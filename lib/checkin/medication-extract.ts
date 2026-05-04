/**
 * Feature 04 Cycle 1 — Medication mention extractor for the voice check-in.
 *
 * Owned by chunk 4.C.
 *
 * Responsibilities:
 *   - Detect simple-adherence affirmations ("I took my medications", "yeah,
 *     took them") and partial-adherence negatives ("I skipped the steroid
 *     today") in the transcript. The check-in summary uses the result to
 *     log intake events for the user's active regimen.
 *   - Detect opportunistic dosage-change mentions ("doc bumped my prednisone
 *     to 20mg") and surface them as a confirm-card candidate. The user
 *     confirms during the summary step before any write happens (per scoping
 *     § Daily voice check-in — medication mechanics).
 *
 * Cost-guard invariant (ADR-020):
 *   The metric extractor (`/api/check-in/extract`) increments the daily cap
 *   ONCE per check-in. The medication extractor must NOT double-increment a
 *   single check-in — it is invoked only AFTER metrics extraction has
 *   already passed the cap. The route handler reflects this by skipping
 *   `incrementAndCheck` entirely; see `app/api/check-in/extract-medication/route.ts`.
 */
import { z } from 'zod'
import type { CheckinMetrics } from './types'

// Re-export so consumers can avoid touching the schema directly when they
// only need the inferred type.
export type ExtractedMedicationResult = z.infer<typeof MedicationExtractionSchema>

/**
 * Minimal regimen-row shape the extractor needs. Mirrors `convex/schema.ts`
 * `medications` table — chunk 4.A owns the canonical type via
 * `convex/medications.ts`. Defined locally here so this module doesn't depend
 * on a generated Convex API the caller may build with `(api as any)`.
 */
export interface RegimenMedication {
  /** Convex id of the medication row. Matched by name in extraction; carried
   *  through so the caller can look up the row when persisting intakes /
   *  dosage changes. */
  _id: string
  /** Display name as the user typed it. Case-insensitive match target. */
  name: string
  /** Free-form dose string ("15mg", "1 tablet"). */
  dose: string
}

/**
 * Zod schema for the structured output. Mirrors the metric extractor's
 * "model returns null when uncertain" pattern. Empty arrays are valid
 * (silence about meds → all-empty result).
 */
export const MedicationExtractionSchema = z.object({
  /**
   * Simple-adherence affirmation. `null` = the transcript didn't make a
   * blanket adherence claim; `{ confirmed: true }` = "I took my meds";
   * `{ confirmed: false }` = "I forgot all my meds today" (rare — partial
   * adherence is the more common case and lives in `skippedMedications`).
   */
  simpleAdherence: z
    .object({ confirmed: z.boolean() })
    .nullable(),
  /**
   * Medications the user explicitly named as skipped. Names are matched
   * case-insensitively against the regimen by the caller; unmatched names
   * are dropped silently (no false positives).
   */
  skippedMedications: z
    .array(z.object({ medicationName: z.string() })),
  /**
   * Detected dose-change mentions. `newDose` is the dose as spoken (e.g.
   * "20mg"); the caller surfaces a confirm card before persisting.
   */
  dosageChanges: z.array(
    z.object({
      medicationName: z.string(),
      newDose: z.string(),
      reason: z.string().optional(),
    }),
  ),
})

/** Empty extraction — used as a no-op fallback (silence, network failure). */
export const EMPTY_EXTRACTION: ExtractedMedicationResult = {
  simpleAdherence: null,
  skippedMedications: [],
  dosageChanges: [],
}

// ---- System prompt ----------------------------------------------------------

/**
 * Build the system prompt. The regimen is rendered inline so the model
 * can ground its name-matching to the user's actual medications — this
 * avoids hallucinated dose-change rows for medications the user doesn't
 * take. Pure (no template-string-id concerns).
 */
export function buildSystemPrompt(regimen: ReadonlyArray<RegimenMedication>): string {
  const list =
    regimen.length === 0
      ? '(none — return empty result)'
      : regimen
          .map((m, i) => `  ${i + 1}. ${m.name} — ${m.dose}`)
          .join('\n')
  return `You are an extraction layer for a daily voice check-in in an autoimmune-health companion app. The user already spoke a freeform check-in. Your only job is to extract three medication-related signals from the transcript.

The user's active regimen (only match against these names):
${list}

Output schema:
- simpleAdherence: { confirmed: boolean } | null. Set to { confirmed: true } only when the user makes a blanket affirmation (e.g. "I took my meds", "yeah, took them"). Set to { confirmed: false } only when the user makes a blanket negation (e.g. "I forgot everything today"). When the user only references specific medications, leave this null and use skippedMedications instead.
- skippedMedications: array of { medicationName }. One entry per medication the user explicitly says they skipped, forgot, or did not take. Only emit names that appear in the regimen above; case-insensitive match. Drop unmatched names — do not invent.
- dosageChanges: array of { medicationName, newDose, reason? }. One entry per mention of a dose change ("doc bumped my prednisone to 20mg", "tapering down to 5mg"). Only emit names that match the regimen. newDose is the new dose as spoken (e.g. "20mg", "5mg twice daily"). reason is optional — include only when explicitly stated.

Rules:
1. If you cannot reliably infer a value, return the empty default for that field. Do not guess.
2. Negation counts as a value ("I forgot the steroid" → skippedMedications: [{ medicationName: "<steroid name from regimen>" }]).
3. Match medication names case-insensitively against the regimen list. Drop unmatched mentions silently.
4. Do not invent medications, doses, or reasons that the user did not say.
5. Return strictly the JSON object matching the schema. No commentary, no markdown.`
}

