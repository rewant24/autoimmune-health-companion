/**
 * save-later queue tests (US-1.F.5).
 *
 * Per ADR-022: localStorage queue under key `saha.saveLater.v1`.
 * Schema-versioned: `{ v: 1, items: [...] }`. Idempotency relies on
 * `clientRequestId` already in the payload (server-side dedupe).
 *
 * API surface:
 *   - enqueue(payload): void
 *   - drain(): Payload[]   (read + clear)
 *   - peek(): Payload[]    (read without clear)
 *
 * Edge cases:
 *   - Corrupted localStorage → log warning + return empty
 *   - Wrong schema version → return empty
 *   - SSR / no localStorage → return empty + no throw
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  enqueue,
  drain,
  peek,
  SAVE_LATER_KEY,
  type SaveLaterPayload,
} from '@/lib/checkin/save-later'

const samplePayload = (clientRequestId: string): SaveLaterPayload => ({
  userId: 'user-1',
  date: '2026-04-25',
  pain: 5,
  mood: 'okay',
  adherenceTaken: true,
  flare: 'no',
  energy: 6,
  declined: [],
  transcript: 'felt okay today',
  stage: 'open',
  durationMs: 18000,
  providerUsed: 'web-speech',
  clientRequestId,
})

describe('save-later queue', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('uses the versioned key saha.saveLater.v1', () => {
    expect(SAVE_LATER_KEY).toBe('saha.saveLater.v1')
  })

  it('enqueue writes a v1-shaped envelope with one item', () => {
    enqueue(samplePayload('req-1'))
    const raw = window.localStorage.getItem(SAVE_LATER_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { v: number; items: unknown[] }
    expect(parsed.v).toBe(1)
    expect(parsed.items).toHaveLength(1)
  })

  it('peek returns enqueued items without clearing', () => {
    enqueue(samplePayload('req-1'))
    enqueue(samplePayload('req-2'))
    const items = peek()
    expect(items).toHaveLength(2)
    expect(items[0].clientRequestId).toBe('req-1')
    expect(items[1].clientRequestId).toBe('req-2')
    // Still there.
    expect(peek()).toHaveLength(2)
  })

  it('drain returns items and clears the queue', () => {
    enqueue(samplePayload('req-1'))
    enqueue(samplePayload('req-2'))
    const drained = drain()
    expect(drained).toHaveLength(2)
    expect(peek()).toEqual([])
    expect(window.localStorage.getItem(SAVE_LATER_KEY)).toBeNull()
  })

  it('peek on empty queue returns []', () => {
    expect(peek()).toEqual([])
  })

  it('drain on empty queue returns []', () => {
    expect(drain()).toEqual([])
  })

  it('corrupted localStorage value → peek returns [] and logs a warning', () => {
    window.localStorage.setItem(SAVE_LATER_KEY, '{not-json')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(peek()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it('wrong schema version → peek returns [] and logs a warning', () => {
    window.localStorage.setItem(
      SAVE_LATER_KEY,
      JSON.stringify({ v: 99, items: [{ foo: 'bar' }] }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(peek()).toEqual([])
    expect(warn).toHaveBeenCalled()
  })

  it('drain on corrupted storage clears the bad value', () => {
    window.localStorage.setItem(SAVE_LATER_KEY, '{not-json')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(drain()).toEqual([])
    expect(window.localStorage.getItem(SAVE_LATER_KEY)).toBeNull()
  })

  it('enqueue preserves existing items (append, not overwrite)', () => {
    enqueue(samplePayload('req-1'))
    enqueue(samplePayload('req-2'))
    enqueue(samplePayload('req-3'))
    const items = peek()
    expect(items.map((i) => i.clientRequestId)).toEqual([
      'req-1',
      'req-2',
      'req-3',
    ])
  })

  it('enqueue after corrupted value recovers — replaces with valid envelope', () => {
    window.localStorage.setItem(SAVE_LATER_KEY, '{not-json')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    enqueue(samplePayload('req-1'))
    const items = peek()
    expect(items).toHaveLength(1)
    expect(items[0].clientRequestId).toBe('req-1')
  })
})
