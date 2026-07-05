# Spike — Multi-vendor voice + LLM strategy

**Date:** 2026-07-05 · **Status:** DRAFT — awaiting Rewant decisions (§8) · **Owner:** Fable session 25

## 1. Context & trigger

Three threads from Rewant (2026-07-05 session), all downstream of the
[tech-stack-scale assessment](../assessment/2026-07-04-tech-stack-scale.md)'s #1
finding (Sarvam concentration = 89% of COGS, no fallback vendor):

1. **Accent-routed voice.** When an international (non-Indian) user tries the voice
   check-in, Sarvam's Indian-accented English voice reads as unfamiliar and erodes
   trust before the product gets a chance. Ideation: route English/international
   users to a different voice vendor (Gemini, Google Cloud, ElevenLabs, …) — better
   accent fit AND potentially better unit economics for that cohort.
2. **Plug-and-play LLM.** Make the extraction-LLM swappable per cost/financing
   conditions — switch models without a code cycle.
3. **TTS naturalness.** The current live voice sounds "robotic / AI with a stuttery
   accent" compared to talking to ChatGPT/Gemini directly on their own platforms.
   Rewant's question: is that a TTS or an STT problem? (Answer: TTS + pipeline
   architecture — §6.)

A fourth standing thread from the assessment rides along: a **fallback voice
adapter** is outage insurance for the single-vendor Sarvam risk, and the
accent-routing work in (1) builds exactly that adapter.

## 2. Current state (verified in code, 2026-07-05)

| Seam | Where | State |
|---|---|---|
| STT provider factory | `lib/voice/provider.ts` → `getVoiceProvider()` | Env-driven (`VOICE_PROVIDER`): `web-speech` \| `openai-realtime` \| `sarvam`. Prod = sarvam. |
| TTS provider factory | `lib/voice/provider.ts` → `getTtsProvider()` | Env-driven (`VOICE_TTS_PROVIDER`): `web-speech` \| `sarvam`. Prod = sarvam (bulbul:v2 via `/api/speak`). |
| Language | `provider.ts` `DEFAULT_LANGUAGE_CODE = 'en-IN'` | Hardcoded; the file's own comment says "multilingual config will route through here when F03+ adds language settings." |
| Extraction LLM | 3 routes (`extract`, `extract-event`, `extract-medication`) | Vercel AI SDK `generateObject` + **AI Gateway**: `gateway(DEFAULT_MODEL_ID)`, `DEFAULT_MODEL_ID = 'openai/gpt-4o-mini'` hardcoded in `lib/checkin/extract-prompt.ts` and re-declared in the two sibling routes (ADR-020). |
| Prior art | `lib/voice/openai-realtime-adapter.ts` | An OpenAI Realtime STT adapter already exists from the ADR-017 era, before ADR-026 locked Sarvam. |

Key implication: **both swaps the spike proposes land on seams that already exist.**
Voice routing extends a working factory; LLM routing is a model-string change behind
a gateway that already abstracts providers. Neither requires new architecture.

## 3. Track 1 — Vendor landscape (research 2026-07-05)

### 3a. Regional / Hinglish voice (Sarvam's job)

| Vendor | Strength | Weakness vs Sarvam | Fit |
|---|---|---|---|
| **Sarvam** (incumbent) | Best-in-class Hinglish code-mix STT (saarika/saaras) + TTS (bulbul); ₹15/10k chars TTS, ₹30/hr STT — cheapest; India-hosted, DPDP-advertising | Single vendor; no SLA contract; 1,000 req/min Business-tier ceiling; robotic prosody (§6) | Keep as primary for Indic |
| **Reverie** | Repeatedly cited as best India-native alternative for code-mixed Hinglish | Pricing/limits UNVERIFIED | The credible Hinglish fallback — evaluate first |
| **Smallest.ai** (Lightning) | India-based, sub-100ms TTS, positioned directly vs Sarvam | STT story thinner; UNVERIFIED on Hinglish STT | TTS-only fallback candidate |
| **AI4Bharat** (IndicConformer STT, Indic Parler-TTS) | Open-source, 22/18+ Indian languages, free | Self-hosted — contradicts the solo-operator serverless premise | Nuclear option only (Sarvam reprices/pivots) |
| **Google Cloud Speech** | Excellent pure-Hindi + 125+ languages; managed | Fumbles mid-sentence Hindi↔English code-mixing | Better as the *English* route (§3b) than a Hinglish fallback |
| **Azure Speech** | Deepest catalog (140+ langs, 400+ voices incl. Indic variants); HIPAA posture Sarvam lacks | Same code-mix weakness; enterprise pricing | Relevant if US-PHI ever matters |

**Verdict (confirms the assessment):** no drop-in Hinglish substitute. Reverie is
the only vendor to actually evaluate as a like-for-like fallback.

### 3b. English / international voice (the new cohort)

English voice is a commodity in 2026 — this is where the accent problem dissolves:

