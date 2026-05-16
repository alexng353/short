import { useState } from "react";
import { ShortLink, useUpdateUrl } from "../api/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "sonner";

export function EditShortlinkModal({
  link,
  onClose,
}: {
  link: ShortLink;
  onClose: () => void;
}) {
  const [long, setLong] = useState(link.long);
  const update = useUpdateUrl();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit /s/{link.short}</DialogTitle>
          <DialogDescription>Update where this short link points.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { id: link.id, long },
              {
                onSuccess: () => {
                  toast.success("Link updated");
                  onClose();
                },
                onError: (err) => toast.error((err as Error).message),
              },
            );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="long">Destination URL</FieldLabel>
              <Input
                id="long"
                type="url"
                value={long}
                onChange={(e) => setLong(e.target.value)}
                required
              />
            </Field>
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
