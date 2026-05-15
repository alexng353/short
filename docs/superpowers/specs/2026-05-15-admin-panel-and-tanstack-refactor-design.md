# Admin Panel + TanStack Frontend Refactor — Design

**Date:** 2026-05-15
**Status:** Approved (pending spec review)

## Goals

Add an admin panel for user management (revoke without delete, set password,
CRUD), shortlink editing with Cloudflare cache invalidation, and a QR-code
modal — and migrate the static-HTML frontend to a TanStack React app that
builds to the existing `web/` directory.

## Architecture & build pipeline

- **Frontend:** TanStack Start (React + TSX) in `/frontend/`. Uses TanStack
  Router for routing and guards, TanStack Query for server state, Vite under
  the hood. Public routes (`/`, `/login`, `/signup`) are prerendered to static
  HTML; authed routes ship as SPA shells.
- **Build output:** `frontend/` build config writes to `../web/`, the
  directory axum's `ServeDir` already serves. Existing static `*.html` files
  in `web/` are deleted as routes migrate.
- **Dockerfile:** new first stage runs `bun install && bun run build` in
  `frontend/`; the Rust stage copies the populated `web/` from it.
- **SPA fallback:** explicit routes (`/api/*`, `/s/:short`, `/.well-known/*`,
  `/docs/*`) keep their current handlers and take precedence. After those,
  axum falls back to `ServeDir::new("web")` (existing) with a final fallback
  that serves `web/index.html` so client-side routes resolve on refresh.
  Prerendered HTML files in `web/` are served directly by `ServeDir`.
- **Auth-cookie root redirect:** the `/` route's `beforeLoad` checks for a
  non-HttpOnly companion cookie (`short-auth=1`) and redirects to `/dashboard`
  if present. The real JWT cookie stays HttpOnly.

## Data model

One migration: `sqlx migrate add admin_panel`.

```sql
ALTER TABLE users ADD COLUMN disabled_at TIMESTAMP;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shortlinks ADD COLUMN updated_at TIMESTAMP;
UPDATE users SET is_admin = true WHERE username = 'admin';
```

- `users.disabled_at` — null = active, non-null = revoked (also acts as
  audit timestamp).
- `users.token_version` — embedded in JWT claims; bumping invalidates every
  outstanding token for that user.
- `shortlinks.updated_at` — null until first edit, then `datetime('now','localtime')`.
- The `UPDATE users` line backfills `is_admin` on legacy deployments whose
  seeded admin row was created before `main.rs` started inserting with
  `is_admin = true`. Idempotent on fresh DBs.

## Backend changes

### Extractors

- `UserId(i64)` — gains a per-request `SELECT is_admin, disabled_at,
  token_version FROM users WHERE id = ?`. Rejects with 401 when
  `disabled_at IS NOT NULL` or `claims.tv != row.token_version`.
- New `AdminUserId(i64)` — same as `UserId` plus `is_admin = true`. Replaces
  the inline `is_admin` check in `invite.rs`.

### JWT claims

`JWTClaims` gains `tv: i64`. `JWTClaims::new` takes it from the user row on
issuance. Login, signup, and password-change all read the current
`token_version` before signing.

### Admin endpoints (new module `src/v1/admin/`)

All require `AdminUserId`.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/v1/admin/users` | — | id, name, username, is_admin, disabled_at, created_at |
| POST | `/api/v1/admin/users` | `{ name, username, password, is_admin }` | hashes pw, inserts |
| PATCH | `/api/v1/admin/users/:id` | `{ name?, username?, is_admin? }` | 409 on username conflict |
| POST | `/api/v1/admin/users/:id/password` | `{ password }` | re-hash, bump `token_version` |
| POST | `/api/v1/admin/users/:id/revoke` | — | sets `disabled_at`, bumps `token_version` |
| POST | `/api/v1/admin/users/:id/restore` | — | nulls `disabled_at` |
| DELETE | `/api/v1/admin/users/:id` | — | 409 if user owns any shortlinks |
| GET | `/api/v1/admin/invites` | — | outstanding invites (`used_at IS NULL`), joined to creator username |
| DELETE | `/api/v1/admin/invites/:id` | — | only when `used_at IS NULL` |

**Guard rails on admin actions:**

- Reject revoke / delete / demote when target id == caller id.
- Reject any operation that would leave zero `is_admin = true AND
  disabled_at IS NULL` users (`SELECT COUNT(*)` precheck).

### Existing endpoints touched

- `POST /api/v1/auth/invite` — switches from `UserId` + inline check to
  `AdminUserId`. No other change.
- `POST /api/v1/auth/change-password` — bumps `token_version`, reissues the
  cookie so caller stays logged in.
- `POST /api/v1/auth/login` and `signup` — read `token_version` from the user
  row, pass to `JWTClaims::new`. Also set the `short-auth=1` companion cookie.
- `POST /api/v1/auth/logout` — clears both cookies with `Max-Age=0`.
- `PATCH /api/v1/user/self` — `{ name?, username? }`. Owner of the empty
  `src/v1/user/update.rs`. 409 on conflict.

### Shortlink edit + Cloudflare purge

- `PATCH /api/v1/shorturls/:id { long }` — verifies caller owns the row (or
  is admin), updates `long` and `updated_at`. Fires CF purge via
  `tokio::spawn` (fire-and-forget; errors log-only).
- New `src/util/cloudflare.rs`:

  ```rust
  pub async fn purge_short(short: &str) {
      // Reads CF_API_TOKEN, CF_ZONE_ID, PUBLIC_HOST env.
      // If any missing: warn-log and return.
      // POST https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache
      //   with { "files": ["https://{host}/s/{short}"] }
      // Log on non-2xx.
  }
  ```

- New dependency: `reqwest = { version = "0.12", default-features = false,
  features = ["rustls-tls", "json"] }`.

## Frontend route tree

```
/                        public, prerendered  — landing; beforeLoad redirects to /dashboard if short-auth cookie present
/login                   public, prerendered
/signup                  public, prerendered  — reads ?invite_code= from URL
/dashboard               authed               — own shortlinks; New / Edit / Delete / QR row actions
  /change-password       authed
