/**
 * TTS vendor bake-off (vendor-strategy spike 2026-07-05, Track 2 eval).
 *
 * Synthesizes the same 10 utterances (5 international-English, 5 Hinglish
 * code-mix — all real Saha voice-catalog register) through every vendor
 * whose API key is present in the environment, writes the audio to
 * `bakeoff-output/<vendor>/`, and prints a per-vendor summary with char
 * counts for cost math. Vendors without keys are SKIPPED, not errors —
 * add keys incrementally as accounts get created.
 *
 * Run:  node --env-file=.env.local scripts/tts-bakeoff.mjs
 *
 * Env keys (all optional except you want at least one):
 *   SARVAM_API_KEY                     — already in .env.local (prod vendor)
 *   GOOGLE_TTS_API_KEY                 — Google Cloud TTS API key
 *   ELEVENLABS_API_KEY                 — ElevenLabs; ELEVENLABS_VOICE_ID
 *                                        optional (defaults to Rachel)
 *   GEMINI_API_KEY                     — Google AI Studio key (Gemini TTS)
 *   REVERIE_API_KEY + REVERIE_APP_ID   — Reverie (shortlisted for the
 *                                        Hinglish-fallback angle)
 *
 * Shape caveats: the Sarvam call mirrors `lib/voice/sarvam-tts-server.ts`.
 * The Gemini and Reverie request shapes are best-effort from public docs
 * and UNVERIFIED against a live key — if a vendor errors, the full
 * response body is printed so the shape can be corrected in one pass.
 *
 * Scoring happens outside this script: listen blind (Rewant + one
 * international listener), score naturalness per spike §4, and record
 * the verdict in the spike doc.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "bakeoff-output";

/**
 * The fixed utterance set. en-* items exercise the international-accent
 * problem; hi-* items exercise Hinglish code-mix (Sarvam's home turf —
 * the fallback vendors must not embarrass themselves here).
 */
const UTTERANCES = [
  // International English — Saha catalog register
  { id: "en-01", lang: "en", text: "Hi, I'm Saha. How are you feeling today?" },
  { id: "en-02", lang: "en", text: "How is the pain today, 1 to 10?" },
  { id: "en-03", lang: "en", text: "Got it, pain at four. How's your energy been?" },
  { id: "en-04", lang: "en", text: "That's fine — skipping mood today. Did you take your medications?" },
  { id: "en-05", lang: "en", text: "Thanks for checking in. I've saved today's entry — see you tomorrow." },
  // Hinglish code-mix — the hard cases
  { id: "hi-01", lang: "hi", text: "Aaj pain kaisa hai, ek se dus mein?" },
  { id: "hi-02", lang: "hi", text: "Theek hai, pain four pe note kar liya. Energy kaisi rahi aaj?" },
  { id: "hi-03", lang: "hi", text: "Koi baat nahi — mood skip karte hain. Medicines li aaj?" },
  { id: "hi-04", lang: "hi", text: "Kya aaj koi flare-up hua? Yes, no, ya ongoing?" },
  { id: "hi-05", lang: "hi", text: "Bahut accha, aaj ki entry save ho gayi. Kal milte hain!" },
];

