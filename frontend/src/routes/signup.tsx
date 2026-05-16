import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { LinkIcon } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_40%_at_50%_0%,oklch(0.3_0.05_265/_0.4),transparent_70%)]" />

      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight text-foreground/90 hover:text-foreground">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <LinkIcon className="size-4" />
          </span>
          short
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>You'll need an invite code to get in.</CardDescription>
          </CardHeader>
          <form method="post" action="/api/v1/auth/signup" encType="application/x-www-form-urlencoded">
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="invite_code">Invite code</FieldLabel>
                  <Input id="invite_code" name="invite_code" defaultValue={invite_code ?? ""} required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Display name</FieldLabel>
                  <Input id="name" name="name" autoComplete="name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input id="username" name="username" autoComplete="username" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input id="password" name="password" type="password" autoComplete="new-password" required />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full">Create account</Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
