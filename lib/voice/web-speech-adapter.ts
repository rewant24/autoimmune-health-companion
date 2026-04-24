/**
 * Web Speech adapter. Wraps the browser's `SpeechRecognition` /
 * `webkitSpeechRecognition` API and exposes our `VoiceProvider` contract.
 *
 * Scope (Cycle 1):
 * - Locale `en-IN` by default.
 * - Continuous capture + interim results (partials via `onPartial`).
 * - Maps native error events to typed `VoiceError` shapes.
 * - No UI; this file stays React-free.
 */

import type {
  Transcript,
  VoiceCapabilities,
  VoiceError,
  VoiceErrorKind,
  VoiceProvider,
} from './types'

// --- Minimal ambient types for SpeechRecognition ---------------------------
// The DOM lib doesn't include SpeechRecognition in every TS version, and we
// want to avoid a project-wide `lib.dom.iterable` change. Declare just what
// we use, narrowly.

interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  length: number
  [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  onend: ((ev: Event) => void) | null
  onstart: ((ev: Event) => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionGlobal {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

function resolveCtor(): SpeechRecognitionCtor | undefined {
  if (typeof globalThis === 'undefined') return undefined
  const g = globalThis as unknown as SpeechRecognitionGlobal
  return g.SpeechRecognition ?? g.webkitSpeechRecognition
}

// --- Error mapping ---------------------------------------------------------

/** Map a native SpeechRecognition error string to our typed kind. */
export function mapNativeError(nativeError: string): VoiceErrorKind {
  switch (nativeError) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied'
    case 'no-speech':
      return 'no-speech'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    case 'audio-capture':
      // Mic hardware missing / blocked at OS level — closest to permission.
      return 'permission-denied'
    default:
      return 'aborted'
  }
}

// --- Adapter ---------------------------------------------------------------

export class WebSpeechAdapter implements VoiceProvider {
  readonly capabilities: VoiceCapabilities = { partials: true, vad: false }

  private recognition: SpeechRecognitionLike | null = null
  private partialListeners: Array<(partial: string) => void> = []
  private errorListeners: Array<(err: VoiceError) => void> = []

  private finalText = ''
  private lastConfidence: number | undefined
  private startedAt = 0
  private stopPromise: {
    resolve: (t: Transcript) => void
    reject: (err: VoiceError) => void
  } | null = null

  constructor(private readonly locale: string = 'en-IN') {}

  onPartial(cb: (partial: string) => void): void {
    this.partialListeners.push(cb)
  }

  onError(cb: (err: VoiceError) => void): void {
    this.errorListeners.push(cb)
  }

  async start(): Promise<void> {
    const Ctor = resolveCtor()
    if (!Ctor) {
      const err: VoiceError = {
        kind: 'unsupported',
        message: 'SpeechRecognition API is not available in this environment.',
      }
      this.emitError(err)
      throw err
    }

    const recognition = new Ctor()
    recognition.lang = this.locale
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (ev) => this.handleResult(ev)
    recognition.onerror = (ev) => this.handleError(ev)
    recognition.onend = () => this.handleEnd()

    this.recognition = recognition
    this.finalText = ''
    this.lastConfidence = undefined
    this.startedAt = Date.now()

    try {
      recognition.start()
    } catch (e) {
      const err: VoiceError = {
        kind: 'aborted',
        message: e instanceof Error ? e.message : 'Failed to start recognition.',
      }
      this.emitError(err)
      throw err
    }
  }

  stop(): Promise<Transcript> {
    if (!this.recognition) {
      return Promise.reject<Transcript>({
        kind: 'aborted',
        message: 'stop() called before start().',
      } satisfies VoiceError)
    }

    return new Promise<Transcript>((resolve, reject) => {
      this.stopPromise = { resolve, reject }
      try {
        this.recognition?.stop()
      } catch {
        // Some implementations throw if already stopping; onend will resolve.
      }
    })
  }

  // --- Internal event handlers --------------------------------------------

  private handleResult(ev: SpeechRecognitionEventLike): void {
    let interim = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i]
      const alt = result[0]
      if (!alt) continue
      if (result.isFinal) {
        this.finalText = (this.finalText + ' ' + alt.transcript).trim()
        if (typeof alt.confidence === 'number') {
          this.lastConfidence = alt.confidence
        }
      } else {
        interim += alt.transcript
      }
    }
    if (interim) {
      const preview = (this.finalText + ' ' + interim).trim()
      for (const cb of this.partialListeners) cb(preview)
    } else if (this.finalText) {
      for (const cb of this.partialListeners) cb(this.finalText)
    }
  }

  private handleError(ev: SpeechRecognitionErrorEventLike): void {
    const err: VoiceError = {
      kind: mapNativeError(ev.error),
      message: ev.message ?? ev.error,
    }
    this.emitError(err)
    // `no-speech` surfaces as an error, but Web Speech then fires `onend`.
    // Reject the pending stop() on any error so the UI can branch.
    if (this.stopPromise) {
      this.stopPromise.reject(err)
      this.stopPromise = null
    }
  }

  private handleEnd(): void {
    if (!this.stopPromise) {
      // Ended without a pending stop() — user or browser killed the session.
      return
    }
    const transcript: Transcript = {
      text: this.finalText,
      durationMs: Math.max(0, Date.now() - this.startedAt),
      confidence: this.lastConfidence,
    }
    this.stopPromise.resolve(transcript)
    this.stopPromise = null
    this.recognition = null
  }

  private emitError(err: VoiceError): void {
    for (const cb of this.errorListeners) cb(err)
  }
}
