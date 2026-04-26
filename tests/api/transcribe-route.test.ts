/**
 * Tests for `app/api/transcribe/route.ts` — the Vercel HTTP-streaming
 * proxy that bridges browser MediaRecorder output to Sarvam streaming
 * STT and pipes partials back as Server-Sent Events.
 *
 * Strategy: mock `sarvamai` with a controllable `FakeSocket` so we can
 * drive partial / error / close events deterministically without any
 * network. The mock is registered before any import of the route or its
 * server-side helper.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'

// jsdom env doesn't expose web streams globally. Pin them to `globalThis`
// so both the test helpers and the route handler (running under the same
// VM context) see the same constructor — otherwise the route's
// `request.body.getReader()` operates on an instance the body doesn't
// know about.
if (typeof globalThis.ReadableStream === 'undefined') {
  ;(globalThis as unknown as {
    ReadableStream: typeof NodeReadableStream
  }).ReadableStream = NodeReadableStream
}

// ----------------------------------------------------------------------
// Mock `sarvamai` — must be hoisted by Vitest before route imports it.
// ----------------------------------------------------------------------

interface FakeSocketEventHandlers {
  message?: (msg: unknown) => void
  error?: (err: Error) => void
  close?: () => void
  open?: () => void
}

class FakeSocket {
  public closed = false
  public flushCalls = 0
  public sentChunks: { audio: string; sample_rate?: number; encoding?: string }[] =
    []
  private handlers: FakeSocketEventHandlers = {}
  on<T extends keyof FakeSocketEventHandlers>(
    event: T,
    cb: FakeSocketEventHandlers[T],
  ): void {
    this.handlers[event] = cb
  }
  transcribe(params: {
    audio: string
    sample_rate?: number
    encoding?: string
  }): void {
    if (this.closed) throw new Error('socket closed')
    this.sentChunks.push(params)
  }
  flush(): void {
    this.flushCalls += 1
  }
  close(): void {
    if (this.closed) return
    this.closed = true
    this.handlers.close?.()
  }
  emitMessage(msg: unknown): void {
    this.handlers.message?.(msg)
  }
  emitError(err: Error): void {
    this.handlers.error?.(err)
  }
  emitClose(): void {
    if (this.closed) return
    this.closed = true
    this.handlers.close?.()
  }
}

const fakeState: {
  socket: FakeSocket | null
  connectArgs: unknown
  connectShouldThrow: Error | null
} = { socket: null, connectArgs: null, connectShouldThrow: null }

vi.mock('sarvamai', () => {
  return {
    SarvamAIClient: class MockSarvamAIClient {
      constructor(_opts: { apiSubscriptionKey: string }) {
        // no-op
      }
      speechToTextStreaming = {
        connect: async (args: unknown) => {
          fakeState.connectArgs = args
          if (fakeState.connectShouldThrow !== null) {
            const err = fakeState.connectShouldThrow
            fakeState.connectShouldThrow = null
            throw err
          }
          const socket = new FakeSocket()
          fakeState.socket = socket
          return socket
        },
      }
    },
  }
})

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/** Build a Request with a streaming body of the given chunks. */
function buildStreamingRequest(
  url: string,
  chunks: Uint8Array[],
  opts: {
    contentType?: string
    abortController?: AbortController
    holdOpenMs?: number
  } = {},
): Request {
  const { contentType = 'audio/wav', abortController, holdOpenMs = 0 } = opts
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        controller.enqueue(c)
        await new Promise((r) => setTimeout(r, 1))
      }
      if (holdOpenMs > 0) {
        await new Promise((r) => setTimeout(r, holdOpenMs))
      }
      controller.close()
    },
  })
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: body as unknown as BodyInit,
    signal: abortController?.signal,
    // @ts-expect-error duplex is required by Node fetch for streaming bodies
    duplex: 'half',
  })
}

/** Drain a Response body to text. */
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

/** Parse SSE `data: <json>` lines into objects (drops empty lines). */
function parseSseEvents(raw: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trimEnd()
    if (!trimmed.startsWith('data: ')) continue
    const json = trimmed.slice('data: '.length)
    try {
      out.push(JSON.parse(json) as Record<string, unknown>)
    } catch {
      // Ignore malformed lines (shouldn't happen — we author the writer).
    }
  }
  return out
}

