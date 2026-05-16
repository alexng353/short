import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMyUrls, useDeleteUrl, ShortLink } from "../api/queries";
import { NewShortlinkForm } from "../components/NewShortlinkForm";
import { EditShortlinkModal } from "../components/EditShortlinkModal";
import { QRCodeModal } from "../components/QRCodeModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { Spinner } from "~/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  LinkIcon,
  PencilIcon,
  QrCodeIcon,
  Trash2Icon,
} from "lucide-react";

export const Route = createFileRoute("/_authed/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useMyUrls();
  const del = useDeleteUrl();
  const [editing, setEditing] = useState<ShortLink | null>(null);
  const [qrFor, setQrFor] = useState<ShortLink | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Your links</h1>
        <p className="text-sm text-muted-foreground">Create, edit, and share short URLs.</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>New short link</CardTitle>
          <CardDescription>Paste a long URL — pick a custom slug if you want one.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewShortlinkForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All links</CardTitle>
          <CardDescription>
            {data ? `${data.length} link${data.length === 1 ? "" : "s"}` : " "}
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
                  <LinkIcon />
                </EmptyMedia>
                <EmptyTitle>No links yet</EmptyTitle>
                <EmptyDescription>Create your first short link with the form above.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Short</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="hidden md:table-cell">Updated</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => {
                  const fullShort = `${origin}/s/${u.short}`;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        <a
                          href={fullShort}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-foreground hover:underline"
                        >
                          /s/{u.short}
                          <ExternalLinkIcon className="size-3 text-muted-foreground" />
                        </a>
                      </TableCell>
                      <TableCell className="max-w-[28rem] truncate text-muted-foreground">
                        <a
                          href={u.long}
                          target="_blank"
                          rel="noreferrer"
                          title={u.long}
                          className="hover:text-foreground hover:underline"
                        >
                          {u.long}
                        </a>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatDate(u.updated_at ?? u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label="Actions">
                              <EllipsisIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onSelect={() => {
                                  navigator.clipboard.writeText(fullShort);
                                  toast.success("Copied to clipboard");
                                }}
                              >
                                <CopyIcon />
                                Copy link
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setQrFor(u)}>
                                <QrCodeIcon />
                                QR code
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setEditing(u)}>
                                <PencilIcon />
                                Edit
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                del.mutate(u.id, {
                                  onSuccess: () => toast.success("Link deleted"),
                                  onError: (e) => toast.error((e as Error).message),
                                });
                              }}
                            >
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editing && <EditShortlinkModal link={editing} onClose={() => setEditing(null)} />}
      {qrFor && <QRCodeModal short={qrFor.short} origin={origin} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
