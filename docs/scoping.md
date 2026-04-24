# Autoimmune Health Companion — Scoping Document

> Written by Rewant. Claude transcribes only.

---

## Language conventions

Two terms were explicitly off-limits in app copy and have now been resolved:

| Avoid | Reason | Resolution |
|---|---|---|
| **"caregiving" / "caregiver"** | too clinical / implies dependence | **Sentence-level rewrites** — dropped the noun entirely. Where a referent was needed, replaced with **"support system"** (e.g. *"the patient, her doctor, and her support system"*). Onboarding framing rewritten from scratch to drop "journey" (collision with the Journey pillar). |
| **"log"** | too technical / legal-sounding | **"Memory"** — makes the README tagline operative (*"Sakhi means friend — the one who remembers with you"*). Used in copy as *"your Memory"* (possessive). Section label inside Journey is **Memory**. Also appears in the save prompt on the summary card (*"Good to save these to your Memory?"*). |
| **"Medications module"** | evaluated; no change | **Kept as "Medications"** — clinically neutral, universally understood, no warmer alternative lands without sounding casual or still-clinical. |

## Brand direction (visual language)

Not a design spec — a direction. Final visual language locks during build.

- **Muted pastel tinted backgrounds** — soft tints, no loud chroma. Mirrors a clinical calm.
- **One illustration per meaningful screen** — onboarding, splash, error, empty-state. Illustrations are warm and human (not clip-art, not stock photography, not medical imagery).
- **Single-accent-color CTA treatment** — Sakhi's accent is **teal** (already established on the waitlist page). Every primary CTA uses it; nothing else competes.
- **Consistent card geometry** — rounded corners, soft shadows, padded interior; cards are the default container for any piece of content with its own identity (event, nudge, report section).
- **Whoop-style data visualization direction** — rings, streak bars, stacked timelines. Data first, but the glance is warm, not dashboard-cold.

These are direction, not mandates. Anything that conflicts with accessibility (contrast, touch targets, readability at small sizes) overrides brand preference.

## Landing-page copy locks

Three pieces of landing-page and launch-post copy are locked (2026-04-24). All three reuse the *"logbook"* motif for consistency across the landing page and launch post.

- **ROI anchor.** Sells against the cognitive labor between visits, not the cost of a visit.
  *"Stop being the logbook for your own condition. Sakhi remembers every dose change, every flare, every off day — so your doctor sees the full picture, not just today."*
  Lands above or beside the pricing block.
- **One-sentence persona pitch.** Opens the public launch post.
  *"Sakhi is for people with chronic autoimmune conditions who shouldn't have to be their own medical logbook."*
- **Founder quote (social proof baseline).** Upside-swap for a Sonakshi- or waitlist-sourced named quote if one lands in time; otherwise this is what ships.
  *"No one should have to be their own medical logbook. Sakhi is for the people I've watched try."* — Rewant Prakash, Founder.

