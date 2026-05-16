import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
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
import { Spinner } from "~/components/ui/spinner";
import { toast } from "sonner";

export function SetPasswordModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: () =>
      api(`/admin/users/${userId}/password`, {
        method: "POST",
        body: JSON.stringify({ password: pw }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Password set");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const mismatch = pw !== confirm && confirm.length > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
          <DialogDescription>Pick a new password for this user.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mismatch || !pw) return;
            set.mutate();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="set-pw">New password</FieldLabel>
              <Input
                id="set-pw"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
            </Field>
            <Field data-invalid={mismatch || undefined}>
              <FieldLabel htmlFor="set-confirm">Confirm password</FieldLabel>
              <Input
                id="set-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch || undefined}
                required
              />
              {mismatch && <FieldDescription>Passwords don't match.</FieldDescription>}
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={set.isPending || mismatch || !pw}>
              {set.isPending && <Spinner data-icon="inline-start" />}
              {set.isPending ? "Setting…" : "Set password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
