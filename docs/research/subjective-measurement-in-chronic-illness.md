# Subjective Measurement in Chronic Illness — why "what's a 3 for me?" is broken, and what the evidence says works

**Document type:** Research brief. Externally shareable.
**Audience:** investors, co-creators, clinician advisors, prospective team members, users asking "why are you doing it this way?"
**Date:** 2026-04-25
**Last research pass:** 2026-04-25

---

## Why this document exists

During our foundational user interview (see `sonakshi-lele-interview.md`), Sonakshi — an autoimmune patient on immunosuppressants — named a problem that most trackers pretend isn't there:

> "I've always had a hard time putting it in a number. I've come up with a more subjective system based on my normal activities during the day — normal meaning activities during chronic illness, not the pre-illness routine."

She was describing the failure of the standard 1–10 pain scale (the Numeric Rating Scale, or NRS) for chronic illness. She wasn't alone. The same complaint shows up in the clinical literature going back twenty years, and it has driven the development of several validated alternatives that almost no consumer app has implemented.

This brief is the evidence base behind our product's choice to **not use a generic 1–10 for pain or mood**, and to use a function-first, patient-anchored approach instead.

---

## The core problem, in one sentence

Asking a chronic-illness patient to rate their pain 0–10 assumes a stable reference point that doesn't exist for them. The number they return is a reconstruction, not a measurement — and the reconstruction is biased in predictable, well-documented ways.

---

## The five failure modes

The clinical literature, taken together, describes five distinct ways self-rating scales break in chronic illness. Each has a different mechanism, and each needs a different fix.

### 1. No personal reference point

The NRS was designed for **acute** pain — post-surgical, injury-related — where "0 = no pain" and "10 = worst imaginable" are anchors the patient has recently experienced. In chronic illness, there is no "0." A patient hasn't been at 0 in months or years; their memory of "worst imaginable" is distorted by having actually lived near it.

A controlled study in *The Clinical Journal of Pain* (2019) found that adding verbal anchors to the NRS **changes reported pain intensity in chronic pain patients but not in acute**, confirming that chronic patients are actively reconstructing what the numbers mean each time they're asked.

### 2. Recall bias inflates scores

When patients rate "average pain over the last week" (how most clinics ask), they systematically report **higher** values than they do when sampled in the moment via smartphone. Ecological momentary assessment (EMA) studies in chronic low back pain and cancer pain consistently show that recalled pain overshoots momentary pain. Memory compresses experience toward peaks and endings — a well-known cognitive distortion called the peak-end rule (Kahneman).

The implication: every clinic visit where the patient is asked "how's your pain been?" is structurally biased upward.

### 3. Anchor drift (response shift)

As chronic illness settles in, the patient's internal scale **recalibrates**. What was a "7" a year ago is a "4" today — not because the pain is less, but because the scale has shifted. Patient-reported outcome research calls this "response shift." It makes longitudinal tracking with a raw NRS unreliable: a flat line on the chart can hide real deterioration, and a falling line can mask a patient's accommodation rather than actual improvement.

### 4. Context collapse into a single number

A single intensity number conflates **intensity, function, mood, fatigue, and context**. Focus groups of chronic back pain patients told researchers the NRS "fails to capture the complexity and idiosyncratic nature of the pain experience or improvements due to symptom fluctuations." Sonakshi put it more directly: *"8 can't be constant, harder to explain."*

This is why PEG, PROMIS Pain Interference, and the Brief Pain Inventory all split intensity from interference — because a person at intensity 5 but functional 90% has a very different life from a person at intensity 5 but functional 20%.

### 5. Inter-personal incomparability

Even if a given patient's scale is internally stable, it is **not comparable across people** — including to their doctor. Harvard political scientist Gary King developed an entire methodology for this called **anchoring vignettes**: respondents rate hypothetical people's days on the same scale, which calibrates how they use the numbers. The WHO's 70-country World Health Survey uses this.

The clinical consequence shows up in rheumatology as **patient-doctor discordance**. A large Brazilian RA study (*PLOS One*, 2020) found that in **one-third of visits**, patient global assessment and physician global assessment disagreed — and the disagreement is structural: patients weight pain and function, doctors weight joint counts and labs. Same number, different reference frames.

---

## What the evidence says works

### Function-first, multi-dimensional measurement

