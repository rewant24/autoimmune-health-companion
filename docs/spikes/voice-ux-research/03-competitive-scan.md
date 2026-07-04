# Voice UX competitive scan (2026-05-24)

Scan of five voice-conversational products to inform Saha's check-in UX. Evidence is drawn from product docs, reviews, and user reports — marketing claims are flagged when behavioral evidence is missing.

## Comparison table

| Product | Turn-taking | Error recovery | Warmth | "Feels heard" | Recovery affordances | Pacing |
|---|---|---|---|---|---|---|
| **Wysa** | Text-only — no voice; turn-taking is button-driven (multiple-choice taps) | When confused, explicitly says "not sure how to help" and routes user to toolkit or email feedback ([choosingtherapy](https://www.choosingtherapy.com/wysa-app-review/), [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9044157/)) | Penguin avatar + warm validation phrases; users explicitly report "feeling heard" even knowing it's AI | Reflective restatements + checkbox confirmations of feeling | SOS button is global; tap-based "browse toolkit" alternative path always available | User-paced — no timeout pressure; works for tired/distracted users |
| **Replika** | Voice mode exists; barge-in unreliable — users report "disjointed" turns, lag | Poor — fails on accents, "robotic and detached" recovery ([techpoint](https://techpoint.africa/guide/replika-ai-review/), [toolify](https://www.toolify.ai/ai-news/experience-realistic-ai-phone-calls-with-replika-pro-88931)) | High in text, weaker in voice — emotional vocabulary present but delivery flat | Voice notes used as "acknowledgment" gesture, but reviewers find it shallow | Limited; user can switch back to text, no clear "repeat/slow down" affordance | Lag-heavy; not real-time — kills sense of conversation |
| **Pi.ai** | Strong perceived turn-taking — "thoughtful pauses", "phone-call-like" ([toolstack](https://toolstack.io/tools/pi-by-inflection-ai), [aicompanionguides](https://aicompanionguides.com/blog/what-i-learned-this-week-pi-vs-expectations/)) | Light documentation; reviews emphasize emotional pivot rather than retrieval recovery | Highest perceived warmth of the five — "gentle tone", breathing sounds, laughter | Strong: matches emotional tone, validates before advancing | 8 voice options, switchable mid-conversation; no documented "repeat/go back" | Slow + deliberate by design; thoughtful inter-turn pauses |
| **Hume EVI** | State-of-the-art end-of-turn detection via prosody (tune/rhythm/timbre), not just silence ([Hume blog](https://www.hume.ai/blog/introducing-hume-evi-api)) | "Always interruptible" — stops mid-sentence and resumes with correct context after interruption | Adapts own tone of voice to user's prosody (calm/excited/tired) — algorithmic warmth | Strongest signal: tone-matching IS the "I heard you" signal | API-level prompt customization; no fixed end-user "repeat" UI | Variable, tied to detected user state; ~sub-second response latency |
| **ChatGPT Advanced Voice** | Worst documented turn-taking — interrupts on 1-second pauses; users complain it "cuts me off constantly" ([OpenAI community](https://community.openai.com/t/feature-request-advanced-voice-mode-keeps-interrupting-me/962909)) | Resilient to background noise — pauses and resumes ([Forte Labs](https://fortelabs.com/blog/the-voice-only-mid-year-review-testing-the-limits-of-chatgpt-voice-mode/)); but no graceful "didn't catch that" affordance | Warm prosody, "affirmative glow" — but reviewers note it agrees with everything | Strong tonal warmth, weak factual acknowledgment | Speed control 0.5x–2x; can be interrupted, but no "go back" verb | 2-3s response time; speech-to-speech (no STT round-trip) |

## Per-product deep-dive

### Wysa
- **No voice mode at all** — it's a text chatbot with a cartoon penguin avatar. Highly relevant negative data point: a 4.9-star app with 21K reviews has succeeded at "feels heard" without voice ([choosingtherapy](https://www.choosingtherapy.com/wysa-app-review/)).
- **Honest fallback**: when it can't help (e.g. on bullying or unsafe-feeling topics), it explicitly says "not sure how to help" and routes to the toolkit or to email feedback ("so it can learn to help you better"). Doesn't fake competence.
- **SOS path is always one tap away** — global affordance, not buried in flow. Crisis detection claims 82% accuracy ([Wysa](https://www.wysa.com/role-of-ai-in-sos)).
- **No long-term memory** — every session starts fresh. Users describe this as "scripted" but still rate it 5 stars. Implication: memory is not required for "feels heard" if the immediate turn is well-handled.
- **Active-listening verbalizations** — reflective restatement is the core acknowledgment pattern: "I feel like I've been heard … even if I am only talking to an AI" ([PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9044157/)).

### Replika
- **Voice lag is the dominant complaint** — reviewers describe "disjointed conversation that hindered the immersion" ([toolify](https://www.toolify.ai/ai-news/experience-realistic-ai-phone-calls-with-replika-pro-88931)).
- **Accent failures repeated across reviews** — "failed to recognize my voice or understand my accent" — particularly bad for non-American speech. Cautionary tale for Saha's Indian-English user base.
- **Voice notes used as faux-acknowledgment** — when emotional content is shared, Replika sends a "voice note" reply. Reviewers note the gesture feels hollow without competent comprehension first.
- **Voice is paywalled (Pro)** — gating warmth behind a subscription. Users still rate the free text version more useful.
- **Text fallback always available** — explicit toggle. Useful safety valve when voice fails.

### Pi.ai
- **Eight voices, swappable instantly** — Pi 1 through Pi 8, with distinct tonal personalities, switchable from settings at zero cost ([toolstack](https://toolstack.io/tools/pi-by-inflection-ai)). Personalization without re-onboarding.
- **Naturalistic prosody — breathing, laughter, deliberate pauses** — reviewers describe it as "unsettling … blurs the line between AI and human" ([aicompanionguides week-1 review](https://aicompanionguides.com/blog/what-i-learned-this-week-pi-vs-expectations/)).
- **Slow by design** — "thoughtful pacing" is praised. Pi prioritizes feel over throughput. Wrong tradeoff for a 2-3 minute structured check-in.
- **Emotion-adaptive tone** — recognizes sadness/stress from language and shifts approach. Companion-mode, not task-mode.
- **No documented structured-data extraction** — Pi is built for open-ended conversation; reviews are silent on form-filling or task completion.

### Hume EVI
- **Prosody-based end-of-turn detection** is the signature behavior — uses tune, rhythm, and timbre, not just a silence-timer, to decide when the user has finished ([Hume blog](https://www.hume.ai/blog/introducing-hume-evi-api)). Saha's Sarvam stack uses silence-only — directly comparable.
- **Always-interruptible by design** — stops mid-utterance on barge-in, resumes with the correct context anchor. Explicit architectural commitment, not retrofitted.
- **Tone-matches the user** — if the user sounds tired, EVI's own voice softens; if excited, it brightens. The acknowledgment is in the voice itself, not in extra acknowledgment words.
- **Measures 53 vocal/expression dimensions** as streaming inputs to the LLM context — emotion is a first-class input, not a sentiment-label post-process.
- **API-first; no consumer app** — UX patterns are configurable by the developer. Saha could adopt the *idea* of prosody-driven turn detection without adopting Hume itself.

### ChatGPT Advanced Voice Mode
- **Worst-documented interruption behavior** — multiple users report it interrupts after 1-second pauses, "halfway through a thought" ([OpenAI community thread](https://community.openai.com/t/feature-request-advanced-voice-mode-keeps-interrupting-me/962909)). Speak-deliberately users are punished.
- **Loss of push-to-talk** — Standard Voice Mode had tap-and-hold; Advanced Voice removed it. Users explicitly miss the affordance. Suggests Saha should KEEP an explicit "I'm done" affordance for users who need it.
- **2-3s response latency** with sub-second start-of-speech, via direct speech-to-speech (no STT detour) ([Forte Labs](https://fortelabs.com/blog/the-voice-only-mid-year-review-testing-the-limits-of-chatgpt-voice-mode/)).
- **Pauses on loud background noise and resumes** — graceful with environmental noise, ungraceful with user thinking-pauses. Reverse of what a check-in user needs.
- **Tonally warm but agrees with everything** — Forte Labs reviewer felt "the glow of approval" but flagged that uncritical affirmation undermined coaching value. For a health-tracking context, agreement-bias is dangerous (must not validate a misheard pain score).

## Steal-or-skip

### Worth stealing (5 patterns)
- **Prosody-driven end-of-turn detection (Hume)** — even a lightweight version (RMS energy slope + pitch contour falling, not just silence-timer) would beat Saha's current silence-only detector for tired/slow-speaking users. Aligns with the "user is in pain, may pause mid-sentence" reality.
- **Honest "I didn't catch that" fallback (Wysa)** — when STT confidence is low, say so explicitly and offer a tap-based alternative. Don't guess and confirm-wrongly. Wysa proves this doesn't kill warmth.
- **Global SOS / "I'm done" affordance (Wysa, ChatGPT pre-Advanced)** — always-visible button to bail out of voice into tap-based flow. Restore the push-to-talk affordance ChatGPT removed.
- **Tone-matched voice (Hume + Pi)** — if the user sounds tired (slow, low energy), the TTS reply slows and softens. For Saha specifically: tired users should not be greeted by a chipper bot. Sarvam TTS may not support this directly — but pre-selecting a slower voice when fatigue >= 7 is a one-line heuristic.
- **Reflective restatement before extraction (Wysa, Pi)** — "Sounds like a rough night — pain at 7, sleep at 3, did I get that?" The confirm step IS the warmth signal. Already in Saha's plan; this scan reinforces it.

### Worth skipping (5 patterns)
- **Open-ended companion conversation (Pi, Replika)** — Saha is a 2-3 minute structured check-in. Long pauses and breathing sounds are wrong for a task-oriented flow with a clear end state.
- **8 voice options (Pi)** — choice paralysis on a daily-check-in surface. One well-chosen voice per locale (one Hindi, one Indian-English) is enough. Defer to post-MVP.
- **Aggressive barge-in (ChatGPT Advanced)** — for a check-in, the user is *answering questions*, not having a debate. Cutting them off on a 1-second pause is catastrophic for pain/fatigue users who are slow to articulate. Keep barge-in conservative; favor the user finishing.
- **Agreement-bias warmth (ChatGPT Advanced)** — affirming everything is dangerous when the AI must record a pain score correctly. Saha needs confirm-and-correct, not glow-of-approval.
- **Long-term emotional memory framing (Replika)** — Saha *does* have memory, but it's clinical (last week's pain trend), not emotional ("you mentioned your cat last week"). Don't conflate the two; users came here to track, not be remembered as a person.

## Saha-specific context

Saha is a 2-3 minute daily check-in, not a long conversation. The user is often tired, in pain, time-poor. Goal is "extract 5 metrics + log events" not "feel emotionally connected." This lens reorders the steal list above: the top three (prosody turn detection, honest fallback, global bail-out) are **table stakes** for the use case; the bottom two (tone-match, reflective restatement) are differentiators. Companion-style warmth (Pi, Replika) is a distraction — it adds seconds to every turn and risks the user abandoning the check-in.

Critical asymmetry: in a *companion* product, a missed turn is a missed conversation beat — annoying but recoverable. In Saha, a missed turn means the wrong pain score in the database. The cost of false-confident extraction is higher than the cost of an honest "I didn't catch that — was that a 6 or a 7?" prompt. This rules out the ChatGPT-style "predict the user is done" strategy and favors the Wysa-style "explicit confirm + tap-fallback" strategy.

Sarvam-specific note: Saha's stack does STT→LLM→TTS round-trip, not speech-to-speech. The 2-3s round-trip latency we observe is at parity with ChatGPT Advanced Voice — so latency is not the bottleneck. The bottleneck is *turn detection quality* and *recovery affordances* — both of which Hume and Wysa demonstrate are solvable without speech-to-speech models.

## Sources

- [Wysa app review — ChoosingTherapy](https://www.choosingtherapy.com/wysa-app-review/)
- [Wysa qualitative thematic analysis — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9044157/)
- [Wysa SOS feature](https://www.wysa.com/role-of-ai-in-sos)
- [Replika Pro voice review — Toolify](https://www.toolify.ai/ai-news/experience-realistic-ai-phone-calls-with-replika-pro-88931)
- [Replika 5-day review — Techpoint Africa](https://techpoint.africa/guide/replika-ai-review/)
- [Pi.ai voice mode review — AICompanionGuides week 1](https://aicompanionguides.com/blog/what-i-learned-this-week-pi-vs-expectations/)
- [Pi.ai review — Toolstack](https://toolstack.io/tools/pi-by-inflection-ai)
- [Pi.ai review — Techvernia](https://techvernia.com/pages/reviews/chatbots/pi-ai.html)
- [Hume EVI API introduction blog](https://www.hume.ai/blog/introducing-hume-evi-api)
- [Hume EVI documentation overview](https://dev.hume.ai/docs/empathic-voice-interface-evi/overview)
- [VentureBeat — Hume EVI 2 launch](https://venturebeat.com/ai/who-needs-gpt-4o-voice-mode-humes-evi-2-is-here-with-emotionally-inflected-voice-ai-and-api)
- [ChatGPT Advanced Voice interruption complaints — OpenAI community](https://community.openai.com/t/feature-request-advanced-voice-mode-keeps-interrupting-me/962909)
- [Forte Labs — ChatGPT Voice Mode mid-year review](https://fortelabs.com/blog/the-voice-only-mid-year-review-testing-the-limits-of-chatgpt-voice-mode/)
- [QCall — ChatGPT Voice Mode brutally honest review](https://qcall.ai/chatgpt-voice-mode-review)
- [Poly.ai — Barge-in voice AI interruption handling](https://poly.ai/blog/barge-in-voice-ai-interruption-handling)