/** Build the user-message payload sent to the model. */
export function buildUserMessage(transcript: string): string {
  return `Transcript:\n"""\n${transcript}\n"""\n\nReturn the extracted medication signals now.`
}

// ---- Client helper ----------------------------------------------------------

export interface ExtractMedicationsArgs {
  transcript: string
  userId: string
  /** YYYY-MM-DD in the device's local timezone. */
  date: string
  regimen: ReadonlyArray<RegimenMedication>
  /** Test seam — defaults to global `fetch`. */
  fetchImpl?: typeof fetch
  /** Test seam — defaults to `/api/check-in/extract-medication`. */
  routeUrl?: string
}

/** Thrown when the extraction route returns a non-2xx status. */
export class MedicationExtractFailedError extends Error {
  readonly code = 'medication-extract.failed' as const
  constructor(message: string) {
    super(message)
    this.name = 'MedicationExtractFailedError'
  }
}

/**
 * POST the transcript to the medication extraction route. Returns the
 * structured result. Failures collapse to `EMPTY_EXTRACTION` so the
 * check-in summary can render without a medication block — the metric
 * extractor's result is independent and stays unaffected.
 *
 * The caller is responsible for filtering `skippedMedications` /
 * `dosageChanges` against the active regimen — though the route's prompt
 * already constrains the model, defence-in-depth keeps a phantom name
 * out of the UI.
 *
 * Note: this client never throws on cost-guard 429 because the route
 * doesn't increment the cap (see top-of-file invariant). 429s coming back
 * here would be unexpected; we surface them as `MedicationExtractFailedError`.
 */
export async function extractMedications(
  args: ExtractMedicationsArgs,
): Promise<ExtractedMedicationResult> {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch
  const url = args.routeUrl ?? '/api/check-in/extract-medication'

  // Empty regimen short-circuits — there's nothing to match against.
  if (args.regimen.length === 0) return EMPTY_EXTRACTION

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: args.transcript,
        userId: args.userId,
        date: args.date,
        regimen: args.regimen.map((m) => ({
          _id: m._id,
          name: m.name,
          dose: m.dose,
        })),
      }),
    })
  } catch (err) {
    throw new MedicationExtractFailedError(
      `Network error calling medication-extract route: ${(err as Error).message}`,
    )
  }

  if (!response.ok) {
    throw new MedicationExtractFailedError(
      `Medication-extract route returned ${response.status}`,
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (err) {
    throw new MedicationExtractFailedError(
      `Medication-extract route returned non-JSON: ${(err as Error).message}`,
    )
  }

  const parsed = MedicationExtractionSchema.safeParse(
    (body as { result?: unknown })?.result,
  )
  if (!parsed.success) {
    throw new MedicationExtractFailedError(
      `Medication-extract route returned malformed body: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

// ---- Pure helpers used by the summary flow ---------------------------------

/**
 * Resolve `skippedMedications` against the active regimen. Returns the
 * regimen rows the user said they skipped (case-insensitive name match).
 * Unmatched names are dropped silently.
 */
export function resolveSkipped(
  result: ExtractedMedicationResult,
  regimen: ReadonlyArray<RegimenMedication>,
): RegimenMedication[] {
  const byLower = new Map<string, RegimenMedication>()
  for (const med of regimen) byLower.set(med.name.toLowerCase(), med)
  const seen = new Set<string>()
  const out: RegimenMedication[] = []
  for (const { medicationName } of result.skippedMedications) {
    const match = byLower.get(medicationName.toLowerCase())
    if (!match) continue
    if (seen.has(match._id)) continue
    seen.add(match._id)
    out.push(match)
  }
  return out
}

/**
 * Compute the medications the simple-adherence path should log. When the
 * user blanket-affirms ("took my meds"), every active medication is logged
 * EXCEPT those named in `skippedMedications` (partial-adherence overrides
 * simple). When `simpleAdherence` is null, no medications are logged via
 * this path.
 */
export function resolveLoggedMedications(
  result: ExtractedMedicationResult,
  regimen: ReadonlyArray<RegimenMedication>,
): RegimenMedication[] {
  if (result.simpleAdherence?.confirmed !== true) return []
  const skipped = new Set(resolveSkipped(result, regimen).map((m) => m._id))
  return regimen.filter((m) => !skipped.has(m._id))
}

/**
 * Resolve `dosageChanges` against the active regimen. Drops unmatched
 * names; preserves order. The caller renders one confirm card per result.
 */
export interface ResolvedDosageChange {
  medication: RegimenMedication
  newDose: string
  reason?: string
}

export function resolveDosageChanges(
  result: ExtractedMedicationResult,
  regimen: ReadonlyArray<RegimenMedication>,
): ResolvedDosageChange[] {
  const byLower = new Map<string, RegimenMedication>()
  for (const med of regimen) byLower.set(med.name.toLowerCase(), med)
  const out: ResolvedDosageChange[] = []
  for (const change of result.dosageChanges) {
    const match = byLower.get(change.medicationName.toLowerCase())
    if (!match) continue
    // No-op same-dose changes: drop. The Convex mutation also throws
    // `dosage.no_change` so this is defence-in-depth UX (don't show a
    // confirm card the user can only ignore).
    if (match.dose.trim().toLowerCase() === change.newDose.trim().toLowerCase()) {
      continue
    }
    out.push({
      medication: match,
      newDose: change.newDose,
      reason: change.reason,
    })
  }
  return out
}

// Type-only re-export so the route handler can share the inferred type
// without re-declaring it. `CheckinMetrics` is referenced only via this
// `import type` to keep the dep graph tight.
export type { CheckinMetrics }