**PEG scale** (Pain intensity, interference with Enjoyment, interference with General activity) — three items, all 0–10, averaged. Two of three items measure *interference* (function), not intensity. Validated in the *Journal of General Internal Medicine* (2009) with internal consistency α = 0.73–0.89, responsive to change, outperforms single-item NRS in primary care.

**PROMIS Pain Interference Short Form 6a** — NIH-validated, measures "the extent to which pain hinders physical, mental, cognitive, emotional, recreational, and social activities." Universal rather than disease-specific. Current gold standard for modern PROMs.

Both approaches align with Sonakshi's instinct that **dysfunction is a more accurate representation than intensity**.

### Ecological momentary assessment beats retrospective recall

Smartphone-based EMA — short, in-the-moment prompts repeated 2–4 times per day — produces more reliable data than any form of retrospective recall. Test-retest reliability in chronic pain populations peaks at **4 ratings per day × 7 days (r = 0.95)**. Recall-based scores are systematically higher than EMA-based scores for the same patient over the same period.

The cost of EMA is completion rate. Apps that achieve >80% completion use prompts under 30 seconds with context-aware timing, not random pings.

### Anchoring vignettes for personal calibration

To solve inter-personal incomparability, King and colleagues showed that a short set of hypothetical day descriptions, rated by the patient on the same scale they use for themselves, allows statistical recalibration. In a consumer product context, this can be simplified: a **first-use ritual** in which the patient describes their own worst, best, and typical days in their own words — and those descriptions become the scale's labels.

### Single-item tolerability as a low-energy fallback

*JAMA Network Open* (2020) showed a single-item tolerability question — "Is your pain tolerable?" with three options — correlated better with function and treatment decisions than the NRS in chronic pain. This is a cheap fallback for low-energy days when a fuller check-in would feel like work.

### Rheumatology-specific: patient-global is mostly function + pain

Multiple RA studies show that patient global assessment (PtGA) correlates most with **function and pain interference**, not with inflammation or joint count. So a function-led tracking approach is not throwing away signal — it is capturing the signal that patients actually generate. The doctor's own assessment is what fills in the biomarker/labs side.

---

## What consumer apps have tried, and what they missed

| App | Approach | Gap |
|---|---|---|
| Spoonie Day | Spoon-theory energy unit tracking | Mood and pain still collected as generic 1–10; no personal anchor ritual |
| PaceMate | Energy pacing for ME/CFS, Long COVID | Energy-first but single-axis; no EMA cadence |
| Bearable | Fatigue and symptom tracker | Supports spoon tracking; multi-axis but relies on unanchored 1–10 |
| Tiimo | Activity-and-energy planning | Closer to PROMIS-PI philosophy, but planning-oriented, not medical |
| Manage My Pain | Clinical-grade journaling | Multi-dimensional but still NRS-based at the core |

**What no current app combines:**
1. Function-first phrasing as the primary axis (not secondary)
2. A first-run anchoring ritual that captures the patient's own vocabulary for their scale
3. EMA-style short prompts multiple times per day, with daily/weekly reflection layered on top
4. Doctor-facing outputs framed as change-from-personal-baseline, not raw scores

This combination is the core differentiation of our product's measurement layer.

---

## Design implications

The evidence maps to five product decisions:

| Failure mode | Product decision |
|---|---|
| No personal reference point | Day-1 anchoring ritual. User describes their own best, worst, and typical day in their own words (voice or text). Those descriptions become the scale's labels for the next ~90 days. Re-prompted quarterly to catch drift. |
| Recall bias | EMA-style micro check-ins — short, in-context, 2–3 times per day. Longer weekly reflection is optional. The app computes averages; the user never has to produce one. |
| Anchor drift | Store raw entries plus the anchoring snapshot. Doctor exports report function (stable) and relative change, not raw intensity trend lines. |
| Context collapse | Dysfunction-first, multi-axis. Ask "what could you do today?" separately from "how did it feel?" Derive a composite score internally only when one is needed. |
| Inter-personal incomparability | Never show raw numbers in a doctor export. Show change relative to the patient's own 30-day or 90-day baseline, with event annotations (dose change, flareup, blood test). |

---

## Open research questions

These are deliberate gaps we plan to close with further work, not hidden weaknesses:

