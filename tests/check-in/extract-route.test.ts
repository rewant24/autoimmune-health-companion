/**
 * Tests for `app/api/check-in/extract/route.ts` (US-1.D.1 + US-1.D.2).
 *
 * We mock both `ai` (so no AI Gateway call leaves the test) and
 * `convex/browser` (so no Convex round-trip). The mocks expose spies the
 * tests use to assert the cost guard fires before the LLM and to feed
 * canned `generateObject` results.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks -----------------------------------------------------------

const generateObjectMock = vi.fn();
const gatewayMock = vi.fn((id: string) => ({ __mock: "gateway", id }));

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  gateway: (id: string) => gatewayMock(id),
}));

const convexMutationMock = vi.fn();

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    constructor(_url: string) {}
    mutation(...args: unknown[]) {
      return convexMutationMock(...args);
    }
  },
}));

// `anyApi.extractAttempts.incrementAndCheck` is just a Proxy in the real
// convex/server, but for our route the underlying ConvexHttpClient.mutation
// receives whatever we pass. The shape doesn't matter for the mock.
vi.mock("convex/server", async () => {
  const proxy = new Proxy(
    {},
    {
      get(_t, p1: string | symbol) {
        return new Proxy(
          {},
          {
            get(_t2, p2: string | symbol) {
              return `${String(p1)}.${String(p2)}`;
            },
          },
        );
      },
    },
  );
  return { anyApi: proxy };
});

// ---- Import the route AFTER mocks ------------------------------------------

import { POST } from "@/app/api/check-in/extract/route";
import { MAX_TRANSCRIPT_CHARS } from "@/lib/checkin/extract-prompt";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/check-in/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  generateObjectMock.mockReset();
  gatewayMock.mockClear();
  convexMutationMock.mockReset();
});

describe("POST /api/check-in/extract — request validation", () => {
  it("returns 400 on invalid JSON body", async () => {
    const req = jsonRequest("not-json{");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("extract.bad_request");
  });

  it("returns 400 when fields are missing", async () => {
    const res = await POST(jsonRequest({ transcript: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when date is malformed", async () => {
    const res = await POST(
      jsonRequest({ transcript: "x", userId: "u", date: "April 25" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/check-in/extract — cost guard (US-1.D.2)", () => {
  it("calls Convex incrementAndCheck before any LLM work", async () => {
    convexMutationMock.mockResolvedValue({ count: 1, capReached: false });
    generateObjectMock.mockResolvedValue({
      object: {
        pain: null,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
    });
    await POST(
      jsonRequest({ transcript: "hi", userId: "u-1", date: "2026-04-25" }),
    );
    expect(convexMutationMock).toHaveBeenCalledTimes(1);
    // The 2nd mutation arg carries the userId/date.
    expect(convexMutationMock.mock.calls[0][1]).toEqual({
      userId: "u-1",
      date: "2026-04-25",
    });
    // generateObject is called only after the cost guard.
    const cgOrder = convexMutationMock.mock.invocationCallOrder[0];
    const llmOrder = generateObjectMock.mock.invocationCallOrder[0];
    expect(cgOrder).toBeLessThan(llmOrder);
  });

  it("returns 429 with code extract.daily_cap_reached when cap is hit", async () => {
    convexMutationMock.mockResolvedValue({ count: 6, capReached: true });
    const res = await POST(
      jsonRequest({ transcript: "hi", userId: "u-1", date: "2026-04-25" }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("extract.daily_cap_reached");
    // LLM must NOT have been called when the cap fires.
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("returns 500 if the cost-guard mutation itself throws", async () => {
    convexMutationMock.mockRejectedValue(new Error("convex down"));
    const res = await POST(
      jsonRequest({ transcript: "hi", userId: "u-1", date: "2026-04-25" }),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("extract.cost_guard_failed");
  });
});

describe("POST /api/check-in/extract — LLM call (US-1.D.1)", () => {
  beforeEach(() => {
    convexMutationMock.mockResolvedValue({ count: 1, capReached: false });
  });

  it("returns 200 with the canned metrics on success", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        pain: 6,
        mood: "okay",
        adherenceTaken: true,
        flare: "no",
        energy: 5,
      },
    });
    const res = await POST(
      jsonRequest({
        transcript: "Pain six, mood okay, took meds, no flare, energy five.",
        userId: "u-1",
        date: "2026-04-25",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics).toEqual({
      pain: 6,
      mood: "okay",
      adherenceTaken: true,
      flare: "no",
      energy: 5,
    });
  });

  it("uses gpt-4o-mini via gateway as the locked model id (ADR-020)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        pain: null,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
    });
    await POST(
      jsonRequest({ transcript: "ok", userId: "u-1", date: "2026-04-25" }),
    );
    expect(gatewayMock).toHaveBeenCalledWith("openai/gpt-4o-mini");
  });

  it("caps maxOutputTokens at 200 (ADR-020)", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        pain: null,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
    });
    await POST(
      jsonRequest({ transcript: "ok", userId: "u-1", date: "2026-04-25" }),
    );
    const opts = generateObjectMock.mock.calls[0][0] as {
      maxOutputTokens: number;
    };
    expect(opts.maxOutputTokens).toBe(200);
  });

  it("includes the no-hallucination + negation lines in the system prompt", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        pain: null,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
    });
    await POST(
      jsonRequest({ transcript: "ok", userId: "u-1", date: "2026-04-25" }),
    );
    const opts = generateObjectMock.mock.calls[0][0] as { system: string };
    expect(opts.system).toContain(
      "If you cannot reliably infer a value, return null. Do not guess.",
    );
    expect(opts.system).toContain("Negation counts as a value");
  });

  it("truncates oversized transcripts before sending to the model", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        pain: null,
        mood: null,
        adherenceTaken: null,
        flare: null,
        energy: null,
      },
    });
    const huge = "a".repeat(MAX_TRANSCRIPT_CHARS + 1000);
    await POST(
      jsonRequest({ transcript: huge, userId: "u-1", date: "2026-04-25" }),
    );
    const opts = generateObjectMock.mock.calls[0][0] as { prompt: string };
    // Truncation marker is appended; total prompt length must be bounded.
    expect(opts.prompt.length).toBeLessThan(MAX_TRANSCRIPT_CHARS + 200);
    expect(opts.prompt).toContain("[...truncated]");
  });

  it("short-circuits on an empty transcript without calling the model", async () => {
    const res = await POST(
      jsonRequest({ transcript: "   ", userId: "u-1", date: "2026-04-25" }),
    );
    expect(res.status).toBe(200);
    expect(generateObjectMock).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.metrics.pain).toBeNull();
  });

  it("returns 502 with code extract.failed when generateObject throws", async () => {
    generateObjectMock.mockRejectedValue(new Error("schema parse failed"));
    const res = await POST(
      jsonRequest({ transcript: "hi", userId: "u-1", date: "2026-04-25" }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("extract.failed");
  });
});