// ----------------------------------------------------------------------
// Tests — Story V.A.1 (POST route + SSE happy path + runtime declaration)
// ----------------------------------------------------------------------

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.resetModules()
    fakeState.socket = null
    fakeState.connectArgs = null
    fakeState.connectShouldThrow = null
    process.env.SARVAM_API_KEY = 'test-key-do-not-leak'
  })

  afterEach(() => {
    delete process.env.SARVAM_API_KEY
  })

  it('streams partials as SSE then a final on body close (happy path)', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const chunks = [
      new Uint8Array([1, 2, 3, 4]),
      new Uint8Array([5, 6, 7, 8]),
      new Uint8Array([9, 10, 11, 12]),
    ]
    const req = buildStreamingRequest(
      'http://localhost/api/transcribe',
      chunks,
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/^text\/event-stream/)

    // Drive partials from the fake socket as soon as it's open. The route's
    // reader loop awaits ~1ms per chunk so we have time to interleave.
    const interleave = (async () => {
      while (fakeState.socket === null) {
        await new Promise((r) => setTimeout(r, 1))
      }
      const sock = fakeState.socket
      sock.emitMessage({
        type: 'data',
        data: { request_id: 'r', transcript: 'hello' },
      })
      await new Promise((r) => setTimeout(r, 2))
      sock.emitMessage({
        type: 'data',
        data: { request_id: 'r', transcript: 'hello there' },
      })
      await new Promise((r) => setTimeout(r, 2))
      sock.emitMessage({
        type: 'data',
        data: { request_id: 'r', transcript: 'hello there friend' },
      })
    })()

    const text = await readResponseText(res)
    await interleave

    const events = parseSseEvents(text)
    const partials = events.filter((e) => e.type === 'partial')
    const finals = events.filter((e) => e.type === 'final')

    expect(partials.map((e) => e.text)).toEqual([
      'hello',
      'hello there',
      'hello there friend',
    ])
    expect(finals).toHaveLength(1)
    expect(finals[0]?.text).toBe('hello there friend')
    expect(typeof finals[0]?.durationMs).toBe('number')
    expect(finals[0]?.bytes).toBe(12)
  })

  it('forwards each request body chunk to Sarvam.transcribe as base64 WAV', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const chunks = [new Uint8Array([0xaa, 0xbb]), new Uint8Array([0xcc, 0xdd])]
    const req = buildStreamingRequest(
      'http://localhost/api/transcribe',
      chunks,
    )
    const res = await POST(req)
    await readResponseText(res)
    expect(fakeState.socket).not.toBeNull()
    const sock = fakeState.socket!
    expect(sock.sentChunks).toHaveLength(2)
    expect(sock.sentChunks[0]?.encoding).toBe('audio/wav')
    expect(sock.sentChunks[0]?.sample_rate).toBe(16000)
    // Base64 of 0xaa 0xbb is "qrs="; 0xcc 0xdd is "zN0=".
    expect(sock.sentChunks[0]?.audio).toBe('qrs=')
    expect(sock.sentChunks[1]?.audio).toBe('zN0=')
  })

  it('forwards the lang query param into the Sarvam connect args', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const req = buildStreamingRequest(
      'http://localhost/api/transcribe?lang=hi-IN',
      [new Uint8Array([1])],
    )
    const res = await POST(req)
    await readResponseText(res)
    const args = fakeState.connectArgs as { 'language-code'?: string } | null
    expect(args?.['language-code']).toBe('hi-IN')
  })

  it('emits an SSE error frame when Sarvam emits an error message', async () => {
    const { POST } = await import('@/app/api/transcribe/route')
    const req = buildStreamingRequest(
      'http://localhost/api/transcribe',
      [new Uint8Array([1, 2])],
      { holdOpenMs: 30 },
    )
    const res = await POST(req)
    const interleave = (async () => {
      while (fakeState.socket === null) {
        await new Promise((r) => setTimeout(r, 1))
      }
      fakeState.socket.emitMessage({
        type: 'error',
        data: { error: 'upstream blew up' },
      })
    })()
    const text = await readResponseText(res)
    await interleave
    const events = parseSseEvents(text)
    const errors = events.filter((e) => e.type === 'error')
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]?.kind).toBe('voice.network')
    expect(errors[0]?.message).toBe('upstream blew up')
  })

  it('declares runtime = nodejs and dynamic = force-dynamic', async () => {
    const mod = await import('@/app/api/transcribe/route')
    expect(mod.runtime).toBe('nodejs')
    expect(mod.dynamic).toBe('force-dynamic')
  })
})
