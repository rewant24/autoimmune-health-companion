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

---

## 2026-04-23 — Session 2: Day 2 waitlist shipped

**Deliverable:** waitlist live on Vercel, handbook Day 2 spec met (email → Convex).

**Stack locked in this push:**
- Next.js 16.2.4 (App Router, Turbopack) + Tailwind 4
- Convex (dev: `hardy-hamster-888`, prod: `usable-zebra-515`)
- Vercel (project `autoimmune-health-companion` under `rewant24s-projects`)

**Live URLs:**
- App: https://autoimmune-health-companion.vercel.app
- Repo: https://github.com/rewant24/autoimmune-health-companion
- Convex dashboard (dev): https://dashboard.convex.dev/d/hardy-hamster-888
- Convex prod URL: https://usable-zebra-515.convex.cloud

**What ships:**
- Landing: headline, 3 bullets (check-in / patterns / doctor report), teal accent
- `waitlist` table (`email`, `createdAt`) with `by_email` index for dedupe
- `addEmail` mutation: validates format, lowercases, dedupes; returns `{ ok, alreadyOnList }`
- `WaitlistForm` client component with inline success / duplicate / error states
- Smoke-tested: first insert accepted, second returns `alreadyOnList: true`

**Route taken vs plan:**
- Initial plan was Google Form iframe placeholder — rejected. Rewant's direction: handbook is source of truth, no placeholders. Swapped to native Convex-backed form before first deploy.
- Missed 11am IST deadline while realigning. Shipped ~12:40 IST.

**Open items (next session):**
- **GitHub ↔ Vercel auto-deploy:** Vercel CLI couldn't connect the repo automatically (app install step missing). One-time dashboard action — install the Vercel GitHub App on `rewant24`, then future pushes auto-deploy without manual `vercel --prod`.
- Handbook Day 2 bonus: LinkedIn launch post ("I've launched X" format) with live link.
- Resume scoping: doctor report flow, edge cases, out-of-scope section.

---

## 2026-04-25 — Session 3: Wholesome build plan + living docs scaffolded

**Deliverable:** full product build plan + 3 living docs + 10 feature MDs + session-start context rule. Plan approved; ready for Phase 1 build (Feature 01 Cycle 1) in a new tab.

**Locked decisions (7):**
1. Plan depth — structure + Features 01/02 fully broken down; 03–10 sketched with chunking cycle as first build task.
2. Build order — dependency-driven: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10.
3. Memory edit window — **48 hours**.
4. Feature 10 timing — stub in F01 C1, finalize last.
5. Parallel lanes — decide each time (I ask at each phase's review step).
6. F03–10 chunking authorship — agent drafts; 3 reviewer subagents check the draft in parallel with Rewant review; merged fix list applied before feature enters `ready`.
7. Session-start context rule — every new session auto-loads 5 canonical docs (scoping, build-plan, system-map, product-taxonomy, tech-stack) via `docs/CLAUDE.md` header + memory pointer.

**New files created (15):**
- `docs/build-plan.md` — master plan (sections 1–9 + Appendices A & B). Source of truth for the build.
- `docs/system-map.md` — living visual map (5 Mermaid diagrams: feature deps, subagent topology, chunking cycle, status lifecycle, docs topology).
- `docs/product-taxonomy.md` — living capability mindmap + capability→feature table.
- `docs/tech-stack.md` — living stack layer diagram + dependency ledger + upgrade rules + breaking-change watchlist.
- `docs/features/README.md` — index, status vocabulary, build cycle pattern, feature MD template.
- `docs/features/01-daily-checkin.md` — full breakdown (6 chunks, 14 stories, 4-lane acceptance).
- `docs/features/02-memory.md` — full breakdown (6 chunks, 12 stories, 4-lane acceptance).
- `docs/features/03-patterns.md` through `10-edge-case-templates.md` — 8 stubs (status: scoped; first build task = chunking cycle).

**Files updated (1):**
- `docs/CLAUDE.md` — prepended session-start checklist so every new conversation auto-loads canonical context.

**Memory updates (2):**
- `~/.claude/projects/-Users-rewantprakash-1/memory/autoimmune_companion.md` — session-start pointer added.
- `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md` — living docs listed in the Autoimmune section.

**Process adopted (from verbatim brief, preserved as Appendix B in build-plan.md):**
- Hierarchy: feature → chunks → user stories → 4-lane acceptance (UX / UI / backend-data / UX copy).
- Parallel dispatch: 3 build subagents per cycle, each with disjoint file ownership, dispatched via a single multi-tool-call message.
- 3 review subagents after build: brief alignment / spec+regression / edge cases.
- Second-pass reviewer catches the 1–2 things pass one missed; "decisions already made — don't re-litigate".
- Chunking cycles (for F03–10) use the same dual-track: Plan subagent drafts + 3 reviewer subagents check + Rewant review, all in parallel.

**Next step:** open a new tab in `/Volumes/Coding Projects + Docker/autoimmune-health-companion/` → Phase 1 = Feature 01 Cycle 1 build dispatch (chunks 1.A, 1.B, 1.C in parallel).

---

## 2026-04-25 — Session 4: Overnight — F01 Cycle 1 build (in progress)

**Mode:** orchestrator autonomous. Branch `feat/f01-cycle-1` off `main@1a4ab10`. Phase-boundary annotated tags; no push.

**Phase `f01-c1/plan-saved` (commit 82473e5):**
- Plan doc `docs/features/01-daily-checkin-cycle-1-plan.md` written and committed. Resume guide + tag table + verbatim dispatch prompts + locked-decision list embedded.
- Session-start repo was dirty (planning docs from Session 3). Committed on main as `1a4ab10` before branching.
- Stale `.git/index.lock` from Apr 23 removed (no live git process).
- Tag created.

**Next:** Task 0 pre-flight — vitest + RTL + jsdom install, smoke test, commit, tag `f01-c1/pre-flight-done`.

**Phase `f01-c1/pre-flight-done` (commit d2de361):**
- `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom` — 103 packages added, 2 moderate vulnerabilities (not blocking).
- `vitest.config.ts` — jsdom env, React plugin, `tests/**/*.test.{ts,tsx}` glob, `@/` alias.
- `tests/setup.ts` — `@testing-library/jest-dom/vitest` import.
- `tsconfig.json` — added `"types": ["vitest/globals", "@testing-library/jest-dom"]` so agents can write `describe`/`it`/`expect` globally without imports.
- Scripts added: `test`, `test:run`, `typecheck`.
- Smoke test passed (1/1). `tsc --noEmit` clean.

**Next:** Task 1 — dispatch 3 build subagents in one multi-tool-call message. Each given verbatim prompt from `docs/features/01-daily-checkin-cycle-1-plan.md` Task 1. Agents run in parallel.
