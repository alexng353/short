import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export interface SelfUser {
  id: number;
  name: string;
  username: string;
}

export const useSelf = () =>
  useQuery({
    queryKey: ["self"],
    queryFn: () => api<SelfUser>("/user/self"),
    retry: false,
  });

export interface ShortLink {
  id: number;
  user_id: number;
  short: string;
  long: string;
  created_at: string;
  updated_at: string | null;
}

export const useMyUrls = () =>
  useQuery({
    queryKey: ["myurls"],
    queryFn: () => api<ShortLink[]>("/shorturls/myurls"),
  });

export const useDeleteUrl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/shorturls/delete/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myurls"] }),
  });
};

export const useUpdateUrl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, long }: { id: number; long: string }) =>
      api(`/shorturls/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ long }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myurls"] }),
  });
};

export interface AdminUserRow {
  id: number;
  name: string;
  username: string;
  is_admin: boolean;
  disabled_at: string | null;
  created_at: string;
}

export const useAdminUsers = () =>
  useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<AdminUserRow[]>("/admin/users"),
  });

export interface InviteRow {
  id: number;
  code: string;
  used_at: string | null;
  created_at: string;
  created_by_username: string;
}

export const useAdminInvites = () =>
  useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => api<InviteRow[]>("/admin/invites"),
  });
