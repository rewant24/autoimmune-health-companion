/**
 * Feature 05 Cycle 1 — Doctor visits (first-class timeline events).
 *
 * Owned by chunk 5.A. Stub created in pre-flight.
 *
 * Mutations to expose:
 *   - `createVisit({ userId, date, doctorName, specialty?, visitType,
 *     notes?, source, checkInId?, clientRequestId })`
 *   - `updateVisit({ id, ...patch })`
 *   - `softDeleteVisit({ id })` — sets `deletedAt`.
 *
 * Queries to expose:
 *   - `listVisits({ userId, fromDate?, toDate? })` — newest first.
 *   - `getNextUpcomingVisit({ userId, today })` — first row with `date >= today`.
 *   - `getVisitsByDate({ userId, date })`
 *
 * Memory integration: `eventFromVisit(row)` will be added to
 * `lib/memory/event-types.ts`. Type-tag `APPOINTMENT` per scoping pill
 * convention.
 *
 * Auth posture: client-trusted `userId` per ADR-019.
 */
export {};
