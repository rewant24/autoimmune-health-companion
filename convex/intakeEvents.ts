/**
 * Feature 04 Cycle 1 — Medication intake events.
 *
 * Owned by chunk 4.A. Stub created in pre-flight.
 *
 * Mutations to expose:
 *   - `logIntake({ userId, medicationId, date, takenAt, source, clientRequestId })`
 *     Idempotent on `clientRequestId` (same pattern as createCheckin).
 *     Dedupe rule: if another intake row exists for
 *     (userId, medicationId, date) and is not soft-deleted, the second
 *     call is a no-op that returns the existing row id (with the
 *     existing `source`). This collapses the home-tap then check-in
 *     race that scoping § Daily adherence calls out.
 *   - `softDeleteIntake({ id, clientRequestId })` — sets `deletedAt`.
 *
 * Queries to expose:
 *   - `listIntakeEvents({ userId, fromDate, toDate })`
 *   - `listIntakeEventsByDate({ userId, date })`
 *
 * Memory integration: `eventFromIntake(row, medication)` will be added to
 * `lib/memory/event-types.ts` so the Memory list renders intake markers
 * with type-tagged `INTAKE` pills (per scoping § home event feed).
 */
export {};
