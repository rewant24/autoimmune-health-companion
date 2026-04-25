# Sonakshi Lele Interview — Blue Sky Ideation synthesis

**Source:** Miro board titled "Blue Sky Ideation - Lele", exported as 6 PDFs into `miro-export/`. Interview subject: **Sonakshi Lele** (autoimmune patient; arthritis + allergy; on immunosuppressants, post-switch to biologic injectibles).

**Status:** Day-0 primary research (2026-04-23). This is the authoritative "what did the user say" reference until more interviews are added. The scoping doc and MVP should trace back to these insights.

---

## 1. Patient profile (inferred from board)

- Chronic autoimmune condition — arthritis signals + allergy correlation
- Medication path: 1–4 month onset before relief (3 months typical); dosage titration over ~3 months (e.g. 10 → 15 → 20 → 25 mg); after ~1 year switched to **injectibles** and continues variating in a loop of "change → check impact → check reports"
- Cadence: **blood tests every 2 weeks**; **doctor follow-ups every 3 months** after normalization
- Started therapy **6–8 months after diagnosis**; post-antidepressants does ~monthly check-ins; next therapy session typically scheduled right after the prior one as followup

---

## 2. Life categories she tracks or manages (board mind-map)

### Medication (three buckets)
1. **Maintenance** — arthritis-focused medications / immunosuppressants (the IV file is urgency-sensitive, number is concerning)
2. **SOS** — steroids and painkillers for symptom management; NSAIDs, allergic reactions
3. **Side effects + supplements** — nausea, anti-depressants (fairly regular), supplements to remove toxins from the bloodstream
- **Delivery modes:** at-home injectables/orals vs IV-based (requires hospitalization + in-person administration)

### Body checkups
- Frequent blood tests enable impact assessment
- Initially during medication trial: temperature mapping + allergic reactions
- Keeping track of **weights as medication impact** (managing symptoms — weight fat in joints)
- New symptoms appearing every now and then
- Side effect ↔ symptoms (confusable)

### Physical health
- Daily exercise as part of well-being
- Personal hygiene can be mentally demanding ("breakfast to the shower")

### Mental health
- Blood tests as a **key factor in alleviation** — correlation between being stressed and physical symptoms; noticeable pretty soon via body symptoms
- **Coping:** meditation workshops, yoga; support groups (Washington-based, shared experience but different locations); **hard to find focus groups — India-specific — when done via Google search**
- Wake up and have things to do ("not to think of pain all the time")
- Having a lot of tasks to motivate, structure and figure out things to do
- Deterimental in thinking about pending work → causes rescheduling of tasks
- **Feeling of helplessness, shame, loss of identity**; frustration + imposter syndrome (comparing with peers)
- **Lack of empathy** in understanding chronic fatigue, feelings, emotions
- **Hard to explain the limited mental capacity**
- **Spoon theory** for chronic illness is a referenced mental model
- Seeking therapy has helped

### Diet
- Ensure eating food that does not impact the symptoms for both arthritis AND allergens
- Quinoa great for arthritis **but** allergic — trial-and-error in defining, documentation, memorization

### Other indulgences (coping)
- Follow other IG / content creators
- Dark reels / dark humor content — to take it as-is at the moment, feel better
- Harder to control emotions to even consume content

---

## 3. INSIGHTS (pink notes — the board's explicit "insights" section)

- Onset to relief: **1–4 months on average; 3 months in case**, until then no relief
- **Blood tests every 2 weeks**
- **3-month doctor follow-ups** after normalization
- **Dosage change over ~3 months** (10 → 15 → 20 → 25 mg pattern)
- After 1 year → switch to injectibles → **keep variating — loop on check impact and reports**
- **Medical gaslighting:** different interpretations by different doctors impact individual mindset
- Auto-immune correlates with BOTH mental and physical health; there's a **history of emotions and psychological** component
- **Emotions repression** as a pattern
- Auto-immune direct correlation to allergy — **very visible symptoms**
- Medication, dosage and mood move together
- Progress emerges as **trends over time** on how the personal journey has fared
- What's needed: **qualitative analysis of subjective data, especially pain parameters**

---

## 4. PATIENT COMMENTS (yellow — her own words)

- "All things are dynamic in health wellbeing"
- "Even progress is dynamic"
- "Hard to simplify / condense the emotions or progress to other people on current state"
- "Specifically with the doctors hard to explain since very dynamic"
- "Might be today, but very current state specific"
- **"Fluctuates — ups and downs — 1 step back 2 steps forward / 2 steps back but 1 day forward"**

→ The product must treat health state as **non-monotonic and time-variant**, not a score that goes up.

---

## 5. QUESTIONS DOCTORS ASK EACH TIME (green)