| Vendor | Why | Notes |
|---|---|---|
| **Google Cloud TTS/STT** | Rewant explicitly open to it; natural en-US/en-GB voices; one vendor covers both directions; managed, usage-billed | Pricing at Saha's profile UNVERIFIED — measure in the eval |
| **Gemini native audio / Live API** | Rewant's named candidate; the "sounds like talking to Gemini" quality IS this API (§6) | Realtime S2S pricing model differs from per-char TTS — cost-model before committing |
| **ElevenLabs** | Best-in-class naturalness; TTS Hindi+Tamil too; STT covers 7+ Indic languages | Priciest tier; could serve BOTH routes if cost clears |
| **Cartesia Sonic / Deepgram Aura-2** | Latency leaders (~40–90ms first-audio) | Thin Indic depth — English-route only |
| **OpenAI Realtime / gpt-4o-mini-tts** | Adapter prior art already in-tree | S2S economics same caveat as Gemini Live |

### 3c. Extraction LLM (OpenAI's job)

Commodity job; all major providers do structured output. Per-1M-token (in/out):
Gemini Flash-Lite ~$0.10/$0.40 · Claude Haiku 4.5 $1/$5 · Mistral Nemo $0.02/$0.04
· DeepSeek V3.x ~$0.14/$0.28 · gpt-4o-mini (incumbent). All reachable through the
AI Gateway Saha already uses. Economically minor next to voice (LLM is a rounding
error in the ₹89/user/mo COGS), so the driver here is *optionality*, not savings.

## 4. Track 2 — Accent-routed voice adapter (design)

**Principle:** one new concept — a **voice route** derived from the user's language
setting — resolved in the existing factories. Not a new abstraction layer.

1. **User-facing setting:** `voiceLocale` (e.g. `en-IN` | `en-US` | future `hi-IN`),
   default `en-IN`, stored with the profile (post-auth: users table; pre-auth: the
   localStorage stub). This is the F03+ "language settings" hook `provider.ts`
   already reserves.
2. **Factory change:** `getVoiceProvider(locale)` / `getTtsProvider(locale)` consult
   a route table: `en-IN → sarvam`, `en-US → <english-vendor>`, unknown → sarvam.
   Env overrides stay for dev/preview.
3. **Server routes:** `/api/speak` + `/api/transcribe` gain a vendor branch behind
   the same validation (text caps, pace bounds, key hygiene — all vendor-neutral
   already).
4. **Fallback = same mechanism:** a Sarvam outage flips the route table's `en-IN`
   entry to the secondary vendor (degraded Hinglish, but alive). The accent feature
   and the outage insurance are one build.

