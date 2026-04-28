/**
 * Unit tests for `lib/voice/sarvam-stt-rest.ts` — the REST batch
 * caller that replaces the streaming-WS path post-Bug-1.
 *
 * Strategy: inject a fake `fetch` via `opts.fetchImpl` so we can
 * (a) inspect the request shape (URL, method, headers, FormData
 * fields) and (b) drive arbitrary Response shapes (200 / 400 / 413 /
 * 422 / 500, malformed JSON, AbortError) without touching the network.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SarvamRestError,
  SARVAM_REST_ENDPOINT,
  SARVAM_REST_MODE,
  SARVAM_REST_MODEL,
  readSarvamApiKey,
  transcribeBatch,
} from '@/lib/voice/sarvam-stt-rest'

const SAMPLE_AUDIO = new Uint8Array([
  // 44-byte WAV header + 1 PCM sample. Bytes don't have to be a real
  // WAV here — the module hands them straight to the multipart blob.
  ...new Array(44).fill(0),
  0x10,
  0x00,
])

interface CapturedRequest {
  url: string
  init: RequestInit
}

function makeFakeFetch(
  resolve: (req: CapturedRequest) => Response,
): { captured: CapturedRequest | null; fetch: typeof fetch } {
  const state: { captured: CapturedRequest | null } = { captured: null }
  const fetchImpl: typeof fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const captured: CapturedRequest = {
      url: typeof url === 'string' ? url : String(url),
      init: init ?? {},
    }
    state.captured = captured
    return resolve(captured)
  }) as typeof fetch
  return {
    get captured() {
      return state.captured
    },
    fetch: fetchImpl,
  } as unknown as { captured: CapturedRequest | null; fetch: typeof fetch }
}

const ORIGINAL_API_KEY = process.env.SARVAM_API_KEY

beforeEach(() => {
  process.env.SARVAM_API_KEY = 'test-key-12345'
})

afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.SARVAM_API_KEY
  } else {
    process.env.SARVAM_API_KEY = ORIGINAL_API_KEY
  }
})

describe('readSarvamApiKey', () => {
  it('returns the trimmed key when set', () => {
    process.env.SARVAM_API_KEY = '  abc-123  '
    expect(readSarvamApiKey()).toBe('abc-123')
  })

  it('returns null when missing', () => {
    delete process.env.SARVAM_API_KEY
    expect(readSarvamApiKey()).toBeNull()
  })

  it('returns null when blank', () => {
    process.env.SARVAM_API_KEY = '   '
    expect(readSarvamApiKey()).toBeNull()
  })
})

describe('transcribeBatch — happy path', () => {
  it('POSTs multipart form-data with file, model, mode, language_code', async () => {
    const ff = makeFakeFetch(
      () =>
        new Response(
          JSON.stringify({
            request_id: 'req_abc',
            transcript: 'the quick brown fox',
            language_code: 'en-IN',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    )

    const result = await transcribeBatch({
      audio: SAMPLE_AUDIO,
      languageCode: 'en-IN',
      fetchImpl: ff.fetch,
    })

    expect(result.transcript).toBe('the quick brown fox')
    expect(result.requestId).toBe('req_abc')
    expect(result.detectedLanguageCode).toBe('en-IN')

    expect(ff.captured?.url).toBe(SARVAM_REST_ENDPOINT)
    expect(ff.captured?.init.method).toBe('POST')

    const headers = ff.captured?.init.headers as Record<string, string>
    expect(headers['api-subscription-key']).toBe('test-key-12345')

    const body = ff.captured?.init.body
    expect(body).toBeInstanceOf(FormData)
    const fd = body as FormData
    expect(fd.get('model')).toBe(SARVAM_REST_MODEL)
    expect(fd.get('mode')).toBe(SARVAM_REST_MODE)
    expect(fd.get('language_code')).toBe('en-IN')
    const file = fd.get('file')
    expect(file).toBeInstanceOf(Blob)
    expect((file as Blob).type).toBe('audio/wav')
    expect((file as Blob).size).toBe(SAMPLE_AUDIO.byteLength)
  })

  it('returns null requestId / detectedLanguageCode when fields are missing', async () => {
    const ff = makeFakeFetch(
      () =>
        new Response(JSON.stringify({ transcript: 'hello' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )

    const result = await transcribeBatch({
      audio: SAMPLE_AUDIO,
      languageCode: 'en-IN',
      fetchImpl: ff.fetch,
    })

    expect(result.transcript).toBe('hello')
    expect(result.requestId).toBeNull()
    expect(result.detectedLanguageCode).toBeNull()
  })

  it('returns empty transcript when Sarvam returned no text field', async () => {
    const ff = makeFakeFetch(
      () =>
        new Response(JSON.stringify({ request_id: 'r' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )

    const result = await transcribeBatch({
      audio: SAMPLE_AUDIO,
      languageCode: 'en-IN',
      fetchImpl: ff.fetch,
    })

    expect(result.transcript).toBe('')
    expect(result.requestId).toBe('r')
  })
})

describe('transcribeBatch — error paths', () => {
  it('throws voice.provider_unconfigured when SARVAM_API_KEY is missing', async () => {
    delete process.env.SARVAM_API_KEY
    await expect(
      transcribeBatch({ audio: SAMPLE_AUDIO, languageCode: 'en-IN' }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.provider_unconfigured',
    })
  })

  it('throws voice.session_too_large on 413', async () => {
    const ff = makeFakeFetch(() => new Response('payload too large', { status: 413 }))
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.session_too_large',
    })
  })

  it('throws voice.unprocessable on 400', async () => {
    const ff = makeFakeFetch(
      () => new Response('bad audio', { status: 400 }),
    )
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.unprocessable',
    })
  })

  it('throws voice.unprocessable on 422', async () => {
    const ff = makeFakeFetch(
      () => new Response('unprocessable', { status: 422 }),
    )
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.unprocessable',
    })
  })

  it('throws voice.provider_unconfigured on 401', async () => {
    const ff = makeFakeFetch(() => new Response('forbidden', { status: 401 }))
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.provider_unconfigured',
    })
  })

  it('throws voice.network on 500', async () => {
    const ff = makeFakeFetch(() => new Response('internal error', { status: 500 }))
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.network',
    })
  })

  it('throws voice.aborted when fetch rejects with AbortError', async () => {
    const fetchImpl: typeof fetch = (async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }) as typeof fetch

    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.aborted',
    })
  })

  it('throws voice.network on non-Abort fetch rejection', async () => {
    const fetchImpl: typeof fetch = (async () => {
      throw new TypeError('network down')
    }) as typeof fetch

    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.network',
    })
  })

  it('throws voice.network on malformed JSON response', async () => {
    const ff = makeFakeFetch(
      () =>
        new Response('not json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.network',
    })
  })

  it('throws voice.network on non-object JSON response', async () => {
    const ff = makeFakeFetch(
      () =>
        new Response(JSON.stringify('a bare string'), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(
      transcribeBatch({
        audio: SAMPLE_AUDIO,
        languageCode: 'en-IN',
        fetchImpl: ff.fetch,
      }),
    ).rejects.toMatchObject({
      name: 'SarvamRestError',
      code: 'voice.network',
    })
  })
})

describe('SarvamRestError', () => {
  it('exposes a typed code field', () => {
    const err = new SarvamRestError('voice.network', 'oops')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('SarvamRestError')
    expect(err.code).toBe('voice.network')
    expect(err.message).toBe('oops')
  })
})
