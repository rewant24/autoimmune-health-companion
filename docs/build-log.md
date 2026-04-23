# Autoimmune Health Companion — Build Log

> Running chronicle of the build process. Following the [AI Weekender Builder Handbook](https://growthx.club/docs/ai-weekender-builder-handbook).

---

## Handbook principles we are following

- **You write the scoping doc. Not the AI.** Plain English. About one specific user.
- **Walk the user step-by-step.** First screen → first click → first submit → where data goes → what they see back → return visit → edge cases.
- **Three-step rhythm: Scope → POC → Build.**
  1. Scope: handwritten document, every user journey end-to-end
  2. POC: validate the core logic in Claude Chat first (prove it works before building)
  3. Build: only now open Claude Code with the validated scope
- **Discipline rules:** "Do not be over-smart. Do not skip. Step 1. Step 2. Step 3." Like school maths.
- **Manage the AI as an intern:** clear spec → validate the work → then let it scale.

---

## 2026-04-23 — Session 1: Project kickoff

**Decisions made:**
- Project confirmed as a new standalone build at `/Volumes/Coding Projects + Docker/autoimmune-health-companion/`.
- Adopted AI Weekender Builder Handbook as the true methodology guide.
- Order of work locked: **scoping doc first, scaffold second.** Reason: scope decides the data model, data model decides the Convex schema — scaffolding first would mean rewriting the schema.

**Files created this session:**
- `CLAUDE.md` — already existed (project overview, problem statement, MVP feature list, stack TBD)
- `scoping.md` — empty skeleton with the handbook's own prompts as section headers. Rewant fills in, Claude transcribes.
- `build-log.md` — this file.

**Open questions (to be answered during scoping):**
- Who is the one specific user we're designing for?
- What's the first screen?
- What's the daily check-in actually made of?
- What does "correlation view" mean concretely?
- What do we explicitly NOT build this weekend?

**Next step:** Rewant walks through the user step-by-step. Claude asks one focused question at a time. No first passes, no shortcuts.

---

### Research: conversation design for the voice AI (2026-04-23)

Rewant flagged that patients get asked the same questions daily by doctors — redundant and off-putting. The app's voice AI must phrase things differently and make Sonakshi feel welcome. Web research sources:

- [Helping Patients Take Charge of Their Chronic Illnesses — AAFP](https://www.aafp.org/pubs/fpm/issues/2000/0300/p47.html)
- [Five Communication Strategies to Promote Self-Management of Chronic Illness — AAFP](https://www.aafp.org/pubs/fpm/issues/2009/0900/p12.html)
- [Patient-centered care in nurse-patient interactions (lit review) — BMC Nursing](https://link.springer.com/article/10.1186/s12912-021-00684-2)
- [Influence of Patient–Provider Communication on Self-Management (2025) — Wiley](https://onlinelibrary.wiley.com/doi/10.1111/jan.16492)
- [Motivational Interviewing as a Counseling Style — NCBI](https://www.ncbi.nlm.nih.gov/books/NBK571068/)
- [Motivational Interviewing: Evidence-Based Approach in Medical Practice — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8200683/)
- [Empathy in Motivational Interviewing includes language style synchrony — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5018199/)
- [AI chatbots vs. human healthcare professionals: empathy meta-analysis (2025) — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12536877/)
- [Empathy AI in healthcare — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12753942/)
- [Engaging AI-based chatbots in digital health: systematic review — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12900317/)

Key principles synthesized into the scoping doc (§ Conversation design principles). These are POC targets — we validate in Claude Chat before building.
