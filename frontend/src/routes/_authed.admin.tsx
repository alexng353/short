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
