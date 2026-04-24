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

## Related files
- `miro-export/` — source PDFs (6 board exports)
- `seed-entries.md` — 18 fictional daily entries derived from this research, for prototyping
