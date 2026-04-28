/**
 * Tests for `lib/voice/sarvam-recorder.ts` (US-V.B.5).
 *
 * The recorder is a `MediaRecorder`-style wrapper that captures a
 * `MediaStream`, downsamples to 16kHz mono, and emits raw PCM s16le
 * chunks at a fixed timeslice. Production code drives it from an
 * `AudioWorkletNode`; tests inject a `FakeAudioContext` and call the
 * `feedSamples()` test hook directly.
 *
 * Spike outcome (`docs/research/sarvam-format-spikes.md`): Sarvam STT
 * accepts `wav` / `pcm_s16le` / `pcm_l16` / `pcm_raw` only — WebM/Opus
 * is rejected at the protocol layer. This recorder is the PCM s16le
 * path that satisfies that contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SARVAM_AUDIO_FORMAT,
  SARVAM_OUTPUT_SAMPLE_RATE,
  SarvamRecorder,
  buildWorkletUrl,
} from '@/lib/voice/sarvam-recorder'

// --- Fake AudioContext for tests ------------------------------------------
//
// Implements just enough of the WebAudio surface that `SarvamRecorder.start()`
// can connect a worklet and `stop()` can tear it down. Crucially the worklet
// path is a no-op — tests drive samples in via `feedSamples()` instead so
// the resampling math is fully observable without spinning up real audio.

interface FakeWorkletNode {
  port: { onmessage: ((ev: MessageEvent<Float32Array>) => void) | null }
  connect: () => void
  disconnect: () => void
}

class FakeAudioContext {
  sampleRate: number
  // Mirrors the production browser path that Fix D addresses: a real
  // AudioContext created after an awaited getUserMedia starts in
  // 'suspended' state on Chrome. The recorder is expected to call
  // resume() to transition it to 'running'.
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  destination = { _isDest: true }
  audioWorklet = {
    addModule: vi.fn(async (_url: string) => undefined),
  }
  closed = false

  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 48000
  }

  createMediaStreamSource(_stream: MediaStream) {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.closed = true
    this.state = 'closed'
  }
}

// Minimal fake AudioWorkletNode constructor — recorder only sets `port.onmessage`
// then connects/disconnects.
const FakeAudioWorkletNode = vi.fn(function (
  this: FakeWorkletNode,
  _ctx: unknown,
  _name: string,
) {
  this.port = { onmessage: null }
  this.connect = vi.fn()
  this.disconnect = vi.fn()
}) as unknown as new (ctx: unknown, name: string) => FakeWorkletNode

const makeStream = (): MediaStream =>
  ({ getTracks: () => [], getAudioTracks: () => [] }) as unknown as MediaStream

// --- URL.createObjectURL / revokeObjectURL stubs --------------------------

beforeEach(() => {
  ;(globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode =
    FakeAudioWorkletNode
  ;(globalThis as unknown as { URL: typeof URL }).URL = URL
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:fake') as typeof URL.createObjectURL
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SarvamRecorder — constants', () => {
  it('exposes 16000 as SARVAM_OUTPUT_SAMPLE_RATE', () => {
    expect(SARVAM_OUTPUT_SAMPLE_RATE).toBe(16000)
  })

  it('exposes "pcm_s16le" as SARVAM_AUDIO_FORMAT', () => {
    expect(SARVAM_AUDIO_FORMAT).toBe('pcm_s16le')
  })
})

describe('SarvamRecorder — constructor', () => {
  it('rejects non-positive timesliceMs', () => {
    expect(
      () =>
        new SarvamRecorder({
          stream: makeStream(),
          timesliceMs: 0,
          audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
        }),
    ).toThrow(/timesliceMs/)
  })

  it('rejects non-finite timesliceMs', () => {
    expect(
      () =>
        new SarvamRecorder({
          stream: makeStream(),
          timesliceMs: Number.POSITIVE_INFINITY,
          audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
        }),
    ).toThrow(/timesliceMs/)
  })

  it('defaults to 250 ms timeslice when omitted', () => {
    // Default chunk size is 250ms * 16000Hz / 1000 = 4000 samples = 8000 bytes.
    const r = new SarvamRecorder({
      stream: makeStream(),
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    const chunks: Uint8Array[] = []
    r.onChunk((c) => chunks.push(c))
    // Feed samples at 16kHz — exactly one chunk's worth.
    r.feedSamples(new Float32Array(4000), 16000)
    expect(chunks.length).toBe(1)
    expect(chunks[0].byteLength).toBe(8000)
  })
})

describe('SarvamRecorder — start() / stop() lifecycle', () => {
  it('start() opens an AudioContext + connects a worklet', async () => {
    const ctxs: FakeAudioContext[] = []
    const Ctor = vi.fn(function (this: FakeAudioContext, opts?: { sampleRate?: number }) {
      const c = new FakeAudioContext(opts)
      ctxs.push(c)
      return c
    }) as unknown as typeof AudioContext

    const r = new SarvamRecorder({
      stream: makeStream(),
      audioContextCtor: Ctor,
    })
    await r.start()
    expect(ctxs.length).toBeGreaterThan(0)
    expect(ctxs[0].audioWorklet.addModule).toHaveBeenCalledTimes(1)
    await r.stop()
    expect(ctxs[0].closed).toBe(true)
  })

  it('start() throws when invoked twice', async () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    await r.start()
    await expect(r.start()).rejects.toThrow(/already started/)
    await r.stop()
  })

  it('stop() is idempotent', async () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    await r.start()
    await r.stop()
    // Second stop must not throw.
    await expect(r.stop()).resolves.toBeUndefined()
  })

  it('start() resumes a suspended AudioContext (Fix D — Chrome gesture-expiry)', async () => {
    // Production Chrome creates the AudioContext in `suspended` state
    // when it's constructed after an awaited getUserMedia. Without
    // resume() the worklet pulls no samples, the recorder produces zero
    // chunks, and Sarvam's `socket.flush()` throws. The FakeAudioContext
    // mirrors that path (default state: 'suspended').
    const ctxs: FakeAudioContext[] = []
    const Ctor = vi.fn(function (this: FakeAudioContext, opts?: { sampleRate?: number }) {
      const c = new FakeAudioContext(opts)
      ctxs.push(c)
      return c
    }) as unknown as typeof AudioContext
    const r = new SarvamRecorder({
      stream: makeStream(),
      audioContextCtor: Ctor,
    })
    expect(ctxs.length).toBe(0)
    await r.start()
    expect(ctxs[0].state).toBe('running')
    await r.stop()
  })
})

describe('SarvamRecorder — chunk emission', () => {
  it('emits one chunk per accumulated 250 ms at 16kHz', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    const chunks: Uint8Array[] = []
    r.onChunk((c) => chunks.push(c))

    // 4000 samples at 16kHz = exactly 250 ms = 1 chunk = 8000 bytes.
    r.feedSamples(new Float32Array(4000), 16000)
    expect(chunks.length).toBe(1)
    expect(chunks[0].byteLength).toBe(8000)

    // Another full slice → second chunk.
    r.feedSamples(new Float32Array(4000), 16000)
    expect(chunks.length).toBe(2)
  })

  it('downsamples 48 kHz input to 16 kHz output (3:1 ratio)', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    const chunks: Uint8Array[] = []
    r.onChunk((c) => chunks.push(c))

    // 12000 samples at 48 kHz = 250 ms of audio = 4000 output samples = 1 chunk.
    r.feedSamples(new Float32Array(12000), 48000)
    expect(chunks.length).toBe(1)
    expect(chunks[0].byteLength).toBe(8000)
  })

  it('converts float [-1, 1] to s16le little-endian', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    const chunks: Uint8Array[] = []
    r.onChunk((c) => chunks.push(c))

    // All samples = 1.0 → should clamp to +32767 → 0xFF 0x7F (LE).
    const samples = new Float32Array(4000).fill(1.0)
    r.feedSamples(samples, 16000)
    expect(chunks.length).toBe(1)
    const view = new DataView(
      chunks[0].buffer,
      chunks[0].byteOffset,
      chunks[0].byteLength,
    )
    // First sample: read int16 LE.
    expect(view.getInt16(0, true)).toBe(0x7fff)
  })

  it('flushes a partial buffer on stop()', async () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    const chunks: Uint8Array[] = []
    r.onChunk((c) => chunks.push(c))

    await r.start()
    // 2000 samples at 16 kHz = 125 ms = HALF a chunk. No emission yet.
    r.feedSamples(new Float32Array(2000), 16000)
    expect(chunks.length).toBe(0)

    // stop() should flush the partial as a short final chunk.
    await r.stop()
    expect(chunks.length).toBe(1)
    // 2000 samples × 2 bytes = 4000 bytes.
    expect(chunks[0].byteLength).toBe(4000)
  })

  it('clamps out-of-range float samples to s16 limits', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    const chunks: Uint8Array[] = []
    r.onChunk((c) => chunks.push(c))

    const samples = new Float32Array(4000)
    samples[0] = 5.0 // way over +1
    samples[1] = -3.0 // way under -1
    r.feedSamples(samples, 16000)

    expect(chunks.length).toBe(1)
    const view = new DataView(
      chunks[0].buffer,
      chunks[0].byteOffset,
      chunks[0].byteLength,
    )
    expect(view.getInt16(0, true)).toBe(0x7fff)
    expect(view.getInt16(2, true)).toBe(-0x8000)
  })
})

describe('SarvamRecorder — worklet helper', () => {
  it('buildWorkletUrl returns a Blob URL', () => {
    const url = buildWorkletUrl()
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })
})

// --- Silence VAD ----------------------------------------------------------
//
// The recorder's silence VAD watches RMS energy over each emitted 16kHz
// PCM chunk. Once it has heard a "loud" chunk (RMS ≥ 0.02), it counts
// consecutive "silent" chunks (RMS < 0.01). At 6 trailing silent chunks
// (the SILENCE_TRAILING_CHUNKS default — 1.5 s at 250 ms cadence) it
// fires `onSilenceDetected` exactly once, never again for the same turn.

/** A 4000-sample chunk of constant amplitude `amp` in [0, 1]. */
function loudChunk(amp: number): Float32Array {
  const f = new Float32Array(4000)
  for (let i = 0; i < f.length; i++) f[i] = amp
  return f
}

