import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

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
    onSuccess: () => nav({ to: "/dashboard" }),
  });

  return (
    <div className="container">
      <h1>Change password</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <input type="password" placeholder="Old password" value={oldPw} onChange={(e) => setOld(e.target.value)} required />
        <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNew(e.target.value)} required />
        {change.error && <p style={{ color: "crimson" }}>{(change.error as Error).message}</p>}
        <button type="submit" disabled={change.isPending}>Change</button>
      </form>
    </div>
  );
}
