# Autoimmune Health Companion — Scoping Document

> Written by Rewant. Claude transcribes only. Following the AI Weekender Builder Handbook.

---

## Language conventions

Two terms are explicitly off-limits in app copy — both need warmer, more patient-friendly replacements. Placeholders used in this doc until Rewant picks final wording:

| Avoid | Reason | Placeholder | Candidate replacements |
|---|---|---|---|
| **"caregiving" / "caregiver"** | too clinical / implies dependence | `[TERM]` | companionship, wellbeing support, health companion, self-care |
| **"[LOG]"** | too technical / legal-sounding | `[LOG]` | wellness journal, health timeline, my journey, companion notebook, daily diary, my memory |

Rewant picks final terms; I will find-and-replace across this doc and all app copy.

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

Her reality (from the Miro research — see `research/miro-export/`):
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
Framing: *"A digital assistant for your [TERM] journey — designed to ensure you are receiving the appropriate support in your journey."*

### Onboarding Screen 3
Framing: *"You take command of your own life."* Positions the app as a conversational assistant that makes this easier.

### Onboarding Screens 4 (and possibly 5)
Each entails one objective the app provides. *(Specific objectives TBD — see open questions.)*

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
- **Screen B.4:** Ask for the user's **medical condition**. Single dropdown; Sonakshi selects the autoimmune disease she lives with.
  - **Dropdown source:** a public health library of autoimmune diseases — preferably a US / Western-American public reference list.
  - Most likely candidate: **[AARDA](https://autoimmune.org/disease-information/) (American Autoimmune Related Diseases Association)** — maintains a publicly published list of 100+ autoimmune diseases.
  - Alternate candidate: **NIH NIAMS** list. **Rewant to confirm source before we import the list.**

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

Always visible at the bottom of every in-app screen (not during onboarding/setup). Horizontal, left to right, four modules:

1. **Home**
2. **Medications** *(module name TBD — "Medications" / "Dosage" / other; Rewant's call)*
3. **Check-in** *(likely the `[LOG]` — past check-ins history; needs confirmation)*
4. **Settings**

## Home page (first and subsequent visits)

**Top to bottom:**

1. **Greeting** — *"Welcome, Sonakshi"* (first name, personalized).
2. **Daily check-in prompt** — a CTA asking her to start today's check-in (voice-first interaction).
3. **[First-time / not-yet-set-up nudge] — set up your medications** — a CTA placed *above* the metric visualization and *below* the check-in prompt, urging her to open the Medications module and enter her regimen. This nudge appears only until she has completed the one-time medication setup; after that it hides.
4. **Overall health metrics** — Whoop-style aggregated self-view (rings, streak bars, stacked metric timelines — specific chart types TBD, see open question #14).
5. **Persistent mic-icon CTA** — always-visible floating button for on-demand voice conversation anytime, anywhere in the app.
6. **Bottom menu bar** (Home / Medications / Check-in / Settings).

### Daily check-in — voice conversation

When she taps the check-in CTA, the AI agent has a voice-based conversation with her. The AI asks about:

- How she is **feeling** today
- What is on her **mind**
- What she has **lined up for the day**
- Her **pain scale** and measurements *(this is not just a number in isolation — it feeds the Communication theme; see Theme 1)*

She can answer by voice, or supplement with a numeric scale / text.

### After the voice conversation ends — summary card

When the AI wraps up the conversation, Sonakshi sees a **quick summary card** with three elements:

1. **Captured notes** — a concise, structured recap of what she said during the conversation (pain, dosage, mood, food, environment, anything else she brought up).
2. **Save-to-audit-log confirmation** — a prompt asking her: *"Good to save these to your [LOG]?"* She confirms (or presumably declines / edits — flagged as open question).
3. **Nudge or reassurance** — every interaction ends with one. *Examples TBD — open question.* This is a fixed element of every check-in, not optional.

**New concept introduced here: the `[LOG]`.** This is where every confirmed daily check-in is stored. Sonakshi can revisit prior entries from the `[LOG]`. *(Full `[LOG]` UI is a downstream question.)*

### After save — celebration + return to home

When Sonakshi taps **"Save"** on the summary card, the sequence is:

1. **Save confirmed.** Captured notes are written to the `[LOG]`.
2. **Nudge / reassurance shown.** (Per the conversation design principles — affirm effort, not outcomes.)
3. **Milestone celebration, if applicable** — a congratulatory visualization shown before returning to home. Triggered on:
   - **Day 1:** first-ever check-in (first-time user logs into logging data)
   - **Day 7:** one-week streak
   - **Day 30:** one-month streak
   - Intermediate milestones (e.g. 90 days, 180 days) with incremental logic
   - Up to **Day 365:** one-year streak
   Each milestone gets its own nudge or **"visualization of a mission"** — something that feels like progress in a meaningful way, not just a number.
4. **Return to the home screen.** Home now shows:
   - Updated **metric visualizations** of all her data — styled in the vein of **Whoop's health data representation** (rings / recovery score / stacked metric timelines). *This is the "group-based analytics and data metrics" reference from earlier — interpreted as aggregated self-view over time, Whoop-style, NOT cohort comparison.*
   - A **persistent mic-icon CTA** — always visible, always tappable, so Sonakshi can start another voice conversation on demand whenever she wants.

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

### Daily adherence (captured during voice check-in, not in this module)
The Medications module shows today's adherence status, but the actual "did you take them today" input comes from the check-in conversation — not from this screen.

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

The app keeps a running record of the patient's illness for the patient herself, the doctor, and the [TERM]. Built for the reality that symptoms fluctuate day-to-day.

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

<!-- -->

### Edge cases

<!-- -->

## MVP scope (what we build this weekend)

**Primary focus — voice-to-voice interaction.** The core MVP is Sonakshi having a voice conversation with the AI agent about:

- How she is **feeling**
- Her **health metrics**
- What she has **eaten**
- Her **environment and food**
- Her **emotions** and **physical wellbeing**

**Followed by — tracking across three categories:**

1. **Dosage** — her medications and any dosage changes
2. **Emotional** — how she is feeling emotionally
3. **Physical** — how she is feeling physically

These two pieces — voice check-in + tracking in three categories — define the MVP surface. Analytics, visualizations, projections (Theme 4) live *inside* the MVP only as whatever minimum is needed to prove the loop works; the full pattern/projection engine is explicitly post-MVP.

## Out of scope (explicitly not building this weekend)

<!-- To be filled in as MVP scope gets tighter. Early candidates from Themes we are de-prioritizing:
- Full cohort/peer comparison analytics
- Community / networking features
- Doctor-facing portal
- Caregiver / family shared view
- Triggers map (food/allergen correlation engine)
- Education for peers/family
- Advanced pattern recognition + causal inference
- Projections model
-->


---

## Open questions (tracking)

1. **Replacement term for "caregiving"** — what word does Sonakshi use for this concept? Options to consider: *self-management, self-care, health journey, wellbeing, companionship, support.* **Rewant to pick.**
2. What are the specific objectives taught on onboarding screens 4 and 5? (e.g. daily check-in, symptom tracking, medication log, doctor report, community.)
3. Exact onboarding copy for each screen (verbatim language, not paraphrase).
4. **Medical condition dropdown source** — confirm AARDA vs. NIH NIAMS vs. another public list. Also: is this a single-select or multi-select (some users have multiple autoimmune conditions)?
5. Is the medical condition dropdown **searchable** (100+ items is long to scroll) or a plain dropdown?
6. **Voice-first architecture** — is the app web (Next.js per handbook stack, browser-based voice via Web Speech / OpenAI Realtime / Vapi) or native mobile? Voice-first is easier on mobile but the handbook stack is web. Needs a decision before POC.
7. ~~"Group-based analytics" on the home dashboard~~ — **answered.** Aggregated self-view, Whoop-style (rings / recovery score / stacked metric timelines). Not cohort comparison.
8. ~~After the voice check-in ends~~ — **answered.** She sees a summary card with captured notes + a "save to [LOG]" prompt + a nudge/reassurance. See § After the voice conversation ends.
10. **Edit / decline flow on the summary card** — if the AI's captured notes are wrong, can Sonakshi edit before saving? If she declines to save, what happens to the conversation — discarded, drafted, or saved as "unconfirmed"?
11. **Examples of nudges / reassurances** — every interaction ends with one. What's the bank? (e.g. *"You've shown up 3 days straight — that matters."* / *"Rest is part of the work."*) Should this vary with mood, streak, content of that day's check-in?
12. **`[LOG]` UI** — what does Sonakshi see when she opens the `[LOG]`? Chronological list? Searchable? Filter by symptom / mood / date range? How does she navigate there from home?
13. **Milestone list finalization** — beyond Day 1 / 7 / 30 / 365, what intermediate days fire a celebration? (e.g. 14, 60, 90, 180.) What does a "mission" visualization look like — animation? Badge? Message?
14. **Whoop-style visualization** — which specific chart types make sense for autoimmune data? Recovery ring (daily wellness score), streak bars, multi-metric stacked line, sleep/mood correlation heat-map? Needs a research pass.
9. ~~Scope-vs-weekend reality check~~ — **answered.** MVP = voice-to-voice check-in (feelings, metrics, food, environment, emotions, physical) + tracking in 3 categories (dosage, emotional, physical). See "MVP scope" section.
