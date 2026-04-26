/**
 * Tests for `app/api/speak/route.ts` (Voice C1, Chunk V.C, stories
 * SpeakRoute.US-V.C.1 + SpeakRoute.US-V.C.2).
 *
 * We mock `lib/voice/sarvam-tts-server` so no real `sarvamai` call leaves
 * the test. The mock exposes a `synthesizeMock` spy that lets each test
 * either return a canned audio payload or throw a typed `SarvamTtsError`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const synthesizeMock = vi.fn();

// `vi.mock` is hoisted to the top of the file. Anything the factory
// references must be defined inside the factory itself (or hoisted via
// `vi.hoisted`). We re-implement the typed error inside the factory and
// re-export the constructor for tests below.
vi.mock("@/lib/voice/sarvam-tts-server", () => {
  class SarvamTtsErrorMock extends Error {
    readonly kind: "missing_key" | "provider_failed";
    constructor(kind: "missing_key" | "provider_failed", message: string) {
      super(message);
      this.kind = kind;
      this.name = "SarvamTtsError";
    }
  }
  return {
    synthesize: (...args: unknown[]) => synthesizeMock(...args),
    SarvamTtsError: SarvamTtsErrorMock,
    DEFAULT_SPEAKER: "anushka",
    DEFAULT_MODEL: "bulbul:v2",
  };
});

// `lib/voice/sarvam-tts-server` carries an `import 'server-only'` guard
// that throws when reached from a non-server context. The mock above
// short-circuits the import, but the bare specifier still resolves; stub
// it to be safe so the route's own server-only chain doesn't fire.
vi.mock("server-only", () => ({}));

import { POST, MAX_TEXT_CHARS } from "@/app/api/speak/route";
import { SarvamTtsError as SarvamTtsErrorMock } from "@/lib/voice/sarvam-tts-server";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  synthesizeMock.mockReset();
});

describe("POST /api/speak — request validation (US-V.C.1 / US-V.C.2)", () => {
  it("returns 400 on invalid JSON body", async () => {
    const res = await POST(jsonRequest("not-json{"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("voice.bad_request");
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when `text` is missing", async () => {
    const res = await POST(jsonRequest({ language_code: "en-IN" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("voice.bad_request");
  });

  it("returns 400 when `language_code` is missing", async () => {
    const res = await POST(jsonRequest({ text: "Hello" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("voice.bad_request");
  });

  it("returns 413 when text exceeds the 1000-char cap", async () => {
    const res = await POST(
      jsonRequest({
        text: "a".repeat(MAX_TEXT_CHARS + 1),
        language_code: "en-IN",
      }),
    );
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe("voice.text_too_long");
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when text contains a control char (US-V.C.2)", async () => {
    // Vertical tab (0x0B) is below 0x20 and not `\n` — should be rejected.
    const res = await POST(
      jsonRequest({ text: "Hello\x0Bthere", language_code: "en-IN" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("voice.bad_request");
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it("returns 400 when text has more than 5 newlines (US-V.C.2)", async () => {
    const res = await POST(
      jsonRequest({ text: "a\nb\nc\nd\ne\nf\ng", language_code: "en-IN" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("voice.bad_request");
  });
});

describe("POST /api/speak — provider integration (US-V.C.1)", () => {
  it("happy path returns 200 with audio bytes and `audio/wav`", async () => {
    const audio = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0xde, 0xad]);
    synthesizeMock.mockResolvedValue({ audio, contentType: "audio/wav" });

    const res = await POST(
      jsonRequest({ text: "Hello there.", language_code: "en-IN" }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/wav");
    expect(res.headers.get("Content-Length")).toBe(String(audio.byteLength));

    const got = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(got)).toEqual(Array.from(audio));

    // text + language_code (and optional voice when present) must flow
    // through to synthesize().
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    expect(synthesizeMock.mock.calls[0][0]).toMatchObject({
      text: "Hello there.",
      language_code: "en-IN",
    });
  });

  it("forwards `voice` override to synthesize() when provided", async () => {
    synthesizeMock.mockResolvedValue({
      audio: new Uint8Array([1, 2]),
      contentType: "audio/wav",
    });

    await POST(
      jsonRequest({
        text: "hi",
        language_code: "en-IN",
        voice: "manisha",
      }),
    );

    expect(synthesizeMock).toHaveBeenCalledWith({
      text: "hi",
      language_code: "en-IN",
      voice: "manisha",
    });
  });

  it("returns 503 when synthesize throws missing_key", async () => {
    synthesizeMock.mockRejectedValue(
      new SarvamTtsErrorMock("missing_key", "no key"),
    );

    const res = await POST(
      jsonRequest({ text: "hi", language_code: "en-IN" }),
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("voice.provider_unconfigured");
  });

  it("returns 502 when synthesize throws provider_failed", async () => {
    synthesizeMock.mockRejectedValue(
      new SarvamTtsErrorMock("provider_failed", "upstream 500"),
    );

    const res = await POST(
      jsonRequest({ text: "hi", language_code: "en-IN" }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("voice.tts_failed");
  });

  it("returns 502 when synthesize throws an unknown error type", async () => {
    synthesizeMock.mockRejectedValue(new Error("something else"));

    const res = await POST(
      jsonRequest({ text: "hi", language_code: "en-IN" }),
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("voice.tts_failed");
  });
});
