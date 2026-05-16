import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

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
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      style={{ display: "flex", gap: ".5em", marginBottom: "1em" }}
    >
      <input
        placeholder="Long URL"
        value={long}
        onChange={(e) => setLong(e.target.value)}
        required
      />
      <input
        placeholder="Short (optional)"
        value={short}
        onChange={(e) => setShort(e.target.value)}
      />
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
