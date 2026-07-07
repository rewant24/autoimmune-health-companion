/**
 * Canonical marker names for the `bloodWorkMarkers` flatten (housekeeping
 * #13, ADR-037).
 *
 * One shared normalization used by BOTH the dual-write path
 * (`convex/bloodWork.ts`) and the backfill migration
 * (`convex/migrations.ts`), so "CRP", "crp" and " C-reactive protein "
 * land on the same canonical name and don't fragment F08 trend queries.
 *
 * Deliberately minimal: trim + collapse whitespace, then an alias map for
 * the four MVP-default markers (CRP / ESR / WBC / Hb) and their obvious
 * spellings. Unknown names pass through with whitespace normalized but
 * casing preserved — "Vitamin D" stays "Vitamin D". No ontology, no fuzzy
 * matching; extend the alias map when real duplicate data shows up.
 *
 * NOTE: this canonicalizes the FLATTENED rows only. The embedded
 * `bloodWork.markers[]` array keeps the user's as-entered name (trimmed)
 * and stays the read source for all F05 surfaces.
 */

/** lowercase(collapsed) → canonical display form. */
const MARKER_ALIASES: Record<string, string> = {
  // C-reactive protein
  crp: "CRP",
  "c-reactive protein": "CRP",
  "c reactive protein": "CRP",
  // Erythrocyte sedimentation rate
  esr: "ESR",
  "erythrocyte sedimentation rate": "ESR",
  "sed rate": "ESR",
  // White blood cells
  wbc: "WBC",
  "white blood cell count": "WBC",
  "white blood cells": "WBC",
  "wbc count": "WBC",
  // Hemoglobin
  hb: "Hb",
  hgb: "Hb",
  hemoglobin: "Hb",
  haemoglobin: "Hb",
};

/**
 * Normalize a marker name to its canonical display form.
 *
 * Steps: trim → collapse internal whitespace runs to single spaces →
 * case-insensitive alias lookup → alias hit returns the canonical form,
 * miss returns the whitespace-normalized original unchanged.
 */
export function canonicalMarkerName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  const canonical = MARKER_ALIASES[collapsed.toLowerCase()];
  return canonical ?? collapsed;
}
