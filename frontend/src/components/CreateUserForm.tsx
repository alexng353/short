import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Checkbox } from "~/components/ui/checkbox";
import { Spinner } from "~/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircleIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

export function CreateUserForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, username, password, is_admin: isAdmin }),
      }),
    onSuccess: () => {
      setName("");
      setUsername("");
      setPassword("");
      setIsAdmin(false);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User created");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="new-name">Display name</FieldLabel>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-username">Username</FieldLabel>
            <Input
              id="new-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-password">Password</FieldLabel>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="new-admin"
              checked={isAdmin}
              onCheckedChange={(v) => setIsAdmin(v === true)}
            />
            <FieldLabel htmlFor="new-admin">Make admin</FieldLabel>
          </Field>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner data-icon="inline-start" /> : <UserPlusIcon data-icon="inline-start" />}
            {create.isPending ? "Creating…" : "Create user"}
          </Button>
        </div>

        {create.error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Couldn't create user</AlertTitle>
            <AlertDescription>{(create.error as Error).message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
    </form>
  );
}
