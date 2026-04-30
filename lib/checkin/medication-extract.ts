/**
 * Feature 04 Cycle 1 — Medication mention extractor for the voice check-in.
 *
 * Owned by chunk 4.C. Stub created in pre-flight.
 *
 * Responsibilities:
 *   - Detect simple-adherence affirmations ("I took my medications", "yeah,
 *     took them") and partial-adherence negatives ("I skipped the steroid
 *     today") in the transcript. Returns a structured result the check-in
 *     summary uses to log intake events for the user's active regimen.
 *   - Detect opportunistic dosage-change mentions ("doc bumped my prednisone
 *     to 20mg") and surface them as a confirm-card candidate. The user
 *     confirms during the summary step before any write happens (per scoping
 *     § Daily voice check-in — medication mechanics).
 *
 * Implementation sketch:
 *   - Zod schema `MedicationExtractionSchema` with `simpleAdherence`,
 *     `skippedMedications`, `dosageChanges` slots.
 *   - `extractMedications(transcript, regimen)` — POSTs to
 *     `/api/check-in/extract-medication` (a new route owned by chunk 4.C).
 *     Same cost-guard increment + Vercel AI Gateway pattern as the metrics
 *     route.
 *   - The route reuses `incrementAndCheck` from convex/extractAttempts but
 *     does NOT double-increment a single check-in: chunk 4.C wires this so
 *     the cap covers the WHOLE check-in, not per-slice (see plan §
 *     Coordination note + ADR-020 invariant).
 *
 * No exports yet — chunk 4.C populates.
 */
export {};
