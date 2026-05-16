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
  const { self } = Route.useRouteContext();
  return (
    <div>
      <nav className="topnav">
        <Link to="/dashboard">Dashboard</Link>
        {self.is_admin && <Link to="/admin/users">Admin</Link>}
        <form method="post" action="/api/v1/auth/logout" style={{ display: "inline" }}>
          <button type="submit">Logout</button>
        </form>
      </nav>
      <Outlet />
    </div>
  );
}