1. **Morning stiffness** (present / absent / severity)
2. **What is your pain killer 1–10** (subjective pain scale)

### Problems with the 1–10 pain scale
- Hard to quantify chronic pain; "8 can't be constant, harder to explain"
- **Pain scale = dysfunction** is a more accurate representation
- Patient's own rubric:
  - **Minimal** — dysfunctional in terms of task completion
  - **Mid** — pain but manage to work a couple of hours
  - **Extreme** — couldn't get out of bed

### Sonakshi's own 1–10 pain/dysfunction scale (transcribed from yellow note on themes board)
> "I've always had a hard time putting it in a number. Have come up with a more subjective system based on my normal activities during the day — normal meaning activities during chronic illness, not the pre-illness routine."

- **1** — can do normal/ill activities without painkiller, but require rest
- **2–3** — noticing avoidance of certain activities (stairs, cooking, typing too much), can manage without painkiller
- **4–5** — thinking of taking painkiller but can carry on with basic tasks; need more rest, nap, or may not take a pill
- **6–7** — not able to do many basic tasks either; will take painkiller; can do some work cautiously; feeling drained by the effort
- **8–9** — pain is absolutely front and center; not able to think about much else despite painkiller; using distractions to cope
- **10** — immobilized with pain despite painkiller; distractions aren't helping either

### Derived design requirements
- **Medication ↔ subjective pain-scale visualization**
- **Symptoms ↔ medication visualization correlation** (if not pain-scale, then allergy)
- "Not just data backlog management — also **insights and analytics**"
- Better doctor-check-in questions: *"How acutely do you feel the chronic pain right now?"* and *"How incapable / incapacitated do you feel today?"*
- Rules of thumb Sonakshi uses: **<6 routine work possible; 6 means bed; 8 means painkillers**
- "All really depends on the planned / unplanned routine / schedule / activities" — dysfunction is context-relative

---

## 6. PATIENT PERSONAL GOALS (orange/teal)

- **Gamify tracking** — not just writing or documenting
- **Instant positive feedback / dopamine feedback loop**
- **Centralized place** for tracking progress
- **One-stop shop** for all reports, progress, trackers
- **Making tracking more accessible, easier, not mundane, and less brain space** ← the pink "must-not" — tracking must not add cognitive load

→ Design imperative: **zero-to-low cognitive cost journaling**, with a reward loop. Anything that feels like homework loses.

---

## 7. THEMES → HMW opportunities (purple — the synthesis board)

| # | Theme | HMW |
|---|---|---|
| 1 | **Dosage administration + management + tracking** | HMW simplify and make it easier to stay on top of medication routine + adherence + the dynamic changes in dosage/frequency/other parameters as prescribed |
| 2 | **Symptom tracking** | HMW simplify staying on track with fluctuations in symptoms, keeping a record for patient, doctor and support system |
| 3 | **Big-picture tracking over time** (years, meds, fluctuations, multiple datasets; analytics on projections) | HMW create multiple visualizations of gathered data (dosage / symptoms / mental+physical wellbeing / food / environment) over a timeframe • HMW determine patterns, causation/correlation between symptoms and medication/other parameters → **north-star: projections** • HMW empower patient with projections using data analytics based on existing health + medication patterns |
| 4 | **Communication** — explaining to doctors, family, peers | HMW make subjective experience of chronic symptoms a more quantifiable metric, easily communicated to doctors • HMW sensitize + create awareness on chronic illnesses for peers/support system, empower them to support patient's betterment |
| 5 | **Peer/family/friend sharing** of emotional+physical data metrics | (Leverages the pain scale — connects to Communication theme) |
| 6 | **Food + other aspects of health impacting symptoms/flareups** | HMW track and map triggers — allergic responses, sensitivities, food maps, degree of intensity of flareups |
| 7 | **General wellbeing tracking** (non-medication: physical/mental/other/food) | HMW enable patients to create + maintain a schedule of activities that benefit them — reminders/nudges/check-ins + progress over time |
| 8 | **Daily/weekly/monthly task sheet + reminders + scheduler** | (Feeds theme 7) |
| 9 | **Education** — not just for self, for peers/family/friends | HMW enable patients to track non-medicine parameters (sleep quality, food intake, mental health, physical health) and find correlations • HMW help patients + support system educate themselves on specific chronic illnesses, common experiences, what to expect |
| 10 | **Future repercussions of medication** — willingness to being informed | (Feeds theme 9) |
| 11 | **Community** — specifically India, around chronic illness (reduce loneliness + emotional support + networking + access) | HMW create a community for patients to tackle loneliness + a network for illness/disability-friendly support and opportunities |
| 12 | **Centralized report repository for comparison** | HMW make gathered data accessible for visualization/comparison across any parameter the user wishes, to view progression |
| 13 | **Positive reaffirmation of things well-done** | HMW make tracking + staying on top of the illness a **more positive experience, less of a chore** |

