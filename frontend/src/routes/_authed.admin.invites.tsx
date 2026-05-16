import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAdminInvites } from "../api/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Spinner } from "~/components/ui/spinner";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { toast } from "sonner";
import { CopyIcon, PlusIcon, TicketIcon, Trash2Icon } from "lucide-react";

export const Route = createFileRoute("/_authed/admin/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const { data, isLoading } = useAdminInvites();
  const qc = useQueryClient();
  const generate = useMutation({
    mutationFn: () => api<string>("/auth/invite", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invites"] });
      toast.success("Invite generated");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api(`/admin/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invites"] });
      toast.success("Invite revoked");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Invites</CardTitle>
          <CardDescription>
            Generate signup codes. Each one is good for a single account.
          </CardDescription>
        </div>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          Generate invite
        </Button>
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
                <TicketIcon />
              </EmptyMedia>
              <EmptyTitle>No invites yet</EmptyTitle>
              <EmptyDescription>Generate one to share with a teammate.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent />
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden md:table-cell">Created by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((i) => {
                const link = `${origin}/signup?invite_code=${i.code}`;
                const used = !!i.used_at;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.code}</TableCell>
                    <TableCell>
                      {used ? <Badge variant="secondary">Used</Badge> : <Badge variant="outline">Available</Badge>}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {formatDate(i.created_at)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      @{i.created_by_username}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(link);
                            toast.success("Invite link copied");
                          }}
                          disabled={used}
                        >
                          <CopyIcon data-icon="inline-start" />
                          Copy link
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => revoke.mutate(i.id)}
                          aria-label="Revoke invite"
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
