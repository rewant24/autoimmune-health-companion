/**
 * Tests for `lib/voice/sarvam-tts-adapter.ts` (Voice C1, Chunk V.C, stories
 * SarvamTtsAdapter.US-V.C.3 / US-V.C.4 / US-V.C.5).
 *
 * The adapter implements `TtsProvider` from `lib/voice/types.ts`:
 *   - `speak(text)` POSTs to `/api/speak` with the constructor
 *     `language_code` (and optional `voice`), then plays the returned
 *     bytes via blob-URL on a fresh `<audio>` element.
 *   - `cancel()` aborts the in-flight fetch, pauses + resets the audio,
 *     and rejects the pending `speak()` with a typed `{ kind: 'aborted' }`.
 *   - `isAvailable()` returns `true` always — provider work is server-side.
 *
 * We mock `fetch`, `URL.createObjectURL` / `revokeObjectURL`, and stub the
 * `<audio>` element so the test runs entirely in jsdom without touching
 * the real DOM audio pipeline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Audio element stub ------------------------------------------------------

interface FakeAudio extends Pick<HTMLAudioElement, "src" | "play" | "pause"> {
  onended: ((ev: Event) => void) | null;
  onerror: OnErrorEventHandler;
  __triggerEnd(): void;
  __triggerError(): void;
  __srcSetTo: string[];
  __plays: number;
  __pauses: number;
  __currentTime: number;
}

function makeFakeAudio(): FakeAudio {
  const fake: FakeAudio = {
    src: "",
    onended: null,
    onerror: null,
    __srcSetTo: [],
    __plays: 0,
    __pauses: 0,
    __currentTime: 0,
    play(): Promise<void> {
      fake.__plays++;
      return Promise.resolve();
    },
    pause(): void {
      fake.__pauses++;
    },
    __triggerEnd(): void {
      fake.onended?.(new Event("ended"));
    },
    __triggerError(): void {
      fake.onerror?.(new Event("error") as unknown as string);
    },
  } as unknown as FakeAudio;

  // Make `src` a tracked setter so the adapter clearing it counts as a
  // "reset" we can assert on.
  let _src = "";
  Object.defineProperty(fake, "src", {
    get() {
      return _src;
    },
    set(v: string) {
      _src = v;
      (fake as FakeAudio).__srcSetTo.push(v);
    },
    configurable: true,
  });

  // currentTime needs the same treatment so the adapter resetting it is
  // observable.
  Object.defineProperty(fake, "currentTime", {
    get() {
      return (fake as FakeAudio).__currentTime;
    },
    set(v: number) {
      (fake as FakeAudio).__currentTime = v;
    },
    configurable: true,
  });

  return fake;
}

let audioInstances: FakeAudio[] = [];
let originalAudio: typeof globalThis.Audio | undefined;
let originalCreate: typeof URL.createObjectURL | undefined;
let originalRevoke: typeof URL.revokeObjectURL | undefined;
let originalFetch: typeof globalThis.fetch | undefined;

beforeEach(() => {
  audioInstances = [];
  originalAudio = globalThis.Audio;
  originalCreate = URL.createObjectURL;
  originalRevoke = URL.revokeObjectURL;
  originalFetch = globalThis.fetch;

  // Must be a real constructor — `new Audio()` rejects plain spies. Wrap
  // the factory in a function-as-constructor pattern that returns the
  // fake from `new` (the constructor's return value, when an object,
  // overrides the implicit `this`).
  const AudioCtor = function AudioCtor(this: unknown): FakeAudio {
    const fake = makeFakeAudio();
    audioInstances.push(fake);
    return fake;
  } as unknown as typeof globalThis.Audio;
  (globalThis as unknown as { Audio: unknown }).Audio = AudioCtor;

  let nextBlobId = 0;
  URL.createObjectURL = vi.fn(() => `blob:mock-${nextBlobId++}`) as unknown as (
    obj: Blob | MediaSource,
  ) => string;
  URL.revokeObjectURL = vi.fn() as unknown as (url: string) => void;
});

afterEach(() => {
  if (originalAudio === undefined) {
    delete (globalThis as unknown as { Audio?: unknown }).Audio;
  } else {
    (globalThis as unknown as { Audio: unknown }).Audio = originalAudio;
  }
  if (originalCreate) URL.createObjectURL = originalCreate;
  if (originalRevoke) URL.revokeObjectURL = originalRevoke;
  if (originalFetch) globalThis.fetch = originalFetch;
});

// Helper — install a fetch mock that returns a Response with the given
// body bytes once (resolved) and lets the test inspect the call args.
interface FetchSpy {
  spy: ReturnType<typeof vi.fn>;
  resolvedWith?: Response;
  rejectAfter?: () => void;
}

function installFetch(
  bodyBytes: Uint8Array = new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  contentType = "audio/wav",
): FetchSpy {
  const spy: FetchSpy = { spy: vi.fn() };
  spy.spy.mockImplementation(
    async (_input: RequestInfo, init?: RequestInit): Promise<Response> => {
      const signal = init?.signal;
      if (signal && signal.aborted) {
        const err = new DOMException("Aborted", "AbortError");
        throw err;
      }
      return new Promise<Response>((resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }
        const resp = new Response(bodyBytes as unknown as BodyInit, {
          status: 200,
          headers: { "Content-Type": contentType },
        });
        spy.resolvedWith = resp;
        resolve(resp);
      });
    },
  );
  globalThis.fetch = spy.spy as unknown as typeof globalThis.fetch;
  return spy;
}

// --- Import after mocks are set up --------------------------------------------

import { SarvamTtsAdapter } from "@/lib/voice/sarvam-tts-adapter";
import type { TtsProvider } from "@/lib/voice/types";

describe("SarvamTtsAdapter — interface (US-V.C.3)", () => {
  it("implements TtsProvider", () => {
    const t: TtsProvider = new SarvamTtsAdapter({ language_code: "en-IN" });
    expect(typeof t.speak).toBe("function");
    expect(typeof t.cancel).toBe("function");
    expect(typeof t.isAvailable).toBe("function");
  });

  it("isAvailable() returns true (server-driven provider)", () => {
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    expect(t.isAvailable()).toBe(true);
  });
});

describe("SarvamTtsAdapter.speak — happy path (US-V.C.3 / US-V.C.5)", () => {
  it("POSTs to /api/speak with text + language_code, plays blob, resolves on ended", async () => {
    const fetchSpy = installFetch(new Uint8Array([1, 2, 3]));
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });

    const speakP = t.speak("Hello there.");

    // Let the fetch microtask flush so the audio element gets created.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Trigger the audio end event. Use waitFor-ish polling because the
    // adapter wires onended after blob URL is created.
    for (let i = 0; i < 20 && audioInstances.length === 0; i++) {
      await Promise.resolve();
    }
    expect(audioInstances.length).toBeGreaterThan(0);
    const audio = audioInstances[0];
    // play() is invoked after fetch + arrayBuffer settle — flush extra
    // microtasks until it lands.
    for (let i = 0; i < 20 && audio.__plays === 0; i++) {
      await Promise.resolve();
    }
    expect(audio.__plays).toBe(1);
    expect(audio.__srcSetTo[0]).toMatch(/^blob:mock-/);

    audio.__triggerEnd();
    await expect(speakP).resolves.toBeUndefined();

    // Verify request shape.
    expect(fetchSpy.spy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.spy.mock.calls[0];
    expect(String(url)).toBe("/api/speak");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ text: "Hello there.", language_code: "en-IN" });
  });

  it("forwards constructor `voice` override in the request body", async () => {
    const fetchSpy = installFetch();
    const t = new SarvamTtsAdapter({
      language_code: "hi-IN",
      voice: "manisha",
    });
    const speakP = t.speak("Namaste.");
    for (let i = 0; i < 10 && audioInstances.length === 0; i++) {
      await Promise.resolve();
    }
    audioInstances[0].__triggerEnd();
    await speakP;

    const body = JSON.parse(fetchSpy.spy.mock.calls[0][1].body as string);
    expect(body).toEqual({
      text: "Namaste.",
      language_code: "hi-IN",
      voice: "manisha",
    });
  });

  it("language_code flows through on every speak() call (US-V.C.5)", async () => {
    const fetchSpy = installFetch();
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });

    const p1 = t.speak("one");
    for (let i = 0; i < 10 && audioInstances.length < 1; i++) {
      await Promise.resolve();
    }
    audioInstances[0].__triggerEnd();
    await p1;

    const p2 = t.speak("two");
    for (let i = 0; i < 10 && audioInstances.length < 2; i++) {
      await Promise.resolve();
    }
    audioInstances[1].__triggerEnd();
    await p2;

    expect(fetchSpy.spy).toHaveBeenCalledTimes(2);
    const b1 = JSON.parse(fetchSpy.spy.mock.calls[0][1].body as string);
    const b2 = JSON.parse(fetchSpy.spy.mock.calls[1][1].body as string);
    expect(b1.language_code).toBe("en-IN");
    expect(b2.language_code).toBe("en-IN");
  });
});

describe("SarvamTtsAdapter.speak — failure modes (US-V.C.3)", () => {
  it("rejects when fetch returns non-2xx", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { code: "voice.tts_failed" } }), {
        status: 502,
      });
    }) as unknown as typeof globalThis.fetch;

    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    await expect(t.speak("hi")).rejects.toMatchObject({ kind: "tts_failed" });
  });

  it("rejects when audio playback errors out", async () => {
    installFetch();
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    const speakP = t.speak("hi");
    for (let i = 0; i < 10 && audioInstances.length === 0; i++) {
      await Promise.resolve();
    }
    audioInstances[0].__triggerError();
    await expect(speakP).rejects.toMatchObject({ kind: "playback_failed" });
  });

  it("requires non-empty language_code at construction", () => {
    expect(
      () => new SarvamTtsAdapter({ language_code: "" }),
    ).toThrowError(/language_code/);
  });
});

describe("SarvamTtsAdapter.cancel — abort + idempotency (US-V.C.4)", () => {
  it("cancel() while idle is a no-op", () => {
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    expect(() => t.cancel()).not.toThrow();
    expect(() => t.cancel()).not.toThrow();
  });

  it("cancel() during in-flight speak() rejects prior with { kind: 'aborted' }", async () => {
    // fetch never resolves until aborted
    let rejectAbort: () => void = () => undefined;
    globalThis.fetch = vi.fn(async (_url: RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
        init?.signal?.addEventListener("abort", rejectAbort);
      });
    }) as unknown as typeof globalThis.fetch;

    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    const speakP = t.speak("hi");
    // give the adapter a tick to install the abort listener
    await Promise.resolve();
    t.cancel();
    await expect(speakP).rejects.toMatchObject({ kind: "aborted" });
  });

  it("cancel() during playback pauses, resets currentTime, clears src, rejects pending", async () => {
    installFetch();
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    const speakP = t.speak("hi");
    for (let i = 0; i < 20 && audioInstances.length === 0; i++) {
      await Promise.resolve();
    }
    const audio = audioInstances[0];
    for (let i = 0; i < 20 && audio.__plays === 0; i++) {
      await Promise.resolve();
    }
    expect(audio.__plays).toBe(1);

    t.cancel();
    expect(audio.__pauses).toBeGreaterThanOrEqual(1);
    expect(audio.__currentTime).toBe(0);
    expect(audio.src).toBe("");
    await expect(speakP).rejects.toMatchObject({ kind: "aborted" });
  });

  it("a fresh speak() after cancel() proceeds normally (US-V.C.4)", async () => {
    installFetch();
    const t = new SarvamTtsAdapter({ language_code: "en-IN" });
    const first = t.speak("first");
    for (let i = 0; i < 10 && audioInstances.length === 0; i++) {
      await Promise.resolve();
    }
    t.cancel();
    await expect(first).rejects.toMatchObject({ kind: "aborted" });

    const second = t.speak("second");
    for (let i = 0; i < 10 && audioInstances.length < 2; i++) {
      await Promise.resolve();
    }
    expect(audioInstances.length).toBe(2);
    audioInstances[1].__triggerEnd();
    await expect(second).resolves.toBeUndefined();
  });
});
