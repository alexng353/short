# Admin Panel + TanStack Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin panel (user CRUD + revoke + password reset), shortlink edit with Cloudflare cache invalidation, and a QR-code modal, while migrating the static-HTML frontend to a TanStack React app that builds into the existing `web/` directory.

**Architecture:** Axum/SQLite backend gains `disabled_at` + `token_version` on users (checked on every authed request via a new extractor), plus admin-only endpoints. Shortlinks gain `updated_at` and a PATCH endpoint that fires a Cloudflare purge async. Frontend is replaced by a TanStack Start app whose Vite build writes to `web/`, leaving axum's `ServeDir` unchanged.

**Tech Stack:** Rust (axum 0.8, sqlx-sqlite, utoipa), reqwest 0.12 (new), TanStack Start (Vite + React + TSX), TanStack Router, TanStack Query, qrcode (npm), Bun for the frontend toolchain.

**Spec:** [`docs/superpowers/specs/2026-05-15-admin-panel-and-tanstack-refactor-design.md`](../specs/2026-05-15-admin-panel-and-tanstack-refactor-design.md)

---

## File Structure

### New backend files

```
migrations/<ts>_admin_panel.sql           — single migration adding the new columns + admin backfill
src/util/cloudflare.rs                    — purge_short() helper (async, fire-and-forget)
src/util/cookies.rs                       — small helpers to build the auth cookie + short-auth companion
src/v1/admin/mod.rs                       — router for /admin
src/v1/admin/users/mod.rs                 — submodule wiring
src/v1/admin/users/list.rs                — GET /admin/users
src/v1/admin/users/create.rs              — POST /admin/users
src/v1/admin/users/update.rs              — PATCH /admin/users/:id
src/v1/admin/users/set_password.rs        — POST /admin/users/:id/password
src/v1/admin/users/revoke.rs              — POST /admin/users/:id/revoke + restore
src/v1/admin/users/delete.rs              — DELETE /admin/users/:id
src/v1/admin/invites/mod.rs               — submodule wiring
src/v1/admin/invites/list.rs              — GET /admin/invites
src/v1/admin/invites/revoke.rs            — DELETE /admin/invites/:id
src/v1/shorturls/update.rs                — PATCH /shorturls/:id
```

### Modified backend files

```
Cargo.toml                                — add reqwest 0.12
src/main.rs                               — SPA fallback for refreshes
src/util/mod.rs                           — re-export cookies + cloudflare modules
src/util/auth.rs                          — JWTClaims gains tv field
src/extractors/users.rs                   — UserId rechecks disabled_at + tv; add AdminUserId
src/v1/mod.rs                             — nest /admin
src/v1/auth/mod.rs                        — already registers logout; no change
src/v1/auth/login.rs                      — set token_version, set short-auth companion cookie
src/v1/auth/signup.rs                     — set token_version, set short-auth companion cookie
src/v1/auth/logout.rs                     — clear short-auth companion cookie
src/v1/auth/change_password.rs            — bump token_version, reissue cookies
src/v1/auth/invite.rs                     — switch to AdminUserId
src/v1/user/update.rs                     — implement PATCH /user/self
src/v1/user/mod.rs                        — register update route
src/v1/shorturls/mod.rs                   — register update route
```

### New frontend files

```
frontend/package.json
frontend/tsconfig.json
frontend/vite.config.ts
frontend/index.html                       — Vite entry HTML
frontend/.gitignore
frontend/src/main.tsx
frontend/src/router.ts
frontend/src/app.css
frontend/src/api/client.ts                — fetch wrapper, 401 → redirect /login
frontend/src/api/queries.ts               — TanStack Query hooks
frontend/src/components/Modal.tsx
frontend/src/components/Table.tsx
frontend/src/components/QRCodeModal.tsx
frontend/src/components/EditShortlinkModal.tsx
frontend/src/components/NewShortlinkForm.tsx
frontend/src/components/EditUserModal.tsx
frontend/src/components/SetPasswordModal.tsx
frontend/src/components/CreateUserForm.tsx
frontend/src/routes/__root.tsx
frontend/src/routes/index.tsx
frontend/src/routes/login.tsx
frontend/src/routes/signup.tsx
frontend/src/routes/_authed.tsx
frontend/src/routes/_authed.dashboard.tsx
frontend/src/routes/_authed.dashboard.change-password.tsx
frontend/src/routes/_authed.admin.tsx
frontend/src/routes/_authed.admin.users.tsx
frontend/src/routes/_authed.admin.invites.tsx
```

### Modified other

```
Dockerfile                                — add Bun build stage that runs `bun run build` into web/
.gitignore                                — ignore frontend/dist, frontend/node_modules
```

### Deletions (final cleanup)

```
web/index.html web/index.css web/index.js
web/login.html web/signup.html web/logout.html
web/change-password.html web/invite.html
web/dashboard/index.html web/dashboard/dashboard.css web/dashboard/dashboard.js
```

These get removed after the corresponding TanStack route ships. The build pipeline writes its own `index.html` and assets into `web/`, replacing the old files.

---

## Phase 1 — Backend foundation (migration, extractor refactor)

Working software at phase end: existing endpoints still work; admin/non-admin distinction enforced; disabled users + bumped tokens get 401.

### Task 1: Add migration

**Files:**
- Create: `migrations/<ts>_admin_panel.sql` (sqlx-cli picks the timestamp)

- [ ] **Step 1: Create the migration**

```bash
cargo sqlx migrate add admin_panel
```

- [ ] **Step 2: Fill the migration**

Open the newly-created `migrations/<ts>_admin_panel.sql` and replace its contents:

```sql
ALTER TABLE users ADD COLUMN disabled_at TIMESTAMP;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shortlinks ADD COLUMN updated_at TIMESTAMP;
UPDATE users SET is_admin = true WHERE username = 'admin';
```

- [ ] **Step 3: Run the migration against the dev DB**

```bash
DATABASE_URL=$(grep DATABASE_URL .env | cut -d= -f2-) cargo sqlx migrate run
```

Expected: `Applied <ts>/migrate admin panel` (or similar).

- [ ] **Step 4: Verify schema in the SQLite file**

```bash
sqlite3 $(grep DATABASE_URL .env | cut -d= -f2- | sed 's|sqlite://||') ".schema users" ".schema shortlinks"
```

Expected: `users` shows `disabled_at TIMESTAMP` and `token_version INTEGER NOT NULL DEFAULT 0`; `shortlinks` shows `updated_at TIMESTAMP`.

- [ ] **Step 5: Commit**

```bash
git add migrations/
git commit -m "feat: migration for disabled_at, token_version, shortlinks.updated_at"
git push
```

### Task 2: Add reqwest dependency

**Files:**
- Modify: `Cargo.toml`

- [ ] **Step 1: Add the dependency**

In `[dependencies]` add this line below the existing `nanoid` entry:

```toml
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json"] }
```

- [ ] **Step 2: Verify it compiles**

```bash
cargo check
```

Expected: PASS (warnings only).

- [ ] **Step 3: Commit**

```bash
git add Cargo.toml Cargo.lock
git commit -m "chore: add reqwest dep for cloudflare purge"
git push
```

### Task 3: Update `JWTClaims` to carry `tv`

**Files:**
- Modify: `src/util/auth.rs`

- [ ] **Step 1: Replace the entire file**

```rust
use chrono::Utc;

use crate::*;

#[derive(Serialize, Deserialize)]
pub struct JWTClaims {
    pub sub: i64,
    pub iat: i64,
    pub exp: i64,
    pub tv: i64,

    pub name: String,
    pub username: String,
}

impl JWTClaims {
    pub fn new(sub: i64, name: String, username: String, tv: i64) -> Self {
        let iat = Utc::now().timestamp();
        let exp = iat + 60 * 60 * 24 * 7;
        Self {
            sub,
            iat,
            exp,
            tv,
            name,
            username,
        }
    }
}
```

- [ ] **Step 2: Check (will fail in callers)**

```bash
cargo check
```

Expected: errors at `JWTClaims::new(...)` calls in `login.rs` and `signup.rs` (and possibly elsewhere). These get fixed in Phase 2.

