/**
 * Server-only Sarvam TTS wrapper (Voice C1, Chunk V.C, story SpeakRoute.US-V.C.1
 * + US-V.C.2).
 *
 * Wraps the `sarvamai` SDK's `client.textToSpeech.convert(...)` REST call:
 *   - Reads `SARVAM_API_KEY` from `process.env` at call time (not at module
 *     load) so the route can return 503 cleanly when the key is missing.
 *   - Locks the model + speaker defaults to the values picked in
 *     `docs/research/sarvam-format-spikes.md` (anushka on bulbul:v2). Both
 *     can be overridden via env vars `SARVAM_TTS_SPEAKER` /
 *     `SARVAM_TTS_MODEL`.
 *   - Decodes the base64 string returned in `audios[0]` to a binary buffer
 *     the route hands back to the client as `Content-Type: audio/wav`.
 *
 * Why a separate module: the route handler stays small and the unit test
 * `tests/api/speak-route.test.ts` mocks this module rather than mocking
 * `sarvamai` deep inside the SDK. The integration with the real Sarvam SDK
 * is exercised by the spike notes — the route test treats this module as
 * the boundary.
 *
 * Hard rule: this file MUST never run in the browser. It imports `sarvamai`
 * which transitively pulls in Node-only deps. Next.js enforces this via
 * the `import 'server-only'` guard at the top.
 */
import "server-only";
import { SarvamAIClient } from "sarvamai";

/**
 * Locked default voice + model picked in the TTS spike (2026-04-26).
 * See `docs/research/sarvam-format-spikes.md` § Outcome.
 */
export const DEFAULT_SPEAKER = "anushka";
export const DEFAULT_MODEL = "bulbul:v2";

/** Typed error surface so the route can map cleanly to HTTP codes. */
export class SarvamTtsError extends Error {
  readonly kind: "missing_key" | "provider_failed";
  constructor(kind: "missing_key" | "provider_failed", message: string) {
    super(message);
    this.kind = kind;
    this.name = "SarvamTtsError";
  }
}

export interface SynthesizeArgs {
  text: string;
  language_code: string;
  voice?: string;
}

export interface SynthesizeResult {
  /** Raw WAV bytes (decoded from `audios[0]` base64). */
  audio: Uint8Array;
  /** Mirror header for the route response. Currently always `audio/wav`. */
  contentType: "audio/wav";
}

/**
 * Build a Sarvam client. Pulled out so the route test can mock the
 * synthesize() call without touching the SDK constructor.
 */
function buildClient(apiKey: string): SarvamAIClient {
  return new SarvamAIClient({ apiSubscriptionKey: apiKey });
}

/**
 * Call Sarvam REST TTS once. Returns decoded WAV bytes ready to stream to
 * the client.
 *
 * Throws `SarvamTtsError`:
 *   - `kind: 'missing_key'` if `SARVAM_API_KEY` is not set.
 *   - `kind: 'provider_failed'` for any SDK error or empty response.
 */
export async function synthesize(
  args: SynthesizeArgs,
): Promise<SynthesizeResult> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new SarvamTtsError(
      "missing_key",
      "SARVAM_API_KEY is not set in the server environment",
    );
  }

  const speaker = args.voice ?? process.env.SARVAM_TTS_SPEAKER ?? DEFAULT_SPEAKER;
  const model = process.env.SARVAM_TTS_MODEL ?? DEFAULT_MODEL;

  const client = buildClient(apiKey);

  let response: { audios?: string[] } | undefined;
  try {
    // The SDK type definitions accept these as branded string unions;
    // we widen at the boundary because callers pass plain strings.
    response = (await client.textToSpeech.convert({
      text: args.text,
      target_language_code: args.language_code as never,
      speaker: speaker as never,
      model: model as never,
    })) as { audios?: string[] };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sarvam TTS request failed";
    // Never log the key. Re-throw a typed error so the route maps to 502.
    throw new SarvamTtsError("provider_failed", message);
  }

  const base64 = response?.audios?.[0];
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new SarvamTtsError(
      "provider_failed",
      "Sarvam TTS returned no audio payload",
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    throw new SarvamTtsError(
      "provider_failed",
      "Sarvam TTS returned non-base64 audio payload",
    );
  }

  if (buffer.length === 0) {
    throw new SarvamTtsError(
      "provider_failed",
      "Sarvam TTS returned an empty audio payload",
    );
  }

  return {
    // Pass a fresh Uint8Array (Node Buffer subclass works as a Uint8Array
    // too — but copying isolates the route from any underlying buffer
    // pool reuse).
    audio: new Uint8Array(buffer),
    contentType: "audio/wav",
  };
}
