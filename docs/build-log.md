# Autoimmune Health Companion — Build Log

> Running chronicle of the build process. Methodology: [Project Process Playbook](~/.claude/projects/-Users-rewantprakash-1/memory/reference_project_process.md) — scoping + POC, parallel build subagents, parallel review subagents, post-ship learnings. (Adopted 2026-04-24, replacing the earlier process reference.)

---

## Methodology principles we are following

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
- Adopted a structured build methodology (later locked on 2026-04-24 as the Project Process Playbook).
- Order of work locked: **scoping doc first, scaffold second.** Reason: scope decides the data model, data model decides the Convex schema — scaffolding first would mean rewriting the schema.

**Files created this session:**
- `CLAUDE.md` — already existed (project overview, problem statement, MVP feature list, stack TBD)
- `scoping.md` — empty skeleton with section-header prompts. Rewant fills in, Claude transcribes.
- `build-log.md` — this file.

**Open questions (to be answered during scoping):**
- Who is the one specific user we're designing for?
- What's the first screen?
- What's the daily check-in actually made of?
- What does "correlation view" mean concretely?
- What do we explicitly NOT build in MVP scope?

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

**Deliverable:** waitlist live on Vercel — first MVP milestone (email → Convex).

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
- Initial plan was Google Form iframe placeholder — rejected. Rewant's direction: scoping doc is source of truth, no placeholders. Swapped to native Convex-backed form before first deploy.
- Missed 11am IST self-imposed gate while realigning. Shipped ~12:40 IST.

**Open items (next session):**
- **GitHub ↔ Vercel auto-deploy:** Vercel CLI couldn't connect the repo automatically (app install step missing). One-time dashboard action — install the Vercel GitHub App on `rewant24`, then future pushes auto-deploy without manual `vercel --prod`.
- LinkedIn launch post ("I've launched X" format) with live link.
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

**Phase `f01-c1/build-integrated` (tag on commit de7e72e):**

_Process deviation:_ Build subagents were dispatched **serially** (A → B → C) rather than in one multi-tool-call message as the playbook specifies. Functional output is equivalent — each chunk is disjoint by file ownership — but the wall-clock time is ~22 min vs ~8 min parallel. No artifact of this deviation appears in the code; flag for next cycle.

- **Build-A (chunk 1.A, voice provider):** 3 commits. `lib/voice/{types,provider,web-speech-adapter,openai-realtime-adapter}.ts`. 20 tests across `voice-provider.test.ts` + `web-speech-adapter.test.ts`. Shipped signatures: `VoiceProvider`, `Transcript`, `VoiceError { kind; message? }`, `VoiceErrorKind` union, `VoiceCapabilities`, `VoiceProviderName`. Env flag `VOICE_PROVIDER` default `web-speech`. Web Speech capabilities `{partials:true, vad:false}`; OpenAI stub `{partials:true, vad:true}` (not exercised). Open questions raised: `NEXT_PUBLIC_VOICE_PROVIDER` alternative for client bundles; `no-speech` reject vs resolve-empty; `Transcript.text` excludes partials.
- **Build-B (chunk 1.B, Convex):** 4 commits. `convex/schema.ts` appended, `convex/checkIns.ts` new, `tests/check-in/convex-checkins.test.ts` with 17 tests. Mock-ctx approach (hand-rolled, no `convex-test` dep). Cursor-on-date pagination (not `paginationOpts`). `ConvexError({ code: 'checkin.duplicate' })`. Handler logic extracted (`createCheckinHandler`, etc.) so tests don't need Convex runtime. Migration logged in `architecture-changelog.md`. Open questions: pagination shape (swap to paginationOpts if downstream wants it); soft-delete filtered in handler code vs DB query; `getCheckin` takes `v.string()` not `v.id()`.
- **Build-C (chunk 1.C, orb UI):** 3 commits. `app/(check-in)/{layout,page}.tsx`, `components/check-in/{Orb,OrbStates,ScreenShell,ErrorSlot}.tsx`, `lib/checkin/state-machine.ts`, 3 test files (state machine 28, orb 10, screen-shell 6 = 44 tests). Type-contract imports verified clean (import `type`-only from `@/lib/voice/types`). Auth gate deferred to Cycle 2 with TODO comment (no `convex/users.ts` yet). `<ErrorSlot>` stub for Feature 10. Open questions: ErrorSlot replaces Orb entirely (UX); exact "I'm listening." copy; `data-orb-state` DOM attribute for test hooks.