- [ ] **Step 3: Commit (don't push yet — let phase 2 finish the compile)**

```bash
git add src/util/auth.rs
git commit -m "feat: add tv (token version) to JWTClaims"
```

### Task 4: Update `UserId` extractor with disabled/tv checks; add `AdminUserId`

**Files:**
- Modify: `src/extractors/users.rs`

- [ ] **Step 1: Replace the entire file**

```rust
use crate::*;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};

use cookie::ParseError;
use jwt::VerifyWithKey;
use util::auth::JWTClaims;

/// Authenticated user id. Validates JWT signature + expiry, then re-checks the
/// user row for revocation (disabled_at) and token version (tv) on every
/// request. Cheap (PK lookup) and keeps revoke-everywhere fast.
pub struct UserId(pub i64);

/// Same as UserId but also requires is_admin = true.
pub struct AdminUserId(pub i64);

#[derive(sqlx::FromRow)]
struct AuthRow {
    is_admin: bool,
    disabled_at: Option<chrono::NaiveDateTime>,
    token_version: i64,
}

async fn authed_row(parts: &mut Parts, state: &AppState) -> Result<(i64, AuthRow), AppError> {
    let cookie = parts
        .headers
        .get(header::COOKIE)
        .ok_or(AppError::Error(Errors::Unauthorized))?
        .to_str()
        .map_err(|_| AppError::Error(Errors::Unauthorized))?;

    let cookies = cookie::Cookie::split_parse(cookie)
        .collect::<Result<Vec<_>, ParseError>>()
        .map_err(|_| AppError::Error(Errors::Unauthorized))?;

    let cookie = cookies
        .into_iter()
        .find(|c| c.name() == "short-token" || c.name() == "__Secure-short-token")
        .ok_or(AppError::Error(Errors::Unauthorized))?;

    let claims: JWTClaims = cookie
        .value_trimmed()
        .verify_with_key(&state.jwt_key)
        .map_err(|_| AppError::Error(Errors::Unauthorized))?;

    if claims.exp < chrono::Utc::now().timestamp() {
        return Err(AppError::Error(Errors::JWTExpired));
    }

    let row = sqlx::query_as!(
        AuthRow,
        "SELECT is_admin, disabled_at, token_version FROM users WHERE id = $1",
        claims.sub
    )
    .fetch_optional(&*state.db)
    .await?
    .ok_or(AppError::Error(Errors::Unauthorized))?;

    if row.disabled_at.is_some() {
        return Err(AppError::Error(Errors::Unauthorized));
    }
    if row.token_version != claims.tv {
        return Err(AppError::Error(Errors::Unauthorized));
    }

    Ok((claims.sub, row))
}

impl<S> FromRequestParts<S> for UserId
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, s: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(s);
        let (id, _) = authed_row(parts, &state).await?;
        Ok(UserId(id))
    }
}

impl<S> FromRequestParts<S> for AdminUserId
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, s: &S) -> Result<Self, Self::Rejection> {
        let state = AppState::from_ref(s);
        let (id, row) = authed_row(parts, &state).await?;
        if !row.is_admin {
            return Err(AppError::Error(Errors::Unauthorized));
        }
        Ok(AdminUserId(id))
    }
}
```

- [ ] **Step 2: Check (still broken until Phase 2 — login/signup callers haven't been updated yet)**

```bash
cargo check
```

Expected: same compile errors at `JWTClaims::new(...)` call sites, plus possibly type errors in `invite.rs` (still uses `UserId`). All resolved in Phase 2.

- [ ] **Step 3: Commit**

```bash
git add src/extractors/users.rs
git commit -m "feat: extractor checks disabled_at + token_version; add AdminUserId"
```

---

## Phase 2 — Auth touchups (companion cookie, token_version on issue/bump)

Working software at phase end: `cargo build` succeeds again, login/signup/logout/change-password all set the right cookies, invite endpoint uses `AdminUserId`.

### Task 5: Add cookie helpers

**Files:**
- Create: `src/util/cookies.rs`
- Modify: `src/util/mod.rs`

- [ ] **Step 1: Inspect `src/util/mod.rs` to see how existing helpers are re-exported**

```bash
cat src/util/mod.rs
```

- [ ] **Step 2: Create `src/util/cookies.rs`**

```rust
/// Build the HttpOnly auth cookie holding the JWT.
pub fn auth_cookie(token: &str) -> String {
    if cfg!(debug_assertions) {
        format!("short-token={token}; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax")
    } else {
        format!(
            "__Secure-short-token={token}; Max-Age=604800; Path=/; HttpOnly; SameSite=Strict; Secure"
        )
    }
}

/// Clear the auth cookie (used by logout).
pub fn clear_auth_cookie() -> String {
    if cfg!(debug_assertions) {
        "short-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax".to_string()
    } else {
        "__Secure-short-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict; Secure".to_string()
    }
}

/// Non-HttpOnly companion cookie. Purely a client-side hint for routing —
/// the server still validates the JWT in `short-token`.
pub fn short_auth_companion() -> String {
    if cfg!(debug_assertions) {
        "short-auth=1; Max-Age=604800; Path=/; SameSite=Lax".to_string()
    } else {
        "short-auth=1; Max-Age=604800; Path=/; SameSite=Strict; Secure".to_string()
    }
}

pub fn clear_short_auth_companion() -> String {
    if cfg!(debug_assertions) {
        "short-auth=; Max-Age=0; Path=/; SameSite=Lax".to_string()
    } else {
        "short-auth=; Max-Age=0; Path=/; SameSite=Strict; Secure".to_string()
    }
}
```

- [ ] **Step 3: Re-export from `src/util/mod.rs`**

Append to `src/util/mod.rs`:

```rust
pub mod cookies;
```

- [ ] **Step 4: Check**

```bash
cargo check
```

Expected: same callers still broken (login/signup), but no errors in the new file.

- [ ] **Step 5: Commit**

```bash
git add src/util/cookies.rs src/util/mod.rs
git commit -m "feat: cookie helpers for auth + short-auth companion"
```

### Task 6: Update login to fetch token_version and set both cookies

**Files:**
- Modify: `src/v1/auth/login.rs`

- [ ] **Step 1: Replace the file**

```rust
use crate::{structs::user::User, util::cookies::{auth_cookie, short_auth_companion}, *};
use argon2::{
    password_hash::{Encoding, PasswordHash, PasswordVerifier},
    Argon2,
};
use axum::{
    http::{
        header::{LOCATION, SET_COOKIE},
        StatusCode,
    },
    response::{IntoResponse, Response},
    Form,
};
use jwt::SignWithKey;
use util::auth::JWTClaims;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LoginBody {
    username: String,
    password: String,
}

/// Login
#[utoipa::path(
    post,
    path = "/login",
    responses(
        (status = OK, body = String, description = "JWT token"),
        (status = UNAUTHORIZED, body = String, description = "Incorrect password"),
        (status = NOT_FOUND, body = String, description = "User not found"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn login(
    State(state): State<AppState>,
    Form(body): Form<LoginBody>,
) -> Response {
    info!("User {} logging in", body.username);
    let lowercase_username = body.username.to_lowercase();

    let row = sqlx::query!(
        "SELECT id, name, username, password_hash, is_admin, disabled_at, token_version, created_at
        FROM users WHERE username = $1",
        lowercase_username
    )
    .fetch_optional(&*state.db)
    .await;

    let row = match row {
        Ok(Some(row)) => row,
        Ok(None) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    if row.disabled_at.is_some() {
        return (StatusCode::UNAUTHORIZED, "Account disabled").into_response();
    }

    let argon2 = Argon2::default();
    let hash = match PasswordHash::parse(&row.password_hash, Encoding::B64) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Bad hash").into_response(),
    };

    if argon2
        .verify_password(body.password.as_bytes(), &hash)
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password").into_response();
    }

    let claims = JWTClaims::new(row.id, row.name, row.username, row.token_version);
    let token_str = match claims.sign_with_key(&state.jwt_key) {
        Ok(t) => t,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    (
        StatusCode::SEE_OTHER,
        [
            (SET_COOKIE, auth_cookie(&token_str)),
            (SET_COOKIE, short_auth_companion()),
            (LOCATION, "/dashboard".into()),
        ],
    )
        .into_response()
}
```

- [ ] **Step 2: Check**

```bash
cargo check
```

Expected: `signup.rs` and `change_password.rs` still need updating; `invite.rs` may also error if `UserId` ownership changed (it didn't — just the extractor body did).

- [ ] **Step 3: Commit**

```bash
git add src/v1/auth/login.rs
git commit -m "feat(login): include token_version in JWT; set short-auth companion cookie"
```

### Task 7: Update signup similarly

**Files:**
- Modify: `src/v1/auth/signup.rs`

- [ ] **Step 1: Replace the cookie/claims section**

In `signup.rs`, replace the block that builds claims and sets cookies (lines after the `INSERT INTO users ... RETURNING` query). After:

```rust
    let user = query!(
        "INSERT INTO users (name, username, password_hash)
        VALUES ($1, lower($2), $3)
        RETURNING id, name, username, password_hash, is_admin, token_version, created_at",
        body.name,
        body.username,
        hash
    )
    .fetch_one(&*state.db)
    .await?;
```

(Note: added `token_version` to the RETURNING list — important.)

Then replace the response section:

```rust
    let claims = JWTClaims::new(user.id, user.name, user.username, user.token_version);

    let token_str = claims
        .sign_with_key(&state.jwt_key)
        .context("Failed to sign JWT")?;

    Ok((
        StatusCode::SEE_OTHER,
        [
            (SET_COOKIE, crate::util::cookies::auth_cookie(&token_str)),
            (SET_COOKIE, crate::util::cookies::short_auth_companion()),
            (LOCATION, "/dashboard".into()),
        ],
    )
        .into_response())
```

- [ ] **Step 2: Check**

```bash
cargo check
```

Expected: errors narrow to `change_password.rs`, `invite.rs` (if any), and possibly the seed admin in `main.rs` if anything references `JWTClaims::new` there (it doesn't).

- [ ] **Step 3: Commit**

```bash
git add src/v1/auth/signup.rs
git commit -m "feat(signup): include token_version in JWT; set short-auth companion cookie"
```

### Task 8: Update change-password to bump `token_version` and reissue cookies

**Files:**
- Modify: `src/v1/auth/change_password.rs`

- [ ] **Step 1: Replace the entire file**

```rust
use argon2::{
    password_hash::{rand_core::OsRng, Encoding, PasswordHasher, SaltString},
    Argon2, PasswordHash, PasswordVerifier,
};
use axum::{
    extract::State,
    http::{header::SET_COOKIE, StatusCode},
    response::{IntoResponse, Response},
    Form,
};
use jwt::SignWithKey;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::util::cookies::{auth_cookie, short_auth_companion};
use crate::*;
use crate::{extractors::users::UserId, structs::user::User, util::auth::JWTClaims};

use super::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChangePasswordBody {
    old_password: String,
    new_password: String,
}

#[utoipa::path(
    post,
    path = "/change-password",
    responses(
        (status = OK, description = "Success"),
        (status = INTERNAL_SERVER_ERROR, description = "Internal server error"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn change_password(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Form(body): Form<ChangePasswordBody>,
) -> Response {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let user = match sqlx::query_as!(
        User,
        "SELECT id, name, username, password_hash, is_admin, created_at
        FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await
    {
        Ok(u) => u,
        Err(sqlx::Error::RowNotFound) => {
            return (StatusCode::NOT_FOUND, "User not found").into_response()
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let old_hash =
        PasswordHash::parse(&user.password_hash, Encoding::B64).expect("Password hash parse");
    if argon2
        .verify_password(body.old_password.as_bytes(), &old_hash)
        .is_err()
    {
        return (StatusCode::UNAUTHORIZED, "Incorrect password").into_response();
    }

    let new_hash = argon2
        .hash_password(body.new_password.as_bytes(), &salt)
        .expect("Password hashing failed")
        .to_string();

    let updated = sqlx::query!(
        "UPDATE users
         SET password_hash = $1, token_version = token_version + 1
         WHERE id = $2
         RETURNING token_version",
        new_hash,
        user_id
    )
    .fetch_one(&*state.db)
    .await;

    let new_tv = match updated {
        Ok(r) => r.token_version,
        Err(e) => {
            error!("Failed to update password: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let claims = JWTClaims::new(user.id, user.name, user.username, new_tv);
    let token_str = match claims.sign_with_key(&state.jwt_key) {
        Ok(t) => t,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    (
        StatusCode::OK,
        [
            (SET_COOKIE, auth_cookie(&token_str)),
            (SET_COOKIE, short_auth_companion()),
        ],
    )
        .into_response()
}
```

- [ ] **Step 2: Check**

```bash
cargo check
```

Expected: only `invite.rs` should still be broken (still uses bare `UserId` and the inline `is_admin` query).

- [ ] **Step 3: Commit**

```bash
git add src/v1/auth/change_password.rs
git commit -m "feat(change-password): bump token_version, reissue cookies"
```

### Task 9: Update logout to clear companion cookie

**Files:**
- Modify: `src/v1/auth/logout.rs`

- [ ] **Step 1: Replace the file**

```rust
use axum::{
    http::{
        header::{LOCATION, SET_COOKIE},
        StatusCode,
    },
    response::{IntoResponse, Response},
};

use crate::util::cookies::{clear_auth_cookie, clear_short_auth_companion};

#[utoipa::path(
    post,
    path = "/logout",
    responses(
        (status = SEE_OTHER, description = "Redirect to /"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn logout() -> Response {
    (
        StatusCode::SEE_OTHER,
        [
            (SET_COOKIE, clear_auth_cookie()),
            (SET_COOKIE, clear_short_auth_companion()),
            (LOCATION, "/".into()),
        ],
    )
        .into_response()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v1/auth/logout.rs
git commit -m "feat(logout): clear short-auth companion; redirect to /"
```

### Task 10: Convert invite endpoint to `AdminUserId`

**Files:**
- Modify: `src/v1/auth/invite.rs`

- [ ] **Step 1: Replace the file**

```rust
use axum::{extract::State, http::StatusCode};

use crate::extractors::users::AdminUserId;

use super::*;

/// Create invite (admin only)
#[utoipa::path(
    post,
    path = "/invite",
    responses(
        (status = OK, body = String, description = "Invite code"),
        (status = UNAUTHORIZED, body = String, description = "Not an admin"),
    ),
    tag = super::AUTH_TAG
)]
pub async fn invite(
    State(state): State<AppState>,
    AdminUserId(user_id): AdminUserId,
) -> (StatusCode, String) {
    let code = nanoid::nanoid!(12);
    sqlx::query!(
        "INSERT INTO invite_codes (user_id, code) VALUES ($1, $2)",
        user_id,
        code
    )
    .execute(&*state.db)
    .await
    .expect("Failed to insert invite");

    (StatusCode::OK, code)
}
```

- [ ] **Step 2: Full build check**

```bash
cargo build
```

Expected: PASS. The backend compiles end-to-end on this branch.

- [ ] **Step 3: Manual smoke test**

```bash
cargo run
# In another shell:
curl -i -X POST -d 'username=admin&password=adminadmin' http://localhost:8080/api/v1/auth/login
```

Expected: 303 with two `Set-Cookie` headers (`short-token` HttpOnly, `short-auth=1` not HttpOnly), `Location: /dashboard`.

Copy the `short-token` value, then:

```bash
curl -i -X POST http://localhost:8080/api/v1/auth/invite \
  -H "Cookie: short-token=<TOKEN>"
```

Expected: 200 with a 12-char invite code in the body.

Test admin guard with a non-admin user (signup with an invite, log in, try invite endpoint):
```bash
curl -i -X POST http://localhost:8080/api/v1/auth/invite \
  -H "Cookie: short-token=<NON_ADMIN_TOKEN>"
```

Expected: 401.

- [ ] **Step 4: Commit and push**

```bash
git add src/v1/auth/invite.rs
git commit -m "feat(invite): require AdminUserId"
git push
```

Push everything queued from Phase 1 + Phase 2.

---

## Phase 3 — Admin user CRUD

Working software at phase end: all admin user endpoints work end-to-end, verified via curl / swagger UI.

### Task 11: Scaffold the admin module

**Files:**
- Create: `src/v1/admin/mod.rs`
- Create: `src/v1/admin/users/mod.rs`
- Modify: `src/v1/mod.rs`

- [ ] **Step 1: Create `src/v1/admin/mod.rs`**

```rust
use crate::AppState;

pub(super) use super::*;

pub mod users;
pub mod invites;

pub const ADMIN_TAG: &str = "admin";

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .nest("/users", users::router(state.clone()))
        .nest("/invites", invites::router(state.clone()))
        .with_state(state)
}
```

- [ ] **Step 2: Create `src/v1/admin/users/mod.rs`**

```rust
use crate::AppState;

pub(super) use super::*;

pub mod list;
pub mod create;
pub mod update;
pub mod set_password;
pub mod revoke;
pub mod delete;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(list::list))
        .routes(routes!(create::create))
        .routes(routes!(update::update))
        .routes(routes!(set_password::set_password))
        .routes(routes!(revoke::revoke, revoke::restore))
        .routes(routes!(delete::delete))
        .with_state(state)
}
```

- [ ] **Step 3: Create empty placeholder `src/v1/admin/invites/mod.rs`** (filled in Phase 4):

```rust
use crate::AppState;

pub(super) use super::*;

pub fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new().with_state(state)
}
```

- [ ] **Step 4: Wire into `src/v1/mod.rs`**

Replace the file:

```rust
pub(super) use utoipa_axum::router::OpenApiRouter;
pub(super) use utoipa_axum::routes;

use crate::AppState;

pub mod admin;
pub mod auth;
pub mod shorturls;
pub mod user;

pub fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .with_state(state.clone())
        .nest("/auth", auth::router(state.clone()))
        .nest("/user", user::router(state.clone()))
        .nest("/shorturls", shorturls::router(state.clone()))
        .nest("/admin", admin::router(state.clone()))
}
```

- [ ] **Step 5: Add ADMIN_TAG to `src/main.rs`**

In `src/main.rs`, find `use v1::{ ... }` near the top and add `admin::ADMIN_TAG`. Then in the `#[openapi(tags(...))]` block, add:

```rust
(name = v1::admin::ADMIN_TAG, description = "Admin API endpoints"),
```

- [ ] **Step 6: Check (will fail because handler files don't exist yet)**

```bash
cargo check
```

Expected: errors about missing modules `list`, `create`, etc. We'll create them next.

- [ ] **Step 7: Don't commit yet — wait until handlers exist**

### Task 12: `GET /admin/users` — list

**Files:**
- Create: `src/v1/admin/users/list.rs`

- [ ] **Step 1: Create the file**

```rust
use crate::extractors::users::AdminUserId;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct AdminUserRow {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub is_admin: bool,
    pub disabled_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

#[utoipa::path(
    get,
    path = "",
    responses((status = OK, body = Vec<AdminUserRow>)),
    tag = super::super::ADMIN_TAG
)]
pub async fn list(
    State(state): State<AppState>,
    _: AdminUserId,
) -> Result<Json<Vec<AdminUserRow>>, AppError> {
    let rows = sqlx::query_as!(
        AdminUserRow,
        "SELECT id, name, username, is_admin, disabled_at, created_at
         FROM users ORDER BY id"
    )
    .fetch_all(&*state.db)
    .await?;
    Ok(Json(rows))
}
```

- [ ] **Step 2: Commit (deferred until task 17 — group all CRUD into one phase commit)**

### Task 13: `POST /admin/users` — create

**Files:**
- Create: `src/v1/admin/users/create.rs`

- [ ] **Step 1: Create the file**

```rust
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::http::StatusCode;

use crate::extractors::users::AdminUserId;
use crate::*;

use super::list::AdminUserRow;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct CreateUserBody {
    pub name: String,
    pub username: String,
    pub password: String,
    pub is_admin: bool,
}

#[utoipa::path(
    post,
    path = "",
    responses(
        (status = OK, body = AdminUserRow),
        (status = CONFLICT, body = String, description = "Username taken"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn create(
    State(state): State<AppState>,
    _: AdminUserId,
    Json(body): Json<CreateUserBody>,
) -> Result<(StatusCode, Json<AdminUserRow>), AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .expect("hash")
        .to_string();

    let res = sqlx::query_as!(
        AdminUserRow,
        "INSERT INTO users (name, username, password_hash, is_admin)
         VALUES ($1, lower($2), $3, $4)
         RETURNING id, name, username, is_admin, disabled_at, created_at",
        body.name,
        body.username,
        hash,
        body.is_admin,
    )
    .fetch_one(&*state.db)
    .await;

    match res {
        Ok(row) => Ok((StatusCode::OK, Json(row))),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Status(StatusCode::CONFLICT, "username taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}
```

> Note: this references `AppError::Status(StatusCode, String)`. If the existing error enum doesn't have that variant, add it in the same task. See `src/error.rs`.

- [ ] **Step 2: Check `src/error.rs` for a status-with-message variant**

```bash
cat src/error.rs
```

If there is no variant that takes both a status and a message, add one. For example:

```rust
// inside enum AppError
Status(StatusCode, String),
```

And add the matching `IntoResponse` arm:

```rust
AppError::Status(s, m) => (s, m).into_response(),
```

(Adapt to the file's existing patterns.)

### Task 14: `PATCH /admin/users/:id`

**Files:**
- Create: `src/v1/admin/users/update.rs`

- [ ] **Step 1: Create the file**

```rust
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

use super::list::AdminUserRow;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateUserBody {
    pub name: Option<String>,
    pub username: Option<String>,
    pub is_admin: Option<bool>,
}

#[utoipa::path(
    patch,
    path = "/{id}",
    responses(
        (status = OK, body = AdminUserRow),
        (status = CONFLICT, description = "Username taken or would leave zero admins"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn update(
    State(state): State<AppState>,
    AdminUserId(caller_id): AdminUserId,
    Path(id): Path<i64>,
    Json(body): Json<UpdateUserBody>,
) -> Result<Json<AdminUserRow>, AppError> {
    // Guard: caller cannot demote themselves
    if id == caller_id && matches!(body.is_admin, Some(false)) {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "cannot demote yourself".into(),
        ));
    }

    // Guard: must keep at least one active admin
    if matches!(body.is_admin, Some(false)) {
        let active_admins: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM users
             WHERE is_admin = true AND disabled_at IS NULL AND id != $1",
            id
        )
        .fetch_one(&*state.db)
        .await?;
        if active_admins == 0 {
            return Err(AppError::Status(
                StatusCode::CONFLICT,
                "must keep at least one active admin".into(),
            ));
        }
    }

    let res = sqlx::query_as!(
        AdminUserRow,
        "UPDATE users SET
           name = COALESCE($2, name),
           username = COALESCE(lower($3), username),
           is_admin = COALESCE($4, is_admin)
         WHERE id = $1
         RETURNING id, name, username, is_admin, disabled_at, created_at",
        id,
        body.name,
        body.username,
        body.is_admin,
    )
    .fetch_one(&*state.db)
    .await;

    match res {
        Ok(row) => Ok(Json(row)),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Status(StatusCode::CONFLICT, "username taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}
```

### Task 15: `POST /admin/users/:id/password`

**Files:**
- Create: `src/v1/admin/users/set_password.rs`

- [ ] **Step 1: Create the file**

```rust
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct SetPasswordBody {
    pub password: String,
}

#[utoipa::path(
    post,
    path = "/{id}/password",
    responses((status = NO_CONTENT, description = "Password updated")),
    tag = super::super::ADMIN_TAG
)]
pub async fn set_password(
    State(state): State<AppState>,
    _: AdminUserId,
    Path(id): Path<i64>,
    Json(body): Json<SetPasswordBody>,
) -> Result<StatusCode, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .expect("hash")
        .to_string();

    sqlx::query!(
        "UPDATE users
         SET password_hash = $1, token_version = token_version + 1
         WHERE id = $2",
        hash,
        id
    )
    .execute(&*state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
```

### Task 16: `POST /admin/users/:id/revoke` and `/restore`

**Files:**
- Create: `src/v1/admin/users/revoke.rs`

- [ ] **Step 1: Create the file**

```rust
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[utoipa::path(
    post,
    path = "/{id}/revoke",
    responses(
        (status = NO_CONTENT, description = "Revoked"),
        (status = CONFLICT, description = "Self-revoke or last-admin disallowed"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn revoke(
    State(state): State<AppState>,
    AdminUserId(caller_id): AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    if id == caller_id {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "cannot revoke yourself".into(),
        ));
    }

    let active_admins: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users
         WHERE is_admin = true AND disabled_at IS NULL AND id != $1",
        id
    )
    .fetch_one(&*state.db)
    .await?;
    if active_admins == 0 {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "must keep at least one active admin".into(),
        ));
    }

    sqlx::query!(
        "UPDATE users
         SET disabled_at = datetime('now','localtime'),
             token_version = token_version + 1
         WHERE id = $1",
        id
    )
    .execute(&*state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/{id}/restore",
    responses((status = NO_CONTENT, description = "Restored")),
    tag = super::super::ADMIN_TAG
)]
pub async fn restore(
    State(state): State<AppState>,
    _: AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        "UPDATE users SET disabled_at = NULL WHERE id = $1",
        id
    )
    .execute(&*state.db)
    .await?;
    Ok(StatusCode::NO_CONTENT)
}
```

### Task 17: `DELETE /admin/users/:id`

**Files:**
- Create: `src/v1/admin/users/delete.rs`

- [ ] **Step 1: Create the file**

```rust
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[utoipa::path(
    delete,
    path = "/{id}",
    responses(
        (status = NO_CONTENT, description = "Deleted"),
        (status = CONFLICT, description = "User has shortlinks or is last admin"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn delete(
    State(state): State<AppState>,
    AdminUserId(caller_id): AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    if id == caller_id {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "cannot delete yourself".into(),
        ));
    }

    let owned: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM shortlinks WHERE user_id = $1",
        id
    )
    .fetch_one(&*state.db)
    .await?;
    if owned > 0 {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            format!("user owns {owned} shortlinks; reassign or delete first"),
        ));
    }

    let active_admins: i64 = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users
         WHERE is_admin = true AND disabled_at IS NULL AND id != $1",
        id
    )
    .fetch_one(&*state.db)
    .await?;
    if active_admins == 0 {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "must keep at least one active admin".into(),
        ));
    }

    sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&*state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
```

- [ ] **Step 2: Full build**

```bash
cargo build
```

Expected: PASS.

- [ ] **Step 3: Smoke-test the admin endpoints**

Start the server:

```bash
cargo run
```

Log in as admin (Task 10 procedure), capture the cookie. Then:

```bash
# List
curl -s -H "Cookie: short-token=<T>" http://localhost:8080/api/v1/admin/users | jq

# Create
curl -s -H "Cookie: short-token=<T>" -H "content-type: application/json" \
  -X POST -d '{"name":"Bob","username":"bob","password":"hunter22","is_admin":false}' \
  http://localhost:8080/api/v1/admin/users

# Update
curl -s -H "Cookie: short-token=<T>" -H "content-type: application/json" \
  -X PATCH -d '{"name":"Robert"}' http://localhost:8080/api/v1/admin/users/2

# Revoke
curl -s -i -H "Cookie: short-token=<T>" -X POST http://localhost:8080/api/v1/admin/users/2/revoke

# Restore
curl -s -i -H "Cookie: short-token=<T>" -X POST http://localhost:8080/api/v1/admin/users/2/restore

# Delete (will 409 if bob owns shortlinks)
curl -s -i -H "Cookie: short-token=<T>" -X DELETE http://localhost:8080/api/v1/admin/users/2

# Self-revoke guard
curl -s -i -H "Cookie: short-token=<T>" -X POST http://localhost:8080/api/v1/admin/users/1/revoke
# Expect: 409 "cannot revoke yourself"
```

- [ ] **Step 4: Commit and push**

```bash
git add src/v1/admin src/v1/mod.rs src/main.rs src/error.rs
git commit -m "feat(admin): user CRUD endpoints with last-admin and self-action guards"
git push
```

---

## Phase 4 — Admin invite management

Working software at phase end: `/admin/invites` lists outstanding invites and deletes them.

### Task 18: `GET /admin/invites`

**Files:**
- Create: `src/v1/admin/invites/list.rs`
- Modify: `src/v1/admin/invites/mod.rs`

- [ ] **Step 1: Create `src/v1/admin/invites/list.rs`**

```rust
use crate::extractors::users::AdminUserId;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct InviteRow {
    pub id: i64,
    pub code: String,
    pub used_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub created_by_username: String,
}

#[utoipa::path(
    get,
    path = "",
    responses((status = OK, body = Vec<InviteRow>)),
    tag = super::super::ADMIN_TAG
)]
pub async fn list(
    State(state): State<AppState>,
    _: AdminUserId,
) -> Result<Json<Vec<InviteRow>>, AppError> {
    let rows = sqlx::query_as!(
        InviteRow,
        "SELECT i.id, i.code, i.used_at, i.created_at, u.username AS created_by_username
         FROM invite_codes i
         JOIN users u ON u.id = i.user_id
         WHERE i.used_at IS NULL
         ORDER BY i.created_at DESC"
    )
    .fetch_all(&*state.db)
    .await?;
    Ok(Json(rows))
}
```

### Task 19: `DELETE /admin/invites/:id`

**Files:**
- Create: `src/v1/admin/invites/revoke.rs`

- [ ] **Step 1: Create the file**

```rust
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::AdminUserId;
use crate::*;

#[utoipa::path(
    delete,
    path = "/{id}",
    responses(
        (status = NO_CONTENT, description = "Revoked"),
        (status = CONFLICT, description = "Already used"),
    ),
    tag = super::super::ADMIN_TAG
)]
pub async fn revoke(
    State(state): State<AppState>,
    _: AdminUserId,
    Path(id): Path<i64>,
) -> Result<StatusCode, AppError> {
    let res = sqlx::query!(
        "DELETE FROM invite_codes WHERE id = $1 AND used_at IS NULL",
        id
    )
    .execute(&*state.db)
    .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::Status(
            StatusCode::CONFLICT,
            "invite not found or already used".into(),
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}
```

### Task 20: Wire invites router

**Files:**
- Modify: `src/v1/admin/invites/mod.rs`

- [ ] **Step 1: Replace the file**

```rust
use crate::AppState;

pub(super) use super::*;

pub mod list;
pub mod revoke;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(list::list))
        .routes(routes!(revoke::revoke))
        .with_state(state)
}
```

- [ ] **Step 2: Build + smoke test**

```bash
cargo run
# In another shell:
curl -s -H "Cookie: short-token=<T>" -X POST http://localhost:8080/api/v1/auth/invite
# Returns a code, e.g. "abc123def456"
curl -s -H "Cookie: short-token=<T>" http://localhost:8080/api/v1/admin/invites | jq
# Lists outstanding invites including the new one
# Find its id, then:
curl -s -i -H "Cookie: short-token=<T>" -X DELETE http://localhost:8080/api/v1/admin/invites/<id>
# Expect 204
```

- [ ] **Step 3: Commit and push**

```bash
git add src/v1/admin/invites
git commit -m "feat(admin): invite list + revoke endpoints"
git push
```

---

## Phase 5 — Shortlink edit + Cloudflare purge

Working software at phase end: `PATCH /shorturls/:id` updates `long` and fires CF purge (no-op if env vars unset).

### Task 21: Cloudflare purge helper

**Files:**
- Create: `src/util/cloudflare.rs`
- Modify: `src/util/mod.rs`

- [ ] **Step 1: Create `src/util/cloudflare.rs`**

```rust
use serde_json::json;
use tracing::{error, warn};

/// Fire a Cloudflare purge for /s/<short> on PUBLIC_HOST. Reads creds from env;
/// missing env vars produce a warn-log and a no-op return. Network failures are
/// also log-only — the cache TTL will expire on its own.
pub async fn purge_short(short: &str) {
    let Ok(token) = std::env::var("CF_API_TOKEN") else {
        warn!("CF_API_TOKEN unset; skipping cache purge");
        return;
    };
    let Ok(zone) = std::env::var("CF_ZONE_ID") else {
        warn!("CF_ZONE_ID unset; skipping cache purge");
        return;
    };
    let Ok(host) = std::env::var("PUBLIC_HOST") else {
        warn!("PUBLIC_HOST unset; skipping cache purge");
        return;
    };

    let url = format!(
        "https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache"
    );
    let file = format!("https://{host}/s/{short}");
    let body = json!({ "files": [file] });

    let client = match reqwest::Client::builder().build() {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to build reqwest client: {e}");
            return;
        }
    };

    let res = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await;

    match res {
        Ok(r) if r.status().is_success() => {}
        Ok(r) => error!(
            "Cloudflare purge failed: status={} body={:?}",
            r.status(),
            r.text().await.unwrap_or_default()
        ),
        Err(e) => error!("Cloudflare purge request errored: {e}"),
    }
}
```

- [ ] **Step 2: Re-export from `src/util/mod.rs`**

Append:

```rust
pub mod cloudflare;
```

- [ ] **Step 3: Build**

```bash
cargo build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/util/cloudflare.rs src/util/mod.rs
git commit -m "feat: cloudflare cache purge helper"
```

### Task 22: `PATCH /shorturls/:id`

**Files:**
- Create: `src/v1/shorturls/update.rs`
- Modify: `src/v1/shorturls/mod.rs`

- [ ] **Step 1: Create the handler**

```rust
use axum::{extract::Path, http::StatusCode};

use crate::extractors::users::UserId;
use crate::util::cloudflare::purge_short;
use crate::*;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateBody {
    pub long: String,
}

#[utoipa::path(
    patch,
    path = "/{id}",
    responses(
        (status = NO_CONTENT, description = "Updated"),
        (status = NOT_FOUND, description = "Not found or not owned"),
    ),
    tag = super::SHORTURLS_TAG
)]
pub async fn update(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Path(id): Path<i64>,
    Json(body): Json<UpdateBody>,
) -> Result<StatusCode, AppError> {
    // Check ownership OR admin. Cheap query: pull is_admin once.
    let is_admin: bool = sqlx::query_scalar!(
        "SELECT is_admin FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await?;

    let res = if is_admin {
        sqlx::query!(
            "UPDATE shortlinks
             SET long = $1, updated_at = datetime('now','localtime')
             WHERE id = $2
             RETURNING short",
            body.long,
            id
        )
        .fetch_optional(&*state.db)
        .await?
    } else {
        sqlx::query!(
            "UPDATE shortlinks
             SET long = $1, updated_at = datetime('now','localtime')
             WHERE id = $2 AND user_id = $3
             RETURNING short",
            body.long,
            id,
            user_id
        )
        .fetch_optional(&*state.db)
        .await?
    };

    let Some(row) = res else {
        return Err(AppError::Status(StatusCode::NOT_FOUND, "not found".into()));
    };

    // Fire and forget — cache will expire on its own.
    let short = row.short.clone();
    tokio::spawn(async move { purge_short(&short).await });

    Ok(StatusCode::NO_CONTENT)
}
```

- [ ] **Step 2: Register the route in `src/v1/shorturls/mod.rs`**

Replace the file:

```rust
use crate::AppState;

pub(super) use super::*;

pub const SHORTURLS_TAG: &str = "shorturls";

pub mod myurls;
pub mod new;
pub mod delete;
pub mod update;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(new::new))
        .routes(routes!(myurls::myurls))
        .routes(routes!(delete::delete))
        .routes(routes!(update::update))
        .with_state(state)
}
```

- [ ] **Step 3: Smoke test**

```bash
cargo run
# Create a short URL (existing endpoint), get its id from myurls
# Then PATCH it:
curl -s -i -H "Cookie: short-token=<T>" -H "content-type: application/json" \
  -X PATCH -d '{"long":"https://example.com/updated"}' \
  http://localhost:8080/api/v1/shorturls/<id>
```

Expected: 204. Log should show "CF_API_TOKEN unset; skipping cache purge" in dev. Then `curl http://localhost:8080/s/<short>` should redirect to the new URL.

- [ ] **Step 4: Commit and push**

```bash
git add src/v1/shorturls/update.rs src/v1/shorturls/mod.rs
git commit -m "feat(shorturls): PATCH endpoint with Cloudflare cache purge"
git push
```

---

## Phase 6 — Self PATCH (finish in-flight `update.rs`)

Working software at phase end: users can rename themselves and change their username.

### Task 23: Implement `PATCH /user/self`

**Files:**
- Modify: `src/v1/user/update.rs` (currently empty)
- Modify: `src/v1/user/mod.rs`

- [ ] **Step 1: Fill in `src/v1/user/update.rs`**

```rust
use axum::http::StatusCode;

use crate::extractors::users::UserId;
use crate::*;

use super::get_self::UserResponse;

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UpdateSelfBody {
    pub name: Option<String>,
    pub username: Option<String>,
}

#[utoipa::path(
    patch,
    path = "/self",
    responses(
        (status = OK, body = UserResponse),
        (status = CONFLICT, description = "Username taken"),
    ),
    tag = super::super::auth::AUTH_TAG
)]
pub async fn update_self(
    State(state): State<AppState>,
    UserId(user_id): UserId,
    Json(body): Json<UpdateSelfBody>,
) -> Result<Json<UserResponse>, AppError> {
    let res = sqlx::query_as!(
        UserResponse,
        "UPDATE users SET
           name = COALESCE($2, name),
           username = COALESCE(lower($3), username)
         WHERE id = $1
         RETURNING id, name, username",
        user_id,
        body.name,
        body.username
    )
    .fetch_one(&*state.db)
    .await;

    match res {
        Ok(r) => Ok(Json(r)),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(AppError::Status(StatusCode::CONFLICT, "username taken".into()))
        }
        Err(e) => Err(e.into()),
    }
}
```

- [ ] **Step 2: Register the route**

In `src/v1/user/mod.rs`, replace with:

```rust
use crate::AppState;

pub(super) use super::*;

pub mod get_self;
pub mod update;

pub(super) fn router(state: AppState) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_self::get_self))
        .routes(routes!(update::update_self))
        .with_state(state)
}
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -i -H "Cookie: short-token=<T>" -H "content-type: application/json" \
  -X PATCH -d '{"name":"New Name"}' http://localhost:8080/api/v1/user/self
```

- [ ] **Step 4: Commit and push**

```bash
git add src/v1/user
git commit -m "feat(user): PATCH /user/self for name + username"
git push
```

---

## Phase 7 — Frontend scaffolding (TanStack Start, parity with current public pages)

Working software at phase end: `bun run build` outputs static HTML/JS into `web/`, the site loads via React and shows the existing login/signup/landing pages (still drives the existing JSON API).

> **Engineer note:** If you've never set up TanStack Start, the docs are at <https://tanstack.com/start>. The router is file-based; routes/* paths map to URL paths. `_authed.tsx` is a layout (pathless) and children like `_authed.dashboard.tsx` render inside it.

### Task 24: Scaffold the frontend project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/.gitignore`
- Modify: `.gitignore` (root)

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "short-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.95.0",
    "@tanstack/react-query": "^5.62.0",
    "qrcode": "^1.5.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "^1.95.0",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "verbatimModuleSyntax": false,
    "resolveJsonModule": true,
    "baseUrl": "./src",
    "paths": {
      "~/*": ["./*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
  build: {
    outDir: path.resolve(__dirname, "../web"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/s": "http://localhost:8080",
      "/docs": "http://localhost:8080",
    },
  },
});
```

- [ ] **Step 4: Create `frontend/.gitignore`**

```
node_modules
dist
.vite
```

- [ ] **Step 5: Update root `.gitignore`** (only add lines that don't exist)

```
frontend/node_modules
frontend/dist
web/
!web/.gitkeep
```

> **Caveat:** Adding `web/` to the root `.gitignore` will untrack the currently-checked-in HTML files. They get deleted at the end of the plan anyway, but you may want to delay this gitignore change until Task 38.
>
> Safer order: do **not** ignore `web/` until you delete the old HTML files in Task 38. For now, only ignore `frontend/node_modules` and `frontend/dist`.

- [ ] **Step 6: Create `web/.gitkeep`** so the directory stays in git after the cleanup task:

```bash
touch web/.gitkeep
```

- [ ] **Step 7: Install and check**

```bash
cd frontend && bun install && bun run build
```

(The build will fail because there's no source yet — that's expected. Just verify `bun install` worked.)

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/ .gitignore web/.gitkeep
git commit -m "chore: scaffold frontend with vite + tanstack router"
```

### Task 25: Frontend entry, root route, API client

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/router.ts`
- Create: `frontend/src/app.css`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/queries.ts`
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Short</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Port the existing CSS**

Copy `web/index.css` to `frontend/src/app.css`. (Same content — keep the visual identity.) Same for `web/dashboard/dashboard.css` — append its contents to `frontend/src/app.css` (resolve any conflicting rules in favor of the dashboard styles for table layout).

- [ ] **Step 3: Create `frontend/src/api/client.ts`**

```ts
export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}: ${body}`);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      // Best-effort redirect; router catches this in beforeLoad too.
      window.location.assign("/login");
    }
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Create `frontend/src/api/queries.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export interface SelfUser {
  id: number;
  name: string;
  username: string;
}

export const useSelf = () =>
  useQuery({
    queryKey: ["self"],
    queryFn: () => api<SelfUser>("/user/self"),
    retry: false,
  });

export interface ShortLink {
  id: number;
  user_id: number;
  short: string;
  long: string;
  created_at: string;
  updated_at: string | null;
}

export const useMyUrls = () =>
  useQuery({
    queryKey: ["myurls"],
    queryFn: () => api<ShortLink[]>("/shorturls/myurls"),
  });

export const useDeleteUrl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/shorturls/delete/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myurls"] }),
  });
};

export const useUpdateUrl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, long }: { id: number; long: string }) =>
      api(`/shorturls/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ long }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myurls"] }),
  });
};

