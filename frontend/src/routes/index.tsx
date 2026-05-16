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
