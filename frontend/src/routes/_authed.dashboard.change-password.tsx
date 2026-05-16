import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ArrowLeftIcon, AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/dashboard/change-password")({
  component: ChangePassword,
});

function ChangePassword() {
  const [oldPw, setOld] = useState("");
  const [newPw, setNew] = useState("");
  const nav = useNavigate();
  const change = useMutation({
    mutationFn: async () => {
      const fd = new URLSearchParams({ old_password: oldPw, new_password: newPw });
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: fd.toString(),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("Password changed");
      nav({ to: "/dashboard" });
    },
  });

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/dashboard">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to links
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Pick something you'll actually remember.</CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="old_password">Current password</FieldLabel>
                <Input
                  id="old_password"
                  type="password"
                  autoComplete="current-password"
                  value={oldPw}
                  onChange={(e) => setOld(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new_password">New password</FieldLabel>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNew(e.target.value)}
                  required
                />
              </Field>
              {change.error && (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>Couldn't change password</AlertTitle>
                  <AlertDescription>{(change.error as Error).message}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={change.isPending} className="w-full">
              {change.isPending && <Spinner data-icon="inline-start" />}
              {change.isPending ? "Changing…" : "Change password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