export interface AdminUserRow {
  id: number;
  name: string;
  username: string;
  is_admin: boolean;
  disabled_at: string | null;
  created_at: string;
}

export const useAdminUsers = () =>
  useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<AdminUserRow[]>("/admin/users"),
  });

export interface InviteRow {
  id: number;
  code: string;
  used_at: string | null;
  created_at: string;
  created_by_username: string;
}

export const useAdminInvites = () =>
  useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => api<InviteRow[]>("/admin/invites"),
  });
```

- [ ] **Step 5: Create `frontend/src/router.ts`**

```ts
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

> The `routeTree.gen.ts` file is auto-generated by the TanStack Router Vite plugin on first build/dev. Don't create it manually.

- [ ] **Step 6: Create `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./app.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

const root = document.getElementById("root")!;
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 7: Create `frontend/src/routes/__root.tsx`**

```tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => <Outlet />,
});
```

- [ ] **Step 8: Create `frontend/src/routes/index.tsx`**

```tsx
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

function hasAuthCookie() {
  return document.cookie.split("; ").some((c) => c.startsWith("short-auth=1"));
}

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (hasAuthCookie()) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="container">
      <h1>Short</h1>
      <div className="content" style={{ display: "flex", gap: "1em" }}>
        <Link to="/login" className="button">Login</Link>
        <Link to="/signup" className="button">Sign up with invite</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: First successful build**

