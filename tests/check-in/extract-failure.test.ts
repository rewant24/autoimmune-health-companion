/**
 * Interim extract-429 fix (2026-07-04 assessment) — the pure policy the
 * check-in page's extraction catch blocks branch on. The load-bearing
 * behaviors:
 *   - the daily-cap 429 is classified apart from generic failures
 *   - a cap failure bails the answer loop immediately (terminal — every
 *     retry fails identically); transient failures get one re-ask
 *   - the Stage-2 notice copy is honest and distinct per class
 */
import { describe, expect, it } from 'vitest'

import {
  classifyExtractError,
  extractFailureNotice,
  shouldBailAnswerLoop,
} from '@/lib/checkin/extract-failure'
import {
  ExtractDailyCapError,
  ExtractFailedError,
} from '@/lib/checkin/extract-metrics'

describe('classifyExtractError', () => {
  it('classifies ExtractDailyCapError as daily-cap', () => {
    expect(classifyExtractError(new ExtractDailyCapError())).toBe('daily-cap')
  })

  it('classifies ExtractFailedError as transient', () => {
    expect(classifyExtractError(new ExtractFailedError('boom'))).toBe(
      'transient',
    )
  })

  it('classifies unknown throwables as transient', () => {
    expect(classifyExtractError(new Error('boom'))).toBe('transient')
    expect(classifyExtractError('string throw')).toBe('transient')
    expect(classifyExtractError(undefined)).toBe('transient')
  })
})

describe('shouldBailAnswerLoop', () => {
  it('bails immediately on the first daily-cap failure', () => {
    expect(shouldBailAnswerLoop('daily-cap', 1)).toBe(true)
  })

  it('re-asks once for a transient failure, bails on the second', () => {
    expect(shouldBailAnswerLoop('transient', 1)).toBe(false)
    expect(shouldBailAnswerLoop('transient', 2)).toBe(true)
    expect(shouldBailAnswerLoop('transient', 3)).toBe(true)
  })
})

describe('extractFailureNotice', () => {
  it('daily-cap copy is honest about the limit and points to taps', () => {
    const copy = extractFailureNotice('daily-cap')
    expect(copy).toMatch(/limit/i)
    expect(copy).toMatch(/taps/i)
    expect(copy).toMatch(/nothing you said is lost/i)
  })

  it('transient copy owns the failure without blaming the user', () => {
    const copy = extractFailureNotice('transient')
    expect(copy).toMatch(/not you/i)
    expect(copy).toMatch(/taps/i)
    expect(copy).not.toMatch(/limit/i)
  })

  it('the two classes get distinct copy', () => {
    expect(extractFailureNotice('daily-cap')).not.toBe(
      extractFailureNotice('transient'),
    )
  })
})
