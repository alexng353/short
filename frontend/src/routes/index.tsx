import { createFileRoute, Link } from "@tanstack/react-router";

function hasAuthCookie() {
  return document.cookie.split("; ").some((c) => c.startsWith("short-auth=1"));
}

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // /dashboard exists in Phase 8; navigate imperatively to avoid strict route-type error
    if (hasAuthCookie()) window.location.assign("/dashboard");
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
