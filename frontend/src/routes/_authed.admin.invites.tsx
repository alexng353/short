import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAdminInvites } from "../api/queries";

export const Route = createFileRoute("/_authed/admin/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const { data } = useAdminInvites();
  const qc = useQueryClient();
  const generate = useMutation({
    mutationFn: () => api<string>("/auth/invite", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/admin/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });

  return (
    <div className="container">
      <h1>Invites</h1>
      <button onClick={() => generate.mutate()} disabled={generate.isPending}>
        Generate invite
      </button>
      <table className="urls-table">
        <thead><tr><th>Code</th><th>Created</th><th>Created by</th><th>Actions</th></tr></thead>
        <tbody>
          {data?.map((i) => {
            const link = `${window.location.origin}/signup?invite_code=${i.code}`;
            return (
              <tr key={i.id}>
                <td>{i.code}</td>
                <td>{i.created_at}</td>
                <td>{i.created_by_username}</td>
                <td>
                  <button onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
                  <button onClick={() => revoke.mutate(i.id)}>Revoke</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