```bash
cd frontend && bun run build
```

Expected: writes `index.html`, `assets/`, etc. into `../web/`. Plugin generates `frontend/src/routeTree.gen.ts` on the way.

- [ ] **Step 10: Smoke test in a browser**

```bash
# In one terminal:
cargo run
# In another:
cd frontend && bun run dev
```

Open <http://localhost:5173> — should show the new landing page. With no auth cookie, clicking "Login" goes to `/login` (404 from router — we haven't built it yet, that's next).

- [ ] **Step 11: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat(frontend): scaffold tanstack router + landing route"
```

### Task 26: Login and signup routes

**Files:**
- Create: `frontend/src/routes/login.tsx`
- Create: `frontend/src/routes/signup.tsx`

- [ ] **Step 1: Create `frontend/src/routes/login.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="container">
      <div className="header"><h1>Login</h1></div>
      <form
        className="content"
        method="post"
        action="/api/v1/auth/login"
        encType="application/x-www-form-urlencoded"
      >
        <input name="username" placeholder="Username" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
```

> Note: the form posts directly to the API and follows the server's 303 redirect to `/dashboard`. This keeps the existing flow working without JS.

- [ ] **Step 2: Create `frontend/src/routes/signup.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

interface SignupSearch {
  invite_code?: string;
}

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): SignupSearch => ({
    invite_code: typeof s.invite_code === "string" ? s.invite_code : undefined,
  }),
  component: SignupPage,
});

