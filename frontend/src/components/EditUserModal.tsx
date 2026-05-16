import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "./Modal";
import { api } from "../api/client";
import { AdminUserRow } from "../api/queries";

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
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose}>
      <h2>Edit user</h2>
      <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
        <label style={{ display: "block", margin: "1em 0" }}>
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin
        </label>
        {update.error && <p style={{ color: "crimson" }}>{(update.error as Error).message}</p>}
        <div style={{ display: "flex", gap: ".5em", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={update.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
