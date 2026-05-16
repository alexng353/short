import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMyUrls, useDeleteUrl, ShortLink } from "../api/queries";
import { NewShortlinkForm } from "../components/NewShortlinkForm";
import { EditShortlinkModal } from "../components/EditShortlinkModal";
import { QRCodeModal } from "../components/QRCodeModal";

export const Route = createFileRoute("/_authed/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useMyUrls();
  const del = useDeleteUrl();
  const [editing, setEditing] = useState<ShortLink | null>(null);
  const [qrFor, setQrFor] = useState<ShortLink | null>(null);

  return (
    <div className="container">
      <h1>Your short links</h1>
      <NewShortlinkForm />
      {isLoading ? <p>Loading…</p> : (
        <table className="urls-table">
          <thead><tr><th>Short</th><th>Long</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td>/s/{u.short}</td>
                <td>{u.long}</td>
                <td>{u.updated_at ?? u.created_at}</td>
                <td>
                  <button onClick={() => setEditing(u)}>Edit</button>
                  <button onClick={() => setQrFor(u)}>QR</button>
                  <button onClick={() => del.mutate(u.id)} disabled={del.isPending}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <EditShortlinkModal link={editing} onClose={() => setEditing(null)} />}
      {qrFor && <QRCodeModal short={qrFor.short} origin={window.location.origin} onClose={() => setQrFor(null)} />}
    </div>
  );
}
