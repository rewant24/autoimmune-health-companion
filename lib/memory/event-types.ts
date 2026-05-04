/**
 * Memory event types — discriminated union covering all Memory tab event
 * variants for F02 C1 (check-in, flare) and future feature chunks
 * (intake from F04, visit from F05).
 *
 * The shape is deliberately uniform across variants so the day list UI
 * can render every event with the same row component (time · title ·
 * meta · taskState icon) and only branch on `type` for the detail sheet.
 *
 * `eventFromCheckin` is the only event-producer in F02 C1; F04 / F05 will
 * add `eventFromIntake` / `eventFromVisit` later — additive, no churn here.
 */
// Relative import (not `@/convex/checkIns`) so Convex's tsconfig — which
// has no `paths` alias — can typecheck this file when it's transitively
// imported by `convex/checkIns.ts`.
import type { CheckinRow } from "../../convex/checkIns";

export type TaskState = "pending" | "done" | "missed";
export type Mood = "heavy" | "flat" | "okay" | "bright" | "great";

type BaseEventFields = {
  eventId: string;
  date: string;
  time: string;
  title: string;
  meta: string;
  taskState: TaskState;
};

export type CheckInEvent = BaseEventFields & {
  type: "check-in";
  payload: {
    // Cycle 2: metrics are optional — undefined = declined or not captured.
    // The detail sheet (F02 C2 chunk 2.D) renders "—" for absent values.
    pain?: number;
    mood?: Mood;
    adherenceTaken?: boolean;
    energy?: number;
    transcript: string;
    checkinId: string;
  };
};

export type FlareEvent = BaseEventFields & {
  type: "flare";
  payload: { checkinId: string };
};

export type IntakeEvent = BaseEventFields & {
  type: "intake";
  payload: {
    medicationId: string;
    medicationName: string;
    dose: string;
    source: "home-tap" | "check-in";
  };
};

export type VisitEvent = BaseEventFields & {
  type: "visit";
  // SPRINT_F05_VISIT_PAYLOAD — chunk 5.C replaces this with the real
  // payload shape (visitId, doctorName, specialty, visitType, notes).
  payload: Record<string, never>;
};

// SPRINT_F05_BLOODWORK_EVENT — chunk 5.C adds `BloodWorkEvent` here with
// payload { bloodWorkId, markerCount, abnormalCount } and includes it in
// the MemoryEvent union below.

export type MemoryEvent = CheckInEvent | FlareEvent | IntakeEvent | VisitEvent;

const MOOD_LABELS: Record<Mood, string> = {
  heavy: "Heavy",
  flat: "Flat",
  okay: "Okay",
  bright: "Bright",
  great: "Great",
};

/**
 * Format a UTC ms timestamp as HH:MM in IST (Asia/Kolkata).
 * IST is UTC+5:30 with no DST — a fixed offset is correct year-round and
 * avoids Intl.DateTimeFormat surprises across runtimes.
 */
function formatTimeIST(createdAt: number): string {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const istMs = createdAt + IST_OFFSET_MS;
  const d = new Date(istMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Convert one check-in row into 1 or 2 MemoryEvents:
 *  - always: a 'check-in' event (taskState='done').
 *  - if `flare === 'yes'` or `'ongoing'`: also a 'flare' event at the same
 *    time (taskState='missed' — red strikethrough in the task-state vocabulary).
 *
 * Cycle 2: pain/mood may be undefined (declined or not captured). The
 * meta string falls back to "—" for missing values so existing list rows
 * still render. Flare migrated from boolean → tri-state — only 'no' (or
 * undefined) suppresses the flare event.
 */
export function eventFromCheckin(row: CheckinRow): MemoryEvent[] {
  const time = formatTimeIST(row.createdAt);
  const painText = row.pain !== undefined ? String(row.pain) : "—";
  const moodText = row.mood !== undefined ? MOOD_LABELS[row.mood] : "—";
  const events: MemoryEvent[] = [
    {
      type: "check-in",
      eventId: `checkin:${row._id}`,
      date: row.date,
      time,
      title: "Daily check-in",
      meta: `Pain ${painText} · ${moodText}`,
      taskState: "done",
      payload: {
        pain: row.pain,
        mood: row.mood,
        adherenceTaken: row.adherenceTaken,
        energy: row.energy,
        transcript: row.transcript,
        checkinId: row._id,
      },
    },
  ];

  if (row.flare === "yes" || row.flare === "ongoing") {
    events.push({
      type: "flare",
      eventId: `flare:${row._id}`,
      date: row.date,
      time,
      title: "Flare-up logged",
      meta: "",
      taskState: "missed",
      payload: { checkinId: row._id },
    });
  }

  return events;
}

// ---- F04 chunk 4.C — intake event projection ------------------------------

/** Minimal intake-row shape `eventFromIntake` reads. Mirrors the
 *  `intakeEvents` table; defined locally so this module doesn't pull in
 *  the Convex generated types (which compile only after `convex dev`). */
export interface IntakeEventRow {
  _id: string;
  medicationId: string;
  date: string;
  takenAt: number;
  source: "home-tap" | "check-in" | "module";
}

/** Minimal medication shape needed to render an intake row's title/meta. */
export interface IntakeMedication {
  _id: string;
  name: string;
  dose: string;
}

/**
 * Project one intake row into a Memory IntakeEvent. Source is normalised:
 * `module` rows (explicit log inside /medications) are reported as
 * `home-tap` in the Memory feed because the user typed/tapped, not the
 * voice path. The `intake` event type discriminator is preserved.
 *
 * Returns `null` when the supplied medication doesn't match the row's
 * `medicationId` — defensive guard so a stale closure doesn't render a
 * "Took ?" card.
 */
export function eventFromIntake(
  row: IntakeEventRow,
  medication: IntakeMedication,
): IntakeEvent | null {
  if (row.medicationId !== medication._id) return null;
  const time = formatTimeIST(row.takenAt);
  const memorySource: "home-tap" | "check-in" =
    row.source === "check-in" ? "check-in" : "home-tap";
  return {
    type: "intake",
    eventId: `intake:${row._id}`,
    date: row.date,
    time,
    title: `Took ${medication.name}`,
    meta: medication.dose,
    taskState: "done",
    payload: {
      medicationId: medication._id,
      medicationName: medication.name,
      dose: medication.dose,
      source: memorySource,
    },
  };
}
