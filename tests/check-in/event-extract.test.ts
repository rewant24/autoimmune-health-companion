/**
 * F05 chunk 5.C — `lib/checkin/event-extract.ts` unit tests.
 *
 * Covers:
 *   - Date resolver: bare keywords, relative-day-offset, weekday phrases.
 *   - resolveExtraction: trims, defaults `visitType`, prefers literal `date`
 *     over `relativeDate`, falls back to `checkInDate`, and propagates
 *     marker units when present (or null when absent).
 *   - extractEvents() client helper: 200 happy path, 429 cap-reached,
 *     malformed body, network failure. Empty transcript short-circuits.
 *   - Asserts the helper does NOT add an Authorization header — confirms
 *     no API key leaks into the client (server-only per ADR-020).
 */
import { describe, it, expect, vi } from "vitest";
import {
  addDaysToIsoDate,
  resolveRelativeDate,
  resolveItemDate,
  resolveExtraction,
  extractEvents,
  EventExtractDailyCapError,
  EventExtractFailedError,
  type EventExtractionRaw,
} from "@/lib/checkin/event-extract";

describe("addDaysToIsoDate", () => {
  it("adds positive days", () => {
    expect(addDaysToIsoDate("2026-05-01", 1)).toBe("2026-05-02");
    expect(addDaysToIsoDate("2026-05-01", 30)).toBe("2026-05-31");
  });

  it("subtracts via negative offset", () => {
    expect(addDaysToIsoDate("2026-05-01", -1)).toBe("2026-04-30");
    expect(addDaysToIsoDate("2026-05-01", -7)).toBe("2026-04-24");
  });

  it("rolls month and year boundaries", () => {
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToIsoDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("rejects malformed anchor", () => {
    expect(() => addDaysToIsoDate("not-a-date", 1)).toThrow();
  });
});

describe("resolveRelativeDate", () => {
  // 2026-05-01 is a Friday.
  const ANCHOR = "2026-05-01";

  it("resolves 'today'", () => {
    expect(resolveRelativeDate("today", ANCHOR)).toBe("2026-05-01");
  });

  it("resolves 'yesterday'", () => {
    expect(resolveRelativeDate("yesterday", ANCHOR)).toBe("2026-04-30");
  });

  it("resolves 'tomorrow'", () => {
    expect(resolveRelativeDate("tomorrow", ANCHOR)).toBe("2026-05-02");
  });

  it("resolves 'last week' / 'next week'", () => {
    expect(resolveRelativeDate("last week", ANCHOR)).toBe("2026-04-24");
    expect(resolveRelativeDate("next week", ANCHOR)).toBe("2026-05-08");
  });

  it("resolves 'next Tuesday' as the first Tuesday strictly after Fri 2026-05-01", () => {
    // Fri 2026-05-01 → next Tuesday = Tue 2026-05-05.
    expect(resolveRelativeDate("next Tuesday", ANCHOR)).toBe("2026-05-05");
  });

  it("resolves 'last Tuesday' as the most recent Tuesday strictly before Fri 2026-05-01", () => {
    expect(resolveRelativeDate("last Tuesday", ANCHOR)).toBe("2026-04-28");
  });

  it("resolves 'this Friday' (anchor day) as the anchor itself", () => {
    expect(resolveRelativeDate("this Friday", ANCHOR)).toBe("2026-05-01");
  });

  it("treats a bare weekday as 'next <weekday>'", () => {
    expect(resolveRelativeDate("Tuesday", ANCHOR)).toBe("2026-05-05");
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(resolveRelativeDate("  YESTERDAY  ", ANCHOR)).toBe("2026-04-30");
    expect(resolveRelativeDate("Next   Tuesday", ANCHOR)).toBe("2026-05-05");
  });

  it("returns null on unrecognised phrases", () => {
    expect(resolveRelativeDate("the moon", ANCHOR)).toBeNull();
    expect(resolveRelativeDate("", ANCHOR)).toBeNull();
    expect(resolveRelativeDate("   ", ANCHOR)).toBeNull();
  });
});

describe("resolveItemDate", () => {
  const CHECK_IN = "2026-05-01";

  it("prefers literal ISO `date` over `relativeDate`", () => {
    expect(
      resolveItemDate(
        { date: "2026-04-15", relativeDate: "yesterday" },
        CHECK_IN,
      ),
    ).toBe("2026-04-15");
  });

  it("uses `relativeDate` when `date` is null", () => {
    expect(
      resolveItemDate({ date: null, relativeDate: "yesterday" }, CHECK_IN),
    ).toBe("2026-04-30");
  });

  it("falls back to checkInDate when both are absent", () => {
    expect(resolveItemDate({}, CHECK_IN)).toBe(CHECK_IN);
  });

  it("falls back to checkInDate when relativeDate is unrecognised", () => {
    expect(
      resolveItemDate({ relativeDate: "uhhh sometime" }, CHECK_IN),
    ).toBe(CHECK_IN);
  });

  it("rejects a malformed literal `date` and falls through to relativeDate", () => {
    expect(
      resolveItemDate(
        { date: "April 15", relativeDate: "yesterday" },
        CHECK_IN,
      ),
    ).toBe("2026-04-30");
  });
});

describe("resolveExtraction", () => {
  const CHECK_IN = "2026-05-01";

  it("returns empty arrays for empty input", () => {
    const raw: EventExtractionRaw = { visits: [], bloodWork: [] };
    expect(resolveExtraction(raw, CHECK_IN)).toEqual({
      visits: [],
      bloodWork: [],
    });
  });

  it("resolves visit dates and trims doctor names", () => {
    const raw: EventExtractionRaw = {
      visits: [
        {
          doctorName: "  Dr. Mehta  ",
          relativeDate: "yesterday",
          visitType: "follow-up",
        },
        {
          doctorName: "Dr. Singh",
          date: "2026-06-10",
          visitType: "consultation",
        },
      ],
      bloodWork: [],
    };
    const out = resolveExtraction(raw, CHECK_IN);
    expect(out.visits).toEqual([
      {
        doctorName: "Dr. Mehta",
        date: "2026-04-30",
        visitType: "follow-up",
      },
      {
        doctorName: "Dr. Singh",
        date: "2026-06-10",
        visitType: "consultation",
      },
    ]);
  });

  it("propagates specialty + notes when present, omits when blank", () => {
    const raw: EventExtractionRaw = {
      visits: [
        {
          doctorName: "Dr. Mehta",
          specialty: "Rheumatology",
          notes: "labs ordered",
          visitType: "consultation",
        },
        {
          doctorName: "Dr. Singh",
          specialty: "  ",
          notes: "",
          visitType: "consultation",
        },
      ],
      bloodWork: [],
    };
    const out = resolveExtraction(raw, CHECK_IN);
    expect(out.visits[0].specialty).toBe("Rheumatology");
    expect(out.visits[0].notes).toBe("labs ordered");
    expect(out.visits[1].specialty).toBeUndefined();
    expect(out.visits[1].notes).toBeUndefined();
  });

  it("normalises blood-work markers and units (null when blank)", () => {
    const raw: EventExtractionRaw = {
      visits: [],
      bloodWork: [
        {
          markers: [
            { name: "CRP", value: 12, unit: "mg/L" },
            { name: "  ESR  ", value: 30, unit: "" },
            { name: "WBC", value: 7.2, unit: null },
          ],
          relativeDate: "last week",
        },
      ],
    };
    const out = resolveExtraction(raw, CHECK_IN);
    expect(out.bloodWork).toHaveLength(1);
    expect(out.bloodWork[0].date).toBe("2026-04-24");
    expect(out.bloodWork[0].markers).toEqual([
      { name: "CRP", value: 12, unit: "mg/L" },
      { name: "ESR", value: 30, unit: null },
      { name: "WBC", value: 7.2, unit: null },
    ]);
  });
});

describe("extractEvents — client helper", () => {
  const baseArgs = {
    transcript: "I saw Dr. Mehta yesterday and got my CRP back, it was 12.",
    checkInDate: "2026-05-01",
    userId: "user-1",
  };

  it("returns empty result for an empty transcript without calling fetch", async () => {
    const fetchImpl = (() => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    const out = await extractEvents({
      ...baseArgs,
      transcript: "   ",
      fetchImpl,
    });
    expect(out).toEqual({ visits: [], bloodWork: [] });
  });

  it("posts JSON to the route and returns resolved events on 200", async () => {
    const seen: { url: string; init: RequestInit | undefined } = {
      url: "",
      init: undefined,
    };
    const fetchImpl: typeof fetch = (async (url: string, init?: RequestInit) => {
      seen.url = url;
      seen.init = init;
      const body = {
        events: {
          visits: [
            {
              doctorName: "Dr. Mehta",
              relativeDate: "yesterday",
              visitType: "follow-up",
            },
          ],
          bloodWork: [
            {
              markers: [{ name: "CRP", value: 12, unit: "mg/L" }],
              relativeDate: null,
              date: null,
            },
          ],
        },
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const out = await extractEvents({ ...baseArgs, fetchImpl });
    expect(seen.url).toBe("/api/check-in/extract-event");
    expect(seen.init?.method).toBe("POST");
    // Confirm we don't accidentally leak an Authorization header.
    const headers = new Headers(seen.init?.headers);
    expect(headers.has("Authorization")).toBe(false);
    // The body relays the full payload + checkInDate.
    const sent = JSON.parse(seen.init?.body as string);
    expect(sent).toEqual({
      transcript: baseArgs.transcript,
      userId: baseArgs.userId,
      checkInDate: baseArgs.checkInDate,
    });

    expect(out.visits).toEqual([
      {
        doctorName: "Dr. Mehta",
        date: "2026-04-30",
        visitType: "follow-up",
      },
    ]);
    expect(out.bloodWork).toEqual([
      {
        date: "2026-05-01",
        markers: [{ name: "CRP", value: 12, unit: "mg/L" }],
      },
    ]);
  });

  it("throws EventExtractDailyCapError on 429", async () => {
    const fetchImpl: typeof fetch = (async () =>
      new Response(
        JSON.stringify({ error: { code: "extract.daily_cap_reached" } }),
        { status: 429 },
      )) as unknown as typeof fetch;
    await expect(
      extractEvents({ ...baseArgs, fetchImpl }),
    ).rejects.toBeInstanceOf(EventExtractDailyCapError);
  });

  it("throws EventExtractFailedError on a non-2xx non-429 response", async () => {
    const fetchImpl: typeof fetch = (async () =>
      new Response("boom", { status: 500 })) as unknown as typeof fetch;
    await expect(
      extractEvents({ ...baseArgs, fetchImpl }),
    ).rejects.toBeInstanceOf(EventExtractFailedError);
  });

  it("throws EventExtractFailedError when the body lacks `events`", async () => {
    const fetchImpl: typeof fetch = (async () =>
      new Response(JSON.stringify({ unrelated: true }), {
        status: 200,
      })) as unknown as typeof fetch;
    await expect(
      extractEvents({ ...baseArgs, fetchImpl }),
    ).rejects.toBeInstanceOf(EventExtractFailedError);
  });

  it("wraps fetch network errors in EventExtractFailedError", async () => {
    const fetchImpl: typeof fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(
      extractEvents({ ...baseArgs, fetchImpl }),
    ).rejects.toBeInstanceOf(EventExtractFailedError);
  });
});

// ---- Route-level coordination invariant -----------------------------------
//
// CRITICAL INVARIANT (ADR-020): a single check-in burns ONE
// `extractAttempts.incrementAndCheck` counter regardless of how many
// sibling extractor routes fire. The metrics route owns the increment;
// this route does NOT increment again. We assert that by importing the
// route handler with `convex/browser` mocked — the import + a happy-path
// POST must complete without ever instantiating ConvexHttpClient or
// calling .mutation().

describe("/api/check-in/extract-event — no cap-counter increment (ADR-020)", () => {
  it("does NOT call extractAttempts.incrementAndCheck", async () => {
    // Mock the AI gateway so the route's generateObject() returns a stub.
    vi.resetModules();
    const generateObjectMock = vi.fn().mockResolvedValue({
      object: { visits: [], bloodWork: [] },
    });
    const gatewayMock = vi.fn((id: string) => ({ __mock: "gateway", id }));
    vi.doMock("ai", () => ({
      generateObject: (...args: unknown[]) => generateObjectMock(...args),
      gateway: (id: string) => gatewayMock(id),
    }));

    // Spy ConvexHttpClient + its mutation method. If the route ever calls
    // either, this test fails — the invariant is broken.
    const convexCtor = vi.fn();
    const mutationSpy = vi.fn();
    vi.doMock("convex/browser", () => ({
      ConvexHttpClient: class {
        constructor(url: string) {
          convexCtor(url);
        }
        mutation(...args: unknown[]) {
          return mutationSpy(...args);
        }
      },
    }));

    const { POST } = await import(
      "@/app/api/check-in/extract-event/route"
    );

    const req = new Request(
      "http://localhost/api/check-in/extract-event",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: "I saw Dr. Mehta yesterday.",
          userId: "u-1",
          checkInDate: "2026-05-01",
        }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    // The crucial assertions: no Convex client built, no mutation called.
    expect(convexCtor).not.toHaveBeenCalled();
    expect(mutationSpy).not.toHaveBeenCalled();
    // gpt-4o-mini via gateway is locked.
    expect(gatewayMock).toHaveBeenCalledWith("openai/gpt-4o-mini");
  });
});
