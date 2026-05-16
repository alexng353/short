import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { api } from "../api/client";
import { SelfUser } from "../api/queries";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    try {
      const self = await api<SelfUser>("/user/self");
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
        <a href="/admin/users">Admin</a>
        <form method="post" action="/api/v1/auth/logout" style={{ display: "inline" }}>
          <button type="submit">Logout</button>
        </form>
      </nav>
      <Outlet />
    </div>
  );
}
