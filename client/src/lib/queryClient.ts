import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  missing?: string[];

  constructor(status: number, message: string, missing?: string[]) {
    super(`${status}: ${message}`);
    this.name = "ApiError";
    this.status = status;
    this.missing = missing;
  }
}

export function formatApiErrorDescription(err: unknown): string {
  if (err instanceof ApiError && err.missing && err.missing.length > 0) {
    return err.missing.map((item) => `• ${item}`).join("\n");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function formatApiErrorTitle(err: unknown, fallback = "Error"): string {
  if (err instanceof ApiError && err.missing && err.missing.length > 0) {
    const bare = err.message.replace(/^\d+:\s*/, "");
    return bare || "Officer failed deployment validation";
  }
  return fallback;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text: string;
    let missing: string[] | undefined;
    try {
      const raw = await res.text();
      try {
        const parsed = JSON.parse(raw);
        const msg = parsed.message || parsed.error;
        text = typeof msg === "string" ? msg : (msg ? JSON.stringify(msg) : raw);
        if (Array.isArray(parsed.missing)) {
          missing = parsed.missing.filter((item: unknown): item is string => typeof item === "string");
        }
      } catch {
        text = raw || res.statusText;
      }
    } catch {
      text = res.statusText;
    }
    throw new ApiError(res.status, text, missing);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  if (url.startsWith("/api/") && contentType.includes("text/html")) {
    throw new Error(
      `${res.status}: API route not found (server returned HTML). Restart the server if you recently added routes.`,
    );
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