function SignupPage() {
  const { invite_code } = Route.useSearch();
  return (
    <div className="container">
      <div className="header"><h1>Sign up</h1></div>
      <form
        className="content"
        method="post"
        action="/api/v1/auth/signup"
        encType="application/x-www-form-urlencoded"
      >
        <input name="invite_code" defaultValue={invite_code ?? ""} placeholder="Invite code" required />
        <input name="name" placeholder="Name" required />
        <input name="username" placeholder="Username" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">Sign up</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Build and verify**

```bash
cd frontend && bun run build
```

Visit <http://localhost:5173/login> and <http://localhost:5173/signup?invite_code=abc>. Both should render with the existing styles.

- [ ] **Step 4: Commit**

```bash
cd ..
git add frontend/src/routes
git commit -m "feat(frontend): login + signup routes (server-side form posts)"
```

---

## Phase 8 — Authed dashboard, edit modal, QR modal

Working software at phase end: dashboard lists your shortlinks, lets you create/edit/delete, and shows the QR modal.

### Task 27: Authed layout + dashboard list

**Files:**
- Create: `frontend/src/routes/_authed.tsx`
- Create: `frontend/src/routes/_authed.dashboard.tsx`
- Create: `frontend/src/components/NewShortlinkForm.tsx`

- [ ] **Step 1: Create `frontend/src/routes/_authed.tsx`**

```tsx
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { api } from "../api/client";
import { SelfUser } from "../api/queries";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    try {
      const self = await api<SelfUser & { is_admin?: boolean }>("/user/self");
      return { self };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  // self isn't used here, but is in route context for children via Route.useRouteContext()
  return (
    <div>
      <nav className="topnav">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/admin/users">Admin</Link>
        <form method="post" action="/api/v1/auth/logout" style={{ display: "inline" }}>
          <button type="submit">Logout</button>
        </form>
      </nav>
      <Outlet />
    </div>
  );
}
```

> **Note:** `/user/self` doesn't currently return `is_admin`. Update `src/v1/user/get_self.rs` in the same task to include it — see Step 2 below.

- [ ] **Step 2: Update `src/v1/user/get_self.rs` to include `is_admin`**

Replace the file:

```rust
use crate::{extractors::users::UserId, *};

#[derive(Serialize, Deserialize, ToSchema)]
pub struct UserResponse {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub is_admin: bool,
}

#[utoipa::path(
    get,
    path = "/self",
    responses((status = OK, body = UserResponse)),
    tag = super::AUTH_TAG
)]
#[axum::debug_handler]
pub async fn get_self(
    State(state): State<AppState>,
    UserId(user_id): UserId,
) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query_as!(
        UserResponse,
        "SELECT id, name, username, is_admin FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&*state.db)
    .await?;
    Ok(Json(user))
}
```

Also update `SelfUser` type in `frontend/src/api/queries.ts` to include `is_admin: boolean`.

- [ ] **Step 3: Create `frontend/src/components/NewShortlinkForm.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export function NewShortlinkForm() {
  const [long, setLong] = useState("");
  const [short, setShort] = useState("");
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api<string>("/shorturls/new", {
        method: "POST",
        body: JSON.stringify({ long, short: short || null }),
      }),
    onSuccess: () => {
      setLong("");
      setShort("");
      qc.invalidateQueries({ queryKey: ["myurls"] });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      style={{ display: "flex", gap: ".5em", marginBottom: "1em" }}
    >
      <input
        placeholder="Long URL"
        value={long}
        onChange={(e) => setLong(e.target.value)}
        required
      />
      <input
        placeholder="Short (optional)"
        value={short}
        onChange={(e) => setShort(e.target.value)}
      />
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create `frontend/src/routes/_authed.dashboard.tsx`** (just the table — Edit and QR modals are next tasks)

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMyUrls, useDeleteUrl, ShortLink } from "../api/queries";
import { NewShortlinkForm } from "../components/NewShortlinkForm";
import { EditShortlinkModal } from "../components/EditShortlinkModal";
import { QRCodeModal } from "../components/QRCodeModal";

export const Route = createFileRoute("/_authed/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useMyUrls();
  const del = useDeleteUrl();
  const [editing, setEditing] = useState<ShortLink | null>(null);
  const [qrFor, setQrFor] = useState<ShortLink | null>(null);

  return (
    <div className="container">
      <h1>Your short links</h1>
      <NewShortlinkForm />
      {isLoading ? <p>Loading…</p> : (
        <table className="urls-table">
          <thead><tr><th>Short</th><th>Long</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td>/s/{u.short}</td>
                <td>{u.long}</td>
                <td>{u.updated_at ?? u.created_at}</td>
                <td>
                  <button onClick={() => setEditing(u)}>Edit</button>
                  <button onClick={() => setQrFor(u)}>QR</button>
                  <button onClick={() => del.mutate(u.id)} disabled={del.isPending}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <EditShortlinkModal link={editing} onClose={() => setEditing(null)} />}
      {qrFor && <QRCodeModal short={qrFor.short} origin={window.location.origin} onClose={() => setQrFor(null)} />}
    </div>
  );
}
```

- [ ] **Step 5: Don't build yet** — modals don't exist. Next task.

### Task 28: Modal primitive

**Files:**
- Create: `frontend/src/components/Modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useRef, ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ padding: 0, border: "none", borderRadius: 8, maxWidth: 600 }}
    >
      <div style={{ padding: "1.5em" }}>{children}</div>
    </dialog>
  );
}
```

### Task 29: Edit shortlink modal

**Files:**
- Create: `frontend/src/components/EditShortlinkModal.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from "react";
import { Modal } from "./Modal";
import { ShortLink, useUpdateUrl } from "../api/queries";

export function EditShortlinkModal({
  link,
  onClose,
}: {
  link: ShortLink;
  onClose: () => void;
}) {
  const [long, setLong] = useState(link.long);
  const update = useUpdateUrl();

  return (
    <Modal open onClose={onClose}>
      <h2>Edit /s/{link.short}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            { id: link.id, long },
            { onSuccess: onClose }
          );
        }}
      >
        <input
          style={{ width: "100%", marginBottom: "1em" }}
          value={long}
          onChange={(e) => setLong(e.target.value)}
          required
        />
        <div style={{ display: "flex", gap: ".5em", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={update.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
```

### Task 30: QR code modal

**Files:**
- Create: `frontend/src/components/QRCodeModal.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Modal } from "./Modal";

interface Variant {
  key: "light" | "dark" | "light-transparent" | "dark-transparent";
  label: string;
  dark: string;
  light: string;
}

const variants: Variant[] = [
  { key: "light", label: "Light", dark: "#000000", light: "#ffffff" },
  { key: "dark", label: "Dark", dark: "#ffffff", light: "#000000" },
  { key: "light-transparent", label: "Light transparent", dark: "#000000", light: "#00000000" },
  { key: "dark-transparent", label: "Dark transparent", dark: "#ffffff", light: "#00000000" },
];

export function QRCodeModal({
  short,
  origin,
  onClose,
}: {
  short: string;
  origin: string;
  onClose: () => void;
}) {
  const url = `${origin}/s/${short}`;
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    for (const v of variants) {
      const canvas = refs.current[v.key];
      if (!canvas) continue;
      QRCode.toCanvas(canvas, url, {
        width: 256,
        margin: 1,
        color: { dark: v.dark, light: v.light },
      });
    }
  }, [url]);

  const download = (key: Variant["key"]) => {
    const canvas = refs.current[key];
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${short}-${key}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  return (
    <Modal open onClose={onClose}>
      <h2>QR codes for /s/{short}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "1em", alignItems: "center" }}>
        {variants.map((v) => (
          <div key={v.key} style={{ display: "contents" }}>
            <div style={{ background: v.key.includes("transparent") ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 16px 16px" : "transparent", padding: 4 }}>
              <canvas ref={(el) => (refs.current[v.key] = el)} width={128} height={128} style={{ width: 96, height: 96 }} />
            </div>
            <span>{v.label}</span>
            <button onClick={() => download(v.key)}>Download {short}-{v.key}.png</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "1em", textAlign: "right" }}>
        <button onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
cd frontend && bun run build
```

Open dashboard in browser, log in, verify:
- Table loads and shows your existing shortlinks
- "Create" form adds a new row
- Edit modal saves changes
- QR modal renders 4 canvases and downloads correctly-named PNG files
- Delete works

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/
git add src/v1/user/get_self.rs
git commit -m "feat(frontend): authed layout, dashboard, edit + QR modals"
```

### Task 31: Change-password route

**Files:**
- Create: `frontend/src/routes/_authed.dashboard.change-password.tsx`

- [ ] **Step 1: Create the route**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";

export const Route = createFileRoute("/_authed/dashboard/change-password")({
  component: ChangePassword,
});

function ChangePassword() {
  const [oldPw, setOld] = useState("");
  const [newPw, setNew] = useState("");
  const nav = useNavigate();
  const change = useMutation({
    mutationFn: async () => {
      const fd = new URLSearchParams({ old_password: oldPw, new_password: newPw });
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: fd.toString(),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => nav({ to: "/dashboard" }),
  });

  return (
    <div className="container">
      <h1>Change password</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <input type="password" placeholder="Old password" value={oldPw} onChange={(e) => setOld(e.target.value)} required />
        <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNew(e.target.value)} required />
        {change.error && <p style={{ color: "crimson" }}>{(change.error as Error).message}</p>}
        <button type="submit" disabled={change.isPending}>Change</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes
git commit -m "feat(frontend): change-password route"
git push
```

---

## Phase 9 — Admin UI

Working software at phase end: `/admin/users` and `/admin/invites` are fully usable.

### Task 32: Admin layout with guard

**Files:**
- Create: `frontend/src/routes/_authed.admin.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/admin")({
  beforeLoad: ({ context }) => {
    const self = (context as { self: { is_admin: boolean } }).self;
    if (!self.is_admin) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div>
      <nav className="topnav" style={{ background: "#222", color: "#fff" }}>
        <Link to="/admin/users">Users</Link>
        <Link to="/admin/invites">Invites</Link>
      </nav>
      <Outlet />
    </div>
  );
}
```

> Note: this references `context.self` set by the `_authed` route's `beforeLoad`. Make sure `_authed.tsx` returns `{ self }` from its loader (it does, in Task 27).

### Task 33: Set-password modal and Edit-user modal

**Files:**
- Create: `frontend/src/components/SetPasswordModal.tsx`
- Create: `frontend/src/components/EditUserModal.tsx`

- [ ] **Step 1: Create `SetPasswordModal.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "./Modal";
import { api } from "../api/client";

export function SetPasswordModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: () =>
      api(`/admin/users/${userId}/password`, {
        method: "POST",
        body: JSON.stringify({ password: pw }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
  });

  const mismatch = pw !== confirm;
  return (
    <Modal open onClose={onClose}>
      <h2>Set password</h2>
      <form onSubmit={(e) => { e.preventDefault(); set.mutate(); }}>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" required />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm" required />
        {mismatch && confirm && <p style={{ color: "crimson" }}>Passwords don't match</p>}
        <div style={{ display: "flex", gap: ".5em", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={set.isPending || mismatch || !pw}>Set</button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Create `EditUserModal.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "./Modal";
import { api } from "../api/client";
import { AdminUserRow } from "../api/queries";

export function EditUserModal({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: () =>
      api(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, username, is_admin: isAdmin }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose}>
      <h2>Edit user</h2>
      <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
        <label style={{ display: "block", margin: "1em 0" }}>
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin
        </label>
        {update.error && <p style={{ color: "crimson" }}>{(update.error as Error).message}</p>}
        <div style={{ display: "flex", gap: ".5em", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={update.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
```

### Task 34: Create-user form

**Files:**
- Create: `frontend/src/components/CreateUserForm.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export function CreateUserForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, username, password, is_admin: isAdmin }),
      }),
    onSuccess: () => {
      setName(""); setUsername(""); setPassword(""); setIsAdmin(false);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      style={{ display: "flex", gap: ".5em", flexWrap: "wrap", marginBottom: "1em" }}
    >
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <label><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin</label>
      <button type="submit" disabled={create.isPending}>Create user</button>
      {create.error && <p style={{ color: "crimson", width: "100%" }}>{(create.error as Error).message}</p>}
    </form>
  );
}
```

### Task 35: Users page

**Files:**
- Create: `frontend/src/routes/_authed.admin.users.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAdminUsers, AdminUserRow } from "../api/queries";
import { CreateUserForm } from "../components/CreateUserForm";
import { EditUserModal } from "../components/EditUserModal";
import { SetPasswordModal } from "../components/SetPasswordModal";

