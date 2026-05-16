import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { ArrowRightIcon, LinkIcon, QrCodeIcon, ZapIcon } from "lucide-react";

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
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_50%_at_50%_0%,oklch(0.3_0.05_265/_0.45),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(1_0_0/_0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/_0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <LinkIcon className="size-4" />
          </span>
          short
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">
              Sign up
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-24 pb-16 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Invite-only · self-hosted
        </div>
        <h1 className="text-balance bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
          Short links,<br />without the bloat.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
          A tiny URL shortener you actually own. Make links, share QR codes, manage members — that's it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">
              Get started
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/signup">Have an invite?</Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <Feature icon={<ZapIcon className="size-4" />} title="Fast" body="Single Rust binary. Redirects in microseconds." />
          <Feature icon={<QrCodeIcon className="size-4" />} title="QR codes" body="Light, dark, transparent — download in one click." />
          <Feature icon={<LinkIcon className="size-4" />} title="Custom slugs" body="Pick your own /short or let us generate one." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-left backdrop-blur">
      <div className="mb-2 inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{body}</div>
    </div>
  );
}
