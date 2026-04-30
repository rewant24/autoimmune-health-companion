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
  // SPRINT_F04_INTAKE_PAYLOAD — chunk 4.C replaces this with the real
  // payload shape (medicationId, medicationName, dose, source). Keep
  // empty here so existing F02 C1 code still typechecks during pre-flight.
  payload: Record<string, never>;
};

export type VisitType =
  | "consultation"
  | "follow-up"
  | "urgent"
  | "other";

export type VisitEvent = BaseEventFields & {
  type: "visit";
  payload: {
    visitId: string;
    doctorName: string;
    specialty?: string;
    visitType: VisitType;
    notes?: string;
  };
};

export type BloodWorkEvent = BaseEventFields & {
  type: "blood-work";
  payload: {
    bloodWorkId: string;
    markerCount: number;
    abnormalCount: number;
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

// ---- F05 Cycle 1 — visit + blood-work event helpers (chunk 5.C) ----

/**
 * Minimal structural shape of a row from chunk 5.A's `doctorVisits` table.
 * Pulled out as a local type (rather than importing from `convex/doctorVisits.ts`)
 * because the Convex tsconfig has no `@/*` alias and the row type isn't
 * exported from that module yet during pre-flight. The shape mirrors the
 * Convex schema declaration in `convex/schema.ts` § doctorVisits.
 */
export type DoctorVisitRow = {
  _id: string;
  userId: string;
  date: string;
  doctorName: string;
  specialty?: string;
  visitType: VisitType;
  notes?: string;
  source: "module" | "check-in";
  checkInId?: string;
  createdAt: number;
  deletedAt?: number;
};

/**
 * Minimal structural shape of a row from chunk 5.A's `bloodWork` table.
 * Mirrors `convex/schema.ts` § bloodWork. `markers[].abnormal` is the
 * derived hint stamped at write time (see chunk 5.A spec); we count it
 * directly to populate the meta line.
 */
export type BloodWorkRow = {
  _id: string;
  userId: string;
  date: string;
  markers: Array<{
    name: string;
    value: number;
    unit: string;
    refRangeLow?: number;
    refRangeHigh?: number;
    abnormal?: boolean;
  }>;
  notes?: string;
  source: "module" | "check-in";
  checkInId?: string;
  createdAt: number;
  deletedAt?: number;
};

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  consultation: "Consultation",
  "follow-up": "Follow-up",
  urgent: "Urgent",
  other: "Visit",
};

/**
 * Convert one doctor-visit row into a single `VisitEvent`. The meta line
 * format is `{visitTypeLabel} · {doctorName}[ · {specialty}]` so it slots
 * cleanly into the existing EventRow's truncate-on-overflow layout.
 *
 * `taskState` rule: visits in the past or today render as `done` (the
 * appointment happened); future-dated visits render as `pending`. The
 * comparison uses string ordering on YYYY-MM-DD vs the IST today provided
 * by callers — see the doc on `eventFromVisit` for the timezone seam.
 */
export function eventFromVisit(
  row: DoctorVisitRow,
  todayDate?: string,
): VisitEvent {
  const time = formatTimeIST(row.createdAt);
  const typeLabel = VISIT_TYPE_LABELS[row.visitType];
  const metaParts = [typeLabel, row.doctorName];
  if (row.specialty) metaParts.push(row.specialty);
  // Default `todayDate` to the row's own date so server-side callers that
  // don't have an IST clock still produce a stable result. The page-level
  // caller passes the real IST today so future-dated visits show pending.
  const today = todayDate ?? row.date;
  const taskState: TaskState = row.date > today ? "pending" : "done";
  return {
    type: "visit",
    eventId: `visit:${row._id}`,
    date: row.date,
    time,
    title: "Doctor visit",
    meta: metaParts.join(" · "),
    taskState,
    payload: {
      visitId: row._id,
      doctorName: row.doctorName,
      specialty: row.specialty,
      visitType: row.visitType,
      notes: row.notes,
    },
  };
}

/**
 * Convert one blood-work row into a single `BloodWorkEvent`. The meta line
 * format is `{markerCount} markers[ · {abnormalCount} abnormal]`. Empty
 * `markers[]` is rejected at the mutation layer per chunk 5.A spec, so we
 * always have at least one marker to count.
 */
export function eventFromBloodWork(row: BloodWorkRow): BloodWorkEvent {
  const time = formatTimeIST(row.createdAt);
  const markerCount = row.markers.length;
  const abnormalCount = row.markers.filter((m) => m.abnormal === true).length;
  const markerLabel = markerCount === 1 ? "1 marker" : `${markerCount} markers`;
  const meta =
    abnormalCount > 0 ? `${markerLabel} · ${abnormalCount} abnormal` : markerLabel;
  return {
    type: "blood-work",
    eventId: `bloodWork:${row._id}`,
    date: row.date,
    time,
    title: "Blood work",
    meta,
    taskState: "done",
    payload: {
      bloodWorkId: row._id,
      markerCount,
      abnormalCount,
    },
  };
}
