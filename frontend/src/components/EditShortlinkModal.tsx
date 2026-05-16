import { useState } from "react";
import { Modal } from "./Modal";
import { ShortLink, useUpdateUrl } from "../api/queries";

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
    <Modal open onClose={onClose}>
      <h2>Edit /s/{link.short}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            { id: link.id, long },
            { onSuccess: onClose }
          );
        }}
      >
        <input
          style={{ width: "100%", marginBottom: "1em" }}
          value={long}
          onChange={(e) => setLong(e.target.value)}
          required
        />
        <div style={{ display: "flex", gap: ".5em", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={update.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
