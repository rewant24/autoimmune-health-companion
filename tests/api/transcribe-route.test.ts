/**
 * Tests for `app/api/transcribe/route.ts` — the REST-batch proxy that
 * replaces the streaming-WebSocket proxy post-Bug-1. The route now
 * buffers the request body, calls Sarvam's REST endpoint via
 * `lib/voice/sarvam-stt-rest.ts`, and emits one SSE `final` frame (or
 * one `error` frame) back to the browser.
 *
 * Strategy: vi.mock the REST module so we can drive arbitrary
 * transcribeBatch outcomes (success / SarvamRestError / non-Sarvam
 * throw) without touching the network. The route under test still
 * imports the SarvamRestError class for the mapping, so the mock keeps
 * the real class export.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'

// jsdom env doesn't expose web streams globally. Pin them to globalThis
// so both the test helpers and the route handler see the same constructor.
if (typeof globalThis.ReadableStream === 'undefined') {
  ;(globalThis as unknown as {
    ReadableStream: typeof NodeReadableStream
  }).ReadableStream = NodeReadableStream
}

// ----------------------------------------------------------------------
// Mock `@/lib/voice/sarvam-stt-rest` — must be hoisted before route imports.
// ----------------------------------------------------------------------

interface BatchOutcomeOk {
  kind: 'ok'
  transcript: string
  detectedLanguageCode?: string | null
  requestId?: string | null
}
interface BatchOutcomeRestError {
  kind: 'rest-error'
  code:
    | 'voice.provider_unconfigured'
    | 'voice.network'
    | 'voice.session_too_long'
    | 'voice.session_too_large'
    | 'voice.unprocessable'
    | 'voice.aborted'
  message: string
}
interface BatchOutcomeThrow {
  kind: 'throw'
  err: Error
}
interface BatchOutcomeAbortAware {
  kind: 'abort-aware'
  /** ms to wait before resolving. If signal aborts during the wait, throw a SarvamRestError('voice.aborted'). */
  delayMs: number
  /** What to return if no abort. */
  transcript: string
}
type BatchOutcome =
  | BatchOutcomeOk
  | BatchOutcomeRestError
  | BatchOutcomeThrow
  | BatchOutcomeAbortAware

const fakeState: {
  outcome: BatchOutcome
  lastCall: {
    audio: Uint8Array
    languageCode: string
    signal?: AbortSignal
  } | null
  apiKey: string | null
} = {
  outcome: { kind: 'ok', transcript: '' },
  lastCall: null,
  apiKey: 'test-key-do-not-leak',
}

vi.mock('@/lib/voice/sarvam-stt-rest', async () => {
  // Bring the real SarvamRestError class through; the route uses
  // `instanceof` to branch on it, and re-implementing it would diverge.
  const actual = await vi.importActual<
    typeof import('@/lib/voice/sarvam-stt-rest')
  >('@/lib/voice/sarvam-stt-rest')
  return {
    ...actual,
    readSarvamApiKey: () => fakeState.apiKey,
    transcribeBatch: vi.fn(
      async (opts: {
        audio: Uint8Array
        languageCode: string
        signal?: AbortSignal
      }) => {
        fakeState.lastCall = {
          audio: opts.audio,
          languageCode: opts.languageCode,
          signal: opts.signal,
        }
        const outcome = fakeState.outcome
        switch (outcome.kind) {
          case 'ok':
            return {
              transcript: outcome.transcript,
              requestId: outcome.requestId ?? null,
              detectedLanguageCode: outcome.detectedLanguageCode ?? null,
            }
          case 'rest-error':
            throw new actual.SarvamRestError(outcome.code, outcome.message)
          case 'throw':
            throw outcome.err
          case 'abort-aware': {
            // Resolve after delayMs OR throw 'voice.aborted' if signalled.
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                resolve()
              }, outcome.delayMs)
              if (opts.signal) {
                if (opts.signal.aborted) {
                  clearTimeout(timer)
                  reject(
                    new actual.SarvamRestError(
                      'voice.aborted',
                      'Sarvam request aborted.',
                    ),
                  )
                  return
                }
                opts.signal.addEventListener(
                  'abort',
                  () => {
                    clearTimeout(timer)
                    reject(
                      new actual.SarvamRestError(
                        'voice.aborted',
                        'Sarvam request aborted.',
                      ),
                    )
                  },
                  { once: true },
                )
              }
            })
            return {
              transcript: outcome.transcript,
              requestId: null,
              detectedLanguageCode: null,
            }
          }
        }
      },
    ),
  }
})

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function buildRequest(
  url: string,
  body: Uint8Array | Uint8Array[] | null,
  opts: {
    contentType?: string
    abortController?: AbortController
  } = {},
): Request {
  const { contentType = 'audio/wav', abortController } = opts
  if (body === null) {
    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      signal: abortController?.signal,
    })
  }
  // Always wrap in a ReadableStream so request.body is a stream we can
  // pump via getReader(). Passing Uint8Array directly to `body:` works at
  // the Request level but the test runtime's `request.body` getter
  // surfaces it as an empty stream.
  const chunks = body instanceof Uint8Array ? [body] : body
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        if (c.byteLength > 0) controller.enqueue(c)
        await new Promise((r) => setTimeout(r, 0))
      }
      controller.close()
    },
  })
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: stream as unknown as BodyInit,
    signal: abortController?.signal,
    // @ts-expect-error duplex required for streaming bodies under Node fetch
    duplex: 'half',
  })
}