/admin                   authed + admin       — redirects to /admin/users
  /users                 authed + admin
  /invites               authed + admin
/logout                  action route         — POSTs to API, navigates to /
```

### Layout & guards

- `_authed` parent route loader hits `GET /api/v1/user/self`; 401 → `redirect({ to: '/login' })`. Loaded user object is stashed in route context for children.
- `_admin` parent: reads context, redirects to `/dashboard` if not admin.
- `/` root: reads `document.cookie` for `short-auth=1`; redirects if present.

### File layout

```
frontend/
  src/
    routes/
      __root.tsx
      index.tsx
      login.tsx
      signup.tsx
      _authed.tsx
      _authed.dashboard.tsx
      _authed.dashboard.change-password.tsx
      _authed.admin.tsx
      _authed.admin.users.tsx
      _authed.admin.invites.tsx
    components/
      Modal.tsx
      Table.tsx
      QRCodeModal.tsx
      EditShortlinkModal.tsx
      EditUserModal.tsx
      SetPasswordModal.tsx
    api/
      client.ts         (fetch wrapper; 401 → redirect /login)
      queries.ts        (TanStack Query hooks)
    app.css             (port of current web/index.css)
  vite.config.ts        (TanStack Start plugin; outDir = ../web)
  package.json
  tsconfig.json
```

- Styling: plain CSS, port of current `web/index.css`. No Tailwind.
- Modals: custom `<dialog>`-based with focus trap; no Radix.
- QR generation: `qrcode` npm package, four `<canvas>` renders, per-canvas
  `toBlob` + invisible `<a download>` click.

## Specific flows

### Revoke / restore

- User row in `/admin/users` shows a status pill (Active / Revoked) and a
  toggle button. Revoke prompts a confirm dialog.
- `POST /admin/users/:id/revoke` → set `disabled_at`, bump `token_version`.
  Target's next API call hits the extractor's `disabled_at` check → 401 →
  client redirects to `/login`.
- `POST /admin/users/:id/restore` → null `disabled_at`. Does **not** bump
  `token_version` — old tokens stay invalid, user re-logs in.

### Admin sets password

- Modal with new password + confirm field. `POST /admin/users/:id/password`
  re-hashes and bumps `token_version`. Target is booted from active
  sessions on next request.

### Self change-password

- Existing flow, modified to bump `token_version` and reissue the cookie so
  the caller stays logged in; other devices are logged out on next request.

### Edit shortlink

- Row "Edit" button opens modal with `long` prefilled.
- `PATCH /shorturls/:id { long }` updates `long` + `updated_at`. Server
  `tokio::spawn`s CF purge for `https://{PUBLIC_HOST}/s/{short}`.
- Frontend invalidates the shortlinks query; table redraws.

### QR codes modal

- "QR" button opens a modal with four canvases and a download button each.
- File names: `<short>-light.png`, `<short>-dark.png`,
  `<short>-light-transparent.png`, `<short>-dark-transparent.png`.
- Color options passed to `qrcode`:
  - light: `{ dark: '#000', light: '#fff' }`
  - dark: `{ dark: '#fff', light: '#000' }`
  - light-transparent: `{ dark: '#000', light: '#0000' }`
  - dark-transparent: `{ dark: '#fff', light: '#0000' }`

### Auth companion cookie

- Login / signup / password-change handlers set `short-auth=1; Path=/;
  Max-Age=86400; SameSite=Strict` (release adds `Secure`). Logout clears
  with `Max-Age=0`. The flag is advisory — server still validates the JWT.

### Invite list

- `/admin/invites` lists outstanding invites with copy-link and revoke
  buttons, plus a "Generate invite" button. Link is
  `${origin}/signup?invite_code=…`. Replaces standalone `web/invite.html`.

## Environment

New env vars (all optional; missing means feature disabled with a warn-log):

- `CF_API_TOKEN`
- `CF_ZONE_ID`
- `PUBLIC_HOST` — used when constructing the URL passed to CF purge

## Out of scope

- Per-session revocation (only "log out everywhere" via `token_version` bump).
- Email-based password reset (SMTP infra).
- Audit log table for admin actions.
- Cascade / transfer behavior on user delete — server rejects delete when
  the user owns shortlinks.
- Custom QR code logos or styles beyond the four color variants.
