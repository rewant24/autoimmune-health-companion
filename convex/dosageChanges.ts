/**
 * Feature 04 Cycle 1 — Dosage change audit trail.
 *
 * Owned by chunk 4.A. Stub created in pre-flight.
 *
 * Mutations to expose:
 *   - `recordDosageChange({ userId, medicationId, oldDose, newDose,
 *     changedAt, reason?, source, checkInId? })`. When `source: 'check-in'`,
 *     the chunk 4.C confirm-card flow passes the linking `checkInId`.
 *     The handler ALSO updates the `medications.dose` field on the linked
 *     row to the new value — a dosage change is a regimen update.
 *
 * Queries to expose:
 *   - `listDosageChanges({ userId, medicationId? })` — newest first.
 */
export {};
