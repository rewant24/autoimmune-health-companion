/**
 * Sarvam recorder — captures a `MediaStream` and emits PCM s16le 16kHz
 * mono chunks at a fixed timeslice (default 250 ms).
 *
 * Codec rationale (`docs/research/sarvam-format-spikes.md`): the Sarvam
 * streaming STT endpoint rejects WebM/Opus at the protocol level — the
 * only accepted codecs are `wav`, `pcm_s16le`, `pcm_l16`, and `pcm_raw`.
 * Cycle 1 ships the WebAudio resampler path: capture into an
 * `AudioContext`, downsample to 16kHz mono, emit raw little-endian s16
 * frames at 250 ms boundaries.
 *
 * Why not `MediaRecorder`? The browser only exposes WebM/Opus and a few
 * platform-specific codecs through `MediaRecorder`; none of them match
 * what Sarvam accepts. WebAudio gives us float samples we can downsample
 * deterministically.
 *
 * Browser compatibility: `AudioWorkletNode` is the modern primitive
 * (Chrome 66+, Safari 14.1+, Firefox 76+) — well within the Saha browser
 * baseline. The deprecated `ScriptProcessorNode` is intentionally not
 * used; AudioWorklet runs on the audio thread and avoids glitching.
 */

/**
 * Per-chunk callback. The recorder hands ownership of `chunk` to the
 * listener — internally the recorder allocates a fresh buffer for the
 * next slice, so callers may keep the reference.
 */
export type SarvamChunkListener = (chunk: Uint8Array) => void

export interface SarvamRecorderOptions {
  /** Source mic stream from `navigator.mediaDevices.getUserMedia`. */
  stream: MediaStream
  /** Chunk emit interval in ms. Default 250. */
  timesliceMs?: number
  /**
   * Injection seam for tests — defaults to `globalThis.AudioContext`. The
   * worklet path is hard to fake; tests inject a `FakeAudioContext` that
   * pumps synthetic float samples through `feedSamples()`.
   */
  audioContextCtor?: typeof AudioContext
}

/**
 * Output sample rate sent to Sarvam. Hard-coded — the SDK's accepted
 * sample rates are `8000` and `16000`; the spike chose 16k.
 */
export const SARVAM_OUTPUT_SAMPLE_RATE = 16000

/**
 * Audio format identifier passed to the upload route. Constant baked in
 * here so a single source of truth backs the recorder + adapter pair.
 */
export const SARVAM_AUDIO_FORMAT = 'pcm_s16le'

/**
 * The recorder's lifecycle is:
 *
 *   const r = new SarvamRecorder({ stream, timesliceMs: 250 })
 *   r.onChunk(buf => ...)
 *   await r.start()
 *   ...
 *   await r.stop()
 *
 * `start()` resolves once the worklet is connected. `stop()` flushes any
 * partial accumulated buffer (so audio captured between the last 250 ms
 * boundary and the stop call is not lost) and disposes WebAudio nodes.
 */
export class SarvamRecorder {
  private readonly stream: MediaStream
  private readonly timesliceMs: number
  private readonly audioContextCtor: typeof AudioContext

  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private worklet: AudioWorkletNode | ScriptProcessorNode | null = null

  private chunkListeners: SarvamChunkListener[] = []

  /** Float samples pending downsample, accumulated across worklet ticks. */
  private inputBuffer: Float32Array[] = []
  private inputSamples = 0

  /** Carry-over for fractional resample positions across chunks. */
  private resamplePosition = 0

  /** Cached input sample rate captured at start(). */
  private inputSampleRate = 0

  /** Samples to emit per timeslice (16000 * timesliceMs / 1000). */
  private samplesPerChunk = 0

  /** Pending output samples awaiting the next chunk emit. */
  private outputBuffer: Int16Array
  private outputSamples = 0

  private started = false
  private stopped = false

  constructor(opts: SarvamRecorderOptions) {
    this.stream = opts.stream
    this.timesliceMs = opts.timesliceMs ?? 250
    if (this.timesliceMs <= 0 || !Number.isFinite(this.timesliceMs)) {
      throw new Error(
        `SarvamRecorder: timesliceMs must be a positive finite number (got ${this.timesliceMs})`,
      )
    }
    this.audioContextCtor =
      opts.audioContextCtor ??
      (typeof AudioContext !== 'undefined'
        ? AudioContext
        : (undefined as unknown as typeof AudioContext))

    this.samplesPerChunk = Math.round(
      (SARVAM_OUTPUT_SAMPLE_RATE * this.timesliceMs) / 1000,
    )
    // Pre-allocate one chunk's worth; we re-use the buffer between
    // emits but allocate a fresh one when handing off to listeners.
    this.outputBuffer = new Int16Array(this.samplesPerChunk)
  }

