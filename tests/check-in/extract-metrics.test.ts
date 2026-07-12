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
 * 4. (2026-07-12 telemetry completion) each failure path emits its
 *    `voice_extract_*` voiceLog event before throwing.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractMetrics,
  ExtractDailyCapError,
  ExtractFailedError,
  ExtractRateLimitedError,
} from "@/lib/checkin/extract-metrics";
import {
  setVoiceLogSink,
  resetVoiceLogSink,
  type VoiceLogCategory,
  type VoiceLogFields,
} from "@/lib/voice/log";

// The failure paths under test now emit voiceLog events; capture them
// per-test (and keep the default console sink out of the runner output).
interface CapturedLog {
  category: VoiceLogCategory;
  fields: VoiceLogFields;
}
let voiceLogs: CapturedLog[] = [];
beforeEach(() => {
  voiceLogs = [];
  setVoiceLogSink({
    log(category, fields) {
      voiceLogs.push({ category, fields });
    },
  });
});
afterEach(() => {
  resetVoiceLogSink();
});

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

  // W2-2: provider-429 discrimination (feedback_server_429_ux).
  it("throws ExtractRateLimitedError on 429 with code extract.rate_limited", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          error: { code: "extract.rate_limited", retryAfterSeconds: 12 },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "12",
          },
        },
      )) as unknown as typeof fetch;
    const err = await extractMetrics({
      transcript: "anything",
      userId: "user-1",
      date: "2026-04-25",
      fetchImpl,
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ExtractRateLimitedError);
    expect((err as ExtractRateLimitedError).code).toBe(
      "extract.rate_limited",
    );
    expect((err as ExtractRateLimitedError).retryAfterSeconds).toBe(12);
  });

  it("falls back to the body's retryAfterSeconds when the header is absent", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          error: { code: "extract.rate_limited", retryAfterSeconds: 30 },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    const err = await extractMetrics({
      transcript: "anything",
      userId: "user-1",
      date: "2026-04-25",
      fetchImpl,
    }).then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as ExtractRateLimitedError).retryAfterSeconds).toBe(30);
  });

  it("still throws ExtractDailyCapError on a 429 with an unreadable body", async () => {
    const fetchImpl = (async () =>
      new Response("not json", { status: 429 })) as unknown as typeof fetch;
    await expect(
      extractMetrics({
        transcript: "anything",
        userId: "user-1",
        date: "2026-04-25",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ExtractDailyCapError);
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

// 2026-07-12 telemetry completion — every failure path emits a
// `voice_extract_*` event (codes only, never the transcript) before
// throwing, so cap / throttle / reject rates are observable in PostHog
// instead of only as their downstream Stage-2 UX.
describe("extractMetrics — failure telemetry", () => {
  const args = {
    transcript: "anything",
    userId: "user-1",
    date: "2026-04-25",
  };

  it("emits extract_daily_cap (guard) on the cap 429", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: { code: "extract.daily_cap_reached" } }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    await expect(extractMetrics({ ...args, fetchImpl })).rejects.toBeInstanceOf(
      ExtractDailyCapError,
    );
    expect(voiceLogs).toEqual([
      {
        category: "guard",
        fields: { event: "extract_daily_cap", source: "extractMetrics" },
      },
    ]);
  });

  it("emits extract_rate_limited (error) with retryAfterSeconds on the provider 429", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: { code: "extract.rate_limited" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "30",
          },
        },
      )) as unknown as typeof fetch;
    await expect(extractMetrics({ ...args, fetchImpl })).rejects.toBeInstanceOf(
      ExtractRateLimitedError,
    );
    expect(voiceLogs).toEqual([
      {
        category: "error",
        fields: {
          event: "extract_rate_limited",
          source: "extractMetrics",
          retryAfterSeconds: 30,
        },
      },
    ]);
  });

  it("omits retryAfterSeconds when the provider 429 carries none", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: { code: "extract.rate_limited" } }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    await extractMetrics({ ...args, fetchImpl }).catch(() => undefined);
    expect(voiceLogs).toEqual([
      {
        category: "error",
        fields: { event: "extract_rate_limited", source: "extractMetrics" },
      },
    ]);
  });

  it("emits extract_request_failed reason=http with the status on 5xx", async () => {
    const fetchImpl = (async () =>
      new Response("server error", { status: 500 })) as unknown as typeof fetch;
    await extractMetrics({ ...args, fetchImpl }).catch(() => undefined);
    expect(voiceLogs).toEqual([
      {
        category: "error",
        fields: {
          event: "extract_request_failed",
          source: "extractMetrics",
          reason: "http",
          status: 500,
        },
      },
    ]);
  });

  it("emits extract_request_failed reason=network when fetch throws", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await extractMetrics({ ...args, fetchImpl }).catch(() => undefined);
    expect(voiceLogs).toEqual([
      {
        category: "error",
        fields: {
          event: "extract_request_failed",
          source: "extractMetrics",
          reason: "network",
        },
      },
    ]);
  });

  it("emits extract_request_failed reason=malformed on non-JSON and missing-metrics bodies", async () => {
    const nonJson = (async () =>
      new Response("not-json", { status: 200 })) as unknown as typeof fetch;
    await extractMetrics({ ...args, fetchImpl: nonJson }).catch(
      () => undefined,
    );
    const missingKey = mockFetchOk({ unrelated: true });
    await extractMetrics({ ...args, fetchImpl: missingKey }).catch(
      () => undefined,
    );
    expect(voiceLogs).toHaveLength(2);
    for (const log of voiceLogs) {
      expect(log.category).toBe("error");
      expect(log.fields).toEqual({
        event: "extract_request_failed",
        source: "extractMetrics",
        reason: "malformed",
      });
    }
  });

  it("emits nothing on success", async () => {
    const fetchImpl = mockFetchOk({
      metrics: {
        pain: 4,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
    });
    await extractMetrics({ ...args, fetchImpl });
    expect(voiceLogs).toEqual([]);
  });
});
