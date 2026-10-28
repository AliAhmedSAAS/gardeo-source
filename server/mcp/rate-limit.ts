type Window = { count: number; windowStart: number };

const windows = new Map<string, Window>();

const DEFAULT_LIMIT = 60;
const WINDOW_MS = 60_000;

export function checkMcpRateLimit(
  key: string,
  limit = Number(process.env.MCP_RATE_LIMIT_PER_MIN || DEFAULT_LIMIT),
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.windowStart >= WINDOW_MS) {
    windows.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSec: 0 };
  }
  if (current.count >= limit) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - current.windowStart)) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSec: 0 };
}
