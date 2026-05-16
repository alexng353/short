import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "./Modal";
import { api } from "../api/client";

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
      onClose();
    },
  });

  const mismatch = pw !== confirm;
  return (
    <Modal open onClose={onClose}>
      <h2>Set password</h2>
      <form onSubmit={(e) => { e.preventDefault(); set.mutate(); }}>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" required />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm" required />
        {mismatch && confirm && <p style={{ color: "crimson" }}>Passwords don&apos;t match</p>}
        <div style={{ display: "flex", gap: ".5em", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={set.isPending || mismatch || !pw}>Set</button>
        </div>
      </form>
    </Modal>
  );
}
