import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ShieldIcon, UsersIcon, TicketIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_authed/admin")({
  beforeLoad: ({ context }) => {
    const self = (context as { self: { is_admin: boolean } }).self;
    if (!self.is_admin) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
          <ShieldIcon className="size-4" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      </div>

      <div className="mb-6 flex items-center gap-1 border-b border-border/60">
        <SubTab to="/admin/users" icon={<UsersIcon className="size-3.5" />} active={path.startsWith("/admin/users")}>
          Users
        </SubTab>
        <SubTab to="/admin/invites" icon={<TicketIcon className="size-3.5" />} active={path.startsWith("/admin/invites")}>
          Invites
        </SubTab>
      </div>

      <Outlet />
    </div>
  );
}

function SubTab({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
