/**
 * F05 chunk 5.C — <MemoryTimelineMarker /> rendering tests (US-5.C.3).
 *
 * Asserts:
 *   - VisitEvent renders the APPOINTMENT pill with the visit colour class
 *     and an aria-label that includes the pill text.
 *   - BloodWorkEvent renders the BLOOD WORK pill with the blood-work colour
 *     class.
 *   - eventFromVisit / eventFromBloodWork helpers produce the right meta
 *     strings (visitType + doctor + optional specialty for visits;
 *     "{count} markers · {N} abnormal" for blood-work).
 *   - Pending vs Done classification: future-dated visits surface as
 *     pending; past or today as done.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemoryTimelineMarker } from "@/components/journey/MemoryTimelineMarker";
import {
  eventFromVisit,
  eventFromBloodWork,
  type DoctorVisitRow,
  type BloodWorkRow,
  type MemoryEvent,
} from "@/lib/memory/event-types";

function visitRow(overrides: Partial<DoctorVisitRow> = {}): DoctorVisitRow {
  return {
    _id: "v1",
    userId: "u1",
    date: "2026-05-01",
    doctorName: "Dr. Mehta",
    specialty: undefined,
    visitType: "consultation",
    notes: undefined,
    source: "module",
    createdAt: Date.UTC(2026, 4, 1, 9, 0, 0, 0), // 14:30 IST
    ...overrides,
  };
}

function bloodWorkRow(overrides: Partial<BloodWorkRow> = {}): BloodWorkRow {
  return {
    _id: "bw1",
    userId: "u1",
    date: "2026-05-01",
    markers: [
      { name: "CRP", value: 12, unit: "mg/L" },
      { name: "ESR", value: 30, unit: "mm/hr" },
    ],
    notes: undefined,
    source: "module",
    createdAt: Date.UTC(2026, 4, 1, 11, 0, 0, 0), // 16:30 IST
    ...overrides,
  };
}

describe("eventFromVisit", () => {
  it("emits a VisitEvent with the right title, time, meta", () => {
    const e = eventFromVisit(
      visitRow({ specialty: "Rheumatology", visitType: "follow-up" }),
      "2026-05-01",
    );
    expect(e.type).toBe("visit");
    expect(e.title).toBe("Doctor visit");
    expect(e.meta).toBe("Follow-up · Dr. Mehta · Rheumatology");
    expect(e.taskState).toBe("done");
    expect(e.eventId).toBe("visit:v1");
    expect(e.time).toBe("14:30");
  });

  it("omits specialty from meta when absent", () => {
    const e = eventFromVisit(visitRow(), "2026-05-01");
    expect(e.meta).toBe("Consultation · Dr. Mehta");
  });

  it("classifies future-dated visits as pending", () => {
    const e = eventFromVisit(
      visitRow({ date: "2026-06-15" }),
      "2026-05-01",
    );
    expect(e.taskState).toBe("pending");
  });

  it("classifies same-day visits as done", () => {
    const e = eventFromVisit(visitRow({ date: "2026-05-01" }), "2026-05-01");
    expect(e.taskState).toBe("done");
  });

  it("propagates payload fields", () => {
    const e = eventFromVisit(
      visitRow({
        specialty: "Rheumatology",
        notes: "labs ordered",
        visitType: "follow-up",
      }),
      "2026-05-01",
    );
    expect(e.payload).toEqual({
      visitId: "v1",
      doctorName: "Dr. Mehta",
      specialty: "Rheumatology",
      visitType: "follow-up",
      notes: "labs ordered",
    });
  });
});

describe("eventFromBloodWork", () => {
  it("emits a BloodWorkEvent with marker count meta", () => {
    const e = eventFromBloodWork(bloodWorkRow());
    expect(e.type).toBe("blood-work");
    expect(e.title).toBe("Blood work");
    expect(e.meta).toBe("2 markers");
    expect(e.taskState).toBe("done");
    expect(e.eventId).toBe("bloodWork:bw1");
  });

  it("singularises '1 marker'", () => {
    const e = eventFromBloodWork(
      bloodWorkRow({
        markers: [{ name: "CRP", value: 12, unit: "mg/L" }],
      }),
    );
    expect(e.meta).toBe("1 marker");
  });

  it("appends '· {N} abnormal' when any marker is flagged abnormal", () => {
    const e = eventFromBloodWork(
      bloodWorkRow({
        markers: [
          { name: "CRP", value: 12, unit: "mg/L", abnormal: true },
          { name: "ESR", value: 30, unit: "mm/hr", abnormal: false },
          { name: "WBC", value: 11, unit: "x10^9/L", abnormal: true },
        ],
      }),
    );
    expect(e.meta).toBe("3 markers · 2 abnormal");
    expect(e.payload).toEqual({
      bloodWorkId: "bw1",
      markerCount: 3,
      abnormalCount: 2,
    });
  });
});

describe("<MemoryTimelineMarker /> — visit", () => {
  const event: MemoryEvent = eventFromVisit(
    visitRow({ visitType: "follow-up", specialty: "Rheumatology" }),
    "2026-05-01",
  );

  it("renders the APPOINTMENT pill with the visit colour class", () => {
    render(<MemoryTimelineMarker event={event as Extract<MemoryEvent, { type: "visit" }>} />);
    const pill = screen.getByTestId("marker-pill");
    expect(pill).toHaveTextContent("APPOINTMENT");
    expect(pill.getAttribute("data-pill-kind")).toBe("visit");
    expect(pill.className).toMatch(/teal/);
  });

  it("aria-label includes time, pill, title, state", () => {
    render(<MemoryTimelineMarker event={event as Extract<MemoryEvent, { type: "visit" }>} />);
    const btn = screen.getByRole("button");
    const label = btn.getAttribute("aria-label") ?? "";
    expect(label).toContain("14:30");
    expect(label).toContain("APPOINTMENT");
    expect(label).toContain("Doctor visit");
    expect(label).toContain("Done");
  });

  it("renders the meta line under the title", () => {
    render(<MemoryTimelineMarker event={event as Extract<MemoryEvent, { type: "visit" }>} />);
    expect(
      screen.getByText("Follow-up · Dr. Mehta · Rheumatology"),
    ).toBeInTheDocument();
  });

  it("fires onTap with eventId on click", async () => {
    const onTap = vi.fn();
    render(
      <MemoryTimelineMarker
        event={event as Extract<MemoryEvent, { type: "visit" }>}
        onTap={onTap}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onTap).toHaveBeenCalledWith("visit:v1");
  });
});

describe("<MemoryTimelineMarker /> — blood-work", () => {
  const event = eventFromBloodWork(
    bloodWorkRow({
      markers: [
        { name: "CRP", value: 12, unit: "mg/L", abnormal: true },
        { name: "ESR", value: 30, unit: "mm/hr" },
      ],
    }),
  );

  it("renders the BLOOD WORK pill with the blood-work colour class", () => {
    render(<MemoryTimelineMarker event={event} />);
    const pill = screen.getByTestId("marker-pill");
    expect(pill).toHaveTextContent("BLOOD WORK");
    expect(pill.getAttribute("data-pill-kind")).toBe("blood-work");
    expect(pill.className).toMatch(/blue/);
  });

  it("renders the abnormal-aware meta line", () => {
    render(<MemoryTimelineMarker event={event} />);
    expect(screen.getByText("2 markers · 1 abnormal")).toBeInTheDocument();
  });
});
