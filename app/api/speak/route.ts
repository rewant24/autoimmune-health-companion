/**
 * POST /api/speak
 *
 * Server-only Next.js Route Handler — proxies a short utterance to the
 * Sarvam REST TTS endpoint and streams the resulting audio bytes back to
 * the client. Companion to `lib/voice/sarvam-tts-adapter.ts` (browser side)
 * and `lib/voice/sarvam-tts-server.ts` (SDK wrapper).
 *
 * Voice C1 stories implemented:
 *   - SpeakRoute.US-V.C.1 — happy path, malformed body 400, text >1000 413,
 *     missing key 503, provider error 502.
 *   - SpeakRoute.US-V.C.2 — auth + safety. `SARVAM_API_KEY` server-only,
 *     never logged. Reject control chars (ASCII <0x20 except `\n`) and
 *     more than 5 newlines (cheap prompt-injection-via-multiline guard).
 *
 * Why server-only: the Sarvam key must never reach the browser. The route
 * imports `lib/voice/sarvam-tts-server.ts` which carries the
 * `import 'server-only'` guard.
 *
 * Tests: `tests/api/speak-route.test.ts` mocks `lib/voice/sarvam-tts-server`.
 */
import { NextResponse } from "next/server";
import {
  synthesize,
  SarvamTtsError,
} from "@/lib/voice/sarvam-tts-server";

export const runtime = "nodejs";

/** Hard cap matches the cycle-plan story (US-V.C.1). */
export const MAX_TEXT_CHARS = 1000;
/** Cheap prompt-injection-via-multiline guard (US-V.C.2). */
export const MAX_NEWLINES = 5;

interface RequestBody {
  text: string;
  language_code: string;
  voice?: string;
}

function isRequestBody(value: unknown): value is RequestBody {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string" || v.text.length === 0) return false;
  if (typeof v.language_code !== "string" || v.language_code.length === 0) {
    return false;
  }
  if (v.voice !== undefined && typeof v.voice !== "string") return false;
  return true;
}

/**
 * Per US-V.C.2 — reject any ASCII control char below 0x20 except `\n`
 * (0x0A). We intentionally allow `\n` since some short messages may carry
 * one or two; the count cap (`MAX_NEWLINES`) handles abuse.
 */
function hasIllegalControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 && code !== 0x0a) return true;
  }
  return false;
}

function countNewlines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0x0a) n++;
  }
  return n;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, "voice.bad_request", "Invalid JSON body");
  }

  if (!isRequestBody(raw)) {
    return errorResponse(
      400,
      "voice.bad_request",
      "Body must include `text` and `language_code` strings",
    );
  }

  const { text, language_code, voice } = raw;

  if (text.length > MAX_TEXT_CHARS) {
    return errorResponse(
      413,
      "voice.text_too_long",
      `Text must be ${MAX_TEXT_CHARS} characters or fewer`,
    );
  }

  if (hasIllegalControlChars(text)) {
    return errorResponse(
      400,
      "voice.bad_request",
      "Text contains illegal control characters",
    );
  }

  if (countNewlines(text) > MAX_NEWLINES) {
    return errorResponse(
      400,
      "voice.bad_request",
      `Text must contain ${MAX_NEWLINES} newlines or fewer`,
    );
  }

  let result: { audio: Uint8Array; contentType: string };
  try {
    result = await synthesize({ text, language_code, voice });
  } catch (err) {
    if (err instanceof SarvamTtsError && err.kind === "missing_key") {
      return errorResponse(
        503,
        "voice.provider_unconfigured",
        "Voice provider is not configured on this server",
      );
    }
    if (err instanceof SarvamTtsError) {
      return errorResponse(
        502,
        "voice.tts_failed",
        "Voice provider failed to synthesize audio",
      );
    }
    return errorResponse(
      502,
      "voice.tts_failed",
      "Voice provider failed to synthesize audio",
    );
  }

  // Hand the bytes back. We don't stream chunk-by-chunk because the spike
  // confirmed REST returns a single full WAV buffer — there's nothing to
  // chunk. Fixed `Content-Length` lets the browser progress meter work.
  //
  // The `as BodyInit` cast works around a TS 5.9 lib-typing regression
  // where `Uint8Array<ArrayBufferLike>` isn't assignable to BodyInit even
  // though it's a valid value at runtime. Same workaround pattern Next
  // 16's own examples use.
  return new Response(result.audio as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.audio.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