async function readResponseText(res: Response): Promise<string> {
  if (res.body === null) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  out += decoder.decode()
  return out
}

function parseSseEvents(raw: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trimEnd()
    if (!trimmed.startsWith('data: ')) continue
    const json = trimmed.slice('data: '.length)
    try {
      out.push(JSON.parse(json) as Record<string, unknown>)
    } catch {
      // Ignore — we author the writer.
    }
  }
  return out
}

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------

describe('POST /api/transcribe (REST batch)', () => {
  beforeEach(() => {
    vi.resetModules()
    fakeState.outcome = { kind: 'ok', transcript: '' }
    fakeState.lastCall = null
    fakeState.apiKey = 'test-key-do-not-leak'
  })

  afterEach(() => {
    // No-op: fakeState is reset in beforeEach.
  })

  // --------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------

  it('emits a single SSE final frame with the transcript on success', async () => {
    fakeState.outcome = {
      kind: 'ok',
      transcript: 'hello there friend',
      requestId: 'req_abc',
      detectedLanguageCode: 'en-IN',
    }
    const { POST } = await import('@/app/api/transcribe/route')
    const audio = new Uint8Array(64).fill(0x10)
    const res = await POST(
      buildRequest('http://localhost/api/transcribe?lang=en-IN', audio),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/^text\/event-stream/)
    const events = parseSseEvents(await readResponseText(res))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'final',
      text: 'hello there friend',
      bytes: 64,
    })
    expect(typeof events[0]!.durationMs).toBe('number')
  })

  it('forwards the lang query param to transcribeBatch', async () => {
    fakeState.outcome = { kind: 'ok', transcript: '' }
    const { POST } = await import('@/app/api/transcribe/route')
    await readResponseText(
      await POST(
        buildRequest(
          'http://localhost/api/transcribe?lang=hi-IN',
          new Uint8Array([1, 2, 3, 4]),
        ),
      ),
    )
    expect(fakeState.lastCall?.languageCode).toBe('hi-IN')
  })

  it('defaults lang to en-IN when the query param is omitted', async () => {
    fakeState.outcome = { kind: 'ok', transcript: '' }
    const { POST } = await import('@/app/api/transcribe/route')
    await readResponseText(
      await POST(
        buildRequest(
          'http://localhost/api/transcribe',
          new Uint8Array([1, 2, 3, 4]),
        ),
      ),
    )
    expect(fakeState.lastCall?.languageCode).toBe('en-IN')
  })

  it('passes the buffered request body bytes through to transcribeBatch', async () => {
    fakeState.outcome = { kind: 'ok', transcript: '' }
    const { POST } = await import('@/app/api/transcribe/route')
    const chunks = [
      new Uint8Array([0xaa, 0xbb]),
      new Uint8Array([0xcc, 0xdd]),
      new Uint8Array([0xee, 0xff]),
    ]
    await readResponseText(
      await POST(buildRequest('http://localhost/api/transcribe', chunks)),
    )
    expect(fakeState.lastCall?.audio).toEqual(
      new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]),
    )
  })

  it('declares runtime = nodejs and dynamic = force-dynamic', async () => {
    const mod = await import('@/app/api/transcribe/route')
    expect(mod.runtime).toBe('nodejs')
    expect(mod.dynamic).toBe('force-dynamic')
  })

  // --------------------------------------------------------------------
  // Provider config + content-type guards
  // --------------------------------------------------------------------

  it('returns 503 voice.provider_unconfigured when SARVAM_API_KEY is missing', async () => {
    fakeState.apiKey = null
    const { POST } = await import('@/app/api/transcribe/route')
    const res = await POST(
      buildRequest(
        'http://localhost/api/transcribe',
        new Uint8Array([1, 2, 3]),
      ),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('voice.provider_unconfigured')
    const text = JSON.stringify(body)
    expect(text).not.toContain('test-key-do-not-leak')
  })

  it('returns 415 when Content-Type is missing or not an accepted audio type', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const reqA = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: 'x',
    })
    const resA = await POST(reqA)
    expect(resA.status).toBe(415)
    const bodyA = (await resA.json()) as { error: { code: string } }
    expect(bodyA.error.code).toBe('voice.bad_content_type')

    const reqB = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const resB = await POST(reqB)
    expect(resB.status).toBe(415)
  })

  it('accepts each of audio/wav, audio/webm, audio/ogg', async () => {
    fakeState.outcome = { kind: 'ok', transcript: '' }
    const { POST } = await import('@/app/api/transcribe/route')
    for (const ct of ['audio/wav', 'audio/webm', 'audio/ogg']) {
      const res = await POST(
        buildRequest(
          'http://localhost/api/transcribe',
          new Uint8Array([1, 2, 3]),
          { contentType: ct },
        ),
      )
      expect(res.status).toBe(200)
      await readResponseText(res)
    }
  })

  it('never echoes the SARVAM_API_KEY in any response body or header', async () => {
    fakeState.apiKey = 'super-secret-key-12345'
    fakeState.outcome = {
      kind: 'rest-error',
      code: 'voice.network',
      message: 'boom',
    }
    const { POST } = await import('@/app/api/transcribe/route')
    const res = await POST(
      buildRequest('http://localhost/api/transcribe', new Uint8Array([1, 2])),
    )
    const body = await readResponseText(res)
    expect(body).not.toContain('super-secret-key-12345')
    for (const [, value] of res.headers.entries()) {
      expect(value).not.toContain('super-secret-key-12345')
    }
  })

  // --------------------------------------------------------------------
  // Cost + abuse guards
  // --------------------------------------------------------------------

  it('emits voice.session_too_large and stops reading when audio bytes exceed the cap', async () => {
    fakeState.outcome = { kind: 'ok', transcript: 'should not run' }
    const { MAX_AUDIO_BYTES, POST } = await import('@/app/api/transcribe/route')
    // 1.5x the cap, in three chunks.
    const half = new Uint8Array(MAX_AUDIO_BYTES)
    const tail = new Uint8Array(Math.floor(MAX_AUDIO_BYTES / 2))
    const res = await POST(
      buildRequest('http://localhost/api/transcribe', [half, tail]),
    )
    const events = parseSseEvents(await readResponseText(res))
    const errors = events.filter((e) => e.kind === 'voice.session_too_large')
    expect(errors).toHaveLength(1)
    // Sarvam should never have been called when the cap fires first.
    expect(fakeState.lastCall).toBeNull()
    expect(res.headers.get('X-Voice-Cap-Hit')).toBe('1')
  })

  it('emits voice.session_too_long when the duration cap fires', async () => {
    fakeState.outcome = {
      kind: 'abort-aware',
      delayMs: 60_000,
      transcript: 'should never reach here',
    }
    vi.useFakeTimers()
    try {
      const { POST, MAX_DURATION_MS } = await import(
        '@/app/api/transcribe/route'
      )
      const resPromise = POST(
        buildRequest(
          'http://localhost/api/transcribe',
          new Uint8Array([1, 2, 3, 4]),
        ),
      )
      // Let the await chain advance into transcribeBatch.
      await vi.advanceTimersByTimeAsync(0)
      // Push past the duration cap. Our abort-aware mock rejects with
      // SarvamRestError('voice.aborted'); the route remaps that to
      // voice.session_too_long because abortController.signal.aborted is true.
      await vi.advanceTimersByTimeAsync(MAX_DURATION_MS + 100)
      vi.useRealTimers()
      const res = await resPromise
      const events = parseSseEvents(await readResponseText(res))
      const tooLong = events.filter((e) => e.kind === 'voice.session_too_long')
      expect(tooLong).toHaveLength(1)
      expect(res.headers.get('X-Voice-Cap-Hit')).toBe('1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns SSE error frames carrying the SarvamRestError code on upstream failure', async () => {
    const cases: Array<{
      code:
        | 'voice.network'
        | 'voice.unprocessable'
        | 'voice.session_too_large'
        | 'voice.provider_unconfigured'
    }> = [
      { code: 'voice.network' },
      { code: 'voice.unprocessable' },
      { code: 'voice.session_too_large' },
      { code: 'voice.provider_unconfigured' },
    ]
    for (const { code } of cases) {
      vi.resetModules()
      fakeState.outcome = { kind: 'rest-error', code, message: 'mock' }
      const { POST } = await import('@/app/api/transcribe/route')
      const res = await POST(
        buildRequest(
          'http://localhost/api/transcribe',
          new Uint8Array([1, 2, 3, 4]),
        ),
      )
      const events = parseSseEvents(await readResponseText(res))
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: 'error', kind: code })
    }
  })

  it('emits voice.unprocessable on an empty body', async () => {
    fakeState.outcome = { kind: 'ok', transcript: 'should not run' }
    const { POST } = await import('@/app/api/transcribe/route')
    const res = await POST(
      buildRequest('http://localhost/api/transcribe', new Uint8Array(0)),
    )
    const events = parseSseEvents(await readResponseText(res))
    expect(events[0]).toMatchObject({
      type: 'error',
      kind: 'voice.unprocessable',
    })
    expect(fakeState.lastCall).toBeNull()
  })

  it('sets X-Voice-Bytes, X-Voice-Duration-Ms, X-Voice-Cap-Hit response headers', async () => {
    fakeState.outcome = { kind: 'ok', transcript: 'hi' }
    const { POST } = await import('@/app/api/transcribe/route')
    const res = await POST(
      buildRequest(
        'http://localhost/api/transcribe',
        new Uint8Array([1, 2, 3, 4, 5]),
      ),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Voice-Bytes')).toBe('5')
    expect(res.headers.get('X-Voice-Cap-Hit')).toBe('0')
    const dur = Number(res.headers.get('X-Voice-Duration-Ms'))
    expect(Number.isFinite(dur)).toBe(true)
    expect(dur).toBeGreaterThanOrEqual(0)
    await readResponseText(res)
  })

  it('sets X-Voice-* on 503 short-circuit too', async () => {
    fakeState.apiKey = null
    const { POST } = await import('@/app/api/transcribe/route')
    const res = await POST(
      buildRequest('http://localhost/api/transcribe', new Uint8Array([1])),
    )
    expect(res.status).toBe(503)
    expect(res.headers.get('X-Voice-Bytes')).toBe('0')
    expect(res.headers.get('X-Voice-Duration-Ms')).toBe('0')
    expect(res.headers.get('X-Voice-Cap-Hit')).toBe('0')
  })

  // --------------------------------------------------------------------
  // Non-Sarvam throws inside transcribeBatch are remapped to voice.network
  // --------------------------------------------------------------------

  it('maps an unexpected non-Sarvam throw to a voice.network SSE error', async () => {
    fakeState.outcome = { kind: 'throw', err: new Error('rogue') }
    const { POST } = await import('@/app/api/transcribe/route')
    const res = await POST(
      buildRequest(
        'http://localhost/api/transcribe',
        new Uint8Array([1, 2, 3]),
      ),
    )
    const events = parseSseEvents(await readResponseText(res))
    expect(events[0]).toMatchObject({ type: 'error', kind: 'voice.network' })
  })
})
