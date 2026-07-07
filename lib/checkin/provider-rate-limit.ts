/**
 * Provider rate-limit detection for the three LLM extraction routes
 * (W2-2, per `feedback_server_429_ux`: provider 429s get a dedicated
 * `rate_limited` code, never a generic `.failed` 502).
 *
 * The Vercel AI SDK throws `APICallError` with `statusCode` and
 * `responseHeaders` on provider HTTP errors. We detect structurally
 * instead of importing the error class so route tests' minimal `ai`
 * module mocks keep working.
 */

export interface ProviderRateLimit {
  /** Parsed Retry-After seconds, or null when the provider didn't send one. */
  retryAfterSeconds: number | null;
}

export function detectProviderRateLimit(
  err: unknown,
): ProviderRateLimit | null {
  if (err === null || typeof err !== "object") return null;
  const e = err as {
    statusCode?: unknown;
    responseHeaders?: Record<string, string>;
  };
  if (e.statusCode !== 429) return null;
  // Retry-After can be seconds or an HTTP date; we only forward the
  // seconds form (the date form is rare from LLM providers).
  const raw = e.responseHeaders?.["retry-after"];
  const parsed = raw !== undefined ? Number(raw) : Number.NaN;
  return {
    retryAfterSeconds:
      Number.isFinite(parsed) && parsed >= 0 ? Math.ceil(parsed) : null,
  };
}
