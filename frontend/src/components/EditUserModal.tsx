import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { AdminUserRow } from "../api/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Spinner } from "~/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

export function EditUserModal({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: () =>
      api(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, username, is_admin: isAdmin }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User updated");
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update profile and role.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-name">Display name</FieldLabel>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-username">Username</FieldLabel>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="edit-admin"
                checked={isAdmin}
                onCheckedChange={(v) => setIsAdmin(v === true)}
              />
              <div className="grid gap-0.5">
                <FieldLabel htmlFor="edit-admin">Administrator</FieldLabel>
                <FieldDescription>Can manage users and invites.</FieldDescription>
              </div>
            </Field>
            {update.error && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Couldn't update</AlertTitle>
                <AlertDescription>{(update.error as Error).message}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Spinner data-icon="inline-start" />}
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
