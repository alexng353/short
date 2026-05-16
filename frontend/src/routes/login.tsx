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