  onChunk(cb: SarvamChunkListener): void {
    this.chunkListeners.push(cb)
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('SarvamRecorder.start: already started')
    }
    if (!this.audioContextCtor) {
      throw new Error('SarvamRecorder.start: no AudioContext constructor available')
    }
    this.started = true

    // Use a 16k context if the platform allows — saves the resample
    // step entirely. Fall back to the platform default otherwise.
    let context: AudioContext
    try {
      context = new this.audioContextCtor({
        sampleRate: SARVAM_OUTPUT_SAMPLE_RATE,
      })
    } catch {
      context = new this.audioContextCtor()
    }
    this.context = context
    this.inputSampleRate = context.sampleRate

    const source = context.createMediaStreamSource(this.stream)
    this.source = source

    const useWorklet =
      typeof AudioWorkletNode !== 'undefined' &&
      typeof context.audioWorklet !== 'undefined' &&
      typeof context.audioWorklet.addModule === 'function'

    if (useWorklet) {
      const workletUrl = buildWorkletUrl()
      try {
        await context.audioWorklet.addModule(workletUrl)
      } finally {
        // Revoke once the worklet has been registered. Safari hangs
        // onto the URL internally so revoking is safe.
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(workletUrl)
        }
      }
      const node = new AudioWorkletNode(context, 'saha-pcm-tap')
      node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
        this.handleSamples(ev.data)
      }
      source.connect(node)
      // Connect to destination so the worklet pulls audio. We zero the
      // output in the worklet so nothing is heard.
      node.connect(context.destination)
      this.worklet = node
    } else {
      // Fallback: ScriptProcessorNode (deprecated but still works
      // everywhere modern). 4096-sample buffer is a good compromise
      // between latency and CPU.
      const ScriptCtor = (
        context as unknown as {
          createScriptProcessor?: (
            bufferSize: number,
            inputChannels: number,
            outputChannels: number,
          ) => ScriptProcessorNode
        }
      ).createScriptProcessor
      if (typeof ScriptCtor !== 'function') {
        throw new Error(
          'SarvamRecorder.start: neither AudioWorkletNode nor ScriptProcessorNode available',
        )
      }
      const node = ScriptCtor.call(context, 4096, 1, 1)
      node.onaudioprocess = (ev: AudioProcessingEvent) => {
        const channel = ev.inputBuffer.getChannelData(0)
        // Copy because the underlying buffer is reused.
        const copy = new Float32Array(channel.length)
        copy.set(channel)
        this.handleSamples(copy)
      }
      source.connect(node)
      node.connect(context.destination)
      this.worklet = node
    }
  }

  /**
   * Test hook + worklet-fallback hook. Push raw float32 samples at the
   * input sample rate. Production code reaches this via the worklet
   * `port.onmessage` handler; tests call it directly with a known input
   * rate.
   */
  feedSamples(samples: Float32Array, inputSampleRate?: number): void {
    if (typeof inputSampleRate === 'number' && inputSampleRate > 0) {
      this.inputSampleRate = inputSampleRate
    }
    this.handleSamples(samples)
  }

  private handleSamples(samples: Float32Array): void {
    if (this.stopped) return
    if (samples.length === 0) return
    this.inputBuffer.push(samples)
    this.inputSamples += samples.length

    // Downsample (or pass through if already at target). We process in
    // a streaming way to handle fractional positions across calls.
    const ratio = this.inputSampleRate / SARVAM_OUTPUT_SAMPLE_RATE
    if (ratio <= 0 || !Number.isFinite(ratio)) return

    // Flatten the queued chunks into a single view starting at
    // `resamplePosition`. We do this lazily — concatenate only when we
    // can produce at least one output sample.
    while (true) {
      const totalIn = this.inputSamples
      // Number of output samples we can emit given the current backlog.
      const lastInputIndexNeeded = (this.outputBuffer && 0) // satisfy ts unused warn
      void lastInputIndexNeeded
      // We can emit as long as the floor of ratio*outputIdx + resamplePosition < totalIn.
      const maxOut = Math.floor((totalIn - this.resamplePosition) / ratio)
      if (maxOut <= 0) break

      // Concat the queue once so indexed reads are O(1).
      const flat = concatFloat32(this.inputBuffer, this.inputSamples)
      this.inputBuffer = [flat]

      let consumedThroughIndex = 0
      for (let i = 0; i < maxOut; i++) {
        const srcIdx = this.resamplePosition + i * ratio
        const lo = Math.floor(srcIdx)
        const hi = Math.min(lo + 1, flat.length - 1)
        const frac = srcIdx - lo
        const sample = flat[lo] * (1 - frac) + flat[hi] * frac
        // Clamp + convert float [-1, 1] to s16le.
        const clamped = Math.max(-1, Math.min(1, sample))
        const s16 = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
        this.outputBuffer[this.outputSamples++] = s16
        consumedThroughIndex = lo
        if (this.outputSamples >= this.samplesPerChunk) {
          this.emitChunk()
        }
      }

      // Advance the resample position for the next batch + drop fully
      // consumed input samples to keep memory bounded.
      const nextPosition = this.resamplePosition + maxOut * ratio
      const drop = Math.max(0, Math.floor(nextPosition))
      if (drop > 0 && drop <= flat.length) {
        const remaining = flat.subarray(drop)
        this.inputBuffer = remaining.length > 0 ? [new Float32Array(remaining)] : []
        this.inputSamples = remaining.length
        this.resamplePosition = nextPosition - drop
      } else {
        this.resamplePosition = nextPosition
      }
      void consumedThroughIndex
    }
  }

  private emitChunk(): void {
    // Allocate a fresh buffer so listeners can keep the reference.
    const out = new Int16Array(this.samplesPerChunk)
    out.set(this.outputBuffer.subarray(0, this.samplesPerChunk))
    const bytes = new Uint8Array(out.buffer, out.byteOffset, out.byteLength)
    this.outputSamples = 0
    for (const cb of this.chunkListeners) {
      cb(bytes)
    }
  }

  /**
   * Stop capturing, flush any partial chunk, and dispose WebAudio
   * nodes. Tracks on the source `MediaStream` are NOT stopped here —
   * the adapter owns the mic and stops tracks via `MediaStreamTrack.stop()`.
   */
  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true

    // Flush any partial buffer as a short final chunk so trailing
    // audio between the last 250 ms boundary and stop() isn't lost.
    if (this.outputSamples > 0) {
      const out = new Int16Array(this.outputSamples)
      out.set(this.outputBuffer.subarray(0, this.outputSamples))
      const bytes = new Uint8Array(out.buffer, out.byteOffset, out.byteLength)
      this.outputSamples = 0
      for (const cb of this.chunkListeners) {
        cb(bytes)
      }
    }

    try {
      if (this.worklet && 'port' in this.worklet) {
        ;(this.worklet as AudioWorkletNode).port.onmessage = null
      } else if (this.worklet) {
        ;(this.worklet as ScriptProcessorNode).onaudioprocess = null
      }
      this.worklet?.disconnect()
    } catch {
      // ignore
    }
    try {
      this.source?.disconnect()
    } catch {
      // ignore
    }
    try {
      await this.context?.close()
    } catch {
      // ignore
    }
    this.worklet = null
    this.source = null
    this.context = null
    this.chunkListeners = []
  }
}

// --- Helpers ---------------------------------------------------------------

function concatFloat32(parts: Float32Array[], total: number): Float32Array {
  if (parts.length === 1) return parts[0]
  const out = new Float32Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

/**
 * Build a Blob URL containing the inline AudioWorklet processor source.
 * Keeping the source inline avoids an extra network round-trip for a
 * 30-line file and sidesteps `next.config` plumbing for static asset
 * paths.
 *
 * Exported for tests so they can verify the worklet shape without
 * spinning up a real `AudioContext`.
 */
export function buildWorkletUrl(): string {
  const src = `
    class SahaPcmTap extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0]
        if (input && input[0]) {
          const channel = input[0]
          // Post a copy — channel buffers are reused across ticks.
          const copy = new Float32Array(channel.length)
          copy.set(channel)
          this.port.postMessage(copy)
        }
        return true
      }
    }
    registerProcessor('saha-pcm-tap', SahaPcmTap)
  `.trim()
  const blob = new Blob([src], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}
