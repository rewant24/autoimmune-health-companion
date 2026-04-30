/**
 * Feature 04 Cycle 1 — Medications regimen CRUD.
 *
 * Owned by chunk 4.A. Stub created in pre-flight so chunks 4.B and 4.C
 * have a stable import path; build agent fills in handlers + wrappers.
 *
 * Mirror the convex/checkIns.ts pattern:
 *   - Extracted plain-async handlers (`createMedicationHandler`, etc.) that
 *     take a structurally-typed mock ctx so vitest can drive them without
 *     `convex-test`. Real Convex ctx satisfies the shape structurally; cast
 *     in the wrapper has no runtime effect.
 *   - Soft-delete via `isActive: false` + `deactivatedAt: number`. No hard
 *     delete — intake events + dose changes reference these rows.
 *
 * Auth posture: client-trusted `userId` arg per ADR-019. Auth slice tracked
 * in post-MVP item 20.
 *
 * Stories owned by chunk 4.A:
 *   - US-4.A.1 Regimen CRUD (`createMedication`, `updateMedication`,
 *     `deactivateMedication`).
 *   - US-4.A.2 Idempotent intake logging (`logIntake` — see
 *     `convex/intakeEvents.ts`).
 *   - US-4.A.3 Dosage change events with audit trail (`recordDosageChange`
 *     — see `convex/dosageChanges.ts`).
 *
 * Queries to expose: `listActiveMedications`, `listAllMedications`,
 * `getTodayAdherence(date)` — joins medications with intakeEvents for
 * (userId, date) returning `{ medication, takenToday, lastTakenAt? }[]`.
 */
export {};
