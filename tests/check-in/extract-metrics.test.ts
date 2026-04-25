/**
 * Tests for `lib/checkin/extract-metrics.ts` (US-1.D.1).
 *
 * `extractMetrics` is a thin client over the server-only route handler at
 * POST /api/check-in/extract. We don't make real network calls or call the
 * Vercel AI Gateway — that contract is exercised in
 * `extract-route.test.ts` with a mocked `ai` module. Here we mock `fetch`
 * directly with the 8 canonical transcript fixtures to verify:
 *
 * 1. Each fixture's expected metrics survive the round-trip and surface
 *    only the keys with non-null values (Partial<CheckinMetrics>).
 * 2. 429 responses raise `ExtractDailyCapError` with the locked code.
 * 3. Network / 5xx / malformed-JSON failures raise `ExtractFailedError`.
 */
import { describe, it, expect } from "vitest";
import {
  extractMetrics,
  ExtractDailyCapError,
  ExtractFailedError,
} from "@/lib/checkin/extract-metrics";

interface Fixture {
  label: string;
  transcript: string;
  routeReturns: {
    pain: number | null;
    mood: "heavy" | "flat" | "okay" | "bright" | "great" | null;
    adherenceTaken: boolean | null;
    flare: "no" | "yes" | "ongoing" | null;
    energy: number | null;
  };
  /** Subset of keys the resulting Partial should contain. */
  expectedKeys: ReadonlyArray<
    "pain" | "mood" | "adherenceTaken" | "flare" | "energy"
  >;
}

const FIXTURES: Fixture[] = [
  {
    label: "all-5-covered",
    transcript:
      "Pain's about a six today, mood feels okay, took my methotrexate this morning, no flare, energy is maybe a five.",
    routeReturns: {
      pain: 6,
      mood: "okay",
      adherenceTaken: true,
      flare: "no",
      energy: 5,
    },
    expectedKeys: ["pain", "mood", "adherenceTaken", "flare", "energy"],
  },
  {
    label: "3-of-5",
    transcript:
      "Pain is a four, took my meds, energy is decent — maybe a six.",
    routeReturns: {
      pain: 4,
      mood: null,
      adherenceTaken: true,
      flare: null,
      energy: 6,
    },
    expectedKeys: ["pain", "adherenceTaken", "energy"],
  },
  {
    label: "0-of-5",
    transcript: "Just feeling weird today, can't really put words to it.",
    routeReturns: {
      pain: null,
      mood: null,
      adherenceTaken: null,
      flare: null,
      energy: null,
    },
    expectedKeys: [],
  },
  {
    label: "ambiguous-pain-kind-of-bad",
    transcript: "Pain is kind of bad today, didn't take my meds.",
    // 'kind of bad' is ambiguous → model returns null per the no-guessing rule.
    routeReturns: {
      pain: null,
      mood: null,
      adherenceTaken: false,
      flare: null,
      energy: null,
    },
    expectedKeys: ["adherenceTaken"],
  },
  {
    label: "mood-only",
    transcript: "Honestly, just feeling really heavy today.",
    routeReturns: {
      pain: null,
      mood: "heavy",
      adherenceTaken: null,
      flare: null,
      energy: null,
    },
    expectedKeys: ["mood"],
  },
  {
    label: "medication-negation-forgot-my-dose",
    transcript: "Forgot my dose this morning, otherwise the day is fine.",
    // 'I forgot my meds' → adherenceTaken: false (negation counts).
    routeReturns: {
      pain: null,
      mood: null,
      adherenceTaken: false,
      flare: null,
      energy: null,
    },
    expectedKeys: ["adherenceTaken"],
  },
  {
    label: "flare-language-really-bad-day",
    transcript:
      "It's a really bad day, the flare is back full force and pain is at an eight.",
    routeReturns: {
      pain: 8,
      mood: null,
      adherenceTaken: null,
      flare: "yes",
      energy: null,
    },
    expectedKeys: ["pain", "flare"],
  },
  {
    label: "energy-only-knackered",
    transcript: "Honestly just knackered, can barely keep my eyes open.",
    routeReturns: {
      pain: null,
      mood: null,
      adherenceTaken: null,
      flare: null,
      energy: 2,
    },
    expectedKeys: ["energy"],
  },
];

function mockFetchOk(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("extractMetrics — 8 fixture transcripts", () => {
  for (const fx of FIXTURES) {
    it(`${fx.label}: returns only the inferred keys as a Partial`, async () => {
      const fetchImpl = mockFetchOk({ metrics: fx.routeReturns });
      const result = await extractMetrics({
        transcript: fx.transcript,
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      });

      // Keys with non-null values must be present, others must be absent.
      const presentKeys = Object.keys(result).sort();
      expect(presentKeys).toEqual([...fx.expectedKeys].sort());

      // Spot-check a couple of the values.
      if (fx.routeReturns.pain !== null) {
        expect(result.pain).toBe(fx.routeReturns.pain);
      }
      if (fx.routeReturns.adherenceTaken !== null) {
        expect(result.adherenceTaken).toBe(fx.routeReturns.adherenceTaken);
      }
    });
  }
});

describe("extractMetrics — error paths", () => {
  it("throws ExtractDailyCapError on 429", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: { code: "extract.daily_cap_reached" } }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    await expect(
      extractMetrics({
        transcript: "anything",
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ExtractDailyCapError);
  });

  it("ExtractDailyCapError carries the locked error code", async () => {
    const err = new ExtractDailyCapError();
    expect(err.code).toBe("extract.daily_cap_reached");
  });

  it("throws ExtractFailedError on 500", async () => {
    const fetchImpl = (async () =>
      new Response("server error", { status: 500 })) as unknown as typeof fetch;
    await expect(
      extractMetrics({
        transcript: "x",
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ExtractFailedError);
  });

  it("throws ExtractFailedError on network error", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(
      extractMetrics({
        transcript: "x",
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ExtractFailedError);
  });

  it("throws ExtractFailedError on malformed JSON body", async () => {
    const fetchImpl = (async () =>
      new Response("not-json", { status: 200 })) as unknown as typeof fetch;
    await expect(
      extractMetrics({
        transcript: "x",
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ExtractFailedError);
  });

  it("throws ExtractFailedError when body lacks `metrics` key", async () => {
    const fetchImpl = mockFetchOk({ unrelated: true });
    await expect(
      extractMetrics({
        transcript: "x",
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ExtractFailedError);
  });

  it("sends transcript / userId / date in the POST body", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({
          metrics: {
            pain: null,
            mood: null,
            adherenceTaken: null,
            flare: null,
            energy: null,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await extractMetrics({
      transcript: "hello",
      userId: "user-42",
      date: "2026-04-25",
      fetchImpl,
    });

    expect(captured).not.toBeNull();
    const c = captured as unknown as { url: string; init: RequestInit };
    expect(c.url).toBe("/api/check-in/extract");
    expect(c.init.method).toBe("POST");
    const parsed = JSON.parse(c.init.body as string);
    expect(parsed.transcript).toBe("hello");
    expect(parsed.userId).toBe("user-42");
    expect(parsed.date).toBe("2026-04-25");
  });
});