/** A 4000-sample silent chunk (all zeros). */
function silentChunk(): Float32Array {
  return new Float32Array(4000)
}

describe('SarvamRecorder — silence VAD', () => {
  it('does not fire silence when never spoken', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    let silenceFires = 0
    r.onSilenceDetected(() => silenceFires++)
    // 10 silent chunks — well past SILENCE_TRAILING_CHUNKS — but no
    // speech ever heard, so the VAD must stay quiet.
    for (let i = 0; i < 10; i++) {
      r.feedSamples(silentChunk(), 16000)
    }
    expect(silenceFires).toBe(0)
  })

  it('fires onSilenceDetected after speech then 6 trailing silent chunks', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    let silenceFires = 0
    r.onSilenceDetected(() => silenceFires++)

    // 1 loud chunk (amplitude 0.5 → RMS 0.5 ≫ 0.02 threshold).
    r.feedSamples(loudChunk(0.5), 16000)
    // 5 silent chunks: not yet at the trailing-silence threshold.
    for (let i = 0; i < 5; i++) r.feedSamples(silentChunk(), 16000)
    expect(silenceFires).toBe(0)
    // 6th silent chunk crosses the threshold.
    r.feedSamples(silentChunk(), 16000)
    expect(silenceFires).toBe(1)
  })

  it('fires onSilenceDetected only once per turn', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    let silenceFires = 0
    r.onSilenceDetected(() => silenceFires++)

    r.feedSamples(loudChunk(0.5), 16000)
    for (let i = 0; i < 10; i++) r.feedSamples(silentChunk(), 16000)
    expect(silenceFires).toBe(1)
  })

  it('resets the silent-chunk counter when speech resumes mid-recording', () => {
    const r = new SarvamRecorder({
      stream: makeStream(),
      timesliceMs: 250,
      audioContextCtor: FakeAudioContext as unknown as typeof AudioContext,
    })
    let silenceFires = 0
    r.onSilenceDetected(() => silenceFires++)

    r.feedSamples(loudChunk(0.5), 16000)
    // 5 silent chunks (almost there).
    for (let i = 0; i < 5; i++) r.feedSamples(silentChunk(), 16000)
    // A loud chunk in the middle resets the counter — simulates a brief
    // pause mid-thought, NOT end of turn.
    r.feedSamples(loudChunk(0.5), 16000)
    // 5 more silent chunks → still under threshold from the reset point.
    for (let i = 0; i < 5; i++) r.feedSamples(silentChunk(), 16000)
    expect(silenceFires).toBe(0)
    // 6th silent chunk after the reset → fires.
    r.feedSamples(silentChunk(), 16000)
    expect(silenceFires).toBe(1)
  })
})