---

## 8. Signals for MVP scope

Clusters that appear across *multiple* sections (patient words + insights + themes) and are therefore strongest MVP candidates:

1. **Low-friction daily journaling** — symptoms + medication + the "dysfunction-based" 1–10 — designed so it doesn't feel like work (patient goal + theme 13)
2. **Medication ↔ symptom correlation visualization over time** — the core "insights and analytics" ask (doctor-question bucket + theme 3 + theme 12)
3. **Doctor-ready summary / shareable view** — translates subjective fluctuation into something doctors can consume in 3-month follow-ups (theme 4 + patient comment "hard to explain to doctors")
4. **Reminder / scheduler for meds + wellbeing activities** (theme 7–8)

Likely **out of MVP** but belong in `post-mvp-backlog.md` with architectural hooks: community (theme 11), education library (theme 9–10), support-system sharing surfaces (theme 5), projections/predictive analytics (theme 3 north-star), food/trigger mapping (theme 6).

---

## 9. Language anchors from the patient (use in product copy)

- **"Dysfunction"** as the reframe of pain — copy should say *"How functional are you today?"* not *"Rate your pain 1–10"*
- **"Spoon theory"** — she references it; the product can credibly use spoon-language if done respectfully
- **"Dynamic"** — she used this word 4+ times. The product should *acknowledge* fluctuation, not hide it.
- Never **"caregiver" / "squad"** — use **"support system"**

---

## 10. What this research does NOT tell us (gaps for future interviews)

- N = 1. All of this is Sonakshi. Don't generalize to "autoimmune patients" without more interviews.
- No data on payment willingness, price sensitivity, or competitive tool usage
- No screenshots of what she currently uses (notes app? paper journal? nothing?)
- No view into her doctor's side — what would make the shared summary actually useful
- No disability/accessibility insights beyond "mental capacity limited"

---

## 11. Founder follow-up — Sonakshi on the overall app approach (2026-04-25)

**Source:** message from Sonakshi to Rewant in response to a "what do you think of where the app is going" prompt. Verbatim below — preserve as the patient's voice on positioning.

