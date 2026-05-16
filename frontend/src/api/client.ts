export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}: ${body}`);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      // Best-effort redirect; router catches this in beforeLoad too.
      window.location.assign("/login");
    }
    throw new ApiError(res.status, body);
  }
  return (await res.json()) as T;
}
