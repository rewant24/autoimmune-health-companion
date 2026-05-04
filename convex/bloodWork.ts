/**
 * Feature 05 Cycle 1 — Blood work results (structured markers).
 *
 * Owned by chunk 5.A. Stub created in pre-flight.
 *
 * Mutations to expose:
 *   - `createBloodWork({ userId, date, markers, notes?, source,
 *     checkInId?, clientRequestId })`
 *     Validates that each marker has a finite `value`. Empty `markers`
 *     array is rejected (a blood-work row with no values is meaningless).
 *   - `updateBloodWork({ id, ...patch })`
 *   - `softDeleteBloodWork({ id })`
 *
 * Queries to expose:
 *   - `listBloodWork({ userId, fromDate?, toDate? })`
 *   - `getBloodWorkByDate({ userId, date })`
 *
 * Reference ranges: `refRangeLow`/`refRangeHigh` are optional per marker.
 * The form may pre-populate defaults for CRP/ESR/WBC/Hb but does not
 * enforce them. `abnormal` is a derived hint computed at write time when
 * both bounds are present.
 *
 * PDF/image attachment + OCR are post-MVP backlog item 3.
 *
 * Memory integration: `eventFromBloodWork(row)` will be added to
 * `lib/memory/event-types.ts`. Type-tag `BLOOD WORK` per scoping pill
 * convention.
 */
export {};