> "I'll ask Nikhil about the doctor viewpoint. From what I know it helps them to have lab report tracking over the months — so quantitative analysis right in front of them is beneficial — like knowing if CRP is increasing/decreasing over a period of a year with the new medication is something they'd definitely want — they usually manually go through previous reports to check for me.
>
> However, my experience has been that for qualitative stuff, they prefer hearing what the patient has to say rather than read a report on it. But that's a prob because patients don't remember everything they want to discuss, so this gives talking points to the patient so they can be better equipped during consultation.
>
> The app is ideally providing me with context and correlation, without drawing conclusions (that is the doctor's job).
>
> I may be allergic to chola / I feel better when I am avoiding fried food is amaze information to have for quality of life, but is not medically relevant enough to discuss with the doctor in a 20 minute consult. And when quality of life is severely depleted, day to day data about how I'm feeling vs what I'm doing to feel it matters a lot.
>
> So correlations are vital for quality of life even if medically irrelevant for doctor. My advice would be to not go into the space of diagnosing/recommending tests because it can get very vast and murky.
>
> The day to day is the hardest aspect and the app right now makes that a little easier and that's fantastic. I don't need more medical advice. I need more positive reinforcement through seeing a picture of what works for me but I don't have the tools to make that picture on my own yet."

### 11.1 Four takeaways

**A. Doctor viewpoint — quantitative > qualitative (pending Nikhil confirmation).** Doctors want **lab-trend tracking over months/years** (e.g. CRP across a year on a new medication). They currently flip through prior reports manually. Qualitative narrative they prefer to *hear from the patient*, not read.

**B. The app's role for qualitative is talking points, not narrative.** Patients forget what to bring up in a 20-minute consult. The app's qualitative output is the **patient's prep deck** — not a report the doctor reads cover-to-cover.

**C. Hard positioning lock — context and correlation, NOT conclusions.** Stay out of diagnosing and recommending tests ("vast and murky" — the doctor's job). Patient-side correlations are valid even when medically irrelevant ("I may be allergic to chola"; "I feel better avoiding fried food") — those are quality-of-life wins, not clinical signals.

**D. Validation of the day-to-day premise.** "The app right now makes [day-to-day] a little easier and that's fantastic. I don't need more medical advice. I need more positive reinforcement through seeing a picture of what works for me but I don't have the tools to make that picture on my own yet." → Confirms the low-friction journaling + correlation-surfacing direction. The product's job is **giving Sonakshi her own picture**, not advising her.

### 11.2 Coverage map against current scoping

| Takeaway | Current scoping state | Gap |
|---|---|---|
| **A. Lab-trend tracking is the doctor's #1 quantitative ask** | Blood-test *schedule* is a first-class event in MVP (§ Doctor-visit capture); blood-test *results* are explicitly **post-MVP** (post-mvp-backlog #3 — "Blood work results (not schedule)") | **Significant.** Sonakshi's feedback elevates lab-result tracking from "nice-to-have post-MVP" to "the most clinically valuable thing the app can give a doctor." Worth Rewant deciding: pull a thin lab-result slice into MVP (manual entry of CRP/ESR/WBC + a single timeline overlay), or hold it post-MVP and instead position MVP doctor-share around adherence + flare-vs-dose. |
| **B. Qualitative output = patient's talking points, not doctor's narrative** | Doctor Report is currently positioned as a doctor-readable artifact (PDF + cover summary + appendix — § Doctor report flow). Talking-points framing is *implicit* in the report's existence but not stated as the qualitative section's purpose | **Reframe, not rebuild.** The Doctor Report's qualitative section should be explicitly labelled "Talking points for your visit" (Sonakshi-facing), with the doctor-readable summary leaning quantitative. Small copy + structure shift, no architectural change. |
| **C. No diagnosis, no test recommendations — context + correlation only** | Strongly aligned in spirit: "Never claim causation. Only co-occurrence" (§ Feedback loop), "Witness, don't prescribe" (§ The closer), confidence rules on insight cards. But there is no top-level **product positioning principle** that says *"Saha does not diagnose or recommend tests."* | **Add as an explicit positioning lock.** The empty `## Out of scope` section (line 1142) is the natural home: lock "diagnosis" and "test recommendations" as out-of-scope for the product as a whole, not just MVP. Also worth a one-liner in § Brand direction or § Conversation design principles. |
| **D. "Picture of what works for me" is the north-star user need** | Captured in § Theme 4 (visualizations + patterns) and § Feedback loop (graduated visual-to-verbal). Aligned in substance | **Adopt as a quotable north star.** Sonakshi's exact phrase — *"a picture of what works for me but I don't have the tools to make that picture on my own yet"* — is the cleanest one-line product mission yet. Candidate for landing-page copy, founder quote replacement, or onboarding. |

### 11.3 Specific edits Rewant could make to `scoping.md`

1. **§ Out of scope (line 1142, currently empty):** add two locked items —
   - *"**Diagnosis** — Saha does not name, suggest, or rule out medical conditions. The app surfaces context and correlation; conclusions are the doctor's job."*
   - *"**Test recommendations** — Saha does not suggest blood tests, scans, specialists, or any other clinical action. Vast and murky territory; not the product's role."*
   - Source attribution: Sonakshi feedback, 2026-04-25.

2. **§ MVP focus themes / Theme 1 (Communication):** add a clarifying line — *"Doctors prefer hearing qualitative content from the patient directly. The qualitative output of this app is therefore framed as the **patient's talking points** for the consult — not a narrative for the doctor to read. The doctor-readable surface is the quantitative one (adherence, dose-change timeline, flare ↔ dose correlation, lab trends if available)."*

3. **§ Doctor report flow:** rename the qualitative section heading inside the report to *"Talking points for your visit"* (patient-facing), and keep the quantitative cover/summary as the doctor-readable layer.

4. **Lab-result tracking — Rewant's call.** Either:
   - **(a) Pull a thin slice into MVP:** manual entry of 3–5 standard markers (CRP, ESR, WBC, optionally LFT/KFT) per blood-test event + a single timeline overlay on Patterns. No PDF parsing, no OCR. Roughly 1 chunk of build work. Strongest doctor-value-add per Sonakshi.
   - **(b) Hold post-MVP** as currently scoped — accept that MVP doctor-share leans on adherence + dysfunction trend + flare/dose correlation, with lab trends arriving in v1.x.
   Either way, log the decision against post-mvp-backlog #3.

5. **§ Landing-page copy locks (line 29):** consider a candidate alternate ROI anchor sourced from Sonakshi's own words —
   *"You shouldn't have to be your own pattern detective. Saha gives you a picture of what works for you."*
   (Rewant's call vs. the current "logbook" anchor. Sonakshi-sourced quotes are stronger than founder-voiced ones for the social-proof slot.)

### 11.4 What this feedback does NOT settle

- Doctor side is still N=0 from the doctor's mouth. Sonakshi will ask Nikhil. Treat takeaway A as a hypothesis from the patient's vantage point until Nikhil corroborates.
- "Pull lab results into MVP yes/no" is a scope decision Rewant must make — the research only says it's clinically valuable, not that it's MVP-mandatory.

---

## Related files
- `miro-export/` — source PDFs (6 board exports)
- `seed-entries.md` — 18 fictional daily entries derived from this research, for prototyping
