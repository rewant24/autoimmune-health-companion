/**
 * Unit tests for `lib/voice/sarvam-tts-server.ts` — the SDK wrapper the
 * `/api/speak` route treats as its boundary. Added 2026-07-04 with the
 * Q2 (pace plumb) + Q3 (opt-in Sarvam response cache) quick wins; the
 * SDK itself is mocked, we assert the request shape handed to
 * `client.textToSpeech.convert(...)`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const convertMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("sarvamai", () => ({
  SarvamAIClient: class {
    textToSpeech = { convert: (...args: unknown[]) => convertMock(...args) };
  },
}));

import { synthesize, SarvamTtsError } from "@/lib/voice/sarvam-tts-server";

const AUDIO_B64 = Buffer.from([0x52, 0x49, 0x46, 0x46]).toString("base64");

beforeEach(() => {
  convertMock.mockReset();
  convertMock.mockResolvedValue({ audios: [AUDIO_B64] });
  vi.stubEnv("SARVAM_API_KEY", "test-key");
  vi.stubEnv("SARVAM_TTS_SPEAKER", undefined);
  vi.stubEnv("SARVAM_TTS_MODEL", undefined);
  vi.stubEnv("SARVAM_TTS_CACHED_RESPONSES", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("synthesize — request shape", () => {
  it("passes locked defaults (anushka on bulbul:v2) and decodes audio", async () => {
    const result = await synthesize({ text: "Hi.", language_code: "en-IN" });
    expect(convertMock).toHaveBeenCalledWith({
      text: "Hi.",
      target_language_code: "en-IN",
      speaker: "anushka",
      model: "bulbul:v2",
    });
    expect(result.contentType).toBe("audio/wav");
    expect(Array.from(result.audio)).toEqual([0x52, 0x49, 0x46, 0x46]);
  });

  it("forwards `pace` as a plain request field when provided (Q2)", async () => {
    await synthesize({ text: "Hi.", language_code: "en-IN", pace: 0.85 });
    expect(convertMock.mock.calls[0][0]).toMatchObject({ pace: 0.85 });
  });

  it("omits `pace` when not provided (default 1.0 stays provider-side)", async () => {
    await synthesize({ text: "Hi.", language_code: "en-IN" });
    expect("pace" in convertMock.mock.calls[0][0]).toBe(false);
  });

  it("omits `enable_cached_responses` by default (Q3 — beta, opt-in)", async () => {
    await synthesize({ text: "Hi.", language_code: "en-IN" });
    expect("enable_cached_responses" in convertMock.mock.calls[0][0]).toBe(
      false,
    );
  });

  it.each(["1", "true"])(
    "sends `enable_cached_responses` when SARVAM_TTS_CACHED_RESPONSES=%s",
    async (flag) => {
      vi.stubEnv("SARVAM_TTS_CACHED_RESPONSES", flag);
      await synthesize({ text: "Hi.", language_code: "en-IN" });
      expect(convertMock.mock.calls[0][0]).toMatchObject({
        enable_cached_responses: true,
      });
    },
  );

  it("ignores unrecognized SARVAM_TTS_CACHED_RESPONSES values", async () => {
    vi.stubEnv("SARVAM_TTS_CACHED_RESPONSES", "yes please");
    await synthesize({ text: "Hi.", language_code: "en-IN" });
    expect("enable_cached_responses" in convertMock.mock.calls[0][0]).toBe(
      false,
    );
  });
});

describe("synthesize — error surface", () => {
  it("throws missing_key when SARVAM_API_KEY is unset", async () => {
    vi.stubEnv("SARVAM_API_KEY", "");
    await expect(
      synthesize({ text: "Hi.", language_code: "en-IN" }),
    ).rejects.toMatchObject({ kind: "missing_key" });
    expect(convertMock).not.toHaveBeenCalled();
  });

  it("wraps SDK failures as provider_failed", async () => {
    convertMock.mockRejectedValue(new Error("upstream 500"));
    await expect(
      synthesize({ text: "Hi.", language_code: "en-IN" }),
    ).rejects.toBeInstanceOf(SarvamTtsError);
  });

  it("treats an empty audio payload as provider_failed", async () => {
    convertMock.mockResolvedValue({ audios: [] });
    await expect(
      synthesize({ text: "Hi.", language_code: "en-IN" }),
    ).rejects.toMatchObject({ kind: "provider_failed" });
  });
});
