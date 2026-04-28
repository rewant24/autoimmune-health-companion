/**
 * Byte-level tests for `lib/voice/wav-header.ts` — the 44-byte
 * canonical RIFF/WAVE header builder used by the Sarvam adapter to
 * wrap buffered PCM s16le before POST.
 *
 * Wire format reference: http://soundfile.sapp.org/doc/WaveFormat/
 *
 * Cycle 1 fix (Bug 1, Option B, HAR 2026-04-28). Sarvam's `pcm_s16le`
 * codec is type-accepted but silently fails to decode raw PCM. We
 * keep `input_audio_codec='wav'` and prepend a real WAV header so
 * the bytes Sarvam sees ARE a valid WAV file.
 */

import { describe, expect, it } from 'vitest'
import { writeWavHeader } from '@/lib/voice/wav-header'

const PCM_16K_MONO = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
} as const

describe('writeWavHeader', () => {
  it('writes the canonical 44-byte RIFF/WAVE header', () => {
    const pcmByteLength = 32000 // 1 second @ 16k mono 16-bit
    const header = writeWavHeader(pcmByteLength, PCM_16K_MONO)

    expect(header.byteLength).toBe(44)

    const view = new DataView(
      header.buffer,
      header.byteOffset,
      header.byteLength,
    )
    const ascii = (offset: number, len: number): string =>
      String.fromCharCode(
        ...new Uint8Array(header.buffer, header.byteOffset + offset, len),
      )

    // RIFF chunk descriptor
    expect(ascii(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + pcmByteLength)
    expect(ascii(8, 4)).toBe('WAVE')

    // fmt sub-chunk
    expect(ascii(12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16) // fmt chunk size
    expect(view.getUint16(20, true)).toBe(1) // PCM = 1
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000) // sample rate
    expect(view.getUint32(28, true)).toBe(32000) // byte rate = sr * ch * bps/8
    expect(view.getUint16(32, true)).toBe(2) // block align = ch * bps/8
    expect(view.getUint16(34, true)).toBe(16) // bits per sample

    // data sub-chunk
    expect(ascii(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(pcmByteLength)
  })

  it('rejects non-PCM-s16le shapes for cycle 1', () => {
    expect(() =>
      writeWavHeader(100, {
        sampleRate: 16000,
        channels: 2,
        bitsPerSample: 16,
      }),
    ).toThrow(/mono/)
    expect(() =>
      writeWavHeader(100, {
        sampleRate: 44100,
        channels: 1,
        bitsPerSample: 16,
      }),
    ).toThrow(/16000/)
    expect(() =>
      writeWavHeader(100, {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 8,
      }),
    ).toThrow(/16-bit/)
  })

  it('handles a zero-length PCM buffer (final = 36, data = 0)', () => {
    const header = writeWavHeader(0, PCM_16K_MONO)
    const view = new DataView(
      header.buffer,
      header.byteOffset,
      header.byteLength,
    )
    expect(view.getUint32(4, true)).toBe(36)
    expect(view.getUint32(40, true)).toBe(0)
  })
})
