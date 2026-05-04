/**
 * Feature 05 Cycle 1 — Doctor-visit + blood-work event extractor.
 *
 * Owned by chunk 5.C. Stub created in pre-flight.
 *
 * Responsibilities:
 *   - Detect doctor-visit mentions ("I saw Dr. Mehta yesterday", "follow-up
 *     with rheum next Tuesday"). Extract: doctor name, date (resolved
 *     against the check-in's `date` for relative phrases), specialty (if
 *     stated), visitType (consultation / follow-up / urgent / other —
 *     inferred from cues like "follow-up" or "urgent appointment").
 *   - Detect blood-work mentions ("got my CRP back, it was 12 mg/L", "ESR
 *     was 30 last week"). Extract: marker name, value, unit, date if
 *     specified (else null = the check-in's date).
 *
 * Implementation sketch:
 *   - Zod schema `EventExtractionSchema` with `visits[]`, `bloodWork[]`.
 *   - `extractEvents(transcript, checkInDate)` — POSTs to
 *     `/api/check-in/extract-event`.
 *   - Date-anchor resolver: relative phrases ("yesterday", "today",
 *     "next Tuesday") resolved against `checkInDate` so the extractor
 *     stays deterministic and timezone-stable.
 *
 * Confirm flow (chunk 5.C UI): each detected event renders an
 * `EventConfirmCard` during the check-in summary; user confirms → writes
 * to doctorVisits / bloodWork with `source: 'check-in'` + `checkInId`.
 *
 * Cost guard: shares the per-check-in increment from convex/extractAttempts
 * (do NOT double-increment) — same coordination as medication-extract.
 *
 * No exports yet — chunk 5.C populates.
 */
export {};