export const Route = createFileRoute("/_authed/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const { data } = useAdminUsers();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [pwFor, setPwFor] = useState<number | null>(null);
  const qc = useQueryClient();

  const revoke = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const restore = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/restore`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div className="container">
      <h1>Users</h1>
      <CreateUserForm />
      <table className="urls-table">
        <thead><tr><th>Name</th><th>Username</th><th>Admin</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.username}</td>
              <td>{u.is_admin ? "✓" : ""}</td>
              <td>{u.disabled_at ? "Revoked" : "Active"}</td>
              <td>
                <button onClick={() => setEditing(u)}>Edit</button>
                <button onClick={() => setPwFor(u.id)}>Set password</button>
                {u.disabled_at
                  ? <button onClick={() => restore.mutate(u.id)}>Restore</button>
                  : <button onClick={() => { if (confirm(`Revoke ${u.username}?`)) revoke.mutate(u.id); }}>Revoke</button>}
                <button onClick={() => { if (confirm(`Delete ${u.username}? Their shortlinks must be removed first.`)) del.mutate(u.id); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      {pwFor && <SetPasswordModal userId={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  );
}
```

### Task 36: Invites page

**Files:**
- Create: `frontend/src/routes/_authed.admin.invites.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAdminInvites } from "../api/queries";

export const Route = createFileRoute("/_authed/admin/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const { data } = useAdminInvites();
  const qc = useQueryClient();
  const generate = useMutation({
    mutationFn: () => api<string>("/auth/invite", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/admin/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });

  return (
    <div className="container">
      <h1>Invites</h1>
      <button onClick={() => generate.mutate()} disabled={generate.isPending}>
        Generate invite
      </button>
      <table className="urls-table">
        <thead><tr><th>Code</th><th>Created</th><th>Created by</th><th>Actions</th></tr></thead>
        <tbody>
          {data?.map((i) => {
            const link = `${window.location.origin}/signup?invite_code=${i.code}`;
            return (
              <tr key={i.id}>
                <td>{i.code}</td>
                <td>{i.created_at}</td>
                <td>{i.created_by_username}</td>
                <td>
                  <button onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
                  <button onClick={() => revoke.mutate(i.id)}>Revoke</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
cd frontend && bun run build
```

Open `/admin/users` in a browser. Verify:
- Table shows all users
- Create-user form adds a new row
- Revoke / Restore toggle works (also verify the revoked user can't hit any authed endpoint in another tab)
- Set-password modal works
- Self-revoke is blocked server-side (409)
- Invites page lists outstanding codes, copy-link works, revoke works

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat(frontend): admin pages — users and invites"
git push
```

---

## Phase 10 — SPA fallback, Dockerfile, cleanup

Working software at phase end: clean Docker build pipeline; old static HTML deleted; client-side refreshes resolve correctly.

### Task 37: SPA fallback in axum

**Files:**
- Modify: `src/main.rs`

- [ ] **Step 1: Update the router section**

Find the section that builds the router (the call to `.fallback_service(ServeDir::new("web"))`). Replace it with a `ServeDir` that includes a fallback to `index.html`:

```rust
let serve_dir = ServeDir::new("web")
    .not_found_service(tower_http::services::ServeFile::new("web/index.html"));

let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
    .routes(routes!(health_check))
    .routes(routes!(catchall::catchall))
    .with_state(state.clone())
    .nest("/api/v1", v1::router(state.clone()))
    .fallback_service(serve_dir)
    .split_for_parts();
```

> `tower-http` v0.6 supports `ServeFile`. If your `Cargo.toml` doesn't list the `fs` feature on `tower-http`, it should already — verify with `grep tower-http Cargo.toml`.

- [ ] **Step 2: Smoke test**

```bash
cd frontend && bun run build && cd ..
cargo run
# In another shell:
curl -sI http://localhost:8080/admin/users
```

Expected: 200 returning the index.html (TanStack Router will resolve `/admin/users` client-side after hydration).

`/s/<existing-short>` and `/api/v1/...` still hit their handlers because they're explicit routes ahead of the fallback.

- [ ] **Step 3: Commit**

```bash
git add src/main.rs
git commit -m "feat(server): SPA fallback so client-side routes resolve on refresh"
```

### Task 38: Update Dockerfile to build the frontend

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Replace with a multi-stage build**

```dockerfile
FROM oven/bun:1 AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile
COPY frontend ./
RUN bun run build

FROM rust:1.87 AS builder
WORKDIR /app
RUN cargo install sqlx-cli --locked --no-default-features --features sqlite,rustls
COPY . .
# Replace the static web/ from git with the build output from the frontend stage.
RUN rm -rf /app/web
COPY --from=frontend /app/web /app/web
RUN touch build.db
RUN DATABASE_URL=sqlite://build.db cargo sqlx migrate run
RUN DATABASE_URL=sqlite://build.db cargo build --release

FROM rust:1.87
WORKDIR /app
COPY --from=builder /app/target/release/short /app/short
COPY --from=builder /app/web /app/web
CMD [ "/app/short" ]
```

- [ ] **Step 2: Build locally**

```bash
docker build -t short-test .
```

Expected: PASS. Verify by running:

```bash
docker run --rm -e DATABASE_URL=sqlite:///app/build.db -p 8080:8080 short-test
```

Hit `http://localhost:8080/` — should serve the React app.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "ci(docker): add bun frontend build stage"
```

### Task 39: Delete the old static HTML

**Files:**
- Delete: `web/index.html`, `web/index.css`, `web/index.js`, `web/login.html`, `web/signup.html`, `web/logout.html`, `web/change-password.html`, `web/invite.html`, `web/dashboard/index.html`, `web/dashboard/dashboard.css`, `web/dashboard/dashboard.js`

- [ ] **Step 1: Verify the new build covers every old route**

Make sure the frontend covers: `/`, `/login`, `/signup`, `/dashboard`, `/dashboard/change-password`, `/admin/users`, `/admin/invites`. Also check the logout flow (no logout page needed — it's a POST that redirects).

- [ ] **Step 2: Delete**

```bash
rm -f web/index.html web/index.css web/index.js \
      web/login.html web/signup.html web/logout.html \
      web/change-password.html web/invite.html
rm -rf web/dashboard
```

- [ ] **Step 3: Now add `web/` (minus .gitkeep) to root `.gitignore`**

Append to `.gitignore`:

```
web/*
!web/.gitkeep
```

- [ ] **Step 4: Verify locally**

```bash
cd frontend && bun run build && cd ..
cargo run
```

Open every route in a browser and confirm everything still works. Specifically check:
- Refresh on `/admin/users` → still loads
- `/s/<short>` → still redirects
- `/docs` → swagger still loads

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "chore: remove legacy static HTML; gitignore build output"
git push
```

---

## Self-Review (already performed inline)

**1. Spec coverage:**
- Migration: Task 1 ✓
- `disabled_at` / `token_version` extractor logic: Task 4 ✓
- JWT claims with `tv`: Task 3 ✓
- Login/signup/change-password/logout cookie + token_version touchups: Tasks 6–9 ✓
- Companion cookie: Task 5 (helpers) + Tasks 6, 7, 8, 9 (usage) ✓
- `AdminUserId` extractor + invite endpoint conversion: Tasks 4, 10 ✓
- Admin user CRUD + guards: Tasks 11–17 ✓
- Admin invite list/revoke: Tasks 18–20 ✓
- Shortlink PATCH + CF purge: Tasks 21–22 ✓
- Self PATCH: Task 23 ✓
- TanStack frontend scaffold + public routes: Tasks 24–26 ✓
- Authed dashboard, edit modal, QR modal, change-password: Tasks 27–31 ✓
- Admin UI: Tasks 32–36 ✓
- SPA fallback, Docker, cleanup: Tasks 37–39 ✓

**2. Placeholder scan:** No TBDs. The "if there is no variant that takes both a status and a message" instruction in Task 13 is a concrete check with a concrete fix, not a placeholder.

**3. Type consistency checked:** `AdminUserRow` matches across `list.rs`, `create.rs`, `update.rs` (Rust) and `api/queries.ts` (TS). `JWTClaims::new` signature consistent everywhere it's called.

**4. Ambiguity check:** The Dockerfile rewrite in Task 38 assumes `bun.lock` may or may not exist (`bun.lock*` wildcard covers both bun v1.0 `bun.lockb` and v1.1+ `bun.lock`).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-admin-panel-and-tanstack-refactor.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
