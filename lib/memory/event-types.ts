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
  payload: {
    visitId: string;
    doctorName: string;
    specialty?: string;
    visitType: "consultation" | "follow-up" | "urgent" | "other";
    notes?: string;
    source: "module" | "check-in";
  };
};

export type BloodWorkEvent = BaseEventFields & {
  type: "blood-work";
  payload: {
    bloodWorkId: string;
    markerCount: number;
    abnormalCount: number;
    source: "module" | "check-in";
  };
};

export type MemoryEvent =
  | CheckInEvent
  | FlareEvent
  | IntakeEvent
  | VisitEvent
  | BloodWorkEvent;

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

// ---- F05 chunk 5.C — visit + blood-work event projections ----------------

/** Minimal doctor-visit row shape `eventFromVisit` reads. Mirrors the
 *  `doctorVisits` table; defined locally so this module doesn't pull in
 *  Convex-generated types. */
export interface DoctorVisitRow {
  _id: string;
  date: string;
  doctorName: string;
  specialty?: string;
  visitType: "consultation" | "follow-up" | "urgent" | "other";
  notes?: string;
  source: "module" | "check-in";
  createdAt: number;
}

/** Minimal blood-work row shape `eventFromBloodWork` reads. Mirrors the
 *  `bloodWork` table. */
export interface BloodWorkRow {
  _id: string;
  date: string;
  markers: ReadonlyArray<{
    name: string;
    value: number;
    unit: string;
    refRangeLow?: number;
    refRangeHigh?: number;
    abnormal?: boolean;
  }>;
  notes?: string;
  source: "module" | "check-in";
  createdAt: number;
}

const VISIT_TYPE_LABELS: Record<DoctorVisitRow["visitType"], string> = {
  consultation: "Consultation",
  "follow-up": "Follow-up",
  urgent: "Urgent",
  other: "Visit",
};

/**
 * Project one doctor-visit row into a Memory VisitEvent. Title is "Doctor
 * visit"; meta is "[doctorName] · [visitType]". Tap-to-detail routes to
 * `/visits/[visitId]` (see `EventRow`).
 */
export function eventFromVisit(row: DoctorVisitRow): VisitEvent {
  const time = formatTimeIST(row.createdAt);
  return {
    type: "visit",
    eventId: `visit:${row._id}`,
    date: row.date,
    time,
    title: "Doctor visit",
    meta: `${row.doctorName} · ${VISIT_TYPE_LABELS[row.visitType]}`,
    taskState: "done",
    payload: {
      visitId: row._id,
      doctorName: row.doctorName,
      ...(row.specialty !== undefined ? { specialty: row.specialty } : {}),
      visitType: row.visitType,
      ...(row.notes !== undefined ? { notes: row.notes } : {}),
      source: row.source,
    },
  };
}

/**
 * Project one blood-work row into a Memory BloodWorkEvent. Title is "Blood
 * work"; meta is "[markerCount] markers · [abnormalCount] abnormal" — the
 * abnormal segment is omitted when `abnormalCount` is 0.
 */
export function eventFromBloodWork(row: BloodWorkRow): BloodWorkEvent {
  const time = formatTimeIST(row.createdAt);
  const markerCount = row.markers.length;
  const abnormalCount = row.markers.reduce(
    (n, m) => n + (m.abnormal === true ? 1 : 0),
    0,
  );
  const markerWord = markerCount === 1 ? "marker" : "markers";
  const meta =
    abnormalCount > 0
      ? `${markerCount} ${markerWord} · ${abnormalCount} abnormal`
      : `${markerCount} ${markerWord}`;
  return {
    type: "blood-work",
    eventId: `bloodwork:${row._id}`,
    date: row.date,
    time,
    title: "Blood work",
    meta,
    taskState: "done",
    payload: {
      bloodWorkId: row._id,
      markerCount,
      abnormalCount,
      source: row.source,
    },
  };
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
