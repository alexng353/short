import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup } from "~/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group";
import { Spinner } from "~/components/ui/spinner";
import { LinkIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

export function NewShortlinkForm() {
  const [long, setLong] = useState("");
  const [short, setShort] = useState("");
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api<string>("/shorturls/new", {
        method: "POST",
        body: JSON.stringify({ long, short: short || null }),
      }),
    onSuccess: () => {
      setLong("");
      setShort("");
      qc.invalidateQueries({ queryKey: ["myurls"] });
      toast.success("Short link created");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,18rem)_auto]">
          <Field>
            <InputGroup>
              <InputGroupAddon>
                <LinkIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="https://example.com/long-url"
                value={long}
                onChange={(e) => setLong(e.target.value)}
                required
                type="url"
              />
            </InputGroup>
          </Field>
          <Field>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>/s/</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder="custom-slug (optional)"
                value={short}
                onChange={(e) => setShort(e.target.value)}
              />
            </InputGroup>
          </Field>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
