/** Shared helpers for the upstream character API proxies. */

const REVALIDATE = { next: { revalidate: 3600 } } as const;

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** fetch with retries on 429/5xx, tuned for Jikan's rate limits and transient 504s. */
export async function fetchWithRetry(url: string, timeoutMs = 15000): Promise<Response> {
  const ATTEMPTS = 3;
  const BACKOFF_MS = [1500, 3000];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...REVALIDATE, signal: controller.signal });
      if (res.ok) return res;
      // 4xx (other than 429) won't improve on retry
      if (res.status < 500 && res.status !== 429) {
        throw new UpstreamError(`Upstream returned ${res.status}`, 502);
      }
      if (attempt < ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] ?? 3000));
        continue;
      }
      throw new UpstreamError(
        res.status === 429 ? "Rate limited by upstream API" : `Upstream returned ${res.status}`,
        res.status === 429 ? 429 : 502
      );
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      if (attempt < ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] ?? 3000));
        continue;
      }
      throw new UpstreamError("Upstream API is not responding", 504);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new UpstreamError("Unreachable", 502);
}

export function errorResponse(err: unknown): Response {
  const status = err instanceof UpstreamError ? err.status : 500;
  const message =
    err instanceof UpstreamError ? err.message : "Unexpected server error";
  return Response.json({ error: message }, { status });
}
