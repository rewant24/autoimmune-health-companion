/**
 * Save-later queue (Feature 01, Chunk 2.D, US-1.F.5).
 *
 * Per ADR-022: when a `createCheckin` call fails (network, rate limit, transient
 * Convex error), the user can choose "Keep this for later". The full mutation
 * payload is appended to a localStorage queue under
 * `saumya.saveLater.v1`. On next page load, the orchestrator drains and
 * retries each item.
 *
 * Idempotency is preserved server-side via `clientRequestId` (already part of
 * the payload), so a successful original save followed by a queued retry is
 * a no-op.
 *
 * Schema:
 *   { v: 1, items: SaveLaterPayload[] }
 *
 * Failure modes:
 *   - No `localStorage` (SSR, sandboxed, quota-exceeded) → reads/writes are
 *     silent no-ops; reads return [].
 *   - Corrupted JSON or wrong `v` → log warning, treat as empty. `enqueue`
 *     after corruption replaces the bad value with a fresh envelope.
 */

import type { Metric, Mood, FlareState, StageEnum } from "./types";

export const SAVE_LATER_KEY = "saumya.saveLater.v1";
const SCHEMA_VERSION = 1;

/**
 * Shape of a queued payload — mirrors `convex/checkIns.ts` `CreateCheckinArgs`
 * verbatim. We intentionally redeclare it here (rather than importing from
 * Convex) so this module stays Convex-agnostic and trivially serializable.
 */
export interface SaveLaterPayload {
  userId: string;
  date: string;
  pain?: number;
  mood?: Mood;
  adherenceTaken?: boolean;
  flare?: FlareState;
  energy?: number;
  declined?: Metric[];
  appendedTo?: string;
  transcript: string;
  stage: StageEnum;
  durationMs: number;
  providerUsed: string;
  clientRequestId: string;
}

interface Envelope {
  v: number;
  items: SaveLaterPayload[];
}

/** Type guard: a parsed value matches the v1 envelope shape. */
function isV1Envelope(value: unknown): value is Envelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === SCHEMA_VERSION && Array.isArray(candidate.items)
  );
}

/** Get a usable Storage handle, or null in environments without one. */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read the envelope. Returns [] for any failure mode (missing key, corrupt
 * JSON, wrong version). Logs a warning for corrupt / wrong-version cases so
 * problems surface in dev without crashing the page.
 */
function readEnvelope(storage: Storage): SaveLaterPayload[] {
  const raw = storage.getItem(SAVE_LATER_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isV1Envelope(parsed)) {
      console.warn(
        `[save-later] discarded value with unknown schema in ${SAVE_LATER_KEY}`,
      );
      return [];
    }
    return parsed.items;
  } catch {
    console.warn(
      `[save-later] corrupted JSON in ${SAVE_LATER_KEY} — treating as empty`,
    );
    return [];
  }
}

function writeEnvelope(storage: Storage, items: SaveLaterPayload[]): void {
  const envelope: Envelope = { v: SCHEMA_VERSION, items };
  try {
    storage.setItem(SAVE_LATER_KEY, JSON.stringify(envelope));
  } catch {
    // Quota-exceeded / private-mode write blocks — best-effort only.
  }
}

/** Append one payload to the queue. Survives prior corruption. */
export function enqueue(payload: SaveLaterPayload): void {
  const storage = getStorage();
  if (storage === null) return;
  const items = readEnvelope(storage);
  items.push(payload);
  writeEnvelope(storage, items);
}

/** Read items without clearing. Returns [] on any failure. */
export function peek(): SaveLaterPayload[] {
  const storage = getStorage();
  if (storage === null) return [];
  return readEnvelope(storage);
}

/**
 * Read items and clear the queue. Even on a corrupted read, the bad value
 * is removed so the next enqueue starts clean.
 */
export function drain(): SaveLaterPayload[] {
  const storage = getStorage();
  if (storage === null) return [];
  const items = readEnvelope(storage);
  storage.removeItem(SAVE_LATER_KEY);
  return items;
}
