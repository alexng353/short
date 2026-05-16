import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export function CreateUserForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, username, password, is_admin: isAdmin }),
      }),
    onSuccess: () => {
      setName(""); setUsername(""); setPassword(""); setIsAdmin(false);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      style={{ display: "flex", gap: ".5em", flexWrap: "wrap", marginBottom: "1em" }}
    >
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <label><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin</label>
      <button type="submit" disabled={create.isPending}>Create user</button>
      {create.error && <p style={{ color: "crimson", width: "100%" }}>{(create.error as Error).message}</p>}
    </form>
  );
}
