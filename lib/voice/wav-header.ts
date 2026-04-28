/**
 * Build a 44-byte canonical RIFF/WAVE header for a PCM s16le buffer
 * of known length. Used by the Sarvam adapter to wrap recorder
 * output before POSTing to /api/transcribe so Sarvam can decode it
 * with `input_audio_codec: 'wav'`.
 *
 * Why this exists: Sarvam's `pcm_s16le` codec is type-accepted by the
 * SDK but silently fails to decode raw PCM bytes (HAR-confirmed
 * 2026-04-28: zero transcript events on real speech). The fix is to
 * keep `input_audio_codec='wav'` and prepend a real WAV header so
 * the bytes are a valid WAV file end-to-end.
 *
 * Cycle 1 only supports 16 kHz mono 16-bit; anything else throws
 * because the recorder is hard-pinned to that shape and silently
 * accepting a wrong format would mask future regressions.
 *
 * Wire format reference: http://soundfile.sapp.org/doc/WaveFormat/
 *
 * Pure DataView — no DOM, no Buffer — so it runs in jsdom and node
 * tests without polyfills.
 */

export interface WavFormat {
  sampleRate: number
  channels: number
  bitsPerSample: number
}

export function writeWavHeader(
  pcmByteLength: number,
  fmt: WavFormat,
): Uint8Array {
  if (fmt.sampleRate !== 16000) {
    throw new Error('wav-header: cycle 1 only supports 16000 Hz')
  }
  if (fmt.channels !== 1) {
    throw new Error('wav-header: cycle 1 only supports mono')
  }
  if (fmt.bitsPerSample !== 16) {
    throw new Error('wav-header: cycle 1 only supports 16-bit')
  }

  const header = new Uint8Array(44)
  const view = new DataView(header.buffer)
  const writeAscii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) header[offset + i] = s.charCodeAt(i)
  }

  const byteRate = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8)
  const blockAlign = fmt.channels * (fmt.bitsPerSample / 8)

  // RIFF chunk descriptor
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + pcmByteLength, true) // file size - 8
  writeAscii(8, 'WAVE')

  // fmt sub-chunk
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk is 16 bytes
  view.setUint16(20, 1, true) // audio format = PCM
  view.setUint16(22, fmt.channels, true)
  view.setUint32(24, fmt.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, fmt.bitsPerSample, true)

  // data sub-chunk
  writeAscii(36, 'data')
  view.setUint32(40, pcmByteLength, true)

  return header
}