1. **Voice vs. tap for micro check-ins.** Voice is lower-friction for a patient with joint pain but has implications for privacy, accuracy, and battery. To be validated in a Claude Chat POC before building.
2. **Re-anchoring cadence.** Literature suggests response shift can happen on 3–6 month timescales; we default to 90 days, but this should be tuned with actual users.
3. **Mood vs. pain — same approach or different?** The pain literature is strong; the mood literature is thinner and more fragmented. Our working assumption is that the same anchoring + EMA approach applies to both, but this needs validation.
4. **Cultural/language calibration in India.** Most of the evidence base is North American and European. Anchoring vignettes explicitly address cross-cultural variation, but our specific population (Indian chronic-illness patients) has not been studied at this depth.
5. **N = 1 right now.** All design decisions are anchored to one primary user (Sonakshi). Before scaling, we need 5–8 more interviews to confirm these patterns generalize.

---

## Primary sources

Clinical and methodological evidence:
- [Anchoring the Numeric Pain Scale Changes Pain Intensity Reports in Patients With Chronic But Not With Acute Pain — *Clinical Journal of Pain*, 2019](https://pubmed.ncbi.nlm.nih.gov/30328678/)
- [The utility and validity of pain intensity rating scales — *PAIN Reports*, 2018](https://journals.lww.com/painrpts/Fulltext/2018/10000/The_utility_and_validity_of_pain_intensity_rating.6.aspx)
- [Does the NRS represent the optimal tool for evaluating pain? Multicentre ED study, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10521894/)
- [Development and Initial Validation of the PEG — *Journal of General Internal Medicine*, 2009](https://pmc.ncbi.nlm.nih.gov/articles/PMC2686775/)
- [PEG Scale reference — MDCalc](https://www.mdcalc.com/calc/10405/pain-enjoyment-life-general-activity-peg-scale)
- [PROMIS Pain Interference Scoring Manual — HealthMeasures](http://www.healthmeasures.net/images/PROMIS/manuals/PROMIS_Pain_Interference_Scoring_Manual.pdf)
- [Comparative Responsiveness of PROMIS Pain Interference Short Forms — *Journal of Pain*, 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6551313/)
- [Pain Tolerability Question vs NRS for Chronic Pain — *JAMA Network Open*, 2020](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2764594)

Ecological momentary assessment:
- [Ecological Momentary Assessment methodology in chronic pain research: systematic review — *PAIN*, 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6026050/)
- [High-resolution field approaches for assessing pain: EMA, 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7737856/)
- [Smartphone-Based EMA for Low Back Pain — *Sensors*, 2022](https://www.mdpi.com/1424-8220/22/18/7095)

Anchoring vignettes and inter-personal incomparability:
- [Anchoring Vignettes Overview — Gary King, Harvard](https://gking.harvard.edu/vign)
- [Comparability of self-rated health: cross-sectional multi-country survey using anchoring vignettes — WHO World Health Survey](https://pubmed.ncbi.nlm.nih.gov/14742348/)

Rheumatology-specific discordance:
- [Discordance between patient's and physician's global assessment in RA — REAL study, *PLOS One*, 2020](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0230317)
- [Patient global assessment in measuring disease activity in RA: literature review — *Arthritis Research & Therapy*, 2016](https://link.springer.com/article/10.1186/s13075-016-1151-6)
- [What Does PtGA in RA Really Tell Us? Contribution of Specific Dimensions of HRQoL, 2019](https://pubmed.ncbi.nlm.nih.gov/31549772/)

Consumer app comparison:
- [Spoonie Day — Blackburn Labs overview](https://www.blackburnlabs.com/spoonie-day-app-chronic-illness-manager/)
- [PaceMate — energy tracking for chronic illness](https://pacemate.app/)

---

## How this document fits into the research collective

This sits alongside our other foundational research:
- `sonakshi-lele-interview.md` — the primary patient interview this product was built around
- `seed-entries.md` — fictional-but-research-grounded 18-day journal, used as a prototyping reference
- `miro-export/` — raw interview artifacts (6 PDFs)

Together, these four sources are what an external reader — an investor, a co-creator, a clinician advisor — needs to understand why the product looks the way it does. The primary interview gives the *shape* of the user's reality. This document gives the *mechanism* behind why existing tools don't solve her problem. The seed entries show what a solved version looks like in practice.
