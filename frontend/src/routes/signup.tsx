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