**Not locked in this doc:**
- Exact full landing-page copy — drafted during the landing-page pass, not pre-committed here.
- Final pricing numbers — ₹199 / ₹1,499 / $4.99 / $39 are a first pass (per § post-mvp-backlog #16) and may flex based on waitlist feedback before checkout goes live.
- Whether the founder-tier *"₹99 skip the waitlist"* ships — opt-in based on capacity.

## Interaction model

- **Voice-first conversational AI.** The primary way Sonakshi interacts with the app is by talking to it — she has a voice conversation with an AI agent.
- **Supplementary inputs:** the user can also provide:
  - A **numeric scale** (e.g. pain / dysfunction rating)
  - **Free-text** context
- Voice is the default; scale + text are the fallback or supplement.

## Conversation design principles (for the voice AI)

**Critical constraint from Rewant:** *Doctors ask the same questions every day — it gets redundant and off-putting. The app's AI must phrase things differently, feel welcoming, and make Sonakshi want to actually talk about her symptoms / dosage / state.*

Principles drawn from research on patient-centered communication, motivational interviewing (MI), and AI chatbot empathy studies (sources in `build-log.md`):

### 1. Open questions, not interrogation
Use MI-style open prompts — *"What's important to you today?"*, *"What would you like to talk about first?"* — instead of yes/no clinical checklists. Let Sonakshi choose the entry point.

### 2. Reference prior conversations
The AI should remember the last conversation and build on it. *"Last time you mentioned your left wrist was flaring — how's that been since?"* Patients feel valued when providers remember; same holds for AI.

### 3. Rotate phrasings for the same data field
We still need to capture pain / dosage / mood every day — but never the same wording twice in a row. Keep a bank of 5–10 phrasings per field and rotate based on mood + recency.

### 4. Match emotional valence
If Sonakshi sounds flat or is having a bad day, the AI softens and shortens. If she sounds up, it's warmer, maybe celebratory. Tone follows her, not the other way around.

### 5. Shared-agenda start
Begin each conversation by letting her set the agenda. *"Anything specific on your mind today, or should I just check in?"* — evidence shows this adds ~2 min to a visit but massively improves perceived partnership.

### 6. Reflect, don't just record
MI core skill: the AI occasionally reflects back what it heard. *"So the pain's been worse in the evenings this week — did I get that right?"* Reflection signals listening and catches errors.

### 7. Brevity with warmth, not saccharine
Research warning: excessive empathy reads as forced and actually *reduces* perceived authenticity. Warm, short, real — not "That must be so hard, I'm so sorry to hear that" for every answer.

### 8. Language-style synchrony
Mirror Sonakshi's own phrasing. If she says *"my wrists are crap today"*, the AI doesn't respond with *"your wrist joint inflammation is noted."* Speak how she speaks.

### 9. Affirm effort, not outcomes
*"Thanks for showing up today"* lands better than *"Great job, your pain is down!"* — the latter feels conditional on her being "better."

**Implementation note:** these principles become a system prompt + a question-rotation engine on top of whichever voice/LLM stack we pick (open question #6). They are a core POC target — before we build the UI, we should validate in Claude Chat that we can reliably produce conversations that feel like this.

---

## Who is the user?

**Sonakshi, 30.** Autoimmune arthritis, developed after a chikungunya diagnosis. She lives in India.

Her reality (from the Miro research — full synthesis in [`research/sonakshi-lele-interview.md`](research/sonakshi-lele-interview.md); source boards in `research/miro-export/`; seed entries in [`research/seed-entries.md`](research/seed-entries.md)):
- Progress is dynamic. "1 step back, 2 steps forward, 2 steps back, but 1 day forward."
- On bad days, the distance from "breakfast to the shower" can feel unmanageable.
- Pain scale means nothing as a raw 1–10 — she thinks of it as a **dysfunction scale**:
  - 1: can do normal activities without painkiller, requires rest
  - 2–3: avoiding certain activities; cooking/typing too much is hard but manageable without painkiller
  - 4–5: thinking of painkillers, basic tasks only, may or may not medicate
  - 6–7: can't do basic tasks without painkiller; can work cautiously but distracted by pain
  - 8–9: pain front-and-center, nothing else thinkable despite painkiller, using distractions
  - 10: immobilized, distractions stop helping
- Blood tests every 2 weeks; doctor follow-ups every 3 months.
- Dosage changes constantly (e.g. 10 → 15 → 20 → 25mg over 3 months).
- Direct correlation between stress / mental health and physical symptoms.
- Emotions are often repressed. Frustration, imposter syndrome, loss of identity, spoon theory.
- Hard to explain limited mental capacity to peers or doctors.
- Medical gaslighting is real — different doctors give different interpretations.
- Tracking feels like a chore — needs to be fast, low brain-effort, and give some positive feedback.

---

## What's the first screen they land on?

**The onboarding flow — 4 to 5 screens.** Each screen educates Sonakshi on one objective the app is trying to provide for her.

### Onboarding Screen 1
App name + one line on what it's trying to do.

### Onboarding Screen 2
Framing: *"A digital friend for the day-to-day of living with a chronic condition — so you walk into every doctor visit with data, not memory."*

### Onboarding Screen 3
Framing: *"You take command of your own life."* Positions the app as a conversational assistant that makes this easier.

### Onboarding Screens 4 and 5 — two features, Sakhi speaking in first person

Each screen highlights **one** feature the app provides. Written in **Sakhi's first-person voice** (*"I'll remember"*, not *"Sakhi remembers"*) — consistent with the friend/companion framing. Two screens, not three — **Voice check-in** (the core loop) and **Memory / Patterns** (what she gets from showing up). Community and Doctor Report reveal themselves through use; they don't need a dedicated onboarding screen.

**Template for each objective screen** — one card per screen, consistent visual treatment:

- **Pastel tinted background** (per § Brand direction)
- **One illustration** — warm, human, not clinical
- **Short title** — direct, first-person from Sakhi
- **Body copy** — 1–2 sentences, first-person from Sakhi, reusing the "logbook / record" motif for copy coherence with the landing page
- **Single "Next" CTA** on screen 4 → **"Start my first check-in"** CTA on screen 5 (final screen switches the CTA to kick off the first use)

#### Screen 4 — Voice check-in (the daily loop)

> **"Talk to me. I'll remember."**
>
> One minute a day. You talk — about how you slept, what hurt, what's different today. I listen, I keep the record, and you never have to be your own logbook again.
>
> *[Next]*

#### Screen 5 — Memory + Patterns (the payoff)

> **"Look back. See what's changed."**
>
> Week to week, the bad days blur into the okay ones — and you lose the thread. I hold the record, so when you want to see how this month compares to last, you actually can.
>
> *[Start my first check-in]*

**Why these two, not three or five.** The two screens cover *activation* (Voice check-in → *"this is how you talk to me"*) and *retention* (Memory + Patterns → *"this is what you get back for showing up"*). Doctor Report is the *paid-tier* payoff and lives on the landing page; forcing it into onboarding dilutes the daily-use story. Community is a secondary pillar that reveals organically; putting it in onboarding implies it's central to the loop, which it isn't.

### Onboarding CTA rule
Every onboarding screen uses **"Next"** as the single call to action. No other buttons on these screens.

---

## Setup flow (after onboarding)

### Setup Part A — Mobile verification (2 steps)

**Step A.1: Enter mobile number**
- Screen asks the user to enter their mobile number.
- Single CTA: **Next**.

**Step A.2: Enter verification code**
- Screen prompts the user to enter the verification code sent to their mobile number.
- Primary CTA: **Next** (to submit the code).
- Sub-CTAs on the same screen:
  - **Resend**
  - **Get the code via a phone call**

**Confirmation after A.2:**
> *"Awesome, now you are welcome; you are part of the health companion app family."*

### Setup Part B — Profile (3 steps, each on its own screen)

- **Screen B.1:** Ask for the user's **name**. That is the only field on the screen.
- **Screen B.2:** Ask for the user's **date of birth**. That is the only field on the screen.
- **Screen B.3:** Ask for the user's **email ID**. That is the only field on the screen.
- **Screen B.4:** Ask for the user's **medical condition**. Searchable type-ahead dropdown; Sonakshi selects the autoimmune disease she lives with.
  - **Dropdown source (locked 2026-04-24):** **[AARDA](https://autoimmune.org/disease-information/) (American Autoimmune Related Diseases Association)** — publicly published list of 100+ autoimmune diseases. NIH NIAMS considered but ruled out (narrower musculoskeletal-only coverage).
  - **Selection mode (MVP):** **single-select.** The user picks one primary condition. Multi-select is deferred to post-MVP (see post-mvp-backlog.md — many autoimmune patients have more than one condition, e.g. RA + Sjögren's, lupus + Hashimoto's, but single-select ships a cleaner setup flow for MVP).
  - **Architectural hook:** schema stores `conditions: string[]` from day one. Single-select UI writes one entry; post-MVP multi-select is a UI change only, no migration.
  - **Interaction:** searchable type-ahead input — 100+ items is unscrollable on mobile. Autocompletes against the AARDA list client-side. Shows top 5 matches as Sonakshi types.

**After B.4:**
1. User receives a **welcome-onboard confirmation email** personalized with their first name.
2. User is **redirected to the home page**.

---

## What do they click?

- Throughout onboarding: **Next**.
- On setup mobile verification: **Next**, and optionally **Resend** or **Get the code via a phone call**.
- On setup profile: **Next** after entering each field.

## What do they type or upload?

- Mobile number
- Verification code received via SMS
- Name
- Date of birth
- Email ID
- Medical condition (selected from a dropdown)

## What happens when they hit submit?

After `Setup B.4 → welcome email → redirect`, she lands on the **home page** (see next section).

---

## Navigation — persistent bottom menu bar

Always visible at the bottom of every in-app screen (not during onboarding/setup). Horizontal, left to right, **five modules**:

1. **Home**
2. **Medications** *(module name TBD — "Medications" / "Dosage" / other; Rewant's call)*
3. **Journey** *(the "looking back" surface — Doctor Report, Memory history, Whoop-style patterns, flare-up timeline, doctor-visit history; see § Journey module)*
4. **Community** *(see § Community module)*
5. **Settings**

*(Exact ordering — Journey sits between Medications and Community, Settings always last. Rewant can override.)*

**Why "Journey" replaces what was tentatively "Check-in":** the *act* of checking in happens on **Home** (voice conversation launches from there), not from a dedicated tab. The Journey pillar is the aggregated "looking back" surface where the Memory, the Doctor Report, patterns, flare-ups, and doctor visits all live together. See § Journey module for full contents.

## Home page (first and subsequent visits)

**Top to bottom:**

1. **Greeting** — *"Welcome, Sonakshi"* (first name, personalized).
2. **Daily check-in prompt** — a CTA asking her to start today's check-in (voice-first interaction).
3. **[First-time / not-yet-set-up nudge] — set up your medications** — a CTA placed *above* the metric visualization and *below* the check-in prompt, urging her to open the Medications module and enter her regimen. This nudge appears only until she has completed the one-time medication setup; after that it hides.
4. **Dosage intake reminder tap** — a lightweight home-surface control listing her active regimen (pulled from the Medications module). Tapping a medication logs intake for that dose **without opening a conversation** — so she can mark "took my morning methotrexate" or "took my monthly biologic" the moment it happens, not at end-of-day check-in. See § Medications module → *Daily adherence — dosage intake capture* for the mechanics + why this exists alongside the check-in capture path.
5. **Overall health metrics** — Whoop-style aggregated self-view (rings, streak bars, stacked metric timelines — specific chart types TBD, see open question #14).
6. **Persistent mic-icon CTA** — always-visible floating button for on-demand voice conversation anytime, anywhere in the app.
7. **Bottom menu bar** (Home / Medications / Journey / Community / Settings).

**Home is where check-in happens.** The daily voice check-in is an **act launched from Home**, not a destination tab. The history of past check-ins (the Memory) lives in the **Journey** pillar alongside the Doctor Report and pattern views — see § Journey module.

### Home — visual + structural patterns

These shape how the home surface presents mixed content types without becoming cluttered:

- **Setup nudges = a stack, not a single card.** MVP may only ship one nudge (medications setup), but Home treats the nudge area as a **list that can grow** — room for future nudges like "capture your usual doctor" or "add your care provider." Each nudge is a discrete card with a primary CTA; completed nudges hide.
- **Event feed uses type-tagged pill labels on card headers.** Any event or task card on Home (intake tap, upcoming appointment, upcoming blood work, recent flare-up) carries a small coloured pill chip at the top indicating its type — e.g. `INTAKE`, `APPOINTMENT`, `BLOOD WORK`, `FLARE-UP`. This keeps a unified feed glanceable when event types are mixed.
- **Intake tap section shows a progress counter.** The dosage intake reminder area has a small header indicator like `2 of 3 doses today` — so the state is visible without opening the card. Completed doses visually dim; missed doses mark in red per the task-state vocabulary (see § Journey module → Memory landing).
- **Cards beat flat lists** for every mixed-content surface. Each event / nudge / prompt is its own card with time + title + meta + inline CTA. No unsorted bullet lists for event types.
- **Inline education cards as empty-state prompts** — where a section has nothing yet, show a soft educational card inline (not a help menu, not a modal). Example: *"Did you know Sakhi captures flare-ups alongside your doses?"* Dismissible; rotates through a bank.

### Daily check-in — voice conversation

When she taps the check-in CTA, the AI agent has a voice-based conversation with her. The conversation captures:

- How she is **feeling** today
- What is on her **mind**
- What she has **lined up for the day**
- Her **pain scale** and measurements *(this is not just a number in isolation — it feeds the Communication theme; see Theme 1)*

She can answer by voice, or supplement with a numeric scale / text.

#### Conversation shape — hybrid (open-first, scripted-fallback)

The check-in is **not** a rigid form, and **not** a fully open free-association. It's a **hybrid**: Sakhi starts with a single warm open question, lets Sonakshi free-flow, then falls back to short scripted probes *only for the data points she hasn't already covered*.

**Why hybrid.** A pure open question (*"how's your day?"*) feels like a friend but leaves gaps — on some days Sonakshi won't mention pain, on others she won't mention meds, and the report data thins out. A pure scripted sequence feels like a voice-answered form — reliable but cold, and doesn't match a friend-app's tone. Hybrid gives us both: warm on the good days where she talks freely, reliable on the quiet days where she'd otherwise give a one-word answer.

**How it flows (high-level — full screen mechanics in § Multimodal input below).**

1. **Open opener (always).** Sakhi asks one warm question — *"Hey Sonakshi, how's your day been?"* (exact copy TBD). Sonakshi talks for however long feels natural — 10 seconds to 2 minutes. No visible progress indicator during this part. This is the free-flow window.

2. **Live extraction while she talks.** The AI listens for the required data points (see below) and passively marks each one as *covered* or *missing* as she speaks. No interruption — she finishes her thought.

3. **Progressive cleanup — controls, not spoken probes.** When she pauses / finishes / opts out of voice, the screen transitions to Stage 2 (see § Multimodal input) where *only the required metrics she didn't cover* appear as quick tap-controls. No spoken follow-up questions. No redundant probes. If she covered everything in voice, Stage 2 is skipped.

4. **Summary card** — same as already scoped in § After the voice conversation ends.

#### The opener — continuity-aware, remembered

The first thing Sakhi says each morning is **not a fixed greeting**. It draws on state from yesterday (and the running recent history) so it sounds like a friend who actually keeps track, not a form that resets every day. This is the single most load-bearing line of copy in the app — the moment that decides whether Sakhi feels like a friend or a tool.

**State the opener draws from.**

- **Yesterday's check-in** — pain level, mood, flare-up status, whether she actually did the check-in (skip days matter).
- **Streak state** — how many consecutive days she's checked in (for positive callouts on milestones, see § After save → milestone celebration).
- **Upcoming events in Journey** — a doctor visit or blood test within the next 24–48 hours (so Sakhi can gently orient the check-in toward prep).
- **Recent flare-up status** — if a flare was marked *"still ongoing"* on the last check-in, today's opener should acknowledge it's probably still on her mind.

**Example opener variants (exact copy TBD — these are shape, not final language):**

- **After a rough day (yesterday's pain high or flare flagged).** *"Morning, Sonakshi. Yesterday was a rough one — how's today landing?"*
- **After a flare still ongoing.** *"Hey Sonakshi. Is the flare still with you today, or easing up?"*
- **After a good day.** *"Morning, Sonakshi. Yesterday felt like a steady one — how's today starting?"*
- **On a streak.** *"Five days in a row, Sonakshi. How's today?"* (triggered at specific streak milestones, not every day — otherwise the streak reference gets tiring).
- **Doctor visit tomorrow.** *"Morning, Sonakshi. Dr. Mehta tomorrow — how are you feeling going in?"*
- **Blood test in 24h.** *"Morning, Sonakshi. Blood work tomorrow — how's today feeling?"*
- **Neutral default (no notable prior state).** *"Morning, Sonakshi. How's your day been?"*
- **Day 1 / first-ever check-in.** *"Hey Sonakshi — glad you're here. How are you feeling today?"* (no continuity to draw from yet; warm and intentionally simple.)
- **After a multi-day skip.** *"Hey Sonakshi — been a few days. How are things?"* (acknowledges the gap without shaming the skip.)

**Safety rails — when to go neutral even if state suggests otherwise.**

Continuity-awareness can backfire on edge days. Sakhi defaults to the neutral opener in these cases:

- If yesterday's check-in was flagged as *unusually bad* (worst pain in 30+ days, severe flare, explicit qualitative note of distress) — reference it softly or skip reference entirely. Never lead with *"yesterday was terrible"*; that's a friend being heavy-handed.
- If Sonakshi explicitly asks Sakhi to *"not bring up yesterday"* (post-MVP feature — not required for Day 1 build, but flag in the data model so this preference can be respected later).
- If the prior-day data is stale (last check-in >2 days ago) — fall back to the multi-day-skip variant, don't reference specifics from further back.
- If the flare has been *"still ongoing"* for 5+ consecutive days — stop referencing it daily (tiring to be reminded); shift to a neutral opener.

**How the variant is selected.** A deterministic rules engine, not an LLM generating from scratch. Reasons:

1. **Predictability.** Sonakshi should not be surprised by the opener — tone drift is a trust problem in a health app.
2. **Speed.** The opener has to appear instantly when she taps the CTA; no network round-trip for generation.
3. **Safety.** LLM-generated openers can hallucinate prior events or misinterpret state. A rules engine with a bounded set of variants is audit-able.
4. **i18n.** Fixed variants with string keys survive translation into Hindi + vernacular languages (per § PDF language decision — same architecture applies to in-app copy).

The rules engine picks one variant based on a priority order — e.g. *upcoming doctor visit > streak milestone > ongoing flare > rough-yesterday > good-yesterday > neutral default*. Order and exact thresholds (what counts as *"rough"* yesterday) are still TBD and will be tuned during build.

**What the opener does NOT do (MVP).**

- Does not reference specific medications by name in the opener (*"how's the methotrexate treating you?"*) — that's a clinician's voice, not a friend's.
- Does not reference symptoms other than pain / flare / mood (*"how's the stiffness today?"*) — too diagnostic for a warm open.
- Does not probe directly for required data in the opener itself (*"how's the pain — 1 to 10?"*) — the opener is an invitation to talk, not the first probe. Probes live in Stage 2 as tap-controls, not in the opener.

#### The closer — continuity-aware, evidence-led

The last line Sakhi says at the end of a check-in. Sonakshi hears it twice: once on the summary card (as the fixed closing line above the save prompt) and once as a short post-save confirmation. Same copy both places.

**Design principles (research-backed — see sources in build notes).**

- **Brief.** 3–5 words max. Voice UI research (Google Design, Clearleft Voice Principles, Parallel HQ) is unambiguous: every word adds listening cost. Grice's Cooperative Principle — contribute only what's required.
- **Witness, don't prescribe.** Chronic-illness and toxic-positivity research consistently flags prescriptive phrases (*"be kind to yourself"* / *"stay strong"* / *"one day at a time"*) as minimizing on hard days. The closer acknowledges or signs off; it does not instruct Sonakshi how to feel.
- **Companionship, not resolution.** *"I'm here"* outperforms *"it'll get better."* The closer's job is to bear witness, not to fix.
- **Continuity-aware, symmetric with the opener.** Same rules engine, same priority order. A state-aware opener paired with a fixed closer feels like the app suddenly stops tracking her.
- **Genuine, specific affirmation only.** Motivational Interviewing research (OARS framework) — affirmations must be specific and congruent, never generic. Day-7 streak gets *"Seven days. That's real."* — specific. It does not get *"you're doing amazing!"* — generic and hollow.

**Closer variants (locked for MVP, final wordsmith TBD).**

| State | Closer | Why |
|---|---|---|
| Neutral default | *"Saved. See you tomorrow."* | Zero prescription. Sign-off into her day. |
| Yesterday rough | *"Saved. Today's its own day."* | Acknowledges without prescribing how to feel. |
| Flare ongoing | *"Logged. I'm here."* | Companionship framing — presence, not resolution. |
| Streak milestone (day 7 / 30 / 90) | *"Seven days. That's real."* (number scales) | MI-aligned — names the specific fact, not a feeling. Fires only at these three thresholds, never daily. |
| Doctor visit tomorrow | *"Saved. Ready for tomorrow."* | Practical, forward-looking, useful. |
| Day 1 / first-ever check-in | *"Saved. That's the first one."* | Acknowledges the moment without overclaiming. |
| After multi-day skip | *"Saved. Good to hear you."* | Companionship framing, no guilt on the skip. |

**Phrases deliberately ruled out (and why).**

- *"One day at a time."* — flagged in toxic-positivity critiques; reads as minimizing on flare days.
- *"Be kind to yourself today."* — prescriptive; tells her how to feel.
- *"Thank you for trusting this."* — anthropomorphizes Sakhi in a way the rest of the copy doesn't.
- *"You're doing amazing!"* / *"Great job!"* — generic praise; MI research shows this *reduces* intrinsic motivation over time.
- *"Take it gentle today."* — softer than the above but still prescriptive; ruled out on the same principle.

**How the variant is selected.** Same deterministic rules engine as the opener — same priority order (*upcoming doctor visit > streak milestone > ongoing flare > rough-yesterday > multi-day-skip > day-1 > neutral default*). The opener and closer are paired from the same state snapshot, so a flare-day opener is followed by a flare-day closer. Thresholds (what counts as *"rough"* yesterday) still TBD and tuned during build.

**Still TBD on closers.**

- Whether the closer is **spoken** by Sakhi (TTS) or **text-only** on the summary card. Leaning spoken + text for voice-first coherence; confirm during build when we know TTS latency.
- Exact number threshold phrasing at higher streaks (*"Thirty days. That's real."* fine at day 30 — does it still land at day 90 or does it need a different shape?). Tune during build.
- Whether the post-save surface shows the **same** closer as the summary card, or a **shorter** variant (e.g. summary shows *"Saved. See you tomorrow."* and post-save shows just *"See you tomorrow."* without the *"Saved."* — since the save just happened). Probably yes, shorter post-save. Confirm during build.

#### Nudge bank — non-check-in moments

The locked closer set covers the end of a daily check-in. But Sakhi ends **every interaction** with a short line — intake taps, visit captures, report generation, returns after silence, empty states. This bank covers those. All lines follow the same rules as the closer: **first-person Sakhi**, witness-don't-prescribe, specific over generic, short. Reuses closer phrases (*"I'm here"*, *"Good to hear you"*, *"Today's its own day"*) for voice consistency.

| Moment | Trigger | Line |
|---|---|---|
| **First open of the day** (before check-in) | App opened, check-in not yet started | *"Good to see you."* / *"Whenever you're ready."* |
| **After intake tap** (single dose logged) | Tap on dose card → ✓ | *"Got it."* / *"Logged."* / *"Noted."* (rotate) |
| **After dosage-change capture** (confirm card accepted during check-in) | New dosage saved | *"Saved your dose change."* |
| **After visit capture** (confirm card accepted) | Appointment / blood test saved | *"Saved. I'll bring it up when it matters."* |
| **After Doctor Report generated** | PDF ready | *"Your report is ready — 90 days, in one place."* |
| **After annotation added** (Prepare-for-Visit) | Note attached to report | *"Added. Your doctor will see this."* |
| **Return after a 2+ day gap** | First open after ≥48h silence | *"Good to hear you."* (mirrors the multi-day-skip closer) |
| **Return after a 7+ day gap** | First open after ≥7d silence | *"Welcome back. Today's its own day."* |
| **Empty Journey / Patterns** (not enough data yet) | Opened view before thresholds met | *"Give it a few more days — I'll show you what I see."* |
| **Intake missed** (dose window passed, no tap) | Home feed shows missed dose | *"No worries. Mark it when you can."* |
| **Flare flagged during check-in** | Flare checkbox ticked | *"Logged. I'm here."* (mirrors the flare-ongoing closer) |
| **Network retry after save-failed** | Retry succeeds | *"Synced. All caught up."* |

**Design rules for adding lines to this bank later.**
1. Short — ≤ 8 words unless context demands more.
2. Witness, not prescribe. No *"be kind to yourself"* / *"stay strong"* / *"one day at a time."*
3. Specific over generic. *"Logged your dose change"* beats *"Got it!"*
4. Same-language consistency — reuse words from the locked closer set (*"I'm here"*, *"Today's its own day"*, *"Good to hear you"*) so the voice feels unified across surfaces.
5. Never more than one nudge per moment. No cascading affirmations.
6. Rules-engine delivery, not LLM. Same architectural choice as the opener and closer (per ADR-014) — predictability, speed, i18n-readiness, safety.

**What counts as "required data."** Five items the check-in must come out with every day, because they feed the report and pattern engine:

1. **Pain** — the 1–10 scale and/or qualitative descriptor.
2. **Mood** — captured qualitatively (a short read, not necessarily a number).
3. **Intake adherence** — today's doses taken (per active regimen from the Medications module).
4. **Flare-up flag** — is today a flare day (yes / no / ongoing).
5. **Energy / fatigue** — a short qualitative or scaled read.

Everything else Sonakshi brings up in the free-flow — stiffness, sleep, what's on her mind, what she has lined up, food, stress — is bonus capture. Valuable, but never probed for; only captured if she talks about it.

**Multimodal input — voice OR direct tap, on a two-stage progressive screen.** The check-in is voice-first but not voice-only. Some mornings Sonakshi wants to be heard; some mornings she just wants the friction of logging to be zero. A friend meets her in both moods. Forcing voice when she's exhausted is the opposite of what this app is for.

The check-in surface is **progressive, two-stage**:

**Stage 1 — the voice moment.** When she taps the check-in CTA, she lands on a deliberately spare screen: a large breathing mic glow, Sakhi's opening question (*"How's your day been?"*), a small *"tap to pause"* affordance, nothing else. No controls are visible. No dashboard noise. This is the protected voice moment — just her and the mic, like a friend waiting for her to start talking.

- If she **talks**, the AI listens and passively marks each of the five required metrics as *covered* as she speaks.
- If she **doesn't want to talk today** (rough morning), she taps the mic to pause → goes straight to Stage 2 with nothing covered yet.
- If she **talks partially** and then finishes / pauses long enough, Sakhi transitions to Stage 2 with the covered metrics already marked.

**Stage 2 — only-what's-missing.** After she pauses, stops, or taps-to-pause, the screen transitions to a short review view. At the top: *"Heard you on: ✓ mood, ✓ meds, ✓ flare"* — a small recap of what was captured from voice (so she can trust Sakhi heard her). Below that, **only the required metrics she did NOT cover** appear as tappable controls, under a gentle header like *"Just two more:"*. If she covered all five in voice, Stage 2 is skipped entirely and she goes straight to the summary card.

The controls for each required metric (shown in Stage 2 only when that metric is uncovered):

- **Pain** — a scale control (slider or 1–10 tap row) + space for an optional voice/text note.
- **Mood** — a short picker (small set of mood states, e.g. *low / okay / good / great*, exact set TBD) + optional voice/text note.
- **Intake adherence** — **one-tap per dose.** Today's active regimen pulled from the Medications module, shown as a tappable checklist. Same pattern as the home-page intake tap. Tap = taken. Already-tapped-from-home doses are pre-checked so she doesn't double-log.
- **Flare-up flag** — a three-way toggle (*no / yes / still ongoing*). One tap.
- **Energy / fatigue** — a short picker or scale, same shape as mood.

**Why progressive beats always-visible.** An always-visible dashboard of five controls during the voice moment dilutes the warmth — suddenly it looks like a form. Hiding them in Stage 1 protects the feeling of a conversation; revealing them in Stage 2 only for what's missing produces an efficient, non-redundant cleanup. Two stages match the two different modes of her morning: *"I want to be heard"* and *"I just need to log this and move on."*

**Correction inside Stage 2.** The Stage 2 recap lists what was captured from voice (*"✓ mood — okay"*). If Sakhi heard something wrong, Sonakshi can tap the recap item to reveal the control for that metric and correct it — same one-tap adjustment as if it were a missing item.

**Scripted probes become Stage-2 controls, not spoken turns.** The earlier framing of spoken follow-up probes (*"and the pain today?"*) is **replaced** by the Stage 2 reveal of missing-metric controls. Visual, silent, non-interrogative. A probe is never a blocking modal or a forced spoken turn — it's just a control appearing in the cleanup stage. This is softer and more voice-optional than a verbal probe.

**Graceful skip in Stage 2.** Each Stage 2 control has a subtle *"skip today"* option. If she taps skip on pain, that metric is marked as *declined* for the day (distinct from *missing*, so the pattern engine can render it correctly). A friend doesn't badger.

**Pacing target.** Still *under 60 seconds on the median day* — but hybrid makes this a **soft target, not a hard cap**. Good-data days where she free-flows for 90 seconds are fine; there's no forced cut-off. The 60-second promise is marketing-truth for the *typical* morning, not a UI constraint that truncates her.

**Why this matches a friend-app's tone.** A friend asks *"how's your day?"*, listens, and then gently follows up on the thing you didn't mention. A friend doesn't read questions off a list. Hybrid is the structural version of that behavior.

### After the voice conversation ends — summary card

When the AI wraps up the conversation, Sonakshi sees a **quick summary card** with three elements:

1. **Captured notes** — a concise, structured recap of what she said during the conversation (pain, dosage, mood, food, environment, anything else she brought up).
2. **Save-to-audit-log confirmation** — a prompt asking her: *"Good to save these to your Memory?"* She confirms (or presumably declines / edits — flagged as open question).
3. **Nudge or reassurance (the closer)** — every interaction ends with one. Continuity-aware, evidence-led, 3–5 words. See § The closer — continuity-aware, evidence-led for the locked variant set.

**Captured-notes recap format.** The recap is a structured list — not a paragraph. Two sections:

- **"Heard you on:"** — the five required metrics, each with ✓ + the captured value (*"✓ Pain — 5"*, *"✓ Mood — okay"*, etc.). Voice-covered metrics show the checkmark; Stage-2-tapped metrics show the value without checkmark; declined metrics show *"— skipped today"*.
- **"Plus:"** — bonus capture from the free-flow (stiffness, sleep, what she mentioned about her day, food, stress). Short bullet list. Only appears if there's anything to show.

Each line in either section is **tap-to-edit** — she can correct a mis-heard value inline before saving. Editing opens the corresponding control (pain slider, mood picker, etc.) without leaving the summary card. No separate edit screen.

**Decline / discard path (locked 2026-04-24).** If Sonakshi doesn't want to save the check-in — she hit it by accident, the transcription is wrong in ways she doesn't want to correct, or she just changes her mind — a small secondary link at the bottom of the summary card says *"Discard this check-in."* Tapping it opens a confirm dialog: *"Discard this one? Nothing will be saved."* with **[Discard]** and **[Keep editing]** options. On confirm, the check-in is thrown away — **not** saved as a draft, **not** saved as "unconfirmed," **not** partial-saved. The app-level back button during the summary card throws up the same Discard confirm, not a silent abort — she must explicitly choose.

*Why no draft state.* Carrying draft / unconfirmed state for voice check-ins adds cognitive weight (*"wait, is this saved? am I on day 2 of a streak?"*) that hurts more than it helps. A check-in is either in the Memory or it doesn't exist. Clean.

**New concept introduced here: the Memory.** This is where every confirmed daily check-in is stored. Sonakshi can revisit prior entries from the Memory. See § Memory landing inside the Journey module for the full UI spec.

#### Same-day re-entry — append mode

Sonakshi can open the check-in again on the same day she's already logged one. Re-entry is **append, not overwrite**:

- The opener shifts to a re-entry variant: *"Back again, Sonakshi — anything else?"*
- Stage 1 runs normally; Stage 2 shows only controls for metrics that were *declined* earlier or that she wants to update.
- On save, the new capture **appends** to the existing day-entry in the Memory as a secondary block (timestamped), rather than replacing it. The pattern engine always reads the *latest* value per metric for the day.
- Rationale: a morning check-in captured at 8am with pain=4 shouldn't be destroyed if she re-checks at 8pm with pain=7 — both are true, and the evening update is the more-clinically-useful number for the report.

Editing an existing same-day entry (vs. adding a new block) is post-MVP — Memory entry edit UI is still TBD.

#### Day-1 first-ever check-in — micro-tutorial overlay

The very first check-in Sonakshi ever does has two additions on top of the normal flow:

1. **Opener uses the Day-1 variant** (already scoped in § The opener) — *"Hey Sonakshi — glad you're here. How are you feeling today?"*
2. **Stage 2 is shown even if she covered all five metrics in voice.** She needs to see the controls exist — otherwise on a future rough morning she won't know she can tap instead of talk. Stage 2 on Day 1 shows all five controls pre-filled with what voice captured, with a small tooltip on each: *"Tap any of these to correct or skip — you can also use them instead of talking."* After Day 1, Stage 2 reverts to missing-only behavior.
3. **Day-1 milestone celebration fires after save** (see § After save — celebration) with a slightly warmer framing than other streak days, since it's her first-ever entry.

No other onboarding-style overlays during the check-in itself. The rest of the app's structure is introduced through the onboarding screens (see § Onboarding) — the check-in stays clean.

### After save — celebration + return to home

When Sonakshi taps **"Save"** on the summary card, the sequence is:

1. **Save confirmed.** Captured notes are written to the Memory.
2. **Nudge / reassurance shown (the closer).** See § The closer — continuity-aware, evidence-led. Post-save likely uses a shorter variant (TBD during build).
3. **Milestone celebration, if applicable** — a congratulatory visualization shown before returning to home. Triggered only on:
   - **Day 1** — first-ever check-in. Warmer framing (*"That's the first one"*) + a single filled ring animating on.
   - **Day 7, 30, 90, 180, 365** — streak milestones. Visualization is **Whoop-style rings filling up**, scaled to the milestone (7 rings at day 7, 30 at day 30, etc.). Brief animation (≤2s), single milestone line above (the streak-milestone closer variant — *"Seven days. That's real."*), single *"Keep going"* CTA that returns to Home.
   - **Not daily.** No celebration on non-milestone streak days — keeps milestones meaningful and avoids gamification fatigue.
   Exact visual treatment of the rings (color, density, animation curve) is a build-time design call. The principle: it should feel like progress visualized, not a notification.
4. **Return to the home screen.** Home now shows:
   - Updated **metric visualizations** of all her data — styled in the vein of **Whoop's health data representation** (rings / recovery score / stacked metric timelines). *This is the "group-based analytics and data metrics" reference from earlier — interpreted as aggregated self-view over time, Whoop-style, NOT cohort comparison.*
   - A **persistent mic-icon CTA** — always visible, always tappable, so Sonakshi can start another voice conversation on demand whenever she wants.

---

## Feedback loop — what Sonakshi sees back, over time

The check-in is the give; the feedback loop is the get. If the get doesn't outweigh the give by roughly day 14, she churns. This section scopes what the app hands back, on which timescales, and in what form.

**The core design principle — graduated: visual early, verbal later.**

The app **visualizes** what Sonakshi has logged from Day 1 (reflection, no interpretation). It **speaks** — offers verbal insights, correlations, patterns she couldn't have spotted alone — only once the pattern engine has enough data to be honest. This prevents two failure modes: (1) an empty-feeling app in the first two weeks ("*I'm doing this every day and nothing happens*"), and (2) over-claimed patterns on thin data ("*Sakhi says my sleep causes my flares after 4 days of data — that can't be right*").

Graduated means: the app is visually alive from Day 1, but it doesn't talk above its evidence.

### The four timescales

| Timescale | What she sees | Form |
|---|---|---|
| **Instant** (seconds after save) | Closer + milestone celebration (if applicable) | Text + animation |
| **Same-day** (hours later, next Home open) | Today's metric snapshot | Visual — rings, bars, today's values |
| **Short-horizon** (days 1–14) | Reflection of what she's logged so far | Visual only — no interpretation |
| **Long-horizon** (day 14+, conditional on data) | First verbal insights + the Patterns view | Visual + verbal text insights |

### Instant feedback — already scoped

Closer line (§ The closer) + milestone celebration on day 1/7/30/90/180/365 (§ After save). Nothing new here.

### Same-day feedback — Home dashboard state

When Sonakshi opens Home later the same day (after her morning check-in), the Home dashboard reflects today's data:

- **Today's intake progress** — *"2 of 3 doses today"* counter on the intake tap section (already scoped in § Home visual + structural patterns).
- **Today's check-in card** — a small card showing the captured pain / mood / energy values, visible at-a-glance. Not an insight. Just *"here's what you told me."*
- **Today vs. recent** — a subtle comparison line under today's values (e.g. *"pain 6 — around your recent average"* or *"energy low — a bit lower than recent"*). Purely descriptive, never prescriptive. No causation claims.

Latency: all of this is realtime. Convex's reactive queries mean any captured value propagates to Home within a second.

### Short-horizon (days 1–14) — visual reflection, no interpretation

This is the "early visual" half of the graduated approach. The principle: **show her what she logged, don't tell her what it means yet.**

What's on Home in this window:

- **Streak bar** — consecutive check-in days visualized. (Not gamified with badges daily — the milestone celebrations already cover reward beats on day 7/30/90.)
- **Week-so-far rings** — a compact Whoop-style ring cluster showing pain average / mood trend / intake adherence % / flare days count — just for the past 7 days. Updates after every check-in.
- **Recent activity feed** — last 3–5 events (check-ins, intake taps, captured visits) as cards. Mixed-event feed with pill-tag labels (INTAKE / CHECK-IN / FLARE / VISIT — see § Home visual + structural patterns).

What's NOT on Home in this window:

- No verbal insights (*"Sakhi noticed…"* text).
- No correlation claims (*"your pain is higher on low-sleep days"*).
- No pattern charts inside Journey → Patterns (that view shows an empty-state template with *"Patterns unlock once you've checked in for a couple of weeks"* and the rough threshold).

Why: at 3–10 data points, almost any correlation is noise. Talking with false authority destroys trust permanently. Staying visual and descriptive respects the evidence.

### Long-horizon (day 14+) — verbal insights unlock

This is the "verbal later" half. On roughly day 14, the pattern engine starts having enough data to produce honest insights. These surface in two places:

1. **A new card type on Home — the insight card.** Appears when the pattern engine identifies a pattern that crosses a confidence threshold. Example format: *"Over the past two weeks, your pain has been a 6 or higher on 4 of 5 days you slept under 6 hours. Worth flagging to Dr. Mehta."* Always specific (numbers, not vague trends), always dismissable, always caveated when the sample is small.

2. **The Journey → Patterns view becomes populated.** The previously-empty Patterns surface now shows the chart correlations the pattern engine has computed — pain vs. sleep, flare vs. meds, mood vs. intake adherence, etc. Static snapshots she can browse, with a short verbal annotation per chart.

**Why day 14 specifically (soft threshold).** Two weeks is the shortest window across which most chronic-illness patterns show a signal above noise (from the autoimmune tracking literature and from Whoop's own public threshold for their "recovery baseline"). It's also the rough point where Sonakshi's engagement either hooks or doesn't — delivering nothing by then is the failure mode to avoid. Day 14 is a *floor*, not a fixed trigger — some insights may need more data (e.g. flare-vs-med correlations need ≥2 flare events observed), so the floor is 14 days + data-density condition per insight type.

**Confidence rules for verbal insights.**

- Never claim causation. Only co-occurrence. *"Your pain tends to be higher on X days"* — not *"X causes your pain."*
- Always surface the sample size, inline. *"(4 of 5 days)"* — never *"often"* without numbers.
- Suppress insights on <N observations — specific thresholds per insight type, tuned during build.
- Always include the path to action. *"Worth flagging to your doctor"* / *"Might be worth watching"* — connects the insight to what she can actually do with it.
- Insights are always dismissable. Dismissed insights don't re-fire for the same pattern within 14 days (avoid nagging).

**Notification behavior — MVP = none.** The app does NOT push notifications for insights. Insights surface when she opens the app. Rationale: push notifications on chronic-illness data risk feeling alarming or intrusive (*"Sakhi wants to tell you something about your pain"* — no thanks at 9pm). Post-MVP, an opt-in daily digest notification could be added. For MVP: pull model, not push.

**Latency summary.**

- Today's data → Home: <1s (Convex reactive).
- Week-so-far rings: <1s (recomputed on each save).
- Pattern engine: runs async per save; insights appear on Home on next open after the threshold is met. No "insight is loading" state ever shown to her.
- Doctor report auto-refresh: 24h cadence (already scoped in § Auto-generated windows).

### Still TBD for the feedback loop

- Exact insight-card design (single-line verbal + chart thumbnail? full narrative block?). Build-time call.
- Pattern-engine architecture — rules engine vs. small LLM call for insight wording. Leaning rules engine with templated copy (same reasoning as the opener: predictability, speed, safety, i18n). Confirm during build.
- First-insight hero moment — should the very first unlocked insight get a small celebratory framing (like *"First pattern unlocked"*), or just quietly appear? Leaning quiet appearance — matches the "we don't over-claim" design principle.
- Exact N-observation thresholds per insight type (pain-vs-sleep requires X nights, flare-vs-meds requires Y flare events, etc.). Tune during build with real data.

---

## Medications module (decided: Option D — Hybrid)

Accessed from the bottom menu bar. Dedicated section for managing Sonakshi's regimen. The module handles slow-changing regimen data; daily adherence is captured via the home-page voice check-in.

### One-time setup (prompted on first home visit via the nudge above)
Sonakshi enters her full current regimen — every medication she takes, with dose and frequency. **Entry mode:** voice-first inside the Medications module (she talks about her meds; AI structures them into a pill list); she can edit the structured list after.

Fields per medication (minimum):
- Drug name
- Dose (e.g. 15mg)
- Frequency (e.g. once daily, as-needed, twice weekly)
- Category (arthritis-focused / immunosuppressant / steroid / NSAID / antidepressant / supplement / other — tagged per Miro research)
- Delivery (oral / injectable / IV / other)

### Ongoing — dosage changes
When a doctor changes her dose, she updates the Medications module (directly OR via the voice check-in — see next section). Every dosage change is an event with a timestamp, old dose, new dose, and optionally the reason / the doctor's note.

### Daily adherence — dosage intake capture
Intake is a **first-class event**, not just a prescription record. Every time Sonakshi takes a dose (daily tablet, weekly injection, monthly biologic infusion, whatever the cadence), it is logged as an event with a timestamp so it can feed the dynamic chart in the doctor report.

**Two capture paths — both always available:**

1. **Autonomous reminder tap on the home page.** A lightweight, always-available tap on the home page where she can mark a dose as taken without opening a conversation. Examples:
   - *"Took my monthly biologic infusion today"*
   - *"Took the morning methotrexate"*

   This is on the home page so she can log it **whenever she actually takes it** — morning, evening, middle of the day — without waiting for the daily check-in. The phrasing is natural ("took my…") — the UI presents a tappable list of her active regimen pulled from the Medications module, and she taps the one she just took.

2. **Woven into the daily check-in conversation.** However late in the day she does her check-in, the voice AI can also capture intake — either because she mentions it unprompted (*"I took my morning meds"*) or because the AI gently confirms (*"did you take your methotrexate today?"* — phrased per the conversation design principles, not interrogative). Both the simple-adherence and partial-adherence mechanics below apply.

**Why both paths.** Some days she'll remember and tap in the moment (path 1). Some days she won't log until the check-in (path 2). The system should tolerate either, and not double-log if she does both — the check-in conversation should be aware of what's already been tapped for the day.

The Medications module surfaces today's adherence status (what's been logged, what's still outstanding) regardless of which path captured it.

---

## Community module (new — added to MVP)

Accessed from the bottom menu bar. A dedicated module where users with autoimmune conditions can interact with each other — peers dealing with the same (or related) diseases.

### What it is
A **Slack-style channel space**, organized by medical condition. Users can:

- **Create channels** for specific conditions — the way people create channels in Slack.
- **Interact with each other** inside those channels — conversation, threads, shared posts.
- **Share news updates** — new research, drug approvals, lifestyle studies, etc. — so members stay aware of the latest happenings in their condition.
- **Educate themselves and others** — lived experience exchange, symptom-sharing, questions, crowd-sourced knowledge.
- **Connect with others who live with the same or a similar condition** — the core value: "you are not alone."

### Why it's in MVP
Per Rewant's direction: this is no longer a future/out-of-scope item — it is a **5th MVP module** alongside Home / Medications / Journey / Settings. Moved out of the "Out of scope" candidate list.

### MVP Community shell — locked mechanics

The mechanics below lock the MVP shape. Everything heavier (images, polls, curated news feeds, reputation, multi-admin moderation) is deferred to post-MVP (see `post-mvp-backlog.md` item #8).

- **Channels are auto-created from the AARDA condition list.** No user-created channels in MVP. Every autoimmune condition in the AARDA master list gets a dedicated channel at app launch. Rationale: removes the "empty room" problem (a user-created channel with one user is worse than no channel), eliminates a whole moderation surface (duplicate / vanity / spam channels), and keeps discovery predictable — *"my condition → my channel"* is always true.
- **Discovery + joining.** On first Community tap, the user is auto-joined to the channel matching the condition they selected in Setup B.4 and shown a short browse view of related channels (same-family conditions — e.g. RA users see Lupus, Sjögren's, Psoriatic Arthritis surfaced). Full AARDA list is browsable + searchable from a "Browse all conditions" link. Join / leave is one tap; no approval flow.
- **Content type — text only.** No images, links, polls, long-form posts, or attachments in MVP. Plain-text messages in a single threaded feed per channel. Link *detection* (auto-hyperlinking a pasted URL) is fine; link *unfurling* (preview cards) is not. This is a legal + moderation simplification — image moderation and URL-safety scanning are both heavy lifts that don't earn their keep for MVP.
- **No news sharing mechanic in MVP.** No curated feed, no AI-summarized research digest, no user-posted links-as-cards. Channels are peer conversation only. News-sharing lands in post-MVP when a moderation + source-trust model exists.
- **Identity — pseudonym by default.** Each user picks a handle at first Community entry (default suggestion: a friendly-generated name like *"BrightFern-7"* that they can overwrite). The handle is the only thing other users see — no real name, no avatar upload, no bio. Initials chip next to the handle uses the first letter of the handle. This matches health-community convention and materially lowers self-disclosure risk.
- **Moderation — Rewant as sole admin for MVP.** Every message renders with a **Report** button (long-press or ⋯ menu). Reports land in a single admin queue Rewant reviews. Rewant can hide a message, remove a user from a channel, or suspend a user globally. No community moderators, no automated toxicity filters, no appeals flow in MVP. This is explicitly an interim model — scales only up to the waitlist-sized user base; replaced pre-GA with a real moderation stack.
- **Privacy invariant — Community never surfaces Memory.** Private check-in data (pain scores, mood, adherence, flare flags, dosage notes, free-flow bonus capture) is NEVER auto-surfaced in Community. Users can type anything they want into a Community message, but the app's own auto-share paths are zero. No *"Sonakshi had a flare-up today"* posts, no wellness-ring exports, no streak-bar share cards. This is a hard invariant — enforced at the data layer (Community has no read access to check-in / events / memory tables; it is its own data surface).

**Why these locks, collectively:** Community for MVP is a low-lift peer-support shell that ships safely with one admin (Rewant), zero auto-surfacing of private data, and zero content types that carry heavy moderation cost. It earns the "5th pillar" nav slot and satisfies the "you are not alone" promise without blocking the MVP build on moderation infrastructure.

---

## Journey module (the "looking back" pillar)

Accessed from the bottom menu bar. The aggregated surface where Sonakshi and her doctor can see everything Sakhi has quietly been remembering — her check-ins, her medications, her flare-ups, her dosage changes, her doctor visits, and the patterns between them.

### What it contains

The Journey module houses **five content surfaces**, all drawn from the same underlying data captured during daily check-ins and medication logging:

1. **Doctor Report** — the communication artifact produced for doctor visits. Exists in two modes:
   - **Auto-generated**, rebuilt every 24 hours, covering at minimum the last 1-week rolling window.
   - **On-demand**, generated per upcoming visit, with a default time window of "from the last doctor's visit to now."
   Full content spec, trigger logic, and architectural consequences live at § User journeys → Doctor report flow.

2. **Memory / past check-ins history** — a browsable, searchable record of every confirmed daily check-in. Each entry shows captured notes, pain/dysfunction scale, mood, medication adherence, and any qualitative context Sonakshi shared. Filtering by date range, symptom, mood, or keyword. (Detailed Memory UI still open — see open question #12.)

3. **Aggregated patterns / Whoop-style self-view** — a fuller version of the glance visualization on the Home page. Recovery rings, streak bars, stacked metric timelines showing well-being, physical health, emotional health, mental health, dosage intake, dosage changes, and flare-ups over time. Filterable by day / week / month. (Exact chart types still open — see open question #14.)

4. **Flare-up history + medication-change correlations** — a timeline of every flare-up captured, with correlation annotations against dosage changes and intake patterns. Visually surfaces "this flare-up started N days after your dose changed" and "this flare-up subsided M days later." Feeds directly into the Doctor Report's flare-up ↔ medication-change section.

5. **Doctor-visit timeline** — every doctor visit captured as a first-class event (date, doctor, specialty, visit type, notes). Visits become anchor points on every chart and are used to compute the on-demand Doctor Report's default window. Capture UI is still TBD (dedicated screen inside Journey, opportunistic capture during voice check-in, or both).

### Why this pillar exists

Sakhi's promise is *"your next doctor visit starts with data, not memory."* The Journey pillar is how that promise shows up in the app — it is the single surface where the aggregated record lives, so Sonakshi can both (a) look back on her own and (b) walk into any clinical conversation with context already prepared.

It also resolves a structural problem: the Doctor Report, the Memory history, and the pattern views were each homeless in the old nav. Bundling them into one "looking back" pillar keeps the bottom menu at 5 items, gives the report a natural home, and makes the Memory discoverable instead of buried.

### Memory landing — visual + structural spec

The Memory view inside Journey is the browse-past-check-ins surface. Structure:

- **Horizontal calendar strip at the top** — a week-at-a-time day scrubber (S / M / T / W / T / F / S with dates), selected day highlighted in the accent color (teal). She swipes horizontally to move through weeks. The scrubber is the primary navigation affordance; taps on a day load that day's entries below.
- **Filter tabs** just under the calendar strip — e.g. `All` / `Check-ins` / `Intake events` / `Flare-ups` / `Visits` — so she can narrow by event type without leaving the day she's viewing. Default tab is `All`.
- **Task-state visual vocabulary** for every item row:
  - Empty circle — pending / not-yet-due
  - Green checkmark — done / captured
  - Red strikethrough — missed / skipped
- **Item row structure** — time (left) + title (main) + meta line (small, secondary text below). Cards or full-bleed rows, consistent with the home event feed.
- **Empty-state template** when she has no entries yet for the selected day — centered illustration + short copy + soft CTA (e.g. *"Nothing logged yet for today — tap the mic to check in."*).
- **Grouped sections** within a day when there's mixed content — e.g. `Today's check-in`, `Medication intake`, `Other events` — with small section headers. Completed items collapse into a `Completed` group at the bottom so the eye lands on what's still outstanding.
- **Reverse-chronological scroll** below the selected day — newest first. Scrolling past "today" loads yesterday, day-before-yesterday, etc. The calendar strip and the scroll position stay synced (scrolling back moves the scrubber highlight).
- **Keyword search** — a search icon on the Memory tab header opens a search bar that queries the free-flow bonus-capture text across all entries (e.g. *"stiffness"* surfaces every day she mentioned stiffness in conversation). Debounced, client-side for MVP (the dataset is small; Convex reactive queries handle it).
- **Tap-to-detail** — tapping an entry opens a detail sheet showing the full structured capture (five required metrics + bonus bullets + any captured events from that day). The detail sheet has **[Edit]** and **[Delete]** actions — same rules as § Edit/cancel of captured events (delete is irreversible and requires confirm; edit overwrites in place; full audit history is post-MVP).
- **Empty-state integration** — the templated edge-case screen (*"Your memory starts today."* per § Edge cases) renders when the dataset is empty. Same template as other Journey empty states.

### Whoop-style charts — MVP set (inside Journey Patterns + Doctor Report)

Three chart types ship in MVP, rendered both inside Journey (Patterns tab) and in the Doctor Report appendix. All follow the brand direction (§ Brand direction — warm, rounded, not dashboard-cold) and share a single visualization component library.

1. **Wellness ring (Home-glance + Journey-Patterns header)** — today's composite wellness score as a filling ring (Whoop-style). Composite score is a simple weighted average of pain, mood, energy, and intake adherence for the day (exact weights tuned during build). Glanceable — one number for today. Tapping the ring expands it to show the four component sub-scores.
2. **Streak bar (Home + Journey-Patterns)** — a horizontal bar showing the last 30 days at a glance, each day coloured by its wellness score (green / amber / red). Tap a day on the bar → jumps to that Memory entry. Communicates consistency of showing up *and* longitudinal wellness trend in one strip.
3. **Multi-metric stacked line (Journey-Patterns + Doctor Report appendix)** — pain + mood + energy on a shared time axis, with dose-change markers (vertical lines) and flare-up periods (shaded blocks) overlaid. Selectable window (7 / 30 / 90 days per § Auto-generated report window granularity). This is the core Doctor Report chart — the one that makes patterns visible.

**Not in MVP** (deferred to post-MVP backlog):
- **Flare ↔ dosage correlation chart** — the more analytical version of #3 that aligns the two time-series layers with correlation annotations (*"flare started 4 days after 10→15mg increase"*). Clinically valuable but build-heavy (correlation detection + annotation renderer); the core multi-metric stacked line with shading already surfaces the same signal visually, just without the automated callout.
- **Sleep / HRV / heart-rate overlays** — blocked on wearable integration (backlog #13).
- **Heatmaps** — not enough data density in daily check-ins to justify the format.

**Shared behaviour.** All three charts are **filterable by day / week / month** using the Whoop-style granularity toggle already scoped for the Doctor Report (§ Auto-generated report — window granularity). Default granularity auto-picks based on data history.

### Open mechanics for the Journey module

Still to scope:

- **Landing screen** — what Sonakshi sees when she taps Journey. Tabs across the top (Report / Memory / Patterns / Flares / Visits)? A hub page with cards linking to each? Default view (Report vs. Patterns)?
- **Cross-linking** — tapping a flare-up in the timeline jumps into the corresponding Memory entry? Tapping a dosage change jumps into the Medications module? How tightly integrated vs. loosely linked?
- **Sharing scope** — does Sonakshi share any Journey content with anyone other than her doctor? (e.g. shared view with her support system — currently out of scope, but the architecture should not preclude it.)
- **Offline / cached view** — when she's in a clinic with bad signal, does Journey still render the most recent auto-generated report from local cache?

---

## Daily voice check-in — medication mechanics (Hybrid specifics)

The AI is designed so Sonakshi **never has to recite drug names or doses** during daily conversation.

- **Simple adherence:** If she says *"I took my medications"* / *"yeah, took them"* / any natural affirmation — the AI logs today's full regimen as taken. No drug names required.
- **Partial adherence:** *"I skipped the steroid today"* / *"didn't take the evening dose"* — AI marks only that medication as not taken, rest as taken.
- **Opportunistic dosage-change capture:** if she mentions specific drugs + doses during conversation (*"doc bumped my prednisone to 20mg"* / *"I'm on a new immunosuppressant"*), the AI:
  1. Extracts the change
  2. Shows a **confirm card** during the summary step — *"I heard: prednisone 15mg → 20mg. Save this change to your medications?"*
  3. On confirm, writes to **both** today's check-in record AND the Medications module (as a regimen update event)
- **Not a dedicated end-of-day med section.** Medication is woven into the natural flow of conversation — it is NOT a scripted "now let's talk about your meds" block. If she brings meds up, AI engages; if she doesn't, AI infers adherence from her affirmation and moves on.

---

## MVP focus themes

Three of the Miro research themes are explicit MVP priorities:

### Theme 1 — Communication (subjective → quantifiable)
*"How might we make the subjective experience of chronic illness into more quantifiable metrics so it can be easily communicated to doctors?"*

The app generates the right data points for Sonakshi to share with **her doctor** and **close family members** — turning fluctuating, hard-to-explain chronic illness into numbers and patterns that land with a layperson or clinician.

**The pain scale lives inside this theme**, not as a standalone tracker. Specifically: the **pain / dysfunction scale + quantitative representation of medication, symptoms, and their impacts** is the communication artifact the app produces. It exists to:

- Make the app more user-friendly (Sonakshi can rate her state in 1 second instead of describing it)
- Translate her subjective state into metrics her doctor and family can actually read

So when we collect "pain scale" during a daily check-in, we are NOT storing a generic number — we are building the raw material for the communication output.

### Theme 2 — Symptom tracking
*"How might we simplify staying on track with the fluctuations and symptoms?"*

The app keeps a running record of the patient's illness for the patient herself, her doctor, and her support system. Built for the reality that symptoms fluctuate day-to-day.

### Theme 3 — Medication correlation + dosage tracking
*"How might we simplify and make it easier for the patient to stay on top of their medication routine, adherence, and dynamic changes (dosage, frequency, other parameters)?"*

When a doctor changes the course of dosage, Sonakshi records that change in the app. Over time, the app correlates **medication + dosage changes** against **symptoms + wellbeing metrics** to surface patterns.

### Theme 4 — Big data picture: visualizations, patterns, projections
**The key aspect of this product.** Three nested sub-questions:

1. **Visualizations.** *How might we create multiple visualizations of the gathered data — dosage, symptoms, mental and physical wellbeing, food, environment — especially over a specific time frame?*
2. **Pattern & causation/correlation detection.** *How might we determine patterns, causation, correlation between the symptoms during fluctuations and the change in medication, other parameters, and mental/physical wellbeing — so the patient has future-looking notes, projections, and pattern recognition?*
3. **Empowerment via projections.** *How do we empower the patient with projections using data analytics based on their existing health and medication patterns?*

This is the analytical heart of the app: the reason daily check-ins, medication logs, and symptom tracking exist is to feed this engine.

---

## Where does that data go?

<!-- TBD — decided during stack/schema design (Convex tables). -->

## What do they see back? In what format? How fast?

<!-- -->

## What's the second screen? The third?

See **Onboarding Screen 2** and **Onboarding Screen 3** above. Full sequence:
Onboarding (4–5) → Setup A.1 → Setup A.2 → Confirmation → Setup B.1 → Setup B.2 → Setup B.3 → Welcome email + redirect to home.

## If they come back tomorrow, what do they see?

<!-- -->

## User journeys (end-to-end)

### Sign-up flow

Full sign-up = Onboarding (4–5 screens) + Setup Part A (mobile verification, 2 screens) + Setup Part B (profile, 4 screens — name, DOB, email, medical condition) + welcome email + redirect to home. CTA throughout = **Next**; only exceptions are the two sub-CTAs on verification (Resend, phone-call fallback).

### Core action flow (daily check-in)

<!-- -->

### Return flow (next day / next week)

**Day 2 onwards — the returning user:**

1. **Onboarding is skipped.** She is already set up. App opens directly to her **home page**.
2. **Home shows "Ready for today's check-in?"** — a prompt on the home surface inviting her to talk.
3. She taps in (voice CTA or the "Ready for today's check-in?" prompt). The conversation begins.
4. **The AI opens by referencing yesterday.** *"Yesterday you mentioned your wrist was flaring — how has that been since?"* — signalling that the AI actually heard her previous conversation and is continuing the thread, not resetting from zero.
5. **The AI then checks in on how she's feeling today** — today's state, in her own words.
6. **The AI urges her to elaborate** once she's given an initial check-in — drawing out more detail.
7. After the conversation ends, the same post-conversation flow applies (summary card → save → nudge → milestone if applicable → return to home).
8. **She goes back to her day.** The interaction is complete; nothing else is demanded of her.

This return pattern directly enacts Conversation Design Principle #2 (reference prior conversations) — it is the single most important behavior that makes the app feel like a companion, not a form.

### Doctor report flow

The report is the communication artifact Sakhi produces for Sonakshi's doctor visits — the tangible output of every daily check-in, the Memory, and the medication history. It exists to translate her fluctuating, hard-to-describe chronic illness into something a clinician can read quickly.

**Where it lives in the app:** inside the **Journey** pillar (see § Journey module). Journey is the aggregated "looking back" surface that houses the Doctor Report alongside the Memory history, pattern views, flare-up timeline, and doctor-visit history.

#### Report content — what Sonakshi (and her doctor) should see

1. **A dynamic chart of her captured metrics so far**, covering:
   - Well-being
   - Physical health
   - Emotional health
   - Mental health
   - **Dosage intake** — every time she actually took her medication (tablet, injection, infusion, whatever form)
   - **Dosage changes** — when the prescribed routine itself changed (new med added, dose raised/lowered, med stopped)
   - Flare-ups

   **On dosage, specifically.** Autoimmune routines aren't always daily — some meds are weekly, some are monthly (monthly injections and monthly infusions are common). So the chart has to handle both **high-frequency intake** (daily tablets) and **low-frequency intake** (a once-a-month injection) on the same timeline without one drowning out the other. **Dosage changes** are tracked as a separate layer on top of intake — the changes are the big events a doctor cares about, but the actual intake pattern (did she take it on time, did she miss any, how regularly is she dosing) is the underlying signal.

   These passive components are highlighted inside the chart — styled in the vein of **Whoop-style analytics** (consistent with the home-page visualization direction in § Home page). The chart is **filterable by day / week / month** so Sonakshi and her doctor can zoom in or out depending on what's being discussed.

2. **Flare-up ↔ medication-change correlation** — the chart and narrative together surface:
   - **When** each flare-up occurred
   - **How many days after** a medication routine change or dosage change the flare-up began
   - **How long** it took for the flare-up to subside

   These nuances are addressed both **visually (in the chart)** and **in text (a narrative summary)**. The point is cause-effect legibility: a doctor looking at this should see whether a dose change preceded or followed a flare, and by how much.

3. **Qualitative context — what she felt and experienced** beyond the measured metrics. Additional data points captured from her check-ins that don't reduce to a number (things she said, emotions she described, environmental/life context she brought up). This surfaces in the report alongside the metric view.

**The combined effect.** Taken together, the chart + flare-up correlation + qualitative context create a **comparative data point** that lets the doctor understand:
- Her dosage changes over the period
- Her flare-ups and their timing
- Her emotional and physical well-being data points
- All mapped against her Memory entries at large, presented in summary fashion

So the doctor is not getting a raw dump — they are getting a readable summary where metrics, events, and qualitative state are plotted together.

#### Report trigger — when the report exists

**Hybrid: auto-generated cadence + on-demand per visit.** Both paths exist in parallel.

1. **Auto-generated on a rolling cadence.** A version of the report is **rebuilt every 24 hours**, covering at minimum the **last 1-week period**. This means the report always exists and is always current — when Sonakshi opens the Doctor Report screen, something is already there. She doesn't have to ask the app to generate anything to see her own patterns. (Window > 1 week is also produced on the same cadence; 1 week is the floor.)

2. **On-demand, per doctor visit.** Because autoimmune doctor appointments are **not on a fixed schedule** — they happen when her doctor wants to see her, not on a predictable cadence — Sonakshi needs the ability to generate a report **on demand**, tied to a specific upcoming visit. The on-demand report's **default time window is from the last doctor's visit to now** — because that is the window the doctor actually needs to see. Everything that has happened since they last spoke.

**Why both paths.** The auto-generated report serves her own pattern-watching (she can glance at it any time, mid-month, to see how she is doing). The on-demand report serves the clinical use case — prepared for a specific appointment, framed around the window the doctor cares about.

#### Architectural consequence — doctor visits must be first-class events

Because the on-demand report is anchored to "from the last doctor's visit to now," the app needs to **capture doctor visit appointments** as first-class events in the data model. This is a new requirement that surfaces here:

- **Doctor visits are tracked** — each visit has at minimum a date, and optionally: doctor name, specialty, visit type (blood test / follow-up / new prescription / specialist consult), notes.
- Doctor visits become **anchor points on the timeline** — the same way flare-ups and dosage changes already are. They appear in the dynamic chart so Sonakshi (and her doctor) can see "this is what happened between visit A and visit B."
- Doctor visits are what the on-demand report's **default time window** is computed against — "from your last visit on {date} to today."
- Capture path for doctor visits is **TBD** (likely: a dedicated screen in the app + opportunistic capture in the daily check-in when she mentions an appointment — "saw my rheumatologist today").

#### Sharing the report with the doctor

Sonakshi has **two sharing modes** — and only these two. No hosted-link portal, no clinic-portal integration, no email export for MVP.

1. **Show on phone screen (in-app).** She opens the report inside Sakhi and hands her phone to the doctor — or turns it toward them across the desk. The doctor interacts with the in-app view directly (scrolls the chart, changes the time filter, taps through to the qualitative context). This is the primary mode for an in-person visit.

2. **Share the PDF via WhatsApp.** She exports the report as a PDF and shares it through WhatsApp — using the OS-level share sheet to send the PDF directly to her doctor's chat. WhatsApp is the channel of record for doctor communication in India, so the PDF needs to be WhatsApp-friendly: reasonable file size, viewable inline or with one tap, self-contained (no external font / image loads).

**Explicitly not in scope:**
- **No shareable link.** We are not hosting a web-accessible view of her report. A link implies hosted content, access control, link expiry — complexity we don't need when WhatsApp + phone-screen already cover the two real scenarios (in-person visit, pre/post-visit async check-in).
- **No email export.** If this turns out to matter later, add it post-MVP. WhatsApp is the primary rail.
- **No clinic portal integration.** Out of scope entirely.

This keeps the sharing story tight: **one in-app view, one PDF export.** Nothing else.

#### Edit-before-share rule (MVP: annotate-only)

**MVP rule:** Sonakshi can **annotate** the report before sharing. She **cannot redact, delete, or hide** any underlying data.

- **Annotation is additive context.** She can add short notes on top of the report — e.g. *"this week was my wedding, high stress and not a typical week"* or *"my water broke mid-week — the flare the day after is pregnancy-related, not med-related."* Annotations attach to a time range or a specific event and appear alongside the chart / narrative.
- **The underlying data is untouchable.** Every entry that Sakhi captured during check-ins, every intake event, every flare-up — all of it stays in the report. She cannot remove a panic-attack entry from three weeks ago, cannot hide a missed dose, cannot trim a bad week.
- **Why this posture for MVP.** The report's clinical value depends on the data being trustworthy. If Sonakshi can hide entries, the doctor is no longer looking at her record — they are looking at her curated story of her record, and the moment a clinician learns that, the report loses its weight. Annotate-only lets her provide *context* without breaking *trust*.

**Future (post-MVP):** full edit — where she can annotate **and** selectively hide or redact entries — is on the roadmap. The use case is real: some entries may be deeply personal (mental-health detail, relationship context, intimate-life context) that she wants to discuss with some doctors but not others. The architecture should not preclude this — specifically:

- The Memory is the canonical raw record; the report is a view on top of the Memory.
- Future full-edit mode would add a "redact from this report" toggle per entry that only affects the report view, never the underlying Memory.
- Shared-report versioning (which entries were hidden for which visit) stays server-side so Sonakshi has her own audit trail of what she showed to whom.

For MVP: build the annotate path. Do not build the redact path. Keep the data model clean enough that redact-per-report can be added later without a migration.

#### Language (MVP: English; architecture: multilingual)

**MVP:** English only — both in the app and in the generated report / PDF.

**Architecture:** the app is designed so language is a **user preference, not a hardcoded assumption.** Sakhi should be able to address:

- **English** (default, MVP)
- **Hindi** (next priority, post-MVP)
- **Other Indian vernacular languages** — Tamil, Telugu, Bengali, Marathi, Kannada, Gujarati, Malayalam, Punjabi, and others popular across India. India is a multilingual country and this product is built for Indian patients first; a monolingual app cannot serve that audience long-term.

What "multilingual-ready architecture" means in practice:

- **All user-facing copy** (onboarding, UI labels, conversation prompts, nudges, reassurances, the Memory) lives in a string resource system from day one — not inlined as literals in components. Even in the English-only MVP, strings go through an i18n layer so adding a second language is a drop-in, not a refactor.
- **The voice AI** accepts language as a setting. MVP talks English; the prompt architecture and the speech-to-text / text-to-speech stack should allow switching the target language without rewriting the conversation design principles.
- **The PDF generator** takes a language parameter. MVP renders English; the same pipeline should be able to render Hindi or Tamil when the content translation exists, including proper font embedding (Devanagari, Tamil, Bengali scripts etc.).
- **Medical term translations** — post-MVP concern; we flag it here because translating drug names, dosage units, and symptom vocabulary correctly for a clinical artifact is non-trivial and needs either a curated translation pass or a validated medical-translation source (not raw machine translation).

For MVP: ship English only. For architecture decisions during POC + build: do not hardcode English. Treat language as a dimension.

#### PDF content + layout (Hybrid — summary page + full-fidelity appendix)

The PDF exported for WhatsApp sharing uses a **hybrid layout**: a one-page summary at the front, followed by the full-fidelity report as an appendix. Doctors can glance at the summary in an OPD visit (often 10–15 minutes) and dig into the appendix when they want detail.

**Page 1 — Cover + one-page summary view**

A single printable page designed to be readable in a clinician's 30-second glance:

- **Header:** Sonakshi's name, her medical condition, report time window (*"From your last visit on 2 Mar 2026 to today, 23 Apr 2026"*), report generation timestamp, Sakhi branding. If a doctor name/specialty was captured on the associated visit, it appears here.
- **Headline metrics strip** — 4–5 numbers that summarize the window at a glance. Exact metrics still TBD; candidates: number of flare-ups, number of dosage changes, intake adherence %, average dysfunction-scale score, mood-trajectory direction (trending up / flat / trending down).
- **Small static chart** — compressed version of the dynamic chart showing the key timeline at a readable size.
- **3–5 narrative bullets** — the most important qualitative takeaways from the window, plus any annotations Sonakshi added. (*"Wrist pain worsened in week 2 after methotrexate was raised. Sonakshi notes: this was also the week of her wedding — high stress baseline."*)

This page is designed to be usable **on its own** — a doctor who reads only page 1 should still walk away with the clinical picture. The user should also be able to view this one-page summary as a standalone view inside the app (not just as a PDF page), so she can skim it before a visit without opening the full report.

**Page 2+ — Full-fidelity appendix**

All three content blocks from the in-app report render at full fidelity:

1. **Dynamic chart → static snapshot.** The chart is rendered for the chosen time window as a high-resolution static image. All layers active in the in-app view (well-being, physical, emotional, mental, dosage intake, dosage changes, flare-ups, doctor visits) render on the snapshot.
2. **Flare-up ↔ medication-change correlation — visual + text.** A static visual (timeline with correlation annotations) paired with the narrative text explaining when each flare-up occurred, how many days after a dosage change it began, and how long it took to subside.
3. **Qualitative context — narrative section.** What Sonakshi felt and experienced beyond the measured metrics. Drawn from her check-in conversations.

**Annotations** (from § Edit-before-share rule) render **inline with the affected time range** in the appendix — as callouts next to the relevant week on the chart, and as inline italics in the narrative text where they apply. They are visually distinguishable from Sakhi-generated content (colour / typography) so the doctor can tell what came from the data vs. what came from Sonakshi's own note.

**Why hybrid over pure full-fidelity.** A full-fidelity-only PDF is long and dense; a busy OPD doctor may skim only the first page anyway. The one-page summary ensures the clinical value lands in the first 30 seconds; the appendix means she doesn't have to choose between "quick" and "thorough" — both live in the same file.

#### Auto-generated report — window granularity (Whoop-style day / week / month toggle)

The auto-generated report is **one continuously-refreshed dataset** (rebuilt every 24 hours) that Sonakshi and her doctor can view at **three granularities — daily, weekly, or monthly**. Modeled on how Whoop lets users toggle between day-by-day metrics and weekly / monthly comparable-data charts.

**How the toggle works.** Inside the Journey report view, there is a three-position toggle — **Daily / Weekly / Monthly** — that changes how the data is aggregated and displayed. The dataset underneath is the same; the chart and narrative recompute based on the toggle.

- **Daily.** Each day is its own data point. Best for zooming into recent weeks — seeing what happened on a specific day (dose taken / missed, pain-scale rating, flare-up start).
- **Weekly.** Each week is aggregated into one data point per metric (average dysfunction, total intake, flare-ups in the week, mood trajectory). Best for comparing week-over-week — *"this week vs. last week vs. the week before."* This is the view most likely to match how a doctor thinks about a 1–3 month stretch.
- **Monthly.** Each month is aggregated. Best for long-horizon patterns — *"my flare-up frequency has dropped since February"* — and for the scenario where she's been on the app for 6+ months and wants to see the full arc.

**What auto-generates vs. what the user controls.**

- The **underlying dataset** auto-refreshes every 24 hours. She doesn't trigger a rebuild; it's always current.
- The **granularity toggle (Daily / Weekly / Monthly) is her choice.** The app opens on a sensible default based on how much data she has — Daily if she has less than 2 weeks of history, Weekly if she has 2 weeks to 3 months, Monthly if she has 3+ months. She can override the default at any time.
- The **time window** (what "last N days/weeks/months" the chart shows) is also user-controllable — same way the in-app dynamic chart is filterable. Daily granularity with a 30-day window is a different view from Weekly granularity with a 30-day window.

**On-demand reports still use the "from last doctor visit to now" default window** — but the granularity toggle applies there too. She can generate an on-demand report for the inter-visit window and view it day-by-day or week-by-week depending on what she wants to walk the doctor through.

**Why this beats "multiple fixed windows."** Pre-building four separate reports (7/14/30/90-day) assumes we know which windows matter. Sonakshi's reality — dosage cadences ranging from daily to monthly, flare-ups that can last from hours to weeks, doctor visits on irregular schedules — means fixed windows are always going to be wrong for some scenario. One dataset with a three-position granularity toggle + user-adjustable window covers every case.

#### Doctor-visit capture (opportunistic-first, plus a Journey "+" for manual events)

Doctor visits — and adjacent clinical events — are captured through **two paths**:

**Primary path: opportunistic capture during the voice check-in.** If Sonakshi says anything like *"saw my rheumatologist today"* / *"I had my blood test yesterday"* / *"my appointment with Dr. Mehta is next Tuesday"* during a check-in, the AI extracts it and presents a **confirm card** during the summary step — same pattern as opportunistic dosage-change capture. Example: *"I heard: visit with your rheumatologist on 23 Apr 2026. Save this to your visits?"* On confirm, the event writes to the data model and anchors on the timeline. This is the primary path because it requires zero deliberate action from her — she just talks, Sakhi listens.

**Secondary path: a "+" icon inside the Journey pillar for manual add.** Not every event gets mentioned in a check-in. A "+" (plus) icon lives inside the Journey pillar and opens a short menu of event types she can add directly:

- **Appointment / doctor visit** (past or upcoming)
- **Blood work / lab test schedule** (past appointment, upcoming appointment; result attachment may come later)
- **Other clinical events** — the list is deliberately extensible so we can add more types as scoping surfaces them (e.g. scans, procedures, therapy sessions, specialist referrals)

Each type gets a minimal form — date, and whatever structured fields are most useful for that type (doctor name for visits, test type for blood work, etc.). The form is **stepwise** (one field per step, thumb-reachable) rather than a single long form — easier to complete on the go and matches how a voice-first app should feel even when typing is involved.

**Provider picker for doctor visits.** When she captures a doctor visit, the doctor-name field is a **searchable picker pulled from prior captured visits** (and any providers she entered during setup), *not* a blank text input. She taps into the field, sees *"Dr. Mehta (rheumatologist)"* and *"Dr. Rao (GP)"* if she's mentioned them before, and picks one. A *"+ Add new provider"* option at the bottom of the list handles first-time entries — inline, no separate screen — capturing name + specialty as two quick fields.

Why: re-typing the same doctor name every time is friction, and free-text entry produces inconsistent strings (*"Dr Mehta"* vs *"Dr. Mehta"* vs *"Mehta"*) that make the timeline harder to group by provider later. A picker enforces consistency without being rigid. It also means the *opportunistic* capture path can auto-match *"saw my rheumatologist"* to Dr. Mehta if she's the only rheumatologist on file — reducing the confirm-card down to a one-tap yes.

**Why this split.**
- Opportunistic captures what she mentions naturally — matches Conversation Design Principle #1 (open questions, not interrogation). She doesn't have to remember to log anything.
- The "+" fallback handles the cases she doesn't bring up in conversation — upcoming appointments she booked yesterday, a blood test she doesn't feel like talking about, a specialist referral she needs to remember.
- Placing the "+" inside Journey (not in a separate module) keeps the pillar's identity intact: **Journey is where events live — past, present, and upcoming.**

**Architectural consequence — blood work tests become first-class events too.** Sonakshi's reality includes blood tests every 2 weeks (per § Who is the user?). Treating them as a distinct event type (not just a flavor of "doctor visit") lets the chart show them as their own timeline layer, which matters clinically — blood markers often change before symptoms do, and aligning blood-test dates to flare-ups or dosage changes is part of the pattern story. For MVP: capture the *schedule* of blood tests (date + test type). Capturing and rendering actual results is post-MVP.

#### Edit / cancel of captured events (in MVP)

Captured events (appointments, blood tests, other clinical events) are **editable and cancellable** in MVP. The check-in content itself — pain value, mood, flare flag — remains immutable-with-overwrites (full edit is post-MVP, per § post-mvp-backlog #2). But *events on the timeline* must be fixable, because Sonakshi will inevitably:

- get a date wrong during opportunistic capture (*"I said next Tuesday, I meant the Tuesday after"*)
- end up with a duplicate (captured once in voice, once via the "+" menu)
- have an appointment **cancelled** or **rescheduled** by the clinic
- **no-show** an appointment she meant to attend

**Interaction.** Long-press (or tap) any captured event on the Journey timeline → action sheet with:

- **Edit** — opens the same stepwise form the event was created with (date, doctor/test type, notes). Changes overwrite in place. No version history in MVP.
- **Mark cancelled** — event stays visible on the timeline but greyed out with a struck-through date and a "Cancelled" pill. It remains queryable by the pattern engine as *"appointment missed"* — distinct from an event that never existed.
- **Mark rescheduled** — a one-step flow that cancels the original (greyed-out) and prompts for the new date, creating a linked upcoming event.
- **Delete** — hard-removes the event from the timeline. Confirm dialog required (*"Delete this visit? This can't be undone."*) because deletion is irreversible in MVP.

**Why cancelled ≠ deleted.** A cancelled appointment is *signal*: the pattern engine can correlate missed visits with flare-ups, delayed dose adjustments, or extended symptom periods. A deleted event is noise — something that shouldn't have been captured in the first place (duplicate, wrong person, test entry). Keeping the distinction lets the Doctor Report show an honest record (*"you had 3 visits scheduled, 2 completed, 1 cancelled by clinic"*).

**What's visible where.**
- Cancelled events show on the timeline but never on the Doctor Report one-page summary (they'd mislead). They **do** appear in the appendix as a line item, because the appendix is the full record.
- Deleted events are gone — no tombstone.
- Edits show the current value only. If a date moved from 23 Apr to 30 Apr, the report shows 30 Apr (no *"was 23 Apr"* trace). Audit history is post-MVP.

**Architectural note.** The event model needs a `status` field (scheduled / completed / cancelled / no-show / rescheduled) and a `linkedEventId` for the reschedule case. Both are additive to the first-class event schema; no migration risk.

#### "Prepare for Visit" flow (checklists + annotations + open questions for the doctor)

Annotations and pre-visit prep live inside a **dedicated "Prepare for Visit" flow** — not a scattered "+add note" button on the report surface. This flow is how Sonakshi walks herself from *"I have a doctor visit coming up"* to *"I am ready for the conversation."*

**Three content types she captures in this flow** (tripartite structure — checklists for her, annotations on the report, questions for the doctor):

1. **Checklists — things to bring / do before the visit.** A simple to-do list scoped to this specific upcoming visit. These are *for Sonakshi* — they help her walk into the OPD ready, not walk in missing half of what she needed. Examples:
   - *Bring most recent blood work report*
   - *Bring all current pill bottles (or a photo of each)*
   - *Confirm parking at the hospital*
   - *Print the questions list (or keep it pulled up on the phone)*
   - *Take the 9am methotrexate dose before leaving*

   Checklist items are simple text + checkbox. Sonakshi can add her own, and Sakhi can seed a few sensible defaults based on what's in her Journey (e.g. *if a blood test result exists in the last 14 days → suggest "bring blood work report"*; *if any dose was changed since the last visit → suggest "bring current pill bottles"*). Checking items off is client-side — no network required the morning of the visit.

2. **Annotations on the report itself.** The flow walks her chronologically through the on-demand report for the upcoming visit. At notable events — flare-ups, dosage changes, unusually bad or unusually good weeks — she gets an optional prompt to add context for the doctor. *"This week was my wedding, high stress and not a typical week."* / *"My water broke mid-week — the flare the day after is pregnancy-related, not med-related."* These annotations attach to the relevant time range in the report (see § Edit-before-share rule).

3. **Open thoughts and questions for the doctor.** A free-form surface where Sonakshi writes down **what she wants to raise in the visit** — questions she has, worries she hasn't mentioned, things she'd like the doctor's opinion on. Examples:
   - *"Can I try reducing the methotrexate for one week to see if my nausea settles?"*
   - *"Is this level of fatigue normal on this dose, or should we be concerned?"*
   - *"I'm thinking of travelling for 2 weeks next month — anything I should plan around?"*

   This is not medical advice Sakhi is giving. This is **Sonakshi's own voice** — her own prepared questions, captured so she doesn't forget them in the 10-minute OPD window. A patient walking into a visit with a written list of questions is a well-documented practice in patient-advocacy literature; it flips the dynamic from passive recipient to active participant in the conversation. This is what a *friend* would help her prepare.

**Where the flow lives.** Accessed from the Journey pillar — either as a dedicated button ("Prepare for visit") on the report view, or surfaced proactively when Sakhi notices an upcoming doctor visit in the event timeline (say 24–48 hours before the appointment). Likely both — TBD.

**How the three content types render in the PDF.**

- **Checklists** do **not** render in the doctor-facing PDF by default — they are Sonakshi's own pre-visit to-dos, not something the doctor needs. They live on the in-app Prepare-for-Visit surface only. (Post-MVP option: a "share my prep checklist" toggle if she wants it visible to her support system.)
- **Annotations** render inline in the appendix alongside the affected time range (per § PDF content + layout → annotations spec), and as short callouts on the one-page summary where they apply to a highlighted event.
- **Open questions** render as a dedicated section on the PDF — likely a *"Questions from Sonakshi"* block at the end of the one-page summary or the top of the appendix. Structured as a simple numbered list so the doctor can work through them during the visit.

**Why dedicated flow beats scattered "+ add note" buttons.** Annotations and questions are **deliberate, pre-visit work** — not casual additions. Giving them a dedicated flow signals their importance, gives Sonakshi a single place to do the prep, and produces a more considered artifact. Scattered note-buttons on the report would make annotation feel optional and noisy; a Prepare for Visit flow makes it feel like a ritual worth doing.

**MVP annotation-only constraint still applies.** Annotations and questions are both *additive* — they never remove or hide any underlying report data. Per § Edit-before-share rule, full edit (annotate + redact) is post-MVP.

<!-- Still to scope for the doctor report workflow:
- ~~Location in the app~~ — **answered.** Lives inside the **Journey** pillar (see § Journey module). Still TBD: what the Journey landing screen looks like, how the Doctor Report is surfaced vs. the Memory vs. the pattern views.
- ~~How she shares it with the doctor~~ — **answered.** Phone-screen in-app view + PDF over WhatsApp only. No hosted links, no email, no portal.
- ~~Edit-before-share rule~~ — **answered.** MVP = annotate-only. Post-MVP = full edit (annotate + selective redact-per-report). Data model must keep Memory canonical and treat the report as a view, so redact can be added later without migration.
- ~~PDF layout~~ — **answered.** Hybrid — Page 1 one-page summary (cover + headline metrics + small chart + narrative bullets + annotations), Pages 2+ full-fidelity appendix (static chart snapshot + flare-up correlation visual + narrative + qualitative context). One-page summary also available as an in-app standalone view.
- ~~PDF language~~ — **answered.** MVP = English only. Architecture = multilingual-ready (Hindi + Indian vernacular languages post-MVP). All copy goes through an i18n string layer from day one.
- PDF still-TBD — headline metrics for the summary page (exact 4–5 numbers), file size target, whether the Sakhi brand is prominent or muted, cover-page fields when doctor name/specialty isn't captured.
- ~~Does the doctor see a different view if they open a shared link, vs. Sonakshi's in-app view?~~ — **n/a.** No shared link exists. Doctor either sees Sonakshi's phone or the PDF.
- ~~Annotation UX~~ — **answered.** Dedicated "Prepare for Visit" flow inside Journey. Tripartite structure: **Checklists** (for Sonakshi — bring blood work, pill bottles, etc.), **Annotations** (chronological walk through the report with optional prompts at notable events), and **Open questions for the doctor** (free-form list). Questions render as a dedicated "Questions from Sonakshi" section in the PDF. Checklists stay in-app only (not on the doctor-facing PDF).
- Prepare for Visit flow — still TBD: does Sakhi surface the flow proactively 24–48h before an upcoming visit, or is it user-initiated only? How many annotations / questions / checklist items per visit (cap, or unlimited)? What are the seeded-by-default checklist items (if any) vs. pure blank start?
- ~~Default time windows for the auto-generated version~~ — **answered.** Single auto-refreshed dataset (24h cadence), Daily / Weekly / Monthly granularity toggle controlled by the user. Default granularity auto-picks based on data history (Daily <2wks, Weekly 2wks–3mo, Monthly 3mo+). Window is user-adjustable alongside the granularity.
- ~~Doctor visits as first-class events — capture UI~~ — **answered.** Primary = opportunistic capture during voice check-in (confirm card in summary step). Secondary = "+" icon inside Journey with event types (appointment/doctor visit, blood work schedule, extensible to scans/procedures/etc.). Blood work tests are now their own first-class event type alongside doctor visits.
- Upcoming-visit reminders — still TBD. Does Sakhi nudge Sonakshi 24h before an upcoming appointment to generate the on-demand report? Does she nudge the day-of? How does a captured "upcoming" event differ in the UI from a captured "past" event?
- ~~Edit/cancel of captured events~~ — **answered (in MVP).** See § Edit/cancel of captured events below.
- Blood work results (not schedule) — post-MVP. But the data model should leave room to attach a result (file or structured values) to a captured blood-work event later.
-->


### Edge cases

Every edge state gets a **dedicated full-screen template**, not an inline banner or silent failure. The template is consistent — centered illustration + bold title + body copy explaining what happened + primary CTA + secondary link (when applicable). Bottom nav stays visible so Sonakshi is never stuck on a dead end; she can always tap out to another pillar.

Why dedicated screens beat inline error strips: a friend-app has to *hold the moment* when something goes wrong, not hide it. An inline red banner at the top of a screen is easy to miss and easier to mistrust. A full screen with a warm illustration and a clear next step says *"I see this broke, here's what to do next"* — which is the tone we want even in failure.

**Minimum edge-case set for MVP:**

1. **Connection error (no internet).** Triggered when the device is offline or a Convex call fails with a network error. Title: *"You're offline right now."* Body: explains that today's check-in can't sync, the Journey may be stale, and she should reconnect to continue. Primary CTA: *"Try again"* (retry the failed call). Secondary: *"Keep browsing"* (drops her back into the last-cached view — per the Offline mode state below).

2. **Voice transcription failed.** Triggered when the microphone permission is denied, the audio capture fails, or the transcription API call errors out. Title: *"I didn't catch that."* Body: explains what went wrong in plain words (*"Your mic isn't on"* / *"I lost the connection mid-sentence"*) and offers a path forward. Primary CTA: *"Try again"* (retry) or *"Type instead"* (fallback text input — preserves the check-in). Secondary: link to Settings if it's a permission issue.

3. **Save failed (Convex write rejection).** Triggered when a write to Convex fails after the action completed (e.g. intake tap, check-in save, visit capture). Title: *"Didn't save — let's try once more."* Body: reassures that her answers aren't lost locally and asks her to retry. Primary CTA: *"Save again"*. Secondary: *"Discard"* (only when safe — explicit tap, with a confirm). Critical for trust: she must never feel she's talked into the void.

4. **Offline mode (cached-read only).** Not strictly an error — a degraded state. When the device is offline, she can still see the last-cached Journey and Home feed (read-only), but the check-in, intake tap, and Journey "+" capture are disabled with a visible *"You're offline — logging resumes when you reconnect"* ribbon. No destructive actions are attempted offline. Re-sync happens automatically when connectivity returns.

5. **Empty Journey (first-run / no entries yet).** Not an error — a soft empty state shown when Sonakshi opens Journey and has zero logged events. Same template: illustration + title (*"Your journey starts today."*) + body explaining what will fill this space (check-ins, intake taps, flare-ups, doctor visits) + primary CTA (*"Start today's check-in"* → jumps to Home). This is also the template reused for individual empty tabs inside Journey (Memory with no entries, Doctor Report with no data yet, Patterns with too little history).

**State transitions to flag.**
- Connection error and Offline mode are closely related but distinct: connection error is a *failed action*, offline mode is an *ambient state*. They use the same illustration family but different copy.
- Save-failed events log a local retry queue — when connectivity returns, pending writes flush automatically. Sonakshi sees a brief *"Synced — 2 entries saved"* toast, not another screen.
- Permission-denied (mic, notifications) is handled as a variant of the Voice transcription failed screen for mic, and as a soft inline nudge for notifications (not a blocking screen — notifications are optional).

**Still TBD for edge cases:**
- Exact copy for each screen (awaiting language/copy pass post-scoping).
- Illustration style direction — to be locked with the Brand direction pass.
- Whether Sakhi's voice/personality shows up in error copy, or whether error screens are deliberately flat and factual. Likely a warm-but-brief middle ground.
- Specific retry/backoff strategy (how many auto-retries before surfacing the error screen).
- Behavior on sustained outage — does Sakhi show a status-page style message if Convex or the transcription service is down platform-wide?

## MVP scope

The MVP is organized around **four pillar surfaces**, mapping 1:1 to the bottom nav (Home / Medications / Journey / Community / Settings). Settings is plumbing, not a pillar.

### Pillar 1 — Home: daily voice check-in

**Voice-to-voice interaction.** Sonakshi has a voice conversation with the AI agent launched from Home about:

- How she is **feeling**
- Her **health metrics**
- What she has **eaten**
- Her **environment and food**
- Her **emotions** and **physical wellbeing**

She can also tap the **dosage intake reminder** on Home to log a dose without starting a conversation. Home is where check-ins begin; the Memory of past conversations lives in Journey.

### Pillar 2 — Medications: regimen + intake tracking

One-time regimen setup (voice-first, then editable), ongoing dosage-change capture, and daily intake logged as first-class events. Captures across three categories surfaced by every check-in:

1. **Dosage** — medications, dosage changes, and intake events (daily tablets through monthly biologics)
2. **Emotional** — how she is feeling emotionally
3. **Physical** — how she is feeling physically

### Pillar 3 — Journey: the "looking back" surface

The aggregated record where the **Doctor Report**, the **Memory**, **Whoop-style patterns**, **flare-up history**, and **doctor-visit timeline** all live together. See § Journey module. This is how Sakhi delivers on *"your next doctor visit starts with data, not memory."*

### Pillar 4 — Community: condition-based channels

A Slack-style channel space (see § Community module) where users create channels around their autoimmune condition, share news, educate each other, and connect with people who live with the same disease. In MVP because "you are not alone" is a core emotional outcome Sakhi is meant to deliver, not just patient-to-doctor data.

### What's deliberately minimal inside each pillar

Theme 4 analytics, projections, and causal-inference live inside Journey only as the **minimum needed to prove the loop works** — the dynamic chart, the flare-up ↔ medication-change correlation, and the auto-generated Doctor Report. The full pattern/projection engine (forward-looking predictions, trigger detection, multi-variable inference) is explicitly post-MVP.

## Out of scope

<!-- To be filled in as MVP scope gets tighter. Early candidates from Themes we are de-prioritizing:
- Full cohort/peer comparison analytics
- ~~Community / networking features~~ — **moved INTO MVP as 5th module** (see § Community module)
- Doctor-facing portal
- Support-system shared view (read-only)
- Triggers map (food/allergen correlation engine)
- Education for peers/family
- Advanced pattern recognition + causal inference
- Projections model
-->


---

## Open questions (tracking)

1. ~~Replacement term for "caregiving"~~ — **answered (2026-04-24).** **"Support system."** This is the word Sonakshi uses for the concept. Aligns with the already-locked language-conventions table (§ Language conventions) — *"support system"* and *"support-system member"* are the canonical terms across all in-product copy and docs, replacing *caregiver* / *squad* / Kinery-adjacent vocabulary.
2. ~~Objectives taught on onboarding screens 4 and 5~~ — **answered (2026-04-24).** Two screens: **Screen 4 — Voice check-in** (activation), **Screen 5 — Memory + Patterns** (retention payoff). Sakhi speaks first-person throughout. Copy locked in § Onboarding Screens 4 and 5.
3. ~~Exact onboarding copy for each screen~~ — **deferred (2026-04-24).** Screens 1–3 verbatim copy rolls into the landing-page copy pass (single writing session covering both surfaces). Screens 4 and 5 already locked in § Onboarding Screens 4 and 5.
4. ~~Medical condition dropdown source + cardinality~~ — **answered (2026-04-24).** Source: **AARDA** (American Autoimmune Related Diseases Association) master list — publicly maintained, 100+ conditions. Cardinality: **single-select for MVP.** Schema stores `conditions: string[]` from day one so multi-select (post-MVP backlog #18) is a UI-only change later. See § Setup Part B → Screen B.4.
5. ~~Searchable dropdown?~~ — **answered (2026-04-24).** Yes — searchable type-ahead input (client-side filter over the AARDA list). See § Setup Part B → Screen B.4.
6. ~~Voice-first architecture~~ — **answered (2026-04-24).** **MVP = web app (Next.js 16, mobile-first, installable as a PWA)** with browser-based voice (Web Speech API fallback, OpenAI Realtime / Vapi as primary, behind a provider interface). **Post-MVP = native iOS + Android apps** wrapping the same Convex backend and voice provider. See ADR-017.
7. ~~"Group-based analytics" on the home dashboard~~ — **answered.** Aggregated self-view, Whoop-style (rings / recovery score / stacked metric timelines). Not cohort comparison.
8. ~~After the voice check-in ends~~ — **answered.** She sees a summary card with captured notes + a "save to Memory" prompt + a nudge/reassurance. See § After the voice conversation ends.
10. ~~Edit / decline flow on the summary card~~ — **answered (2026-04-24).** Inline edit on the summary card before saving (tap a metric → edit). On **decline**: discard with a confirm dialog (*"Discard this one? Nothing will be saved."*) — no draft state, no "unconfirmed" save, nothing persisted. Explicitly one of two terminal states (save or discard) to keep the Memory surface truthful — no half-states. See § After the voice conversation ends — summary card.
11. ~~Examples of nudges / reassurances~~ — **answered (2026-04-24).** 12-line bank locked for non-check-in moments (intake tap, visit capture, report generation, returns after silence, empty states, missed intake, flare flag, network-retry sync). Check-in closers remain separate — 7 variants locked in § The closer. See § Nudge bank — non-check-in moments.
12. ~~Memory UI~~ — **answered (2026-04-24).** Horizontal calendar strip + filter tabs + reverse-chronological scroll + keyword search over free-flow bonus-capture text + tap-to-detail sheet with Edit / Delete (following § Edit/cancel rules). Full spec in § Memory landing — visual + structural spec.
13. ~~Milestone list finalization~~ — **answered (2026-04-24).** Milestones fire at **Day 1 / 7 / 30 / 90 / 180 / 365.** Visualization = Whoop-style rings filling up (scaled to the milestone — 7 rings at day 7, 30 at day 30, etc.), ≤2s animation, the paired streak-milestone closer line rendered above (*"Seven days. That's real."*), single *"Keep going"* CTA back to Home. No daily celebrations on non-milestone days — keeps milestones meaningful and avoids gamification fatigue. See § Milestone celebration inside § After save.
14. ~~Whoop-style visualization~~ — **answered (2026-04-24).** Three chart types ship in MVP: **wellness ring**, **30-day streak bar**, and **multi-metric stacked line with dose-change markers + flare shaded blocks.** The flare ↔ dosage correlation chart (the analytical version with annotation callouts), sleep/HRV overlays, and heatmaps are all deferred. See § Whoop-style charts — MVP set.
9. ~~MVP scope reality check~~ — **answered.** MVP = voice-to-voice check-in (feelings, metrics, food, environment, emotions, physical) + tracking in 3 categories (dosage, emotional, physical) + Community module (5th module, Slack-style condition channels). See "MVP scope" and "Community module" sections.
15. ~~Community — channel creation permissions~~ — **answered (2026-04-24).** No user-created channels in MVP. Channels are **auto-created from the AARDA condition list** at app launch. Removes the empty-room problem and a whole moderation surface. See § MVP Community shell — locked mechanics.
16. ~~Community — discovery + joining~~ — **answered (2026-04-24).** Auto-join to the channel matching the condition selected in Setup B.4; related conditions surfaced on first entry; full AARDA list browsable/searchable via "Browse all conditions." One-tap join/leave, no approval flow. See § MVP Community shell.
17. ~~Community — content types supported~~ — **answered (2026-04-24).** **Text only for MVP.** No images, links-as-cards, polls, long-form posts, or attachments. Link auto-hyperlinking is fine; unfurling / preview cards are not. Image moderation + URL-safety scanning deferred to post-MVP. See § MVP Community shell.
18. ~~Community — news sharing mechanic~~ — **answered (2026-04-24).** No news-sharing mechanic in MVP — no curated feed, no AI-summarized digests, no user-posted link cards. Channels are peer conversation only. News ships post-MVP once a source-trust + moderation model exists. See § MVP Community shell.
19. ~~Community — identity model~~ — **answered (2026-04-24).** **Pseudonym by default.** User picks a handle on first Community entry (default suggestion generated, e.g. *"BrightFern-7"*). No real name, no avatar upload, no bio. Initials chip derives from the handle. See § MVP Community shell.
20. ~~Community — moderation model~~ — **answered (2026-04-24).** **Rewant as sole admin for MVP.** Every message has a Report button; reports land in a single admin queue Rewant reviews. Admin actions: hide message, remove from channel, global suspend. No community moderators, no automated toxicity filters, no appeals flow. Explicitly interim — scales only to waitlist-sized user base. See § MVP Community shell.
21. ~~Community — privacy boundary vs Memory~~ — **answered (2026-04-24).** Hard invariant: Community NEVER auto-surfaces private check-in / Memory / event data. Enforced at the data layer (Community has no read access to check-in tables; it is its own data surface). Users can voluntarily type anything into a Community message; app-driven auto-share paths are zero. See § MVP Community shell.
