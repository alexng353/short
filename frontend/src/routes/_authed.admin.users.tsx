import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAdminUsers, AdminUserRow } from "../api/queries";
import { CreateUserForm } from "../components/CreateUserForm";
import { EditUserModal } from "../components/EditUserModal";
import { SetPasswordModal } from "../components/SetPasswordModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Spinner } from "~/components/ui/spinner";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "sonner";
import {
  EllipsisIcon,
  KeyRoundIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  UserXIcon,
  UsersIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authed/admin/users")({
  component: UsersPage,
});

type Confirm =
  | { kind: "revoke"; user: AdminUserRow }
  | { kind: "delete"; user: AdminUserRow };

function UsersPage() {
  const { data, isLoading } = useAdminUsers();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [pwFor, setPwFor] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Confirm | null>(null);
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const revoke = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.success("User revoked");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const restore = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.success("User restored");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: number) => api(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("User deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create user</CardTitle>
          <CardDescription>Add a new account directly without an invite.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {data ? `${data.length} user${data.length === 1 ? "" : "s"}` : " "}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner /> Loading…
            </div>
          ) : !data || data.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>No users</EmptyTitle>
                <EmptyDescription>Add one with the form above.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">@{u.username}</TableCell>
                    <TableCell>
                      {u.is_admin ? <Badge>Admin</Badge> : <Badge variant="secondary">Member</Badge>}
                    </TableCell>
                    <TableCell>
                      {u.disabled_at ? (
                        <Badge variant="outline" className="text-destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Actions">
                            <EllipsisIcon />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onSelect={() => setEditing(u)}>
                              <PencilIcon />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setPwFor(u.id)}>
                              <KeyRoundIcon />
                              Set password
                            </DropdownMenuItem>
                            {u.disabled_at ? (
                              <DropdownMenuItem onSelect={() => restore.mutate(u.id)}>
                                <RotateCcwIcon />
                                Restore
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setConfirming({ kind: "revoke", user: u })}
                              >
                                <UserXIcon />
                                Revoke
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setConfirming({ kind: "delete", user: u })}
                          >
                            <Trash2Icon />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      {pwFor && <SetPasswordModal userId={pwFor} onClose={() => setPwFor(null)} />}

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming?.kind === "revoke" ? "Revoke user?" : "Delete user?"}
            </DialogTitle>
            <DialogDescription>
              {confirming?.kind === "revoke"
                ? `${confirming.user.username} will be unable to log in until restored.`
                : confirming
                ? `${confirming.user.username} will be permanently deleted. Their shortlinks must be removed first.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirming) return;
                if (confirming.kind === "revoke") revoke.mutate(confirming.user.id);
                else del.mutate(confirming.user.id);
                setConfirming(null);
              }}
            >
              {confirming?.kind === "revoke" ? "Revoke" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