**Integration verify (this phase's gate):**
- File ownership: no cross-chunk file collisions.
- Type-contract seam: `lib/voice/types.ts` exports match consumers in `lib/checkin/state-machine.ts`, `app/(check-in)/page.tsx`, and tests.
- `npx tsc --noEmit`: clean.
- `npm run test:run`: **81/81 tests pass** across 6 files (20 + 17 + 44).
- `npm run build`: Next 16 production build clean. `/check-in` route group compiles to `.next/server/app/(check-in)/page.js` (does not appear in the static-page table because it's a stateful client component — expected).

**Next:** Task 3 — dispatch 3 review subagents in one multi-tool-call message against delta `f01-c1/pre-flight-done..HEAD`.

**Phase `f01-c1/reviewed` (tag on commit de7e72e, same as integration — notes were orchestrator-only):**

Three reviewers (Reviewer-1 UX+a11y, Reviewer-2 backend/data, Reviewer-3 type-contract + seams) ran in parallel against delta `f01-c1/pre-flight-done..HEAD`. Findings triaged against stop conditions — locked decisions (auth deferral, mood enum, cursor-on-date pagination, "support system" language, 48h edit window, F10 stub-only) were NOT re-litigated.

**Discarded (locked-decision re-litigation):**
- R1-1, R1-2 (auth not enforced on create/list) — explicitly deferred to Cycle 2 chunk 1.F. Plan covers it.
- R2-3 (switch to `paginationOpts`) — locked: cursor-on-date chosen for simplicity + testability.

**Accepted for fix pass:**
- R3-1 (backend): `listCheckinsHandler` crashes on `limit:0` (reads `undefined.date` for next cursor). **Major.**
- R3-4 (backend): boundary tests for `pain`/`energy` at 1 and 10 missing. **Minor.**
- R3-3 (voice): `WebSpeechAdapter.start()` called twice throws native InvalidStateError — want typed `VoiceError` instead. **Minor.**
- R3-10 (voice): `onPartial`/`onError` listeners never cleared — late callbacks can fire against stale consumer after session ends. **Minor.**
- R3-6 (a11y): `ErrorSlot` does not move focus to retry button — keyboard users land nowhere on error surface. **Minor.**
- R3-7 (UX): `navigator.vibrate(50)` fires twice per tap (Orb + hook). **Minor.** Decision: keep in Orb (closer to tap event), remove from hook.
- R3-9 (state machine): no test covers late `PROVIDER_STOPPED` after `VOICE_ERROR` — race where the adapter resolves `stop()` after an error already routed to `error` state. Reducer already handles this (error terminal except RESET) but test was missing. **Docs-only fix.**
- Doc: Cycle 1 auth deferral should have an explicit backlog entry + code note.
- Doc: `date: YYYY-MM-DD` time-zone policy should be written down; cross-tz-travel is a known edge case.

**Next:** Task 4 fix pass on above, commit, tag `f01-c1/fixed`, dispatch second-pass review.

**Phase `f01-c1/fixed` (tag on commit 24ec3d9):**

- R3-1: `listCheckinsHandler` guards `limit <= 0` with early return + defensive `page.length > 0` check on `nextCursor`. Commit 1aaafd6.
- R3-4: 2 new tests — pain=1,10 and energy=1,10 boundary round-trips. Commit 1aaafd6.
- R3-3: `WebSpeechAdapter.start()` now rejects with `{kind:'aborted'}` VoiceError if `this.recognition !== null`. Test added.
- R3-10: `handleEnd()` clears `partialListeners = []; errorListeners = []` so late callbacks can't leak across sessions. Regression test installs a fresh adapter, ends session, starts again, asserts original `onPartial` doesn't fire.
- R3-6: `ErrorSlot` uses `useRef` + `useEffect([kind, onRetry])` to focus the retry button on mount/change.
- R3-7: Removed both `vibrate(50)` calls from `useCheckinMachine()`. Orb handles haptic on tap.
- R3-9: Added 2 reducer tests: VOICE_ERROR during listening → error state, late PROVIDER_STOPPED ignored; VOICE_ERROR during processing → error, late PARTIAL returns same state ref.
- Docs: `docs/post-mvp-backlog.md` §20 (auth enforcement deferral) + §21 (IST/UTC date policy); `convex/checkIns.ts` wrapper header comment pointing to §20; feature doc US-1.B.1 gains a Cycle 1 time-zone contract line.

**Gate:**
- `npx vitest run` — **88/88 tests pass** across 6 files (up from 85 with 3 new tests: 1 for R3-3, 1 for R3-10, 2 for R3-9, 2 for R3-4 — net +3 because one wc mismatch).
- `npx tsc --noEmit` — clean.

**Next:** Task 5 — second-pass reviewer subagent (single reviewer — delta is small + focused on review findings) against delta `f01-c1/reviewed..f01-c1/fixed`.

**Phase `f01-c1/second-pass-clean` (tag on commit 5cd78bc):**

Single reviewer (delta was small + focused on previously-triaged findings). Verdict: **SHIP**. Per-finding audit: R3-1 ✅ / R3-3 ✅ / R3-4 ✅ / R3-6 ✅ (minor gap: no test for focus-on-mount — acceptable since ErrorSlot is F10 stub) / R3-7 ✅ / R3-9 ✅ / R3-10 ✅ / Docs ✅. No new issues introduced by the fixes. 88/88 tests pass, `tsc --noEmit` clean.

One pre-existing observation flagged but out of scope: `Orb.tsx` has `aria-live="polite"` on the button itself rather than a sibling status region — pre-existing from Build-C, not touched by fix pass.

**Next:** Task 6 — ship. Flip chunk statuses in `docs/features/01-daily-checkin.md`, update `architecture-changelog.md`, `system-map.md`, this log, and `~/.claude/projects/-Users-rewantprakash-1/memory/autoimmune_companion.md`. Commit. Tag `f01-c1/shipped`.

**Phase `f01-c1/shipped`:**

Docs flipped:
- `docs/features/01-daily-checkin.md` — front-matter `status: cycle-1-shipped` + commit trail, chunks 1.A / 1.B / 1.C marked `shipped (2026-04-25)`. Chunks 1.D / 1.E / 1.F remain `scoped` (Cycle 2).
- `docs/architecture-changelog.md` — new top entry summarising what landed, the gate numbers, and deferrals to Cycle 2.
- `docs/system-map.md` — F01 node styled `:::shipped` (green) on Map 1.

Final tally:
- **Commits on branch:** plan scaffold (1a4ab10), pre-flight (d2de361), Build-A×3, Build-B×4, Build-C×3 → integration tag, reviewer logs (c340582), fix-pass×2 (1aaafd6, 24ec3d9), build-log (5cd78bc), ship (this).
- **Tags:** `plan-saved`, `pre-flight-done`, `build-integrated`, `reviewed`, `fixed`, `second-pass-clean`, `shipped`.
- **Tests:** 88 across 6 files. Typecheck clean. Next build clean.
- **Files created:** 14 new source + 6 test + 1 plan + 1 vitest config + 1 setup = 23.

**Resume from any tag** if you want to re-run a phase: `git checkout <tag>` (detached), then cherry-pick forward or reset to it.

---

## 2026-04-25 — Session 5: F01 C1 merged to main, F02 C1 prep

**Deliverable:** `feat/f01-cycle-1` merged to main (commit `e190a7b`, `--no-ff`); local dev verified up; 6 new ADRs locking F01 C2 / F02 C1 prep decisions.

**Merge.**
- Branch was 19 commits ahead, working tree clean, all 7 phase tags intact.
- Merged with `--no-ff` to preserve the cycle as a discrete unit on main.
- Not pushed (default policy — no `git push` without explicit ask).

**Local dev verify.**
- Convex `dev:hardy-hamster-888` — schema deployed, `checkIns.by_user_date` index live.
- Next.js dev — `Ready in 3.3s`, `/check-in` route responds. Two harmless warnings: Convex 1.36.0 → 1.36.1 patch available; slow-FS warning expected (project on external volume).

**Open questions answered (Rewant):**
1. Sarvam swap — post-MVP. Web Speech stays through MVP.
2. Auth + `userId` source — moves into F02 work, not F01 C2.
3. LLM routing for `extractMetrics` — Vercel AI Gateway via AI SDK from Next.js (Option C). Default model `gpt-4o-mini`.
4. `clientRequestId` idempotency — already shipped correctly at `convex/checkIns.ts:122-130`. No action.
5. `stage` enum semantics — locked (open / hybrid / scripted definitions per ADR-021).
6. Mood enum lock-in — already shipped at `schema.ts:19-25`. No action.
7. Confirmation auto-route — `/check-in/saved` stable anchor with evolving CTAs (ADR-023).
8. Save-later queue — yes, with localStorage backstop (ADR-022).
9. ErrorSlot — stays stub through F01 ship (no new ADR; ADR-015 covers policy).
10. IST timezone canary — skip (MVP testers may be outside India). Backlog §21 already covers the policy gap.

**ADRs added (6):** 018 (Sarvam deferred), 019 (auth lands with F02), 020 (Vercel AI Gateway routing), 021 (stage enum semantics), 022 (save-later + localStorage), 023 (post-save terminal route).

**Changelog updated.** Top entry summarises the 6-ADR batch + 2 confirmations of already-shipped behavior + 2 deliberate skips.

**Scope drift flagged (open, not yet resolved):** `02-memory.md` diverges from `scoping.md` § Memory landing on five points — placement (Memory tab inside Journey vs. top-level `app/(memory)/`), calendar shape (week-at-a-time vs. 30-day strip), filter set (event types vs. check-in metadata), row visuals (task-state vocabulary vs. metric badges), and keyword search (in scoping, not in feature MD). Edit window already aligned at 48h per the locked decision. Reconciliation needed before F02 C1 build dispatch.

**Next decision for Rewant:** reconcile `02-memory.md` against `scoping.md` (rewrite the feature MD to match canonical scoping), OR accept the divergence and treat current `02-memory.md` as the authoritative target for F02 C1 build. Conflict rule says scoping wins — but the feature MD's current shape may reflect post-scoping refinements that should flow back into scoping.md instead.

---

## 2026-04-25 — Session 6: F02 spec rewrite + Vercel production deploy

**Deliverable:** `docs/features/02-memory.md` rewritten end-to-end to match canonical `scoping.md` § Memory landing. F01 deployed to Vercel production.

**F02 spec rewrite (scope drift resolved, option B — direct review, no reviewer subagents).**
- Placement: Memory is a tab inside Journey pillar. Routes: `app/journey/memory/page.tsx`, `app/journey/memory/[date]/page.tsx`.
- Calendar: week-at-a-time S/M/T/W/T/F/S strip with swipe nav (replaces 30-day horizontal scrubber).
- Filters: All / Check-ins / Intake events / Flare-ups / Visits (canonical 5-set).
- Row visuals: task-state vocabulary (empty circle / green check / red strikethrough). Per-day groups: Today's check-in → Medication intake → Other events → Completed.
- Keyword search added as Chunk 2.E (debounced, client-side per scoping line 695).
- Architecture: event-type discriminated union `MemoryEvent = CheckInEvent | IntakeEvent | FlareEvent | VisitEvent`. F02 C1 implements `CheckInEvent` only; F04/F05 plug in additively.
- 6 chunks across 2 cycles: 2.A (event-type architecture + listEventsByRange + filter predicates), 2.B (tab shell + week scrubber + filter tabs), 2.C (day view + event rows + task-state vocabulary), 2.D (detail sheet + edit-in-place 48h + soft-delete with 5s undo), 2.E (keyword search), 2.F (empty state + paywall + integration test).
- 12 user stories with full acceptance criteria.
- Refinement on scoping: soft-delete with 5s undo toast → hard-delete after window. Scoping says "delete is irreversible" — flagged in doc as a refinement, awaiting Rewant signoff.
- Inherited open scoping items listed (don't block C1): pillar nav shell, `/journey` landing page, auth gate (lands with F02 per ADR-019), paywall mechanics.

**Vercel production deploy (F01 main).**
- `main` is the production branch on this Vercel project — preview deploy not applicable from main.
- Production env var `NEXT_PUBLIC_CONVEX_URL=https://hardy-hamster-888.convex.cloud` already set; preview env add attempted but blocked by CLI ("cannot set production branch for a preview env var") — moot since main → production.
- `vercel deploy --prod --yes` → deployment `dpl_GtwHRAe3xRBwhbRKBPc3377JRQXT`, READY in 36s.
- Live URLs:
  - Stable: https://saumya-health-companion.vercel.app
  - This deploy: https://saumya-health-companion-kg6x4g07r-rewant24s-projects.vercel.app
  - Check-in flow: https://saumya-health-companion.vercel.app/check-in
- Caveats for testers: voice = Web Speech (Chrome/Safari, mic prompt on first tap); no auth (placeholder userId, all testers write to same dev row); Convex backend still `dev:hardy-hamster-888` (not prod Convex).

**Working tree state (uncommitted, on `main`):**
- `M docs/features/02-memory.md` — rewrite awaiting Rewant signoff.
- `?? .claude/` — backup of handbook content (already in .gitignore at commit `969b5e7`).

**Open for Rewant before F02 C1 build dispatch:**
1. Sign off on `02-memory.md` rewrite as authoritative spec.
2. Confirm or revert soft-delete-with-5s-undo refinement (scoping says hard-delete only).
3. Decide whether to resolve any of the 4 inherited open items now vs. parking them.
4. Smoke-test F01 on the live Vercel URL — report what breaks.

**Next:** when Rewant returns: dispatch F02 C1 build (chunks 2.A + 2.B + 2.C in parallel as **one multi-tool-call message** per playbook — correcting the F01 C1 deviation where dispatch was serial).

---

## 2026-04-25 — Session 7: Product rename Sakhi → Saumya

**Trigger.** Rewant: "We're going to do a rebranding from Sakhi. Let's go to Saumya."

**Decision rationale.** Captured in ADR-024. Pre-launch, no public users — cheapest moment for a brand swap. *Saumya* (सौम्य, Sanskrit for *gentle, soft, calm, kind*) describes the *quality* of the companion rather than the relationship category, and reads better as a unisex consumer brand.

**What changed (full sweep).**
- **Launch page (`app/page.tsx`)**: nav wordmark, hero copy, footer wordmark, "What's inside" header, "Why Saumya" section, founder note, italic meaning line in the *Why* block (now: *"Saumya means gentle — सौम्य, soft, calm, kind…"*). New italic after-note added under the waitlist CTA bullets, displayed inline with the bullet list, copy: *"Saumya — सौम्य — Sanskrit for gentle, soft, calm, kind. The presence we're building toward."*
- **Layout / metadata** (`app/layout.tsx`): page title.
- **Privacy page** (`app/privacy/page.tsx`): all references.
- **Components**: `VoiceTranscript.tsx`, `CheckInGrid.tsx`, `WaitlistCount.tsx`.
- **Package**: `package.json` and `package-lock.json` `name` field both → `saumya`.
- **Vercel project**: renamed `sakhi-health-companion` → `saumya-health-companion` (project ID `prj_GZxZGm2MVBup58aumsOGecX9gjPU` unchanged so deploys, env vars, integrations stay intact). Local `.vercel/project.json` synced. Old `sakhi-*.vercel.app` aliases continue to resolve. New `saumya-*` aliases will be created on the next `vercel deploy --prod`.
- **Active docs**: scoping, build-plan, system-map, product-taxonomy, tech-stack, post-mvp-backlog, README, docs/CLAUDE.md, features/01-daily-checkin.md, features/01-daily-checkin-cycle-1-plan.md, features/02-memory.md.
- **History docs (immutability exception, recorded in ADR-024)**: ADR-001 through ADR-023 product noun replaced (decision content unchanged); prior architecture-changelog entries; prior session entries in this build-log.
- **Planned save-later key**: `sakhi.saveLater.v1` → `saumya.saveLater.v1` everywhere it appears (ADR-022, ADR-024, this log, changelog). Verified no shipped code uses the old key — purely a forward plan.
- **ADR-024** added to `architecture-decisions.md`.

**Verified.**
- `tsc --noEmit` clean.
- No remaining `Sakhi`/`sakhi` references in code, configs, or active docs (only references that remain are the few inside Session 7 / ADR-024 / changelog rebrand entries that explicitly *cite* the old name as part of recording the rename — these are intentional).

**Not yet done.**
- Production redeploy to register `saumya-*` aliases — Rewant to trigger `vercel deploy --prod` after reviewing the launch page locally.
- Decision on whether to remove the old `sakhi-*.vercel.app` aliases (currently kept so old links don't break).
