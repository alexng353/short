import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { api } from "../api/client";
import { SelfUser } from "../api/queries";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { LinkIcon, KeyRoundIcon, LogOutIcon, ChevronDownIcon, ShieldIcon } from "lucide-react";
import { cn } from "~/lib/utils";

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
  const path = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (prefix: string) =>
    path === prefix || path.startsWith(prefix + "/");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <LinkIcon className="size-3.5" />
              </span>
              short
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/dashboard" active={isActive("/dashboard")}>Links</NavLink>
              {self.is_admin && (
                <NavLink to="/admin/users" active={isActive("/admin")}>
                  <ShieldIcon className="size-3.5" />
                  Admin
                </NavLink>
              )}
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">
                  {self.name.slice(0, 1)}
                </span>
                <span className="hidden sm:inline">{self.name}</span>
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-medium">{self.name}</div>
                <div className="text-xs font-normal text-muted-foreground">@{self.username}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/change-password">
                    <KeyRoundIcon />
                    Change password
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <form method="post" action="/api/v1/auth/logout">
                <DropdownMenuItem asChild variant="destructive">
                  <button type="submit" className="w-full">
                    <LogOutIcon />
                    Log out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