**Sequencing constraint (PR #21 postmortem / A2 gate):** any rewiring of the live
`speak()`/recorder path is the vitest-green-≠-live-audio class of change. Building
a *new* adapter class + route branch is safe to unit-test; **cutting live traffic
over to it needs either the A2 e2e voice harness or a scripted manual smoke per
vendor.** Budget that into the cycle.

**Recommended eval before building:** a ½-day bake-off script — same 10 check-in
utterances (5 Hinglish, 5 international-English) through Sarvam / Google /
ElevenLabs / Gemini TTS; score naturalness blind (Rewant + one international
listener), record ₹/check-in per vendor. The winner becomes the `en-US` route.

## 5. Track 3 — Plug-and-play extraction LLM (design)

Mostly already true. The gap is configuration, not architecture:

1. **Consolidate:** one `lib/checkin/model-config.ts` owning the model ID; delete
   the two re-declarations in `extract-event`/`extract-medication`.
2. **Env-driven:** `EXTRACT_MODEL_ID` (default `openai/gpt-4o-mini`). Switching to
   `google/gemini-flash` or `anthropic/claude-haiku-4.5` becomes a Vercel env edit +
   redeploy — no code cycle. AI Gateway keys/billing/routing are already unified.
3. **Gateway failover (optional):** AI Gateway supports fallback model chains —
   worth enabling for provider-outage resilience once (4) passes.
4. **The real cost of a swap is eval, not code.** Guardrails that MUST hold per
   provider: (a) Zod schemas stay `.nullable()` not `.optional()` (OpenAI structured
   -output constraint — other providers have their own quirks; run the extract test
   suite against the live candidate model, not just mocks); (b) the dedicated
   `rate_limited` error code must survive (each provider 429s differently through
   the gateway); (c) cap counting stays one-increment-per-logical-unit.
5. **Non-goal:** a bespoke multi-provider abstraction. The AI SDK + Gateway *is*
   the abstraction; adding our own layer on top is the "unnecessary abstraction"
   the code-quality rules prohibit.

## 6. Track 4 — Why the voice sounds robotic (TTS vs STT, answered)

**It is a TTS + pipeline-architecture problem. STT is not involved in how Saha
*sounds*** — STT only affects whether Saha *understood* (mishears → re-asks). The
stuttery/robotic perception has three stacked causes:

1. **The voice model itself.** bulbul:v2 is optimized for Indic coverage and cost,
   not ChatGPT-grade prosody. Ceiling is the model, not our integration.
2. **Turn-based pipeline vs realtime speech-to-speech.** Talking to ChatGPT/Gemini
   on their platforms ≠ STT→LLM→TTS. Those are **native speech-to-speech models**
   (OpenAI Realtime, Gemini Live): audio-in→audio-out in one model, streaming both
   ways, with breathing/intonation/mid-sentence starts. Saha's loop is discrete
   POST turns — record → transcribe → extract → synthesize → play — so every turn
   has a hard silence gap and each utterance starts cold. *That* start-stop cadence
   is most of the "stuttery AI" feel.
3. **Whole-utterance synthesis.** `/api/speak` synthesizes per-utterance; playback
   waits for the full audio body. No time-to-first-audio streaming.

**Options ladder (cheap → expensive):**
- **6a. Tune bulbul (S, days):** pace is already plumbed (Q2); pitch/loudness are
  plain request fields (assessment T4); `SARVAM_TTS_CACHED_RESPONSES` already
  env-gated. Pattern C work. Ceiling: still bulbul.
- **6b. Streaming playback (M):** stream TTS bytes into a `MediaSource`/AudioWorklet
  so audio starts at first chunk. Kills part of the gap feel. A2-gated (live-audio
  class change).
- **6c. Better English TTS via Track 2 (M):** for the international cohort the
  accent fix and the naturalness fix are the same swap (ElevenLabs/Google/Gemini
  voices are simply better at English prosody).
- **6d. Realtime S2S for the check-in loop (L, post-auth):** the true "sounds like
  ChatGPT" answer — Gemini Live or OpenAI Realtime as a *conversation* provider,
  collapsing STT+TTS for that route. Big: state-machine rework, new cost model
  (S2S is priced on audio-minutes, changes the ₹79 math in unknown directions),
  extraction still needs the text transcript. Do NOT start before the A2 harness
  and auth land. The existing `openai-realtime-adapter.ts` is a head start, not a
  free pass.

## 7. Recommendation (one paragraph)

Do Track 3 first (S — an afternoon: consolidate + env-drive the model ID; pure
config, no live-audio risk). Then the Track 4a bulbul tuning + the Track 2 bake-off
in one short cycle — the bake-off data decides the `en-US` vendor and doubles as the
Sarvam-fallback evaluation. Build the route-table adapter next (Track 2, M) behind
the existing factories, cut over only with a per-vendor manual smoke. Hold 6b/6d
behind the A2 harness, and revisit 6d (realtime S2S) only post-auth with real
international-user demand — it's the right end-state for English voice but the
wrong next step.

## 8. Open questions for Rewant

1. Bake-off vendor shortlist: Google + ElevenLabs + Gemini TTS confirmed? Add Reverie (Hinglish-fallback angle) in the same pass?
2. Is `en-US` routing gated on auth (profile-stored locale) or shippable pre-auth on the localStorage stub?
3. Budget appetite for ElevenLabs if it wins naturalness but costs a multiple of Google/Sarvam for the English route?
4. Does the international cohort matter for *revenue* now (₹/$ pricing already scoped), or is this demo-polish for prospective clients? Changes priority vs CI/auth lanes.
5. OK to enable AI Gateway fallback chains once the env-driven model ID lands?

## 9. Sources

- [Sarvam TTS](https://www.sarvam.ai/apis/text-to-speech) · [Sarvam STT](https://www.sarvam.ai/apis/speech-to-text) · [Sarvam pricing](https://docs.sarvam.ai/api-reference-docs/pricing)
- [Swadeshi Apps — Sarvam vs Google Cloud Speech](https://swadeshiapps.com/alternatives/google-cloud-speech) · [Smallest.ai vs Sarvam](https://smallest.ai/blog/smallest-ai-vs-sarvam-ai)
- [Softcery — 14 STT/TTS providers for voice agents (2026)](https://softcery.com/lab/how-to-choose-stt-tts-for-ai-voice-agents-in-2025-a-comprehensive-guide) · [Speechmatics — best TTS APIs 2026](https://www.speechmatics.com/company/articles-and-news/best-tts-apis-in-2025-top-12-text-to-speech-services-for-developers)
- [ElevenLabs STT language coverage](https://elevenlabs.io/docs/overview/capabilities/speech-to-text) · [AI4Bharat self-hosted Indic STT (VEXYL)](https://medium.com/@anilmathewm/vexyl-stt-free-self-hosted-indian-language-speech-to-text-server-f2909003aaf6)
- [BenchLM LLM pricing 2026](https://benchlm.ai/llm-pricing) · [PE Collective LLM pricing comparison](https://pecollective.com/blog/llm-pricing-comparison-2026/)
- Internal: [tech-stack-scale assessment](../assessment/2026-07-04-tech-stack-scale.md) · [voice-humanness assessment](../assessment/2026-07-04-voice-humanness.md) · ADR-017, ADR-020, ADR-026