/** Minimal 16-bit mono PCM → WAV wrapper (for vendors returning raw PCM). */
function wavFromPcm16(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function expectOk(res, vendor) {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${vendor} HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  return res;
}

/**
 * Vendor adapters. Each returns { bytes: Buffer, ext: string } or throws.
 * `enabled()` gates on env keys so missing accounts skip cleanly.
 */
const VENDORS = [
  {
    name: "sarvam",
    enabled: () => !!process.env.SARVAM_API_KEY,
    // Mirrors lib/voice/sarvam-tts-server.ts (bulbul:v2, anushka).
    async synth(u) {
      const res = await expectOk(
        await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "api-subscription-key": process.env.SARVAM_API_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            text: u.text,
            target_language_code: u.lang === "hi" ? "hi-IN" : "en-IN",
            speaker: process.env.SARVAM_TTS_SPEAKER ?? "anushka",
            model: "bulbul:v2",
          }),
        }),
        "sarvam",
      );
      const json = await res.json();
      const b64 = Array.isArray(json.audios) ? json.audios[0] : json.audio;
      if (!b64) throw new Error(`sarvam: no audio in response ${JSON.stringify(json).slice(0, 200)}`);
      return { bytes: Buffer.from(b64, "base64"), ext: "wav" };
    },
  },
  {
    name: "google",
    enabled: () => !!process.env.GOOGLE_TTS_API_KEY,
    async synth(u) {
      const voice =
        u.lang === "hi"
          ? { languageCode: "hi-IN", name: "hi-IN-Neural2-A" }
          : { languageCode: "en-US", name: "en-US-Neural2-F" };
      const res = await expectOk(
        await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              input: { text: u.text },
              voice,
              audioConfig: { audioEncoding: "MP3" },
            }),
          },
        ),
        "google",
      );
      const json = await res.json();
      return { bytes: Buffer.from(json.audioContent, "base64"), ext: "mp3" };
    },
  },
  {
    name: "elevenlabs",
    enabled: () => !!process.env.ELEVENLABS_API_KEY,
    async synth(u) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM"; // Rachel
      const res = await expectOk(
        await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": process.env.ELEVENLABS_API_KEY,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              text: u.text,
              model_id: "eleven_multilingual_v2",
            }),
          },
        ),
        "elevenlabs",
      );
      return { bytes: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
    },
  },
  {
    name: "gemini",
    enabled: () => !!process.env.GEMINI_API_KEY,
    // Shape UNVERIFIED against a live key — corrected in one pass if it errors.
    async synth(u) {
      const res = await expectOk(
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: u.text }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
              },
            }),
          },
        ),
        "gemini",
      );
      const json = await res.json();
      const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) throw new Error(`gemini: no audio in response ${JSON.stringify(json).slice(0, 300)}`);
      // Gemini TTS returns raw 24 kHz 16-bit mono PCM.
      return { bytes: wavFromPcm16(Buffer.from(b64, "base64"), 24000), ext: "wav" };
    },
  },
  {
    name: "reverie",
    enabled: () => !!process.env.REVERIE_API_KEY && !!process.env.REVERIE_APP_ID,
    // Shape UNVERIFIED — from public Reverie docs; verify when the account exists.
    async synth(u) {
      const res = await expectOk(
        await fetch("https://revapi.reverieinc.com/", {
          method: "POST",
          headers: {
            "REV-API-KEY": process.env.REVERIE_API_KEY,
            "REV-APP-ID": process.env.REVERIE_APP_ID,
            "REV-APPNAME": "tts",
            speaker: u.lang === "hi" ? "hi_female" : "en_female",
            "content-type": "application/json",
          },
          body: JSON.stringify({ text: u.text, speed: 1.0, pitch: 1.0, format: "mp3" }),
        }),
        "reverie",
      );
      return { bytes: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
    },
  },
];

const totalChars = UTTERANCES.reduce((n, u) => n + u.text.length, 0);
const results = [];

for (const vendor of VENDORS) {
  if (!vendor.enabled()) {
    results.push({ vendor: vendor.name, status: "SKIPPED (no key in env)" });
    continue;
  }
  const dir = join(OUT_DIR, vendor.name);
  mkdirSync(dir, { recursive: true });
  let ok = 0;
  const failures = [];
  for (const u of UTTERANCES) {
    try {
      const { bytes, ext } = await vendor.synth(u);
      writeFileSync(join(dir, `${u.id}.${ext}`), bytes);
      ok += 1;
      process.stdout.write(`  ${vendor.name} ${u.id} ✓\n`);
    } catch (err) {
      failures.push(`${u.id}: ${err.message}`);
      process.stdout.write(`  ${vendor.name} ${u.id} ✗ ${err.message}\n`);
    }
  }
  results.push({
    vendor: vendor.name,
    status: `${ok}/${UTTERANCES.length} synthesized${failures.length ? ` — ${failures.length} FAILED` : ""}`,
  });
}

console.log("\n=== Bake-off summary ===");
for (const r of results) console.log(`${r.vendor.padEnd(12)} ${r.status}`);
console.log(`\nUtterance set: ${UTTERANCES.length} lines, ${totalChars} chars total.`);
console.log(
  "Cost reference (per spike §3): Sarvam ₹15/10k chars → " +
    `₹${((totalChars / 10000) * 15).toFixed(3)} for this set. ` +
    "Other vendors: rates UNVERIFIED — read from each console after the run.",
);
console.log(`Audio written to ${OUT_DIR}/<vendor>/ — listen blind, score per spike §4.`);

if (results.every((r) => r.status.startsWith("SKIPPED"))) {
  console.error("\nNo vendor keys found in env. Run with: node --env-file=.env.local scripts/tts-bakeoff.mjs");
  process.exit(1);
}
