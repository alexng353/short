import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAdminUsers, AdminUserRow } from "../api/queries";
import { CreateUserForm } from "../components/CreateUserForm";
import { EditUserModal } from "../components/EditUserModal";
import { SetPasswordModal } from "../components/SetPasswordModal";

export const Route = createFileRoute("/_authed/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const { data } = useAdminUsers();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [pwFor, setPwFor] = useState<number | null>(null);
  const qc = useQueryClient();

  const revoke = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const restore = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/restore`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div className="container">
      <h1>Users</h1>
      <CreateUserForm />
      <table className="urls-table">
        <thead><tr><th>Name</th><th>Username</th><th>Admin</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {data?.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.username}</td>
              <td>{u.is_admin ? "✓" : ""}</td>
              <td>{u.disabled_at ? "Revoked" : "Active"}</td>
              <td>
                <button onClick={() => setEditing(u)}>Edit</button>
                <button onClick={() => setPwFor(u.id)}>Set password</button>
                {u.disabled_at
                  ? <button onClick={() => restore.mutate(u.id)}>Restore</button>
                  : <button onClick={() => { if (confirm(`Revoke ${u.username}?`)) revoke.mutate(u.id); }}>Revoke</button>}
                <button onClick={() => { if (confirm(`Delete ${u.username}? Their shortlinks must be removed first.`)) del.mutate(u.id); }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      {pwFor && <SetPasswordModal userId={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  );
}
