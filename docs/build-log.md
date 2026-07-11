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

**Production deploy + alias cleanup (same session).**
- Commit `e1e91a3` on `main` (not pushed): 22 files, the rebrand sweep.
- `vercel deploy --prod` → new deploy `dpl_D1hb8uLygwiACQFnJ2kZT7quk7VJ` (READY).
- `vercel alias set` → `saumya-health-companion.vercel.app` pointed at new deploy.
- **Hit a 401 hiccup:** the new alias was blocked by SSO protection (`ssoProtection.deploymentType: "all_except_custom_domains"`). Project's `domains` array still listed the old `sakhi-health-companion.vercel.app` as the auto-exempt primary, not the new saumya one. Fix: `vercel domains add saumya-health-companion.vercel.app` added it to the project's domains list, which auto-exempted it from SSO.
- Verified: `curl -sI https://saumya-health-companion.vercel.app` → 200; HTML body contains `Saumya`, no `Sakhi`.
- **Old aliases removed:** `vercel alias rm` ran on `sakhi-health-companion.vercel.app`, `sakhi-health-companion-rewant24s-projects.vercel.app`, and `sakhi-health-companion-rewant24-rewant24s-projects.vercel.app`. All three confirmed 404 after removal.
- **Still on the project (untouched, not requested):** three `autoimmune-health-companion*` aliases — `autoimmune-health-companion.vercel.app` (now pointing at the new saumya deploy), `autoimmune-health-companion-rewant24s-projects.vercel.app`, and `-rewant24-rewant24s-projects.vercel.app` (the latter two still pointing at the old `autoimmune-*` deploy from 2 days ago). Decide separately whether to remove these.

**Open follow-ups.**
- Push commit `e1e91a3` to `origin/main` when ready (not pushed automatically).
- Acquire a custom `saumya` domain if desired (`saumya.app`, `saumya.health`, etc.) — site is currently public on the Vercel-managed subdomain only.

---

## 2026-04-25 — Session 8: Launch page UX scan + WaitlistForm restyle

**Trigger.** Rewant asked for a UI/UX scan of the launch page (waitlist), grounded in established design principles.

**Scan delivered (priority order, not all implemented this session):**
1. **WaitlistForm breaks the design system.** Page uses sage / cream / Fraunces; form was Tailwind `bg-teal-700` + zinc inputs. Inverts visual hierarchy (Refactoring UI, Wathan & Schoger), dents trust on a health product (aesthetic-usability effect, Tractinsky/Norman). **Implemented this session.**
2. Headline is poetic; needs a concrete sub-headline naming the thing (Krug). *Not implemented.*
3. Two competing CTAs in nav vs. inline hero form (Wroblewski). *Not implemented.*
4. Privacy section sits below final CTA — should be a precondition, not a postscript. *Not implemented.*
5. `WaitlistCount` "Be among the first" copy under 25 signups is generic; specific count is more honest social proof (Cialdini). *Not implemented.*
6. Founder note shows initial "R" — real face is higher-leverage trust signal. *Not implemented.*
7. Mobile order shows differentiator (`VoiceTranscript`) last. *Not implemented.*
8. Section overlap between "What's inside" and "The daily loop" — possible cut/merge. *Not implemented.*

**Implemented #1: `app/WaitlistForm.tsx` restyled to design system.**
- Input: `--bg-elevated` bg, `--rule` border, `--ink` text. Focus → `--sage-deep` border + 3px sage glow ring (`rgba(47, 90, 82, 0.18)`). Replaces `border-zinc-300 / focus:ring-teal-600/20`.
- Button: `--sage-deep` resting → `--ink` on hover, soft sage drop-shadow (`0 6px 18px rgba(47, 90, 82, 0.16)`). Inter weight 500 (was 700/`font-semibold`). `rounded-xl` to match `VoiceTranscript` and pillar cards (was `rounded-lg`).
- Success card: `--sage-soft` bg, `--sage-deep` border + text, Fraunces italic copy, small breathing dot — same idiom as the hero pill. Replaces `bg-teal-50 / text-teal-900`.
- Error text: `#A6573B` (the deep terracotta from `VoiceTranscript`) — palette-coherent, ~6:1 on cream, passes WCAG AA. Replaces generic `text-red-700`.
- Behavior unchanged: state machine, validation regex, `role="status"` / `role="alert"`, `sr-only` label, `autoComplete="email"`, idempotency via Convex `addEmail`. No tests existed against this component; nothing to update.
- Copy nit: trimmed success message from *"You're on the list. Watch your inbox — we'll email you…"* to *"You're on the list. We'll email you when early access opens."* — "Watch your inbox" is redundant with "We'll email you" and the shorter line breathes better in italic Fraunces.

**Implemented copy edit: pull-quote attribution simplified.**
- `app/page.tsx:245-247` changed `From 12 patient interviews · 2026` → `Autoimmune patient · arthritis`. Rewant explicitly removed the patient-count and year per request: "we don't need to reference patient numbers or year for that matter."

**Verified.**
- `tsc --noEmit` clean.
- `vitest run` → 88/88 pass.
- `next build` → compiled, 5 static pages generated, no warnings.
- HMR picked up changes on the already-running dev server (PID 5211 on port 3000).

**Not committed.** All edits are in the working tree only — no commit made this session. Combined with Session 7's unpushed `e1e91a3`, `main` now diverges from `origin/main` by one commit + uncommitted launch-page polish.

**Open follow-ups (carried into next session).**
- Items 2–8 from the scan above (sub-headline, nav CTA, privacy placement, WaitlistCount copy, founder photo, mobile order, section dedup).
- F02 C1 dispatch (still gated on Rewant signoff per Session 6).
- Push `e1e91a3` + a new commit covering Session 8 launch-page polish.

---

## 2026-04-25 — Session 9: Launch-page polish (UX scan items 2, 3, 4, 5, 7, 8)

**Trigger.** Rewant: focus this tab only on the launch-page polish backlog and execute it.

**Scope decided up front.** Items 2, 3, 4, 5, 7, 8 from Session 8's scan. Item 6 (founder photo) deferred — needs a photo asset from Rewant.

**Implemented.**

- **Item 3 — single nav CTA (`app/page.tsx`).** Dropped `Try demo →` from the top nav; kept `Join waitlist →` as the lone CTA next to the wordmark. Removed the `flex items-center gap-5` container since there's only one child now. Demo link still lives in the footer's Product column, so it remains discoverable for anyone who wants it.

- **Item 2 — Krug-style sub-headline + trimmed body (`app/page.tsx`).** Added a one-line sub-headline directly under the H1: *"A health companion for life with an autoimmune condition."* — uses `type-body-lg` with full `--ink` color so it reads as a deck, not muted body. Replaced the seven-thing body paragraph (*"Daily check-ins, medications, doctor visits, blood work, patterns over time, a community of people who get it — and a doctor-ready report when it counts."*) with a tighter line about the daily loop: *"Sixty seconds a day. Saumya remembers your symptoms, medications, and visits — so when the room rushes, you walk in prepared."* The pill above (*"Voice-first · for autoimmune"*) and the new sub-headline now share the Krug duty without restating each other; the body paragraph carries the loop story.

- **Item 7 — VoiceTranscript visible earlier on mobile (`app/page.tsx`).** Restructured the hero section from two grid cells (text-left, transcript-right) into three: hero copy (badge + H1 + sub + body) at `md:row-start-1 md:col-span-7`, VoiceTranscript at `md:row-start-1 md:row-span-2 md:col-span-5` keeping the existing `md:sticky md:top-10`, and form + conditions at `md:row-start-2 md:col-span-7`. On desktop (md+), explicit row placement keeps the transcript on the right spanning both rows. On mobile (single column, no `md:row-start` applied), DOM order takes over: copy → transcript → form. Differentiator now appears before the conversion ask on small screens. Tweaked the section's gap to `gap-10 md:gap-x-12 md:gap-y-14` so the mobile rhythm tightens slightly.

- **Item 8 — cut "The daily loop" section (`app/page.tsx`).** Removed the 01/02/03 numbered list (*"Speak for sixty seconds / See what your body is telling you / Walk in prepared"*). It duplicated the three-bucket grid above it — bucket 03 ("Show up prepared") and loop step 03 ("Walk in prepared") were verbatim restatements; the buckets carry richer info (9 sub-items) and the same three-jobs hierarchy. Net: ~50 lines deleted, page reads tighter, less scroll between buckets and the founder/why block.

- **Item 4 — privacy moves before final CTA (`app/page.tsx`).** Swapped section order so the privacy stance (`<section>` with the three claims: no tracking pixels / transcripts never train AI / delete in one tap) renders **before** the bottom waitlist gradient card, not after it. Privacy is a precondition for handing over an email, not a postscript. Comment on the privacy section updated from *"replaces generic trust strip"* → *"precondition to the second ask, not a postscript"*. Comment on the waitlist CTA updated from *"three things competing reduced to one"* → *"sits after privacy so the answer precedes the ask"*.

- **Item 5 — specific count from #1 (`app/WaitlistCount.tsx`).** Replaced the `count < 25` evergreen branch with three explicit cases: `0` keeps *"Be among the first to try Saumya."* (real fallback when there's nothing to show), `1` says *"1 person on the list."*, `2+` says *"N people on the list."* (singular/plural handled, dropped the `already` filler since the count alone implies it). Cialdini specificity from the very first signup; no more reading-as-empty until 25 people show up.

**Not implemented (flagged for Rewant).**
- **Item 6 — founder photo.** The "R" letter avatar in the founder note remains. Needs a real image at `public/founder.jpg` (or similar) before swap. Will add `next/image` import + replace the styled `<div>R</div>` with `<Image src="/founder.jpg" .../>` keeping current sage-deep ring as a fallback frame.

**Verified.**
- `npx tsc --noEmit` — clean.
- `npx vitest run` — **88/88 pass** across 6 files. (No tests touch the launch page directly; the safety net is mostly typecheck + Next build for this kind of polish.)
- `npx next build` — compiled successfully in 11.4s, all 7 static pages generated, no warnings.

**Diff scope.**
- `app/page.tsx`: ~83 insertions, ~130 deletions (net -47 lines, mostly from cutting the daily loop). Five distinct edits: nav, hero copy, hero structure, daily-loop removal, privacy/CTA swap.
- `app/WaitlistCount.tsx`: 6-line change to the count text logic.

**Working tree at session end.** Two files modified, both committed in this session. Session 8's launch-page polish (`58e0051`) and the Session 7 rebrand (`e1e91a3`) are already on `origin/main`, so this commit lands cleanly on top.

**Open follow-ups (carried into next session).**
- Item 6 (founder photo) — awaiting image asset.
- F02 C1 dispatch (still gated on Rewant signoff per Session 6: `02-memory.md` rewrite, soft-delete-with-undo refinement, four inherited scoping items, smoke-test of `/check-in`).
- Push Session 9 commit to `origin/main` once Rewant says go.

---

## 2026-04-25 — Session 10: F01 C2 pre-flight (Task 0)

**Trigger.** Plan locked at `~/.claude/plans/playful-kindling-thimble.md` (5-cycle sequence: F01 C2 → F02 auth → F02 C2 → voice+save-later → pricing). Q1–Q4 resolved this session: Convex Auth · tappable-list Stage-2 recap · device-local-time date boundary (narrow scope to re-entry path only, Memory IST helpers stay till Cycle 3) · spoken closer TTS.

**Branch.** `feat/f01-cycle-2` (off `main` at `23b37a1`). Pre-flight is the orchestrator-only Task 0 from the existing Cycle 2 plan at `docs/features/01-daily-checkin-cycle-2-plan.md` — no parallel agents dispatched yet.

**Implemented (single sequential pass).**

- **Schema migration (`convex/schema.ts`).** All five metrics now `v.optional`. `flare` widened to tri-state (`"no" | "yes" | "ongoing"`). Added `declined` array + `appendedTo` id (re-entry path) + `extractAttempts` table indexed by `(userId, date)` for ADR-020 cost guards. One stale dev row (`flare: false`) cleared via `npx convex import --replace` to satisfy the new validator.
- **Convex handler (`convex/checkIns.ts`).** Validators updated; range checks gated on `value !== undefined`; exported `CheckinRow` and `CreateCheckinArgs` types track the new shape.
- **Shared types (`lib/checkin/types.ts`).** New file — `Metric`, `Mood`, `FlareState`, `StageEnum`, `CheckinMetrics`, `ContinuityState`, `OpenerVariantKey`, `MilestoneKind`. Single source of truth for Wave-1/2 subagents.
- **State machine (`lib/checkin/state-machine.ts`).** Union extended additively: states `extracting`, `stage-2`, `discarding`, `celebrating` added; `confirming` and `saved` gain optional fields. New events `EXTRACTION_DONE`, `STAGE_2_CONTINUE`, `METRIC_UPDATED`, `METRIC_DECLINED`, `DISCARD_REQUEST/CONFIRM/CANCEL`, `MILESTONE_DETECTED`. Reducer no-ops the new states with a comment naming the lane that owns each transition. `toOrbState` collapses transient states to `'processing'`.
- **Memory event mapper (`lib/memory/event-types.ts`).** Updated for optional metrics (`mood` undefined → `"—"` in meta) and tri-state flare (`flare === "yes" || flare === "ongoing"` triggers the second event). Switched import to relative `../../convex/checkIns` because Convex's `tsconfig.json` has no `@/*` alias.
- **Tests.** Mechanical updates for the boolean → tri-state flare in `tests/check-in/convex-checkins.test.ts`, `tests/memory/event-types.test.ts`, `tests/memory/list-events-query.test.ts`. App callsite `app/check-in/page.tsx:98` flipped from `flare: false` → `flare: 'no'`.
- **Dependencies.** `npm install ai @ai-sdk/openai zod` (lane 2.B's extraction route). `.env.local.example` created with `AI_GATEWAY_API_KEY` placeholder + the existing Convex env vars.
- **Architecture changelog.** New entry at top of `docs/architecture-changelog.md` capturing the schema + state-machine extension; references ADR-005, ADR-020, ADR-021, ADR-022.

**Verified.**
- `npx tsc --noEmit` — clean.
- `npm run test:run` — **152/152** across 14 files (no regression vs F02 C1 baseline).
- `npm run build` — compiled in 19.4s; 8 static pages generated; no warnings.

**Wave-1 dispatch contract (read-only for build agents).**
- Schema, validators, `CheckinRow` type → frozen.
- `lib/checkin/types.ts` → frozen single source for shared vocabulary.
- State-machine union + no-op reducer cases → frozen; lanes implement transition logic only inside the case for their chunk's events.
- `.env.local.example` → frozen; agents add new keys via the same file.

**Next.** Tag `f01-c2/pre-flight-done` on the commit. Wave 1 dispatch — 4 parallel build agents (2.A opener/closer, 2.B extraction, 2.C Stage 2 UI, 2.D confirm/save) per `docs/features/01-daily-checkin-cycle-2-plan.md`.

---

## 2026-04-25 — Session 11: F01 C2 Wave 1 integration

**Trigger.** Four parallel build agents (2.A opener/closer, 2.B extraction route, 2.C Stage 2 UI, 2.D confirm/save) finished in their own worktrees on disjoint file ownership. Task 2 is the orchestrator-only integration: merge all four branches into `feat/f01-cycle-2`, fill in the no-op reducer cases the pre-flight froze, wire `app/check-in/page.tsx` end-to-end, validate.

**Branches merged (3-way, no conflicts).**
- `feat/f01-c2/build-a` — opener/closer engine + `getContinuityState` query.
- `feat/f01-c2/build-b` — `/api/check-in/extract` AI Gateway route + `coverage()` + `extractAttempts` cost guard.
- `feat/f01-c2/build-c` — `<Stage2>` recap + tap-input column.
- `feat/f01-c2/build-d` — `<ConfirmSummary>` review card + `/check-in/saved` terminal route + `saumya.saveLater.v1` queue.

Branches A and B branched at `e8459f7` while C and D branched at `dd50aad` (a doc-update commit landed between), so A's and B's diff against the integration branch tip showed phantom changes to `docs/features/01-daily-checkin-cycle-2-plan.md` + `docs/system-map.md`. Their actual commits only touched owned files; the 3-way merge dropped the noise. Worth flagging for future Wave dispatches: snapshot the integration branch SHA before kicking agents off so all worktrees branch from the same parent.

**Vitest pool pinned (`vitest.config.ts`).** Default `forks`/`threads` pools time out spawning workers when the project lives on a path with spaces or `+` (this volume: `/Volumes/Coding Projects + Docker/`). Set `pool: 'vmThreads'` permanently — no more `--pool=vmThreads` flag plumbing on every run. Comment in the config calls out the bug for future-us.

**State-machine transitions implemented (`lib/checkin/state-machine.ts`).** Pre-flight froze the union; this session filled in the reducer cases for the events Wave 1 introduced.

- New events: `EXTRACTION_START`, `EXTRACTION_DONE`, `EXTRACTION_FAILED`.
- `processing + EXTRACTION_START → extracting`.
- `extracting + EXTRACTION_DONE`: routes by `coverage().missing.length`. Empty → `confirming`; non-empty → `stage-2` (carries `metrics`, `missing`, `declined: []`, `stage`).
- `extracting + EXTRACTION_FAILED → stage-2` with `missing = ALL_METRICS`, `stage: 'scripted'`. User can still complete the check-in by tap.
- `stage-2 + METRIC_UPDATED / METRIC_DECLINED / STAGE_2_CONTINUE / DISCARD_REQUEST` — per-metric edits stay in `stage-2`; CONTINUE collapses to `confirming` carrying the same payload; DISCARD_REQUEST pushes to `discarding` keeping the previous state for restore-on-cancel.
- `confirming + METRIC_UPDATED / METRIC_DECLINED / CONFIRM / DISCARD_REQUEST` — symmetric edits, CONFIRM → `saving`, discard branches to `discarding`.
- `discarding + DISCARD_CONFIRM → idle` (with reset). `DISCARD_CANCEL` restores `previous` verbatim.
- `saved + MILESTONE_DETECTED → celebrating` (Wave 2 will hook into this; for now the page routes to `/check-in/saved` before milestone has a chance to fire).

`discarding` state shape changed from `previous: kind` to `previous: Extract<State, { kind: 'stage-2' | 'confirming' }>` so DISCARD_CANCEL can restore the full payload, not just re-enter an empty state.

**`app/check-in/page.tsx` rewired end-to-end.** Single client component composes everything Wave 1 produced.
- `useQuery(api.continuity.getContinuityState)` feeds opener + closer; `FALLBACK_CONTINUITY` (with `isFirstEverCheckin: true`) renders an opener string from the very first paint instead of a spinner.
- `useEffect` on `processing` dispatches `EXTRACTION_START`, awaits `extractMetrics()`, computes `coverage()`, dispatches `EXTRACTION_DONE` with `stage: 'open' | 'hybrid' | 'scripted'` (3-way split on `missing.length`), or `EXTRACTION_FAILED`.
- `confirming` and `saving` and the `error/save-failed` branch all render `<ConfirmSummary>` from a cached `confirmingRef` snapshot — keeps the card on screen across save success/fail without re-mounting.
- `stage-2` renders `<Stage2>` with the recap + tap-input column.
- `saved` triggers `router.push('/check-in/saved?closer=…')`.
- Save-later queue is drained once on mount (`useEffect`), failed retries re-`enqueue`.
- `ConvexCreateCheckinArgs` + `toConvexArgs(payload)` bridge `SaveLaterPayload`'s plain-string `appendedTo` to Convex's branded `Id<'checkIns'>` — strip the field when undefined, cast when present. Brand is TS-only nominal so the round-trip is lossless.
- ConfirmSummary owns its own discard-confirm modal, so `onDiscard` fires `RESET` directly (skipping the reducer's `discarding` state). The state is kept for completeness — Stage 2 will route through it once Wave 2's discard sheet lands.

**Test surface (`tests/setup.ts` + `tests/check-in/screen-shell.test.tsx`).** Page tests render `<CheckinPage>` outside Next's App Router runtime, so `useRouter()` threw "invariant expected app router to be mounted". Added a global `vi.mock('next/navigation', …)` to `tests/setup.ts` returning callable spies for `push`/`replace`/`back`/`prefetch` and stubs for `usePathname` / `useSearchParams`. Convex was already mocked there since Cycle 1.

The C1 screen-shell test asserted on the literal heading `"How's today feeling?"`. The opener engine now selects `first-ever` under FALLBACK_CONTINUITY, so the test was updated to assert on the actual variant text from `lib/saumya/variants.ts`: *"Hey Sonakshi — glad you're here. How are you feeling today?"*. Subcopy + ScreenShell + listening + error + retry assertions still pass unmodified.

State-machine unit tests grew by 19 cases (47/47 total) covering: scripted/hybrid routing on `EXTRACTION_DONE`, declined-metric handling at both `stage-2` and `confirming`, discard preserve-and-restore, and `saved + MILESTONE_DETECTED → celebrating`.

**Verified.**
- `npm run test:run` — **366/366 pass** across 26 files.
- `npx tsc --noEmit` — clean.
- `npm run build` — compiled in 12.7s with Turbopack; 10 static pages generated, `/api/check-in/extract` registered as the dynamic route. No warnings.

**Diff scope at session end.**
- `app/check-in/page.tsx`: net +355 lines (full rewrite around the new union).
- `lib/checkin/state-machine.ts`: +149 (transition logic for the new events; `discarding.previous` widened).
- `tests/check-in/state-machine.test.ts`: +252 (19 new cases).
- `tests/setup.ts`: +17 (Next router mock).
- `tests/check-in/screen-shell.test.tsx`: ±9 (opener text + header doc).
- `vitest.config.ts`: +5 (`pool: 'vmThreads'` with comment).
- `convex/_generated/api.d.ts`: +4 (regen via `npx convex dev --once` to register `continuity` + `extractAttempts` modules).

**Open follow-ups.**
- Wave 2 dispatch — chunks 2.E (TTS spoken closer) + 2.F (Day-1 tutorial overlay + same-day re-entry append payload + milestone celebration). Both can run in parallel; lanes don't overlap.
- Then Project Process Playbook review pass — three reviewers in parallel, fix pass, second pass, ship.
- F02 C1 ship-day learning #5 still holds: `NEXT_PUBLIC_CONVEX_URL` should be set globally for "all preview branches" before pushing this branch to a PR, otherwise the Vercel preview will 401 + crash at `_not-found` prerender.

**Next.** Tag `f01-c2/wave-1-integrated` on the integration commit. Then Wave 2 dispatch.

---

## 2026-04-25 — Session 11 — F01 C2 Wave 2 build + integration

**Wave 2 build dispatched** as two parallel subagents in one multi-tool-call message per playbook (Task 3 of `docs/features/01-daily-checkin-cycle-2-plan.md`). File ownership disjoint by design — no merge collisions.

**Build-E (Chunk 2.E — TTS spoken opener)** — 3 commits on `feat/f01-cycle-2`.
- `2a7b945` `feat(voice): add Web Speech tts-adapter (TTS.US-1.H.1)`
- `55386d5` `feat(voice): add SpokenOpener auto-speak component (TTS.US-1.H.2)`
- `14d8991` `feat(voice): add long-press mute popover to SpokenOpener (TTS.US-1.H.3)`
- Files: `lib/voice/tts-adapter.ts`, `components/check-in/SpokenOpener.tsx`, 27 tests across `tts-adapter.test.ts` + `spoken-opener.test.tsx`.
- Voice selection: `en-IN` > any `en-*` > platform default; cached at module level.
- Three guards on auto-speak: `isTtsAvailable()`, no `prefers-reduced-motion`, no `localStorage.saumya.ttsDisabled`.
- Long-press deviation: in jsdom + `pool: 'vmThreads'`, `userEvent.pointer({ keys: '[MouseLeft>]' })` hangs past 5s. Tests use `fireEvent.pointerDown`/`pointerUp` wrapped in `act()`. Behaviour-equivalent — same handlers fire. Matches prior pattern in `tests/check-in/discard.test.tsx`.
- Click-after-long-press suppression: `longPressFired` ref swallows the synthetic click after a 1s hold so the user doesn't get a stray utterance over the popover.

**Build-F (Chunk 2.F — Day-1 tutorial + re-entry + milestone)** — 4 commits on `feat/f01-cycle-2`.
- `29f9d1f` `feat(check-in): detect milestone kinds (Milestone.US-1.J.3)`
- `f450629` `feat(check-in): same-day re-entry append payload + getTodayCheckin (Reentry.US-1.J.2)`
- `f1ba9eb` `feat(check-in): Day-1 micro-tutorial wrapper component (Day1.US-1.J.1)`
- `c7d0589` `feat(check-in): milestone celebration ring overlay (Milestone.US-1.J.4)`
- Files: `lib/checkin/{milestone,same-day-reentry}.ts`, `components/check-in/{Day1Tutorial,MilestoneCelebration}.tsx`, plus the additive `getTodayCheckin` query + `getTodayCheckinHandler` in `convex/checkIns.ts`. 46 tests added.
- `MilestoneCelebration.prefersReducedMotion` shipped as a prop (not internal `matchMedia`) — keeps SSR deterministic and avoids needing a jsdom polyfill. Page reads it once and passes through.
- `Day1Tutorial` ships with a single `forceTooltip` prop instead of the spec-suggested two-flag pattern. Clean contract — Day1Tutorial doesn't know about Stage 2's `forceAllControls`. Orchestrator computes the AND.
- `buildAppendPayload` is 5-arg (added `opts: { clientRequestId, durationMs, providerUsed?, stage? }`) — the spec's 4-arg signature didn't account for required fields on `CreateCheckinArgs`.
- `getTodayCheckin` returns the *original* row (the one with `appendedTo === undefined`) when an append chain already exists for today, so subsequent re-entries chain off the original `_id` and the timestamped block list reads in order.

**Wave 2 integration (orchestrator-only)** wired everything into `app/check-in/page.tsx`:
- Imports: `SpokenOpener`, `Day1Tutorial`, `MilestoneCelebration`, `detectMilestone`, `buildAppendPayload`, `CheckinRow` type.
- `useQuery(api.checkIns.getTodayCheckin, …)` runs alongside `getContinuityState`. When non-null, opener variant becomes `re-entry-same-day` (driven by `continuity.lastCheckinDaysAgo === 0` — already wired by Wave 1) and `onSave` builds an append payload via `buildAppendPayload(existing, …)` instead of a fresh-row payload.
- `prefersReducedMotion` snapshot read once via `useMemo` and passed to `MilestoneCelebration`.
- Saved-state effect now runs `detectMilestone(streakDays + 1, isFirstEverCheckin)` first. Non-null → dispatches `MILESTONE_DETECTED` (state machine moves to `celebrating`); null → routes to `/check-in/saved?closer=…` as before.
- New `celebrating` render branch renders `<MilestoneCelebration kind closerText prefersReducedMotion onContinue>` — `onContinue` routes to `/check-in/saved`. Closer text becomes the heading inside the overlay.
- Stage 2 render branch: `<Day1Tutorial forceTooltip={isDay1}>` wraps `<Stage2 forceAllControls={isDay1} …>`. **Deviation note**: Build-F's Day1Tutorial renders the ribbon below children, not under each TapInput. Orchestrator wraps the whole Stage 2 once — single ribbon below the view. UX-equivalent for v1; per-control wrapping is a future polish.
- Idle render: replaced `<h2>{openerSelection.text}</h2>` with `<SpokenOpener text={openerSelection.text} variantKey={openerSelection.key} />`. The "Tap the orb…" subcopy stays.

**Convex handler patch (cross-cut Build-F gap).** Same-day re-entry needed a way past `createCheckinHandler`'s duplicate check. Build-F explicitly deferred that change. Orchestrator extended the handler in `convex/checkIns.ts:156-185`:
- Idempotency lookup now scans the whole append chain (matches `clientRequestId` across all live rows for `(userId, date)`), not just the original.
- Without `appendedTo`: a second create on `(userId, date)` still throws `checkin.duplicate` — unchanged contract for the non-append path.
- With `appendedTo`: handler skips the duplicate check and inserts the new row.
- Added 2 tests in `tests/check-in/convex-checkins.test.ts`: one asserting the append insert produces a distinct row with `appendedTo` set, one asserting idempotent retry of an append matches the existing append row.

**Verified.**
- `npx tsc --noEmit` — clean.
- `npm run test:run` — **441/441 pass** across 32 files (was 412 before Wave 2; +29 = 27 from Build-E + 2 from the orchestrator's append tests, since Build-F's 46 added the gap from 412 to 439, then orchestrator added 2 more to reach 441).
- `npm run build` — compiled in 13.2s with Turbopack; 10 static pages generated. No warnings.

**Open follow-ups.**
- Tag `f01-c2/wave-2-integrated` on the integration commit, then dispatch the 3 parallel review subagents per the playbook (review pass), fix pass, second-pass reviewer (decisions-locked frame), ship.
- Manual smoke test before tagging `f01-c2/shipped`: clear localStorage + Convex `checkIns` → verify Day-1 tutorial + day-1 milestone fires; seed 6 prior days via `scripts/seed-streak.ts` (dev-only, not yet authored — orchestrator can add as part of smoke test) → verify day-7 ring animation.
- F02 C1 ship-day learning #5 still relevant: `NEXT_PUBLIC_CONVEX_URL` needs to be set for the preview branch (or globally for "all preview") before opening the PR.

---

## 2026-04-25 · Session 11 — Saumya → Saha rebrand

**Outcome.** Second pre-launch rename of the day. Brand framing shifted from *gentle/calm* (Saumya, सौम्य) to *endurance + together* (Saha, सह) on the rationale that "gentle" softens what autoimmune actually demands of patients, and that Sanskrit सह uniquely carries both meanings (*to bear* + *with*) in one word. Branch `feat/rebrand-saha` off post-F02-C1 main; F01 C2 work stays on its own branch and is unaffected.

**Code sweep.**
- `package.json` `name` → `saha`.
- Directory rename `lib/saumya/` → `lib/saha/`; 21 import sites updated across the rules engine, app pages, and tests.
- `localStorage` keys (all pre-launch — no shipped data, no migration shim): `saumya.saveLater.v1` → `saha.saveLater.v1` (`lib/checkin/save-later.ts:26`), `saumya.ttsDisabled` → `saha.ttsDisabled` (`components/check-in/SpokenOpener.tsx:38`), `saumya.testUser.v1` → `saha.testUser.v1` (`app/check-in/page.tsx:124`, `app/journey/memory/page.tsx:24`). History-state key `saumyaDiscardModal` → `sahaDiscardModal` (`components/check-in/DiscardConfirm.tsx:46`).
- Brand references in `app/{LandingPage,layout,privacy/page,CheckInGrid,WaitlistCount,VoiceTranscript,check-in/page,journey/memory/page}.tsx`, `components/check-in/{SpokenOpener,Closer,DiscardConfirm}.tsx`, `lib/checkin/types.ts`, `convex/continuity.ts` straight-renamed.

**Landing page (Option B copy).** `app/LandingPage.tsx`:
- L25 hero pillar: *"Sixty seconds a day. No forms — Saha carries the record with you."*
- L57 privacy callout: *"What you say to Saha stays between you and Saha. Not used for model training. Not sold."*
- L412 label: *"Why Saha"*.
- L448 brand block (italic): *"Saha — सह — Sanskrit, two meanings at once: to endure and with. Because autoimmune is a long carry, and you don't carry it alone. Saha holds the days you can't, and walks beside the days you can."*
- L575 footer brand line: *"Saha — सह — Sanskrit. Endurance, and together. The two things this asks of all of us."*

**Documentation sweep.** All 14 active doc files updated *Saumya → Saha*. ADR-024 retains its body intact (historical record of the prior rename); only a `Superseded by ADR-025` header is added. ADR-025 appended with full Context / Decision / Immutability-extension / Consequences / Alternatives sections. `architecture-changelog.md` gets a top-of-file 2026-04-25 rename entry; older entries stay as historical timeline.

**Redirect proxy.** New `proxy.ts` at the repo root issues 308 permanent redirects from `saumya-*`, `sakhi-*`, and `autoimmune-*` Vercel hosts to `saha-health-companion.vercel.app`, preserving paths. Branch-preview hosts (`*-git-*`) are intentionally excluded so previews keep working under their own hostnames during development. Chose proxy over `vercel.json` redirects because the latter is path-based, not host-based — the proxy file convention runs at the edge before the page handler and is the cleanest place for host-conditional 308s. (Started as `middleware.ts`; Next 16 deprecates that name in favor of `proxy.ts` with `export function proxy()` — renamed before push.)

**Tests.** Updated import paths (`@/lib/saumya/*` → `@/lib/saha/*`) and key assertions in `tests/check-in/{opener-engine,closer-engine,save-later,spoken-opener}.test.{ts,tsx}`. No new tests for the rebrand itself — verification is by passing the existing 441 cases.

**Verification (planned).** Local: `pnpm tsc`, `pnpm vitest` (target 441/441 green), `pnpm next build`, manual smoke at http://localhost:3000 confirming the new brand block + footer copy, and Application → Local Storage check that save-later + TTS-disabled flags write under `saha.*`. Production: curl the legacy hosts and confirm 308 → saha with path preserved.

**Open follow-ups.**
- Vercel project rename (`saumya-health-companion` → `saha-health-companion`) and `saha-health-companion.vercel.app` add to the project's Domains list (per F02 C1 ship-day learning #d — without the explicit add, the new alias 401-blocks until added even with SSO's `all_except_custom_domains` mode).
- Push `feat/rebrand-saha`; `vercel env add NEXT_PUBLIC_CONVEX_URL preview feat/rebrand-saha …` (per build-log Session 7 lesson, the CLI rejects non-per-branch invocations); `vercel redeploy <branch-url>` so the new env var takes effect.
- After merge, verify the Vercel auto-promote landed; do **not** manually run `vercel --prod` (per F01 C2 ship-day learning #c — that creates a duplicate prod deploy).
- Memory write-through: `MEMORY.md` Autoimmune section heading → *(Saha, formerly Saumya)*; update `autoimmune_companion.md` if it references Saumya by name; record any new lesson surfaced by this rebrand (e.g., the host-conditional proxy pattern).

**Next.** Tag the Wave 2 integration commit, then dispatch reviewers.

---

## 2026-04-25 · Session 12 — Voice C1 plan saved, Onboarding plan parked

**Outcome.** Voice cycle pulled forward (originally Cycle 4/5 in the 6-cycle plan) with conversational scope locked: Saha speaks opener (Sarvam TTS), listens to freeform reply (Sarvam STT), follow-up questions for missing metrics, "Switch to taps" bail-out always visible. Plan written to `docs/features/voice-cycle-1-plan.md` and tagged on `feat/voice-sarvam`.

**Branch hygiene.**
- `feat/voice-sarvam` fast-forwarded past the rebrand merge (`b79f494`) so voice work starts from the post-rebrand main. Plan committed at `73d6204`, tagged `voice-c1/plan-saved`.
- Sweep applied to the plan: `ADR-025` → `ADR-026` (ADR-025 is now the Saumya→Saha rebrand); two memory-path typos `rewantprakash_1` → `rewantprakash-1` corrected.
- Onboarding Shell cycle plan (`docs/features/00-onboarding-shell-cycle-plan.md`, 383 lines) was drafted alongside the voice plan but covers a separate cycle. Moved to its own branch `feat/onboarding-shell-plan` (commit `318cac2`) so each cycle's plan lives where its work will happen. The branch is parked — sequencing per locked 6-cycle plan still puts Onboarding ahead of voice; revisit which cycle ships next when voice C1 wraps.

**Locked decisions for voice C1 (this session).**
- **Provider:** Sarvam AI for both STT and TTS (not OpenAI Realtime). Web Speech retained as dev/test fallback.
- **Conversational shape:** Multi-turn — extract from freeform reply, then per-metric follow-up questions for whatever was missed. Re-ask once on no-answer, then mark `declined`.
- **Bail-out:** B3 — single "Switch to taps" affordance on every voice screen, forward-only (cannot return to voice from Stage 2 in cycle 1). Partial metrics preserved on bail.
- **Sequencing:** Path 1 — voice off post-C2 main. (C2 was already shipped before this session began; rebrand merged after; voice branch starts from the rebrand-merged main.)
- **ADR plan:** ADR-026 will supersede ADR-018 on the Sarvam-deferral. ADR-018 stays in the record as point-in-time rationale.

**Open follow-ups.**
- Pre-flight Task 0 (steps 0.1–0.13 in the plan): write ADR-026, install `sarvamai`, scaffold env vars, extend `lib/voice/types.ts` + `lib/voice/provider.ts` + state machine, run STT and TTS audio-format spikes, smoke baseline.
- Update `~/.claude/projects/-Users-rewantprakash-1/memory/project_sakhi_voice_sarvam.md` to reflect the conversational scope expansion (currently records STT-only architecture).
- Onboarding branch is parked — when revisiting, rebase/fast-forward onto whatever main is at that point and confirm the locked Saha "endurance + together" voice still flows through the locked copy lines on Screens 2–5.

**Next.** Run pre-flight Task 0 on `feat/voice-sarvam`. Do not dispatch Wave 1 until pre-flight is green and Rewant signals.

---

## 2026-04-26 — Session 13: Onboarding Shell pre-flight (Task 0)

**Branch.** `feat/onboarding-shell-build` cut from `main` at `6977284` (post-rebrand, post-SSR-hardening). Plan commit (`45ee765`) cherry-picked across from `feat/onboarding-shell-plan` so the cycle plan lives alongside the code.

**Context flip.** Voice C1 was the active branch (`feat/voice-sarvam`) per Session 12 — Rewant's Path 1 call to ship voice ahead of onboarding. That call reverted this session: onboarding ships next per the locked 6-cycle plan, voice resumes after. Voice WIP (Sarvam pre-flight Task 0 — types, state-machine extension, web-speech adapter split-out, ADR-026, sarvam-format-spike outcomes) committed and pushed to `origin/feat/voice-sarvam` as commits `d9cd2ba` + `46b1959` so it's recoverable.

**Pre-flight stamps.**
- `lib/profile/types.ts` — canonical contract: `Profile` interface (v: 1, name, dobIso, email, condition, conditionOther, onboarded, createdAtMs, updatedAtMs), `Condition` union (10 + other), `PROFILE_KEY = 'saha.profile.v1'`, `PROFILE_VERSION = 1 as const`. **Build-B may NOT modify this file.**
- `lib/profile/storage.ts` — thin starter: `readProfile` (v-guard + malformed-JSON null + log-once warn), `writeProfile` (partial-patch merge, sticky `createdAtMs`, re-stamps `v` + `updatedAtMs` after spread), `clearProfile`, `markOnboarded`. **Build-B owns this file** and may extend; signatures + the `PROFILE_KEY` re-export are locked.
- `tests/profile/contract.test.ts` — 11 seam-guard tests (PROFILE_KEY value, PROFILE_VERSION, Condition exhaustiveness, Profile shape compile-check, round-trip, sticky createdAtMs, malformed JSON → null, wrong-version → null, markOnboarded, clearProfile).
- `docs/features/00-onboarding-shell-cycle-plan.md` — Task 0 checklist updated to reflect the actual pre-flight steps; ownership refinement recorded so Build-B doesn't accidentally rewrite `types.ts`.

**Verification.**
- `npm run test:run` → 452/452 (441 baseline + 11 contract tests).
- `npx tsc --noEmit` → clean.
- `npm run build` → clean.
- One TS strict-mode catch during work: my first `writeProfile` had duplicate `v` + `updatedAtMs` keys in a single object literal (the "spread then re-stamp" pattern). Refactored to two literals (`defaults` then `next` = `{ ...defaults, ...prior, ...patch, v, updatedAtMs }`) — same end result, clean compile.

**Surprises.**
- Voice WIP carried over an uncommitted `docs/architecture-changelog.md` write-up (substantive — voice C1 pre-flight summary) that I'd missed staging in the WIP commit. Caught it on the build branch via `git status`. Stashed under `voice-changelog-misplaced` for transfer back to the voice branch separately so it ships with that cycle's changelog entry, not this one.
- Tooling reset CWD between Bash calls a few times mid-pre-flight; first attempt at writing the seam files silently lost them when the working tree changed branches. Retried on a confirmed-correct branch, committed immediately rather than batching, and verified post-commit. Lesson for future pre-flights with parallel branches in play: **commit early, don't accumulate untracked files across `git checkout`s.**

---

## 2026-04-26 — Session 14: Unified app shell SHIPPED (PR #6 → `c0b5b28`)

**Branch.** `feat/unified-app-shell` cut from `feat/onboarding-shell-build` (which already carried the full onboarding-shell wave-1 work — chunks A, B, C — and the F01 C2 green-orb fix `21ef267` and `chore/ship-prod-docs` material). Squash-merged to `main` as **commit `c0b5b28`** via PR rewant24/autoimmune-health-companion#6. Branch deleted on remote (`gh pr merge --squash --delete-branch`).

**Why this cycle (deadline-driven).** Hour-deadline submission ask: tester goes from waitlist → "Try the demo" → can do a check-in but can't see it back, because save auto-redirects to `/` (marketing landing) and Memory lives at a separate disconnected URL. Two-screen disconnection means combined-flow testing is impossible and the submission doesn't read as one product. **Solution: Persistent app shell via Next.js layouts.** Both screens share a fixed bottom nav so they read as tabs of one app; post-save lands on Memory so the contribute → see-it-back loop closes.

**What shipped (the unification slice).**
- `app/check-in/layout.tsx` — added `<BottomNav />` mount after `{children}`, server component still.
- `app/journey/layout.tsx` — **new file**, mirrors check-in: passes children + mounts BottomNav.
- `app/check-in/saved/page.tsx` — `router.push('/')` → `router.push('/journey/memory')` (auto-dismiss target). Removed the `NEXT_PUBLIC_F02_C1_SHIPPED` env-flag gate around the "View memory" CTA — now renders unconditionally. F02 C1 has shipped, the flag was a pre-F02 guard that's no longer needed; removing it eliminates one env-var dependency.
- `components/memory/MemoryTab.tsx` — bottom padding bumped from `pb-[max(1rem,env(safe-area-inset-bottom))]` to `pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]` so the last event row clears the persistent fixed-bottom nav.
- `app/LandingPage.tsx` — footer collapsed: removed adjacent `Try the demo` (`/check-in`) + `Memory` (`/memory`) links, replaced with single `Open the app` → `/check-in`. User enters the app shell at the check-in tab; Memory is one tap away.
- `tests/check-in/saved-route.test.tsx` — three env-flag tests removed; replaced with a single unconditional CTA test; redirect-target assertion updated to `/journey/memory`.

**What also shipped (bundled, because the branch base carried it).** The PR also merged the entire onboarding-shell wave-1 work that was already merged into `feat/onboarding-shell-build`: welcome screen, 5 onboarding screens + dynamic `[step]` route, 4 setup steps (name, dob, email, condition), `/home` page with greeting + check-in card + meds-setup nudge + metric-viz placeholder, the 5-pillar `BottomNav`, the locked seam in `lib/profile/{types,storage}.ts` + 11 contract tests, landing `GetStartedCTA` toggle on `profile.onboarded`, and the `scripts/ship-prod.sh` from `chore/ship-prod-docs`. Did **not** include this session's local-only follow-on commits `c7a60a0` (R3 a11y + test stability + smoke test) and `835a1fd` (R1 Saha-voice copy revisions) — those landed on the branch *after* `9632937` (the unification commit) and were never pushed before the merge. Both are still recoverable from reflog.

**Verification.**
- `pnpm tsc --noEmit` clean.
- `pnpm vitest run` → 570/570 passing (vs the 452/452 onboarding-shell baseline; delta is the bundled wave-1 test suites + updated saved-route tests).
- `pnpm next build` → all 16 routes resolve (`/check-in`, `/check-in/saved`, `/journey/memory`, `/home`, `/welcome`, `/onboarding/[step]`, `/setup/{name,dob,email,condition}`, `/`, `/memory` 307, etc.).
- **Manual smoke deferred** — Vercel auto-promote of `c0b5b28` was in flight at hand-off. Live walk-through of Landing → "Open the app" → save → land on Memory still TBD on `https://saha-health-companion.vercel.app`.

**Surprises.**
- Tooling auto-checkout mid-session moved HEAD between branches without warning (reflog confirmed). At one point my unification edits appeared "lost" because HEAD was on `feat/voice-sarvam`. Recovered via `git reflog` + `git stash list` — work was preserved. **Repeats Session 13's lesson:** with multiple feature branches in play, commit + push at every verified milestone, never trust a clean working tree at the start of a step.
- Branch base inflation: `feat/unified-app-shell` was cut off `feat/onboarding-shell-build` (which had wave-1 already merged in) rather than off `main`. Result: the PR diff was 51 files / +4,554 lines instead of the ~6 files the unification touches. For a deadline ship this was the right call (one merge, two cycles' worth of progress to prod). For normal cadence, branch off `main` to keep PRs scoped.
- The `View memory` CTA env-gate had been waiting since F02 C1 ship (the flag was never flipped on Vercel). Removing the gate entirely was simpler than setting `NEXT_PUBLIC_F02_C1_SHIPPED=true` and is the durable fix.

**Architectural decision recorded inline (no new ADR).** Mounting the persistent BottomNav via Next.js per-route-group layouts (`app/check-in/layout.tsx`, `app/journey/layout.tsx`) instead of a route-group rename (`app/(app)/...`). Considered route-group syntax but rejected it because: (a) URLs stay identical with the layout approach too, no value-add from the rename; (b) layout-mounting requires zero file moves and zero test-path churn; (c) two layouts is fewer LOC than a route-group + one `(app)/layout.tsx`. The trade-off: if a third app-shell screen ships later (e.g., `/medications`), it'll need its own layout to mount the nav — at three repeats, refactor to a shared route group. Two is below the threshold.

**Open follow-ups.**
- Live smoke on `https://saha-health-companion.vercel.app` once auto-promote lands: Landing → "Open the app" → check-in → save → Memory → tap Check-in tab → back → BottomNav persistent throughout. Per the ship-day-manual-smoke memory, vitest green is not the same as feature-correct.
- Verify prod data lands in Convex `usable-zebra-515` waitlist + `checkIns` tables under the same `saha.testUser.v1` user stub.
- Land the local-only R3 fix-pass commits `c7a60a0` + `835a1fd` (still in reflog) on a follow-up branch off current `main`; those are onboarding polish, not unification.
- Voice C1 still parked on `feat/voice-sarvam` at `4c8f332`, tag `voice-c1/pre-flight-done`. Resume with Wave 1 dispatch when Rewant calls for it.
- Stale Vercel aliases (`saumya-*`, `sakhi-*`, `autoimmune-*`) still attached — proxy 308s handle them, leave for cleanup later.

**Next.** Tag `onboarding-shell/pre-flight-done`, push branch + tag. Then Wave 1 dispatch — three parallel build subagents (A onboarding screens, B setup + storage, C welcome + home + nav) in a single multi-tool-call message, per the cycle plan §Task 1.

---

## 2026-04-26 — Session 15: Voice C1 Wave 1 dispatched + integrated

**Branch.** `feat/voice-sarvam` advanced from `a451ab8` (`voice-c1/pre-flight-done`) to `5026342` (`voice-c1/wave-1-integrated`). Branch base unchanged. Local only — no push, no Vercel/Convex commands.

**Setup.** Four git worktrees at `/Volumes/Coding Projects + Docker/voice-c1-build-{a,b,c,d}/`, each on `feat/voice-c1/build-{a,b,c,d}` rooted at the pre-flight tag. `node_modules` symlinked from main checkout. Four parallel build subagents dispatched in a single multi-tool-call message per `docs/features/voice-cycle-1-plan.md` §Task 1.

**What shipped (per chunk).**
- **V.A — STT route + SSE bridge** (4 commits, 14 tests). `app/api/transcribe/route.ts` POST proxy with SSE partial + final events, `runtime = 'nodejs'`. `lib/voice/sarvam-stt-server.ts` wraps `sarvamai`'s `speechToTextStreaming.connect` with `{ model: 'saaras:v3', input_audio_codec: 'wav', sample_rate: '16000', high_vad_sensitivity: 'true' }` per spike outcome. Cost guards: 415 on bad content-type, 5 MB byte cap (`voice.session_too_large`), 90 s duration cap (`voice.session_too_long`), `X-Voice-{Bytes,Duration-Ms}` headers. 503 if `SARVAM_API_KEY` missing. `request.signal` abort closes upstream Sarvam socket cleanly.
- **V.B — STT adapter + recorder** (2 commits, 40 tests). `lib/voice/sarvam-adapter.ts` implements `VoiceProvider` over `/api/transcribe` with chunked `fetch` upload (`duplex: 'half'`) + SSE consumer. `lib/voice/sarvam-recorder.ts` is the WebAudio resampler — `MediaStream` → `AudioContext` → 16kHz mono PCM s16le → 250ms WAV chunks (PCM-only path mandatory per spike, WebM/Opus rejected by Sarvam). Constructor `language_code` mandatory, flows through `?lang=` query param. Public `abort()` method beyond the `VoiceProvider` interface for bail-to-taps wiring.
- **V.C — TTS route + adapter** (2 commits, 23 tests). `app/api/speak/route.ts` POST `{ text, language_code, voice? }` calls `client.textToSpeech.convert` REST endpoint, base64-decodes `audios[0]`, returns `audio/wav`. Defaults `speaker: 'anushka'`, `model: 'bulbul:v2'` (best `en-IN` female on the bulbul:v2 line per spike, ~1.1 s first byte). `lib/voice/sarvam-tts-adapter.ts` implements `TtsProvider` with blob-URL playback (no `MediaSource`, no WebAudio decode — wav plays direct). Idempotent re-cancel rejects pending speak with `{ kind: 'aborted' }`.
- **V.D — follow-up engine + variants + decline detector** (3 commits, 45 tests). `lib/saha/follow-up-engine.ts` exports `selectFollowUpQuestion(metric, attempt, continuityState)` and `selectDeclineAcknowledgement(metric)`. `lib/saha/follow-up-variants.ts` carries the 22-string locked catalog (5 metrics × 2 attempts × 1 continuity-tone variant on `flare`, plus 5 decline acks). `lib/saha/decline-detector.ts` runs `/\b(?:skip|next|don'?t (?:want|know)|not sure|move on|pass|none|nothing)\b/i` — conservative.

**Integration.** Sequential `--no-ff` merges into `feat/voice-sarvam` in order V.A → V.B → V.C → V.D. Zero file-ownership overlap (verified with `git log --name-only voice-c1/pre-flight-done..feat/voice-c1/build-*`), zero conflicts. Tag `voice-c1/wave-1-integrated` placed at `5026342`.

**Verification.**
- `npm run test:run` → **706/706 passing** (was 588 at pre-flight; +118 from Wave 1: 14 V.A + 40 V.B + 23 V.C + 45 V.D, minus a small overlap in renamed setup files).
- `npx tsc --noEmit` clean.
- `npm run build` clean — new ƒ routes `/api/speak` and `/api/transcribe` surfaced. All 17 routes resolve.

**Surprises / lessons (Wave 1).**
- **jsdom has no `ReadableStream`.** V.A and V.B both polyfilled it from `node:stream/web` in their test files. Worth noting for any future test that posts a streaming body — production code is fine because Next.js exposes `ReadableStream` natively in its runtimes.
- **Sarvam streaming STT does NOT accept WebM/Opus** at the protocol level (`SpeechToTextStreamingInputAudioCodec` enumerates only `wav | pcm_s16le | pcm_l16 | pcm_raw`). Confirmed during the pre-flight spike, baked into V.B's WebAudio resampler. `MediaRecorder` raw passthrough was never an option.
- **`SpeechToTextStreamingSocket.transcribe` accepts `audio: string` (base64), not `Buffer`.** V.A wraps `Buffer.from(...).toString('base64')` per chunk.
- **No `is_final` flag on STT messages** in the SDK version we're on (`sarvamai` 1.1.7). V.A treats every transcript as the running text and promotes the LAST one to "final" on flush/close.
- **Pre-existing Next 16 PageProps issue** on `app/check-in/page.tsx` (`CheckinPageProps = {}` test-seam default) and `app/check-in/saved/page.tsx` (`SavedView` named export). Surfaces as an error in `next build` when run from a *worktree* with symlinked node_modules — does NOT reproduce in the main checkout. Wave 2 rewires `page.tsx` and removes the `providerOverride` test seam, which fixes the first organically. The `SavedView` named-export issue is a separate small cleanup for Wave 2.
- **Build-A's enqueue-then-close ordering on SSE error frames is load-bearing.** All cap-hit / abort paths enqueue the error frame *before* `handle.close()` because the close callback closes the controller synchronously. V.B's adapter relies on receiving these frames; documented in code comments at each occurrence.
- **Public `abort()` on `SarvamAdapter`** is intentionally beyond the `VoiceProvider` interface — Wave 2's bail-to-taps wiring needs to cancel without going through the `stop()`-then-await dance. If the page-level orchestrator prefers a different surface, easy to rename.

**Next.** Wave 2 (orchestrator only — no parallel chunks): flip the two placeholders in `lib/voice/provider.ts`, trash the `lib/voice/tts-adapter.ts` re-export shim, implement state-machine transitions for the 7 new events, build `<SwitchToTapsButton>`, rewire `app/check-in/page.tsx` for the multi-turn loop + closer TTS + same-day-reentry quick path. Local smoke against a dev `SARVAM_API_KEY`. Tag `voice-c1/wave-2-integrated`. Still no push / no Vercel / no Convex until Rewant promotes.

---

## 2026-04-26 — Session 16: Voice C1 Wave 2 integrated

**Branch.** `feat/voice-sarvam` advanced from `5026342` (`voice-c1/wave-1-integrated`) to `bbf532d`. Local only — no push, no Vercel/Convex commands. Tag `voice-c1/wave-2-integrated` placed at HEAD.

**Wave 2 commits (orchestrator pass — no parallel chunks).**
- `fa7ff01` — **W2.1.** Flip both placeholders in `lib/voice/provider.ts` to construct real Sarvam adapters when env vars say so. `NEXT_PUBLIC_*` fallbacks added so client code can read the active provider.
- `fac532c` — **W2.2.** Trash the legacy `lib/voice/tts-adapter.ts` re-export shim (renamed to `web-speech-tts-adapter.ts` during pre-flight). Repoint `<SpokenOpener>` through `getTtsProvider()` so it goes through the unified TTS abstraction.
- `5832452` — **W2.3.** State-machine transitions for the seven new voice events. `PERMISSION_GRANTED` carries an optional `opener` payload to route into `speaking-opener`; `CONFIRM` carries an optional `closer` payload to route into `speaking-closer`. `ASK_QUESTION` accepts an optional `seed` so the page can dispatch from `extracting` (cold path) or `extracting-answer` (loop). `ANSWER_EXTRACTED` handles three outcomes: extracted (fold), declined (null + append), neither (state unchanged so the page can re-ask). `BAIL_TO_TAPS` carries the running loop payload to a Stage 2 with `metrics`, `missing`, `declined` preserved. Helpers `emptyStage2(transcript?)` and `carryToStage2(state)` keep the transition cases readable. 22 new state-machine tests; existing 47 still pass.
- `5dcb578` — **W2.4.** `<SwitchToTapsButton>` sticky-bottom bail affordance. 200 ms fade-in via `requestAnimationFrame`; collapses to instant when `prefers-reduced-motion: reduce` is set. `min-h-11` hit target satisfies WCAG 2.5.5 AA. Pure leaf — no state-machine coupling, parent owns mount/unmount.
- `bbf532d` — **W2.5.** Page rewire. Hook gains `UseCheckinMachineOptions.getOpener` so it can attach the opener to PERMISSION_GRANTED. Hook also re-arms the provider when entering `listening-answer` so the user can speak the answer turn after question TTS resolves, and intercepts `TAP_ORB` in `listening-answer` to call `provider.stop`. Page adds `useEffect`s for each speaking state (kick `tts.speak`, dispatch `*_PLAYED` on resolve) and an `extracting-answer` effect that calls `extractMetrics` + `detectDecline` and dispatches `ANSWER_EXTRACTED` with three branches plus a re-ask counter (one re-ask per metric, then auto-decline). Cold extraction effect branches: voice mode + missing > 0 dispatches `ASK_QUESTION + seed` directly into the loop, taps mode keeps the C1 `EXTRACTION_DONE → stage-2` path. Same-day re-entry quick path pre-fills the ConfirmSummary with the prior row's values when the freeform turn yields nothing new. `CONFIRM` dispatched with closer payload when voice mode is active so the reducer routes through `speaking-closer`. `ConfirmSummary` render branch extended to keep the card visible during `speaking-closer`. `<SwitchToTapsButton>` mounted during the four loop states; click fires `tts.cancel()` then `BAIL_TO_TAPS`.

**Verification.**
- `npm run test:run` → **728/728 passing** (was 706 at Wave 1; +22 from W2.3 state-machine + 6 from W2.4 button = +28 tests, with 6 W2.3 voice-state pre-flight no-op tests removed = net +22).
- `npx tsc --noEmit` clean.
- `npm run build` clean — 17 routes, no new failures, the pre-existing Next 16 `PageProps = {}` issue did not surface this run (the rewire did not change the seam shape; suspect it's worktree-specific as noted in Wave 1 surprises).

**Voice mode predicate.** `tts.isAvailable()` snapshotted once per mount. In jsdom this returns `false` (no `globalThis.speechSynthesis`), so the existing `screen-shell.test.tsx` continues to drive the C1 freeform path through the page — `PERMISSION_GRANTED` arrives without an opener payload, the reducer transitions to `listening`, the orb's aria-label flips to "Stop check-in", test passes. In real browsers Web Speech reports availability honestly; the Sarvam adapter always returns `true`. So both adapters slot in without any test changes.

**Surprises / lessons (Wave 2).**
- **Branch-switch mid-session clobbered an in-progress Edit.** Worked around per the F01 C2 ship-day learning #e ("git checkout between branches mid-session can clobber uncommitted edits silently — stay on the feature branch and commit early/often"). After the clobber, switched back to `feat/voice-sarvam` and re-applied W2.3 from scratch, then committed before any further branch movement.
- **Heredoc + apostrophe in commit messages.** Single-quoted heredoc still failed when the body contained an apostrophe ("opener's"). Switched to `git commit -F - <<'EOF'` and dropped apostrophes from message bodies — clean.
- **Optional-payload pattern for backward compat is the cheap unlock.** Extending `PERMISSION_GRANTED` / `CONFIRM` / `ASK_QUESTION` with optional fields rather than adding new event types preserves every C1 test verbatim — the reducer just branches on the presence of the payload.
- **Hook re-arm semantics.** `useCheckinMachine` now calls `provider.start()` again whenever the reducer enters `listening-answer`. The Sarvam adapter creates a fresh recorder per `start()` so this is safe; the Web Speech adapter likewise re-arms cleanly. The PERMISSION_GRANTED that the re-armed start resolves with is swallowed by the reducer because we're already past `requesting-permission` — no transition fires.
- **Voice mode = TTS available.** Going by `tts.isAvailable()` (not STT) keeps the predicate consistent: if Saha can't speak, there's no point gating the user through "wait for opener TTS". STT availability is decoupled — Web Speech STT might be unavailable but TTS works, in which case the user still gets the spoken opener and answers via tap fallback after `BAIL_TO_TAPS`.

**Deferred polish (not required for W2.6 ship).**
- **8-second silence auto-stop in `listening-answer`** — plan §2.5 calls it a "client-side guard" on top of Sarvam VAD; not implemented. User has to tap the orb to stop the answer turn. Acceptable for dev smoke; revisit before public ship.
- **Custom screen-shell tests for the voice loop** — W2.5 is covered by existing `state-machine.test.ts` Wave-2 transitions and the `<SwitchToTapsButton>` unit test. End-to-end page tests (driving through opener TTS → answer turns → closer TTS) are deferred — they require fake TTS + fake STT + fake Convex + a fake extract endpoint. Reasonable to add before review.

**Next.** Local manual smoke against a dev `SARVAM_API_KEY` (`SARVAM_API_KEY=… NEXT_PUBLIC_VOICE_PROVIDER=sarvam NEXT_PUBLIC_VOICE_TTS_PROVIDER=sarvam npm run dev`) → `/check-in` → tap orb → hear opener → speak partial reply → hear follow-up question → speak answer → hear next → reach ConfirmSummary → hear closer → save. Verify Network tab: `/api/transcribe` once per voice turn, `/api/speak` once per TTS, no `SARVAM_API_KEY` in client payloads. Then Wave 3 (review pass — three parallel reviewers per the playbook). Still no push / no Vercel / no Convex until Rewant promotes.

---

## 2026-04-27 — Session 17: Voice C1 fix-pass (production-ready Scope B)

**Branch.** `feat/voice-sarvam` advanced from `fdb00eb` (cold-eyes review fix-pass) with six in-tree changes from this session — uncommitted at hand-off. Local only — no push, no Vercel/Convex commands per the standing constraint.

**Why this fix-pass.** First Vercel preview smoke after Wave 2 surfaced two pre-existing bugs that vitest never caught:
1. **No auto-played opener.** Opener TTS was gated post-`PERMISSION_GRANTED`, so on `/check-in` cold mount the user saw a silent screen. Visible only via real browser smoke.
2. **No live transcript.** Commit `307dd0d` moved the adapter from streaming POST to buffered POST (single fetch on `stop()`) because Chrome blocks streaming request bodies on HTTP/1.1, and `next dev` is HTTP/1.1. The buffered path silently broke the `partials: true` capability flag — server-side SSE was still streaming, but the client never opened the response until after `stop()`.

User chose Scope B (full fix, production-ready) and "PLAN THE ENTIRE MODE FIRST". Plan saved at `/Users/rewantprakash_1/.claude/plans/proud-weaving-lake.md`. Six phases — five structural, one ship.

**What shipped (this session).**

- **Phase 1 — Streaming POST in `SarvamAdapter` with HTTP/1.1 fallback.** `lib/voice/sarvam-adapter.ts` now offers `streamingMode: 'auto' | 'streaming' | 'buffered'`. Auto-mode probes once at `start()`: `https:` + Vercel-style → streaming, else → buffered. Streaming path allocates a `TransformStream`, fires `fetch('/api/transcribe?lang=…', { method: 'POST', body: bodyStream.readable, duplex: 'half' })` immediately, recorder chunks pipe into the writer, SSE response is consumed in parallel so partial frames fire `onPartial(text)` listeners during recording. `stop()` closes the writer, server flushes Sarvam, final frame resolves the promise. Buffered path unchanged. Wired `provider.onPartial(text => dispatch({ type: 'PARTIAL', text }))` in the page so the existing reducer slot at `state-machine.ts:45` actually populates. Capabilities flipped to `{ partials: true, vad: true }` — now truthful on the streaming + Phase 2 path.

- **Phase 2 — Client-side silence VAD auto-stop in `SarvamRecorder`.** `lib/voice/sarvam-recorder.ts` exports tunable constants: `SPEECH_RMS_THRESHOLD = 0.02` (chunk must exceed this to count as "heard speech"), `SILENCE_RMS_THRESHOLD = 0.01` (chunk below this is silent), `SILENCE_TRAILING_CHUNKS = 6` (1.5 s at 250 ms cadence). New `onSilenceDetected(cb)` listener; new `updateSilenceVad()` runs RMS over each emitted chunk and fires the listener once after `hasHeardSpeech === true && consecutiveSilentChunks >= SILENCE_TRAILING_CHUNKS`. Adapter wires `recorder.onSilenceDetected(() => this.stop())` in `start()`. The Stop button (Phase 4) and orb tap remain manual escape hatches.

- **Phase 3 — Auto-play opener via `idle-greeting` + `idle-ready` states.** Decoupled opener-greeting from permission-request. Two new states in `lib/checkin/state-machine.ts`: `idle-greeting` (TTS playing, no mic) and `idle-ready` (greeting done, awaiting first orb tap). Three new events: `START_GREETING { text, variantKey }`, `GREETING_PLAYED`, `GREETING_FAILED`. Transitions: `idle + START_GREETING → idle-greeting`, `idle-greeting + (GREETING_PLAYED | GREETING_FAILED) → idle-ready`, `idle-greeting + TAP_ORB → requesting-permission` (impatient skip), `idle-ready + TAP_ORB → requesting-permission`. `toOrbState` maps both new states to `'idle'` visual. Hook `wrappedDispatch` TAP_ORB now uniformly handles all three idle-flavored kinds; opener payload only attached when starting from cold idle so users don't hear the greeting twice. Page gained two effects: cold-mount `START_GREETING` dispatch (gated on `ttsAvailable && !coldGreetingDispatchedRef.current`) and 3a-greeting effect that fires `tts.speak(state.text)` and dispatches `GREETING_PLAYED` / `GREETING_FAILED` on resolve/reject. `<SpokenOpener>` got an optional `autoSpeak?: boolean = true` prop, set to `!ttsAvailable` so the page-level greeting effect owns playback when TTS is available — no double-fire.

- **Phase 4 — `<StopButton>` + heard-transcript display.** New `components/check-in/StopButton.tsx` mirrors `SwitchToTapsButton` (sticky bottom, full width, large tap target, "Tap when done" label, 200 ms rAF fade-in with `prefers-reduced-motion` static fallback). Mounted during `listening` and `listening-answer`; click dispatches `TAP_ORB`, the same handler the orb uses, so the hook's existing intercept path calls `provider.stop()` cleanly. `transientCopyFor` now echoes `"I heard: '<transcript>'"` during `processing` / `extracting` / `extracting-answer` so the user sees what was captured before extraction lands.

- **Phase 5 — Honest capability flags + doc updates.** Capabilities at `sarvam-adapter.ts` are now `{ partials: true, vad: true }` — truthful with Phase 1 + Phase 2 in place. ADR-027 appended to `docs/architecture-decisions.md` covering all six structural fixes (streaming-fallback rationale, silence VAD parameters, idle-greeting state pair, StopButton + heard-transcript pattern, capability-flag truthfulness, supersedes/amends section). 2026-04-27 entry added to `docs/architecture-changelog.md`.

**Verification.**
- `npx tsc --noEmit` clean.
- `npm run test:run` → **755/755 passing** (was 728 at end of Wave 2; +27 from this session: 5 streaming-adapter + 4 silence-VAD + 6 greeting-state-machine + 3 StopButton + 9 page/integration tests touched in tandem).
- `npm run build` clean — all 17 routes resolve. Pre-existing Next 16 `PageProps = {}` worktree-only issue did not surface.
- **Manual smoke deferred.** Per the standing constraint, no push / no Vercel / no Convex until Rewant promotes. Local `npm run dev` smoke (six steps from plan §Phase 6) and Vercel preview smoke (HTTP/2 → live partials should fire) still TBD.

**Surprises / lessons.**
- **`vercel-c1` plan estimated 737/737 baseline → ~750+ post-fix.** Actual: 728 baseline → 755. Off by ~3 — close enough; the discrepancy was 3 pre-existing tests removed during the buffered-path refactor that I forgot were already gone.
- **jsdom protocol auto-resolves to buffered.** All 26 existing buffered-mode `sarvam-adapter` tests passed without modification because jsdom defaults to `http:` and `streamingMode: 'auto'` falls back to buffered for non-`https:`. The 5 new streaming-mode tests hard-set `streamingMode: 'streaming'` and polyfill `TransformStream` from `node:stream/web`.
- **`OpenerVariantKey` does not include `'cold-start'`.** First pass of state-machine tests used `variantKey: 'cold-start'` and tsc complained. Replaced with `'first-ever'`. Worth confirming the locked taxonomy before fabricating variant keys.
- **`SpokenOpener.tsx` had its own auto-speak `useEffect`** that would have raced the page-level greeting effect. Adding `autoSpeak?: boolean = true` lets the page disable internal speak when it owns playback, while the prop default keeps any other call sites (none in this repo, but hypothetically) working unchanged.
- **`StopButton` opacity fade-in test failed under `act(() => {})`** — rAF doesn't flush from a sync `act`. Fixed by following `SwitchToTapsButton`'s `await waitFor(() => expect(btn.style.opacity).toBe('1'))` pattern.
- **`bodyStream.controller` is the wrong API for fetch.** Used `TransformStream` instead — `body: bodyStream.readable`, then `bodyStream.writable.getWriter().write(chunk)` per recorder chunk. Standard Whatwg streams idiom; no surprises in production but jsdom needs the `node:stream/web` polyfill.
- **The deprecated `speaking-opener` state.** Phase 3 left `speaking-opener` in place for the `re-entry-same-day` opener variant code path inside `getOpenerForGrant`. It's dead for cold mounts now but live for re-entry quick paths. TODO logged in plan §5 for post-ship consolidation.

**Risks still standing.**
- **Browser autoplay block.** Some browser configs block TTS even after navigation gesture. If `GREETING_FAILED` fires consistently in real testing, fall back to a one-tap-to-greet button. Detect via failure rate during smoke. Mitigation already in: `GREETING_FAILED` lands in `idle-ready` so flow continues with no audio.
- **HTTP/2 streaming on Vercel.** Edge Runtime vs Node Runtime semantics around `duplex: 'half'` and `request.body` reader behavior should be verified on preview before ship. Route is `runtime: 'nodejs'` — keep it.
- **Silence VAD false positives.** Background noise (loud room, breathing) may keep RMS above the silence threshold and never auto-stop. Stop button is the safety net. Real-world threshold tuning likely needs follow-up.

**Next.** Commit the in-tree session work (six modified files + three created). Then walk Phase 6 §Local: `npm run dev` → `/check-in` cold → opener auto-plays → tap orb → speak → transcript appears (final-only locally; live partials only on HTTP/2) → Stop button OR silence auto-stops → see heard transcript → save. After local smoke passes, push branch + run Vercel preview smoke (HTTP/2 → live partials should fire). After preview smoke passes, squash-merge to main, run `scripts/ship-prod.sh` for Convex prod, prod smoke on `https://saha-health-companion.vercel.app/check-in`, tag `voice-c1/shipped`, update MEMORY.md. Still no push / no Vercel / no Convex until Rewant promotes.

---

## 2026-04-28 — Voice C1 Bug 1: pivot from streaming WS to REST batch (ADR-028)

**Context.** Voice C1 shipped end-to-end on the `feat/voice-sarvam` branch (commit `a451ab8`) but every check-in returned `{type:"final", text:"", durationMs:~260, bytes:~700KB}`. Two prior fix attempts on this same branch — Option A (codec swap to `pcm_s16le`) and Option B (prepend a 44-byte WAV header) — closed type-system ambiguity but did not move the bug. The audio was reaching Sarvam; Sarvam was emitting zero events.

**Diagnostic walk this session.**
1. Read `docs/voice-c1-bug-1-history.md` and the active two-option fix plan. Three live hypotheses: H1 (250 ms post-flush wait too short), H2 (chunked transcribe needed), H3 (long-tail silent failure).
2. Walked `node_modules/sarvamai/dist/esm/api/resources/speechToTextStreaming/client/{Socket.mjs,Client.mjs}`. Found that `transcribe()` enqueues a frame and `flush()` sends `{type:"flush"}`, but the WS only honours `flush` when opened with `flush_signal=true` as a query param. SDK type surface does not expose this. We never set it — and our usage pattern (buffer entire utterance client-side, POST as one frame in <50 ms, force-close 250 ms after `flush()`) cannot trip Sarvam's VAD on its own. Result: zero events emitted server-side, every session.
3. **Recorder validation (Option A.0 listening spike).** Captured a 22 s `/tmp/last-upload.wav` via a temporary dump branch in the route, reverted the dump, then analysed in Node.js: valid 44-byte RIFF/WAVE header, 16 kHz mono 16-bit PCM, RMS=0.041, peak=0.31, ~30 s duration, real voice-activity profile, no clipping or DC offset. Audio is fine. Bug is in protocol choice.
4. **Decision.** Pivot to Sarvam's REST batch endpoint (`POST https://api.sarvam.ai/speech-to-text`, multipart form-data, synchronous JSON response). REST batch is the right tool for a buffered upload — no VAD/flush/timing race possible.

**Code delta (single fix-pass).**
- New: `lib/voice/sarvam-stt-rest.ts` — thin `transcribeBatch(opts)` doing direct `fetch` + `FormData` (file + model + mode + language_code), typed `SarvamRestError` with `voice.{provider_unconfigured,network,session_too_long,session_too_large,unprocessable,aborted}`, `readSarvamApiKey()` for the 503 short-circuit, `fetchImpl` test seam.
- New: `tests/voice/sarvam-stt-rest.test.ts` — 17 tests (3 readSarvamApiKey, 3 happy-path, 10 error-path mappings, 1 SarvamRestError class).
- Rewritten: `app/api/transcribe/route.ts` — buffers the request body with a 1 MB byte cap, calls `transcribeBatch` with a 30 s `AbortSignal`, emits exactly **one** SSE `final` frame on success or **one** SSE `error` frame on failure. Caps tightened from 5 MB / 90 s to 1 MB / 30 s to match Sarvam's REST batch limits. `X-Voice-{Bytes,Duration-Ms,Cap-Hit}` headers preserved.
- Rewritten: `tests/api/transcribe-route.test.ts` — 16 tests covering happy path, lang query forwarding, byte/duration cap, content-type guards, key absence (503), key non-leakage, X-Voice-* headers on success + 503, SarvamRestError mapping for 4 error codes, non-Sarvam throw remap, empty-body rejection.
- Deleted: `lib/voice/sarvam-stt-server.ts` — streaming WS bridge no longer referenced by any source file.
- Build plan doc: `docs/voice-c1-bug-1-options-build-plan.md` (untracked) captures the three options (A: REST batch, B: keep WS + add `flush_signal=true`, C: chunked transcribe) and the decision rationale.

**Wire-shape compatibility with the browser adapter.** Adapter unchanged — still POSTs `audio/wav` body to `/api/transcribe?lang=…`, still parses SSE `data: {…}` envelopes via `drainSseEvents`, still dispatches on the JSON `type` field. The only observable change is that no `partial` frames are ever emitted (REST batch is synchronous; partials are conceptually impossible). The check-in page already handled the partials-absent case from local-dev buffered mode; nothing else moves.

**ADR + changelog.** ADR-028 added to `docs/architecture-decisions.md` (replaces ADR-027's upload-transport half; ADR-026 unchanged). 2026-04-28 entry at the top of `docs/architecture-changelog.md`. Resolution section appended to `docs/voice-c1-bug-1-history.md` recording the definitive root cause (VAD + missing `flush_signal=true`), why H1/H2/H3 were each the wrong hypothesis to chase, and the code delta.

**Validation.**
- `npm run typecheck` — clean.
- `npm run test:run` — **797/797 passing** (was 755 end of Voice C1 fix-pass; +42 from this session is the net of 16 new route tests + 17 new sarvam-stt-rest tests + 9 sarvam-adapter tests now reachable that were `.skip`'d during the streaming-WS work).
- `npm run build` — green; all 17 routes resolve.
- Live smoke on `next dev` is the next step (handed to Rewant). Per the standing constraint: no push / no Vercel / no Convex until Rewant promotes.

**Tradeoff acknowledged.** Live word-by-word `partial` SSE frames are gone. ADR-027 §1 had restored them on Vercel HTTPS via streaming POST → streaming WS; that path is collateral damage here because it shared the broken upstream. Restoring partials would require a streaming-friendly STT provider or a Sarvam streaming-WS path with `flush_signal=true` properly threaded — out of scope for closing Bug 1.

**Surprises / lessons.**
- **The recorder was fine the whole time.** I argued strongly for Option A on protocol-level analysis but had not verified the audio. Rewant's "build plan and revisit inference" prompt forced an honest re-check, and the listening-spike (objective Node.js analysis of the captured WAV) confirmed the recorder is healthy. Lesson: when a bug looks protocol-level, *still* verify the upstream input is what you think it is — cheap insurance against a phantom fix.
- **SDK type surfaces lie.** Sarvam's SDK accepts `input_audio_codec: 'pcm_s16le'` and a `flush()` method, but the actual server semantics depend on a `flush_signal=true` query param undocumented in the type system. Walking the SDK source (`node_modules/.../Client.mjs`) was the only way to find it. Lesson: when an SDK behaves differently from its documented contract, read the `dist/` source.
- **Three failed attempts on the same branch is the signal to question the protocol, not the parameters.** Option A and Option B both adjusted parameters (codec, header). Bug persisted. The right move was to question whether the streaming-WS protocol fits our buffered usage pattern at all. It does not. REST batch fits. One pivot closes the bug; three more parameter tweaks would have produced more phantom fixes.
- **Sensitive-redaction-vs-empty trap (recurring).** The `vercel env pull` redaction-vs-empty trap from the 2026-04-26 prod incident is in the same family as this bug: surface-level type acceptance does not equal semantic correctness. Same lesson, different layer.

**Next.** Live smoke on `next dev`: cold mount `/check-in` → opener auto-plays (ADR-027 path) → tap orb → speak → silence-VAD or StopButton triggers `stop()` → SSE `final` frame returns the transcript synchronously → "I heard …" echo → Save. Caps to verify: 1 MB byte cap (≈30 s of audio at 32 KB/s); 30 s duration cap. After local smoke passes, push branch, Vercel preview smoke (no live partials this time — that's expected, not a regression), squash-merge, prod smoke. Memory updates and `voice-c1/bug-1-resolved` tag still TBD.

---

## 2026-05-09 — Session 18: F05 Doctor Visits + Blood Work C1 SHIPPED (PR #22 → `0222d5f`, tag `f05-c1/shipped`)

**MVP feature scope is now closed.** F05 was the last feature in MVP — F06 (Doctor Report), F07 (Prepare-for-Visit), F08 (Journey aggregation) all unblock from this ship.

**What landed.**
- Backend (`convex/doctorVisits.ts`, `convex/bloodWork.ts`) — create/update/get/list/soft-delete with `clientRequestId` idempotency, `bloodWork.markers[]` validation, `abnormal` derivation when reference bounds present, mock-ctx-friendly handler signatures with injectable `now`.
- Manual UI — `/visits/{,new,[id]}` + `/blood-work/{,new,[id]}`. `BloodWorkForm` with default markers CRP / ESR / WBC / Hb pre-populated and removable. `VisitForm` with doctor / specialty / visit-type / notes. Tri-state list pages (loading / empty / populated) mirroring `RegimenList`.
- Voice extraction + Memory integration — `lib/checkin/event-extract.ts` populated from header stub. `app/api/check-in/extract-event/route.ts` (does NOT call `incrementAndCheck` — ADR-020 single-counter invariant). `EventConfirmCard` mounts in `app/check-in/page.tsx` orchestrator below `MedicationConfirmCard`. `lib/memory/event-types.ts` filled `VisitEvent.payload` + added `BloodWorkEvent`. `applyFilter` extended exhaustively. `EventRow` renders `DR VISIT` + `BLOOD WORK` pills with detail routing. `listEventsByRangeHandler` extended in place at `convex/checkIns.ts`.

**Process.** Project Process Playbook Map-2 dispatch verbatim, mirroring F04 C1. Build phase: 3 parallel agents (5.A / 5.B / 5.C). Integrate phase: solo merge with two coordination touchpoints (`event-types.ts` slot fill, `MemoryTab` affordance). Review phase: 3 parallel reviewers. Fix phase: solo. Second-pass review: one agent with "decisions locked" preamble. Ship phase: squash-merge, append changelog, Convex prod deploy via `CONVEX_DEPLOYMENT=prod:usable-zebra-515 npx convex deploy --yes`, manual smoke on `meetsaha.com`. Post-ship trio: build-log + memory updates + housekeeping append.

**Triage from second smoke (post-PR-open).**
1. Detail pages were missing `userId` arg on `updateVisit` / `softDeleteVisit` / `updateBloodWork` / `softDeleteBloodWork` → all four mutations 502'd with `ArgumentValidationError`. Fixed in `3bffb96` by threading `userId` with a `!userId` guard.
2. Pill copy `APPOINTMENT` → `DR VISIT` per PM note.
3. Visit `taskState` was statically `done`. Now date-aware via `eventFromVisit(row, todayIso)` + threaded `nowMs` through `listEventsByRangeHandler` for deterministic tests.
4. Blood-work form was accepting future dates. Added `assertBloodWorkDateNotFuture(date, nowMs)` called only from create + update; read-path stays format-only. Form mirrors with `max={today}` + inline error.
5. Stub disabled search icon in `MemoryTab` was misleading at smoke. Removed; tracked real cross-table search at `docs/post-mvp-backlog.md` Section 23 (needs auth model first).

**Validation.** 1054/1054 vitest, `tsc --noEmit` clean, `next build` green. New tests cover handler-level mock-ctx (visits + bloodWork), form + list components, voice extraction + relative-date anchor, cost-guard non-increment, taskState by date. `e2e/f05-visits-bloodwork.spec.ts` covers T1–T7 + F04 regression with per-run `e2e_f05_<uuid>` userIds.

**Manual smoke (live).** `meetsaha.com/visits/new`, `meetsaha.com/blood-work/new`, edit + soft-delete on both detail pages, voice check-in firing visit + blood-work confirm cards, F04 medications regression. Reported "working as expected."

**Open backlog from this cycle (tracked in housekeeping #10–14):**
- TOCTOU `clientRequestId` unique index across 4 tables (before auth lands).
- Embedded `bloodWork.markers` flattening to relational table (before F08).
- Date-bounded `withIndex` in `listEventsByRangeHandler` (before F08).
- 11 `(api as any)` casts cleanup in `app/check-in/page.tsx` (before F06).
- MemoryTab `<details>` log-affordance UX iteration (post-MVP).

**Surprises / lessons.**
- **Convex dev `npx convex dev --once` ≠ Convex prod deploy.** First smoke after `npx convex dev` failed because functions were on dev backend only. Memory hit on `feedback_remind_convex_deploy.md` — the rule applies even within the SAME ship sequence (preview hits dev, prod hits prod).
- **Pre-flight stubs paid off massively.** Schema tables + type-union slot markers landed in F04 PR #18 made F05 integrate phase nearly empty. New memo: `feedback_pre_flight_stub_optionality.md`.
- **`userId` arg thread breaks silently when added late.** Mock-ctx tests pass while live mutations 502. Lesson: when adding `userId` to a mutation that already has consumers, audit every call site in the same PR.
- **Stub icons read as broken.** The disabled search button read as a broken feature, not "coming soon." Lesson: don't ship affordances for features that aren't built.
- **Six architect feedback memos** captured for future cycles: embedded-vs-relational, memory-aggregation index bounds, pre-flight stub optionality, clientRequestId TOCTOU, cost-guard single-increment invariant, confirm-card stack threshold.

**Next.** Decision pending — F06 (Doctor Report) next OR pivot to MVP closeout (pricing + auth + Razorpay/Stripe). Per `project_saha_mvp_scope.md` the MVP feature set is closed; pricing+auth was always the gating step before launch. Rewant's call.

---

## 2026-05-10 — Session 19: Auth sprint Phase 1 — scoping kickoff (Tab A, paused mid-walk)

**Worktree split.** Sprint plan `docs/sprints/2026-05-09-auth-ui-housekeeping.md` (lives on `main`) calls for two-tab parallel work via git worktrees. This session is **Tab A** at `/Volumes/Coding Projects + Docker/saha-auth/` on branch `feat/auth-scoping`. Tab B (Lane C UI follow-ups) runs separately at `~/saha-ui/` and ships before Tab A's build phase begins. Convex dev singleton conflict is the gating constraint — Tab A is markdown-only this phase.

**What landed in this session.**
- `docs/features/auth-scoping.md` created — six-section skeleton + §7 H appendix + handler-migration table for all 32 handlers across 9 Convex files (inventoried via Explore subagents).
- **Hard guardrails locked at top of scoping doc.** Most important: **prod waitlist on `usable-zebra-515` is IMMUTABLE** — first 50 app users come from there. No migration touches it.
- **Decision A LOCKED — Convex Auth.** Rationale: stack-native `ctx.auth.getUserIdentity()`, sub-processor minimization (no auth-vendor in the chain), zero auth-vendor cost. Trade-off: phone-OTP layer is custom code; mitigated by routing through a single SMS vendor (Twilio Verify likely) so vendor absorbs brute-force/replay/rate-limit risk.
- **HIPAA-grade architecture posture LOCKED** (architecture only, formal BAAs deferred until threshold). Bake-ins in scope this sprint:
  1. Audit log table at schema level (`authAuditLog` with `byUserTime` index)
  2. Soft-delete with audit trail (`deletedBy` + `deletionReason`) across `checkIns`, `intakeEvents`, `medications`, `dosageChanges`, `doctorVisits`, `bloodWork`, `profiles` (if added per Decision F)
  3. MFA-ready data model (`mfaEnabled` + `mfaMethod` columns; no enforcement at launch)
  4. Privacy policy in HIPAA/DPDP-compatible language (drafted in Phase 1, constrains Decision H to legal-review-timing only)
- **Bake-ins NOT in scope this sprint:** session revocation surface, LLM data-minimization audit, formal BAAs.
- **ADR shape LOCKED:** separate **ADR-035** for HIPAA-grade architecture (not folded into ADR-033). Updated ADR roster: 032 (Convex Auth) · 033 (server-derived userId, supersedes ADR-019) · 034 (`clientRequestId` unique index) · 035 (HIPAA-grade architecture).
- **Sprint plan §Decision-log update mechanism:** option (b) — accumulate locks in `auth-scoping.md` Decision log; consolidate single batch update to sprint plan at Phase 1 close. Avoids cherry-pick mid-sprint.

**Decisions still open** (walked next session): B → C → D → F → E → G → H.

**Reference notes for next session — Decision B context already gathered.** Three options scanned: Resend (Convex Auth's documented happy-path; lowest friction; ~15 min wire-up), AWS SES (cheapest at $0.10/1000; cleanest BAA path; ~1–2h sandbox exit overhead), SendGrid (consolidation play if Decision C picks Twilio Verify — same vendor account, one BAA path).

**Swap-friendliness analysis added.** Recommended pattern regardless of B's outcome:
- Wrap email transport in `lib/auth/email-transport.ts` adapter exposing `sendMagicLinkEmail(to, link)`. Single swap point.
- Use **React Email** for templates — portable across all three transports. Resend renders natively; SES + SendGrid take HTML, which React Email outputs.
- Same pattern for SMS in Decision C: `lib/auth/sms-transport.ts` with `sendPhoneOtp` + `verifyPhoneOtp`.
- Build sign-in UI as plain Next.js Server-Action-backed forms, NOT Convex-Auth-specific React primitives. Adds ~30 min today; saves ~6h if you ever swap auth providers (Convex Auth → Clerk swap = JWT-minting change + UI rewire; handlers stay since `ctx.auth.getUserIdentity()` is provider-agnostic).
- **Caveat:** "plain Server-Action-backed forms" recommendation needs verification against Convex Auth's actual integration patterns at Phase 3 build kickoff.

**Process notes.**
- Three Explore subagents in parallel surfaced: full handler inventory (32 fns / 9 files / 7 distinct indexes), profile + onboarding shape (localStorage-only today, `saha.profile.v1` schema v2 per ADR-029, no Convex `profiles` table), ADR landscape (31 existing ADRs, ADR-019 the one to supersede, ADR-022 the `clientRequestId` precedent).
- Plan-mode entry/exit cycle handled the strategy approval. Plan file saved at `~/.claude/plans/recursive-drifting-widget.md` for cross-session reference.

**Next session pickup.** See dedicated session-resume doc below; Decision B walks first with the swap-friendliness pattern in mind.

## 2026-05-16 — Session 20: Auth Decision C researched + deferred (MSG91 recommendation drafted)

**Outcome.** Decision C (phone OTP provider) walked end-to-end in research mode; lock deferred at Rewant's discretion. The prior session's shortlist (Twilio Verify, MSG91, "Sarvam reuse") was wrong: Sarvam ships STT/TTS only, no SMS product; Twilio Verify is ~60× more expensive than India-native providers at 10k scale (~₹880k/mo vs ~₹15k/mo MSG91) AND Convex Auth's built-in Twilio provider doesn't relieve the India DLT-DIY burden. Rewant asked for a price-first sweep of India-friendly options at MVP (200 SMS/mo) and 10k-user steady-state (80k SMS/mo).

**Research scope.** Eleven vendors priced: MSG91, 2Factor.in, Plivo Verify, Twilio Verify, Fast2SMS, Authkey.io, Exotel, SMSCountry, Gupshup, Sinch Verification, Kaleyra/Tata Comms. For each: per-OTP India route price, free tier / startup credits, minimum recharge, DLT registration burden, API style (Verify-style vs raw SMS), sender-ID model, webhook availability, reliability red flags, pricing surface (published vs sales-call). Two cost columns computed per vendor.

**Recommendation drafted (NOT locked).** **MSG91 primary, 2Factor.in documented fallback.** MSG91 wins on (a) Startup Program = 25k OTP credits/mo × 6 mo → MVP free for the runway covering ~6,000 users; (b) true Verify-style API (vendor-managed lifecycle, no DIY brute-force protection); (c) assisted DLT registration. 2Factor wins at 10k scale (~₹9.6k/mo vs MSG91's ~₹14.4–15.2k/mo) — named swap target via the `lib/auth/sms-transport.ts` adapter when MSG91's startup credits expire or volume crosses 25k/mo.

**Build plan drafted (NOT executed).** Ten-step plan (C-1 through C-10) inline in `docs/features/auth-scoping.md` → Sub-decision C → "Build plan — MSG91". Long pole = DLT registration (3–7 business days through TRAI portal). Adapter shape locked; Convex Auth wiring sketch included with caveat to verify against `@convex-dev/auth/providers/Phone` at build kickoff. Per-IP rate limit at the public-mutation layer added as defense-in-depth (MSG91 handles per-phone brute-force; per-IP closes the enumeration-attack vector).

**Files updated.**
- `docs/features/auth-scoping.md` — header status block reflects 2026-05-16 position; Sub-decision C inserted in full (research tables + recommendation + alternatives-considered + gotchas + 10-step MSG91 build plan); ADR-032 slot updated to note C pending; Decision log entry appended.
- `docs/post-mvp-backlog.md` — H1 (HIPAA/BAA) entry updated to reflect MSG91 + 2Factor as the standing recommendation; new backlog item #24 added covering the deferred Decision C lock + MSG91 build with revisit-trigger criteria.
- `docs/build-log.md` — this entry.

**No code changed.** Three uncommitted edits + new file (`docs/features/auth-scoping.md`, `docs/post-mvp-backlog.md`, `docs/build-log.md`) on `feat/auth-scoping`. Not committed.

**Process notes.**
- Used general-purpose Agent for the vendor research (parallel web-fetches + table compilation in ~3 min). The agent returned a clean structured comparison; pasted-through to the scoping doc with light reframing. Worth repeating for any future vendor-comparison decision.
- The "Sarvam not applicable" correction came from Rewant on session entry. Worth flagging that the prior session's recap was overconfident on the constrained shortlist — Sarvam was a name-recognition error (we use Sarvam for voice; the model conflated it with "any vendor we already pay"). Lesson noted in flow, not memorialized as a feedback memory — surfaces naturally next time a Decision C revisit happens.

**Next session pickup.** Either (a) Rewant revisits Decision C lock + DLT kickoff, or (b) walk Decision D (India locale detection) in parallel — D is C-independent. See `docs/features/auth-scoping.md` header status block for current position.

## 2026-05-24 — Session 21: Path A voice-sprint tail — housekeeping cleanup + A2 harness plan + A3 voice-UX research stream kickoff

**Outcome.** Two parallel workstreams opened off the 2026-05-24 handoff (PR #28 + #29 merged previous session). (1) **A1 housekeeping**: removed two orphan worktrees, deleted 9 stale local + 9 stale origin branches. (2) **A2 voice telemetry harness**: build plan drafted, e2e infra confirmed (A2.1 done); implementation deferred. (3) **A3 voice conversational UX deep-dive**: kicked off via 3 parallel subagents (loop audit, friction inventory, competitive scan); 4th synthesis doc drafted by main; canonical spike + recommendation (T5) deferred for Rewant's review of the 4 research files.

**A1 — housekeeping deletions (this session).**
- **Worktrees removed:** `/Volumes/Coding Projects + Docker/saha-posthog` (PR #28 merged, remote branch already deleted) and `/Volumes/Coding Projects + Docker/saha-pr21` (PR #21 closed unmerged, kept per backlog #25). Both worktrees were filesystem-corrupted (`app/` directory missing) — `git worktree remove` refused even with `--force`; fell back to `trash` + `git worktree prune`, same pattern documented in 2026-04-30 cleanup (housekeeping resolved item #3).
- **Pre-removal trash:** five untracked diagnostic scripts in `saha-posthog/scripts/` from the #418 hunt (`check-env.mjs`, `error-stack.mjs`, `error-trace.mjs`, `isolate-418.mjs.bak`, `probe-provider.mjs`) — all 17–23 lines, never committed, all hardcoding the Vercel preview protection-bypass token + a dead preview URL. Safe trash; `posthog-smoke.mjs` + `isolate-418.mjs` retained on main are the keepers.
- **Local branches deleted (9):** `feat/voice-telemetry-posthog` (PR #28 squash-merged), `feat/f04-medications-c1` (PR #18 squash-merged), `fix/voice-rate-limited-error-code` (PR #20 squash-merged), `feat/f05-doctor-visits-c1` (no PR — superseded by `feat/f05-c1-integrate` → PR #22), `feat/sprint-f04-f05-preflight` (PR #16 closed, absorbed), `feat/sprint-f04-f05/{4a,4b,4c}` (sprint scratch — work in PR #18), `fix/nav-medications-tab` (PR #17 closed, absorbed into PR #18). Used `git branch -D` per Rewant's pre-approval; all confirmed safe via PR-merge state + ahead/behind check.
- **Origin branches deleted (9):** mirrored the local deletions for the squash-merged + closed-absorbed set, plus also deleted `feat/sprint-f04-f05/{5a,5b,5c}` (F05 sprint-scratch, work in PR #22). Used `git push origin --delete` (batched single command).
- **Retained:** local + origin `fix/voice-loop-survives-extract-failure` (per backlog #25 — PR #21 closed-unmerged reference branch). Worktree `saha-auth` on `feat/auth-scoping` left untouched (Lane B Phase 1 still open).
- **Not addressed:** non-`origin` remote called `wt` with three branches (`wt/build-a`, `wt/build-b`, `wt/build-c`) — surfaced for investigation, no decision made this session. Likely leftover from a prior multi-agent build experiment.
- **Final state.** Local branches: `main`, `feat/auth-scoping`, `fix/voice-loop-survives-extract-failure`. Origin branches: `main`, `fix/voice-loop-survives-extract-failure`. Worktrees: canonical (`autoimmune-health-companion` on `main`) + `saha-auth`.

**Handoff doc stale on a key point — flagged, not corrected.** The 2026-05-24 handoff (`~/.claude/projects/-Users-rewantprakash-1/memory/session_handoff_2026-05-24.md`) said the next-session work was to "rebase PR #21 → merge", but PR #21 was actually closed unmerged on 2026-05-23 (commit `4c426d4` on main filed it as backlog item #25). Handoff was drafted before that close was internalised. No corrective edit to the handoff this session; the build-log entry above + the backlog #25 entry are the authoritative records.

**A2 — voice telemetry harness (build plan + A2.1 e2e infra check done).**
- **Build plan.** New `e2e/voice-telemetry-smoke.spec.ts` that exercises the full voice loop locally with mocked `getUserMedia`, stubbed `/api/transcribe` + `/api/speak` + `/api/check-in/extract`, intercepts PostHog capture POSTs and asserts `voice_start_called`, `voice_stop_called`, `voice_rearm_fired` arrive with expected props; plus a second iteration in the same browser context to assert `distinct_id` stitch (D4). Plus first-ever GitHub Actions workflow (the repo has no `.github/workflows/` today) gated to run on PRs that touch `lib/voice/**`, `app/check-in/**`, `lib/telemetry/**`. Plus one live manual smoke on `meetsaha.com/check-in` per `feedback_ship_day_manual_smoke.md` before claiming the sprint closed.
- **A2.1 e2e infra findings.** Playwright config single-chromium / sequential / port 3001 / local-dev auto-spawn / no mocking baseline; existing F04 + F05 specs run against real dev-Convex with no mocks (synthetic `qa_e2e_<uuid>` user seeded via localStorage init script); F04 spec header explicitly defers voice with "audio simulation in Playwright is fragile" — this is the comment that A2 retires. No `.github/workflows/` directory exists; A2.5 is "create the first workflow" not "add a step" — larger than initial scope estimate. Vercel protection-bypass plumbing exists only in `scripts/{posthog-smoke,isolate-418}.mjs` (root level), not in any `e2e/*.spec.ts` — the harness will be local-only by design (no preview round-trip in CI). PostHog wiring lives at `lib/voice/sink-posthog.ts` with unit coverage at `tests/voice/sink-posthog.test.ts`; the three voice-event strings (`voice_start_called` etc.) are colocated there.
- **Tasks A2.2–A2.7 (mocks, capture interception, identity stitch, CI workflow, live smoke, PR)** all queued — not started this session.

**A3 — voice conversational UX deep-dive (research stream).**
- **Approach.** Three subagents launched in parallel as research workstreams, each writing one file to `docs/spikes/voice-ux-research/`. Main thread synthesised the fourth file. Canonical spike (T5) deferred to Rewant's review of the four files before writing.
- **Files created (all NEW this session):**
  - `docs/spikes/voice-ux-research/01-loop-audit.md` (156 lines) — state machine diagram, 19 states, full TTS string inventory (3 catalogs: 11 openers / 11 closers / 11 follow-ups + 5 decline-acks), provider-lifecycle analysis, error-path enumeration. Cites every claim down to file:line.
  - `docs/spikes/voice-ux-research/02-friction-inventory.md` (108 lines) — 1 P0 (extract-429 silent cliff = backlog #25), 4 P1, 4 P2 frictions; cross-referenced against current code with explicit "fixed by `<commit>`" markers for 6 frictions where memos were stale.
  - `docs/spikes/voice-ux-research/03-competitive-scan.md` (92 lines) — Wysa, Replika, Pi.ai, Hume EVI, ChatGPT Advanced. Steal-or-skip table. Key insight: Wysa hits 4.9★ "feels heard" with no voice at all → warmth lever is reflective restatement + honest fallback, not prosody.
  - `docs/spikes/voice-ux-research/04-target-patterns.md` (main-thread synthesis) — 4 candidate patterns. **Pattern A** "Heard X, doing Y" mid-loop acknowledgment (small, no blockers); **Pattern B** Graceful failure narration (retires F-01 P0, blocked on A2 harness — this is exactly what PR #21 attempted without the gate); **Pattern C** Pre-flight tone/pace adaptation (Hume-inspired, leverages continuity engine); **Pattern D** "Wait, let me try again" per-metric re-do. Sequencing recommendation: Cycle 1 = A standalone; Cycle 2 = A + B + D bundle once harness lands.
- **T5 (canonical spike at `docs/spikes/voice-conversational-ux.md`) NOT YET WRITTEN.** Awaiting Rewant skim of files 01–04. Five open questions surfaced in 04-target-patterns.md §"Open questions for T5" — including whether acknowledgments use LLM-dynamic phrasing vs locked-catalog, confidence-threshold values, Sarvam slow-rate-voice feasibility for Pattern C.

**Process notes.**
- Three parallel subagents (general-purpose) ran ~3–5 minutes each. Each was given a self-contained brief with target output file path; reports landed clean with no rework needed. Worth repeating for any future "stack 3 independent research lanes" surface.
- One stale claim in the input handoff (PR #21 status) was caught only because I cross-checked the actual `gh pr view 21` state before acting on the "rebase + merge" instruction. The handoff was 1 day stale on a fast-moving sprint. Lesson surfaced naturally: verify PR state with `gh` before acting on any session-handoff instruction that names a specific PR.
- Doc-discipline reminder from Rewant mid-session ("every time you delete or make any kind of PR changes, no matter how big or small … it is still supposed to be looked into and logged in the changelog") prompted this same-session backfill. Updating the relevant feedback memo so I never miss this again, esp. for housekeeping/spike work that doesn't touch architecture.

**Next session pickup.**
1. Rewant skims `docs/spikes/voice-ux-research/04-target-patterns.md` (synthesis) → optionally 01/02/03 (evidence) → shares lean.
2. T5 canonical spike written (`docs/spikes/voice-conversational-ux.md`) with chosen pattern + cycle plan.
3. In parallel: A2.2 onwards (build the harness) — this is independent of T5 and unblocks Pattern B regardless of which gets picked first.

## 2026-07-04 — Sessions 22–23: Fable 5 multi-agent assessment (separate chat) + P0 fix execution

**Session 22 (assessment chat, same day).** Six-dimension multi-agent assessment of `main = 2e87f16` with adversarial verification; all execution deferred to this session. Artifacts (committed this session): `docs/assessment/2026-07-04-fable-assessment.md` (findings), `2026-07-04-roadmap.md` (phased plan, Fable→Opus handoff line), `2026-07-04-fix-chat-handoff.md` (this session's brief). Decisions locked there: SMS/MSG91/DLT auth **parked** (near-term auth = email via Convex Auth + Resend), API rate-limiting **parked** until ~100 real users, getCheckin fix pre-approved, token rotation last, forward product priority = voice humanness. Also committed: the 4 session-21 voice-UX research files under `docs/spikes/voice-ux-research/` (were untracked).

**Session 23 (this chat) — the three P0/P1 fixes, in order.**

1. **Secret-leak remediation** (`fa2e4c5`). Root cause: raw `node` scripts don't auto-load `.env` files, so the Vercel protection-bypass token was pasted in as a literal (2nd leak of this shape — see Session 20 entry).
   - `scripts/posthog-smoke.mjs` + `scripts/isolate-418.mjs` now read `VERCEL_AUTOMATION_BYPASS_SECRET` + `NEXT_PUBLIC_POSTHOG_KEY` from env and **fail loud** when missing. Run via `node --env-file=.env.local scripts/<name>.mjs` (Node 20.6+ native, no new dependency). Values added to `.env.local` (gitignored) + documented in `.env.local.example`.
   - `posthog-smoke.mjs` now defaults to prod `https://www.meetsaha.com` — the bypass secret is only required when `PREVIEW_URL` targets a protected `*.vercel.app` preview.
   - **gitleaks pre-commit hook**: `.githooks/pre-commit` (wired by `core.hooksPath` via new package.json `prepare` script, auto-set on every `pnpm install`) + `.gitleaks.toml` extending the default ruleset with two custom rules (`vercel-protection-bypass`, `posthog-project-api-key`) — **the default gitleaks ruleset does NOT catch the `BYPASS = '<32 alnum>'` shape** (no keyword match), verified by staging the actual leaked literal: default = no leaks found; custom config = blocked, exit 1.
   - Redacted the token literal from `2026-07-04-fable-assessment.md` before committing it (would have re-leaked in a tracked doc).
   - Verified: both scripts throw with a clear message when env missing; live run `node --env-file=.env.local scripts/posthog-smoke.mjs` against prod → SDK loaded, token matched from env, both routes 200, 0 console errors. (Smoke exits 1 on its pre-existing `distinct_id === testUser` assertion — the script never seeds the localStorage stub; live run confirmed prod `distinct_id` is an anonymous UUID. That's the Phase-2 telemetry-stitch item, untouched here.)
   - **ROTATION STILL PENDING — Rewant, in the Vercel dashboard** (kills the public value; do it any time, scripts keep working): vercel.com → team `rewant24s-projects` → project `saha-health-companion` → **Settings → Deployment Protection → Protection Bypass for Automation → ⋯ menu → Regenerate** (or Remove + Add). Copy the new secret → replace the `VERCEL_AUTOMATION_BYPASS_SECRET` value in `.env.local` (marked `ROTATE-ME`). Vercel auto-syncs the secret to the project's env vars for all environments. History scrub not needed — rotation makes the leaked value worthless.

2. **getCheckin IDOR guard** (`b1ab7be`). `convex/checkIns.ts` `getCheckinHandler` now takes `userId` and returns `null` on owner mismatch (indistinguishable from not-found), matching the defense-in-depth pattern on every other read path. No app callers existed → no client changes. 4th unit test added (cross-user read → null). **⚠️ Needs Convex prod deploy to take effect on `usable-zebra-515`: run `scripts/ship-prod.sh` (manual step per shipping rule).**

3. **Interim extract-429 fix** (`d2ba1e3`) — the shippable slice of voice Pattern B (full narration still gated on the A2 harness).
   - New pure module `lib/checkin/extract-failure.ts`: `classifyExtractError` (daily-cap vs transient), `shouldBailAnswerLoop` (cap → bail immediately, terminal; transient → one re-ask then bail), `extractFailureNotice` (honest per-class Stage-2 copy).
   - **Answer-loop corruption stopped**: extract *failures* no longer fall through the re-ask → give-up-as-declined path in `app/check-in/page.tsx`. Previously two failing calls silently saved the metric as "declined" — and a cap 429 fails every subsequent call, so one trip inside the first check-in of the day could auto-decline every remaining metric. Now the loop dispatches `BAIL_TO_TAPS`: captured metrics carry into Stage 2, unanswered ones stay *missing*.
   - Stage 2 gains an optional `notice` banner (`role="status"`, `data-testid="stage-2-notice"`) rendered from the failure kind — daily-cap copy is honest about the limit; transient copy owns the failure ("not you").
   - 8 unit tests on the policy module (`tests/check-in/extract-failure.test.ts`).

**Verification bar (all met).** `pnpm typecheck` clean · `pnpm test:run` **1077/1077** (baseline 1068 + 9 new) · `git grep` for the leaked bypass token and the PostHog key literal over tracked files → **no matches**.

**Not done here (by design):** token rotation (Rewant, clicks above) · Convex prod deploy (`scripts/ship-prod.sh`) · rate-limiting (parked) · auth build (Opus phase) · voice Patterns A–D (forward work; assessment docs `2026-07-04-tech-stack-scale.md` + `2026-07-04-voice-humanness.md` written later this session).

**Session 23 addendum — the two deferred assessments (written by parallel background agents, reviewed + committed by main).**
- `docs/assessment/2026-07-04-tech-stack-scale.md` — verdict: stack holds to 10k with two code fixes, holds to 100k technically but not economically as-is. Cost model: **~₹89/active-user/month flat-linear at every scale, ₹79 of it Sarvam voice (~89% of COGS = 45% of ₹199 ARPU before payment fees)**; free tier must hard-cap voice. Biggest scaling risk: **Sarvam concentration** (cost + Business-tier TTS req/min ceiling exceeded at 100k peak + no written SLA/audio-retention terms + no Hinglish substitute). Biggest compliance gap: **no auth/access control on live health data** — DPDP "reasonable security safeguards" failure tier (₹250 cr), no May-2027 runway. DPDP Rules notified 2025-11-13; substantive obligations enforceable 2027-05-13; cross-border US hosting currently lawful (blacklist model). HIPAA honestly N/A (D2C, no US covered-entity link); FTC HBNR + WA MHMDA are what apply to US consumers. 14-row "revisit X when Y" table incl. Razorpay/RBI e-mandate notes and Stripe-India invite-only → MoR lean. All vendor facts sourced 2026-07-04 with URLs.
- `docs/assessment/2026-07-04-voice-humanness.md` — **overall 4.5/10**. Lowest: barge-in/redo 2/10, feeling heard 3/10, turn-taking/latency 4/10. Strongest: language naturalness 6/10. **Highest leverage: Pattern A acknowledgments bundled into the next question's TTS call** (zero extra POSTs/latency, est. +1.5, no harness dependency). Research finding: T4 open question #4 CLOSED — Sarvam `bulbul:v2` supports `pace`/`pitch`/`loudness` as plain request fields (no SSML), and `synthesize()` passes none → Pattern C is a small param-plumb (Q2 enabler + M3). Also: today's `d2ba1e3` credited as raising error-recovery ~3→5/10. Includes 4 line rewrites, 6 quick wins, 4 medium (A2-gated), what-NOT-to-do (no chattier lines, no fake filler, no approval-glow acks).
- Doc accuracy pass: tech-stack doc's two getCheckin-IDOR references updated to reflect today's `b1ab7be` fix (pending prod deploy).

**Session 23 addendum 2 — token rotated + Convex prod deploy shipped (with Rewant back).**
- **Token rotation DONE** (Rewant, Vercel dashboard): old leaked bypass secret regenerated; new value saved to `.env.local`. Verified: old literal no longer present in `.env.local`; tracked files were already clean.
- **Convex prod deploy DONE** (`npx convex deploy` → `usable-zebra-515`, message tagged `b1ab7be`). Ship-prod pre-flight: tree clean on main, tests/types green from earlier this session, `next build` green — but only after temporarily moving aside the redacted `.env.production.local` (restored after; the Phase-1A "fix/remove" item stands). Non-interactive gotcha for the runbook: `convex deploy` needs a TTY for its Y/n prompt AND stdin held open through the push — `(printf 'Y\n'; sleep 180) | script -q /dev/null npx convex deploy` works; plain `echo Y |` does not.
- **Prod verification:** `function-spec --prod` shows `getCheckin` now requires `{id, userId}`; live IDOR probe against a real prod row — wrong `userId` → null, owner `userId` → row returned. `waitlist:count` tripwire = 12 (no drop). `meetsaha.com/check-in` 200 (vercel.app 308 → canonical, expected).
- **Still pending: push the local commits** (`fa2e4c5`…) — the extract-429 frontend fix reaches prod only when main is pushed and Vercel auto-promotes.

**Session 23 addendum 3 — pushed + prod promoted.** `git push origin main` (`2e87f16..5a9b1bb`, 8 commits). Vercel auto-promoted: new prod deploy Ready ~2 min post-push; `www.meetsaha.com` alias verified pointing at the new deployment (`saha-health-companion-cn78oay1v`), `/check-in` 200. All three assessment P0s are now live in prod: env-var'd scripts + rotated token, getCheckin ownership guard (Convex deploy, addendum 2), and the extract-429 honest-copy/no-auto-decline fix (this promote). Phase 0 of the roadmap is fully closed except the WAF rate-limit item, which was explicitly re-parked by Rewant.

## 2026-07-04 — Session 24: Voice-humanness quick-win sprint (Q1–Q6, all landed)

Branch `feat/voice-quick-wins` off `main = 6081c16`, **NOT pushed** (awaiting Rewant OK). Executes the quick-win bucket from `docs/assessment/2026-07-04-voice-humanness.md` §4. One atomic conventional commit per Q-item. Exit state: tsc clean, **1154/1154 vitest green across 81 files** (baseline was 1077 — +77 new tests, +3 new test files). No `convex/` changes anywhere in the branch, so no Convex prod deploy is needed for this train — Vercel auto-promote alone ships it once merged+pushed.

1. **Q1 — Pattern A capture acknowledgments** (`deea2d9`). New locked `ACK_VARIANTS` catalog (`lib/saha/ack-variants.ts`) + pure `ack-engine.ts` (mirrors follow-up-engine discipline). The answer loop stages a receipt line for each captured value in a `pendingAckRef`; the answer-loop driver bundles it into the NEXT question's `ASK_QUESTION` text so the ack rides the same TTS POST — zero extra round-trips, exactly the assessment's design. Freeform seed extraction acks too, when exactly one metric was captured. Policy (T4 caveat): no ack at pain/energy 1 or 9–10; malformed values silent, never throwing. Register enforced by tests: neutral-warm receipts (never approving the value), ≤8 words, no `RULED_OUT_PHRASES`, no exclamation marks. Leak guard: staged ack for the loop's *final* metric (which has no next question) is dropped at the next extraction cycle start. 43 new tests.
2. **Q2 — `pace` plumbed through the TTS stack** (`dd2c359`). `SynthesizeArgs.pace` → SDK convert call; `/api/speak` validates 0.3–3.0 at the boundary (`PACE_MIN`/`PACE_MAX` route-owned like the text caps); `SarvamTtsAdapter` takes `pace` at the constructor (per-instance, matching Pattern C's apply-once-at-mount scoping). **No behavior change** — nothing constructs with a pace yet; every utterance still ships at 1.0. Pattern C is now the one-line conditional the assessment promised.
3. **Q4 — the silent give-up path speaks** (`4c93dc0`). New `GIVE_UP_ACK_VARIANTS` ("Couldn't quite get that — I'll leave pain for the form at the end.") + `selectGiveUpAcknowledgement`. Rides the next question's TTS via the Pattern A staging ref when another metric follows; spoken fire-and-forget when the given-up metric was last (nothing follows to carry or cancel it). Kills the assessment's worst anti-heard moment (answered twice, understood zero times, told nothing).
4. **Q5 — ErrorSlot per-kind plain language** (`7a414f0`). `ERROR_COPY` map: every `VoiceErrorKind` + `save-failed` gets a human headline + blame-absorbing sentence naming the taps recovery path; unknown kinds fall back to the old generic. Debug slug demoted to a tiny detail line (kept for bug reports); `data-error-kind` untouched so existing tests held. New `error-slot.test.tsx`.
5. **Q6 — catalog polish, all four §3 rewrites** (`0c79b79`). Decline acks "OK, skipping X." → "That's fine — skipping X today."; flare attempt-1 → "Anything flaring today?" (enum recital survives only in attempt 2); flare attempt-2 → "Sorry, I missed that — was there a flare today? Yes, no, or ongoing."; daily-cap notice → first-person, no "with AI" mechanism reveal. **Locked-catalog discipline held:** the verbatim table in `docs/features/voice-cycle-1-plan.md` revised in the same commit. `extract-failure` tests were regex-based and held without edits by design.
6. **Q3 — shipped as the server-side slice only** (`57427c7`), deliberate scope call. `SARVAM_TTS_CACHED_RESPONSES=1|true` env-gates Sarvam's `enable_cached_responses` beta (verified in the SDK's `TextToSpeechRequest.d.ts`) — provider-side cache hits for the still-fixed strings (openers, re-asks, decline acks, closers, give-up lines). **Client-side prefetch deferred to backlog #26** with full rationale written there: Q1's ack-bundling makes mid-loop question text value-unique (bare-string prefetch misses exactly the dominant turns), and rewiring `speak()` in the adapter is the vitest-green-≠-live-audio class of change the PR #21 postmortem hard-gates on the A2 harness. Bonus in the same commit: first unit coverage for `lib/voice/sarvam-tts-server` (backfills Q2's server-side passthrough), plus vitest now aliases Next's `server-only` marker to an inert stub (`tests/stubs/server-only.ts`) so server-only modules are directly testable.

**Ship notes for Rewant:** (a) merge/push pending your OK; Vercel auto-promote suffices (no convex/ touched); (b) per `feedback_ship_day_manual_smoke.md`, the live smoke for this train should walk: a normal 5-metric voice loop (hear acks mid-loop, no doubled/cut-off audio), a boundary answer ("pain ten" → question with NO ack), a decline ("skip that" → "That's fine — skipping…"), two-garbled-answers give-up (hear the give-up line), and a mic-permission-denied load (plain-language card, slug demoted); (c) `SARVAM_TTS_CACHED_RESPONSES` is default-off — flip it in Vercel env only when you want to trial the beta cache.

**Session 24 addendum — pushed + prod promoted.** Rewant OK'd the push. `feat/voice-quick-wins` fast-forwarded into `main` (`6081c16..a4e515e`, 7 commits) and pushed. Vercel auto-promoted: new prod deployment (`saha-health-companion-3lgt8uixq`, production target, created seconds after the push) went **Ready** ~90 s later; `www.meetsaha.com` verified resolving to that exact deployment; `/` and `/check-in` both 200. All six voice quick wins are now live on prod. **Outstanding: the live manual voice smoke (list above) is Rewant's — HTTP 200s are not a voice smoke.** No Convex deploy was needed (no `convex/` in the train).

**Session 24 addendum 2 — live smoke S1 tripped the extract cap → prod cap raised 5 → 30 (`06056a0`, Convex prod deployed).** Rewant's S1 happy loop hit the daily-cap banner mid-journey and bailed to the tap form. Diagnosis: prod `DAILY_CAP` was 5 (ADR-020, set before the follow-up loop existed) and one clean loop is exactly 5 extract calls (freeform + 4 answers) — any re-ask/decline/mishear pushed a first-day user over the cap mid-loop. Silver linings from the trip: the daily-cap UX was live-verified incidentally — Rewant confirmed the banner showed the **new Q6 first-person copy** ("I've hit today's limit for understanding voice answers…"), and the bail carried into the tap form as designed. Fix, per Rewant's call ("bump it to 30 a day"): prod 30 / dev-preview 50, ADR-020 amendment recorded, comment refs updated in both extract routes + live test. Deployed to `usable-zebra-515` via the pseudo-TTY incantation; **verified live with a throwaway probe user** — 7 increments returned `capReached: false` (old cap would have tripped at 6); both probe rows deleted via `resetForUserOnDate`. Rewant's own counter (~6–7 today) is now well under the new cap — no reset needed, smoke can resume at S1. Still unconfirmed from the trip: whether Stage 2 showed the captured values prefilled (smoke checkpoint #2).

## 2026-07-05 — Session 25: Multi-vendor voice + LLM strategy spike

Trigger: Rewant's vendor questions in-session — (a) international users hesitate at Sarvam's Indian-accented English voice → ideate accent-routed vendors (Gemini/Google/ElevenLabs) for the English cohort; (b) make the extraction LLM plug-and-play for cost-driven switching; (c) diagnose why the live voice sounds "robotic/stuttery" vs talking to ChatGPT/Gemini on their own platforms; plus the assessment's standing fallback-voice-adapter thread. Web research pass (sourced inline) + code-seam verification, written up as **`docs/spikes/voice-llm-vendor-strategy.md`** (DRAFT — 5 open questions for Rewant in §8, no build work started).

Key findings recorded in the spike: both proposed swaps land on seams that already exist (`lib/voice/provider.ts` env-driven factories; extraction already on Vercel AI Gateway via `gateway('openai/gpt-4o-mini')` — plug-and-play is a config consolidation, not architecture); no drop-in Hinglish substitute for Sarvam (Reverie = only credible fallback to evaluate); the robotic-voice complaint is TTS + turn-based-pipeline architecture, NOT STT — the "sounds like ChatGPT" quality is realtime speech-to-speech (Gemini Live / OpenAI Realtime), a post-auth, post-A2-harness option (6d). Recommended order: Track 3 env-driven model ID (S) → bulbul tuning + 4-vendor bake-off (S/M) → route-table adapter (M, per-vendor manual smoke) → streaming/S2S held behind A2. No code changed this session.

**Session 25 addendum — spike decisions locked same session.** Rewant: (a) confirmed voice plug-and-play applies to Sarvam/check-in flow itself (Track 2 scope note added to the spike); (b) §8 Q1 ANSWERED — bake-off shortlist locked: Google + ElevenLabs + Gemini TTS + Reverie; (c) §8 Q4 ANSWERED — international cohort is a revenue priority NOW → the spike's cycle schedules ahead of/parallel to Lane 1A (CI), with the S-sized CI workflow slice recommended alongside. Q2 (pre-auth locale storage), Q3 (ElevenLabs budget), Q5 (gateway fallback chains) still open. S1–S5 live voice smoke still outstanding (Rewant).

**Session 25 addendum 2 — Track 3 + bake-off script built (branch `feat/vendor-strategy-track3`, NOT merged).** Rewant: "go ahead and start before the smoke." Two commits: `938e14c` env-driven extraction model id — new `lib/checkin/model-config.ts` (`getExtractModelId()`, `EXTRACT_MODEL_ID` env override, per-call resolution) replaces the id hardcoded in all three extract routes; `DEFAULT_MODEL_ID` export removed from `extract-prompt.ts` (no back-compat shim); 7 new unit tests. `da7feff` `scripts/tts-bakeoff.mjs` — 10 fixed utterances (5 intl-English, 5 Hinglish, Saha catalog register) through the locked shortlist with skip-if-no-key per vendor; output gitignored at `bakeoff-output/`. Verification: tsc clean, **1161/1161 vitest (82 files)**; live sanity run synthesized Sarvam 10/10 (₹0.75, baseline audio for blind scoring now on disk); Google/ElevenLabs/Gemini/Reverie SKIPPED pending keys (Rewant creates accounts). Gemini + Reverie request shapes marked UNVERIFIED in-script until keys exist. Merge + the per-vendor listening pass await Rewant; no convex/ touched, so Vercel auto-promote alone ships the model-config change when merged.

**Session 25 addendum 3 — branch merged.** `feat/vendor-strategy-track3` fast-forwarded into `main` (`8297592..a5898e7`) per Rewant's OK; branch deleted. `main` is now 5 commits ahead of `origin/main` (the two spike-doc commits + the Track 3/bake-off train), **NOT pushed** — push + Vercel auto-promote pending Rewant's word. No `convex/` in any of it, so no ship-prod.sh needed when it goes.

## 2026-07-06 — Session 26: vendor-strategy train pushed + prod promoted

Rewant OK'd the push at session kickoff. `git push origin main` (`c35e1ae..d87ac66`, 6 commits: spike doc + locked decisions, Track 3 model-config, bake-off script, build-log addenda). Vercel auto-promoted: production deployment `saha-health-companion-cx5zxtip0` went **Ready**; `www.meetsaha.com/check-in` 200. No `convex/` in the train, so no Convex deploy — and the ship is behaviorally inert: extraction stays on the ADR-020 default until `EXTRACT_MODEL_ID` is set in Vercel env. Housekeeping digest surfaced at kickoff; new flag raised: backlog #16 lockfile drift (`msw`) will break the planned CI slice's frozen install — fix it before or with the CI PR. Next per the handoff: vendor keys → bake-off rerun + blind listening pass; S1–S5 live voice smoke (still Rewant's); Track 2 route-table adapter (blocked on spike §8 Q2); CI slice alongside.

**Session 26 addendum — CI slice built (PR #30, branch `feat/ci-slice`).** Rewant: "go ahead with the CI slice + lockfile fix." Findings + work:

1. **Housekeeping #16 (lockfile drift) was already resolved** — PR #26 (`a3d345a`, Phase-0 sprint) regenerated the lockfile with the `msw` tree. Verified today: `pnpm install` produces zero diff; `pnpm install --frozen-lockfile` passes in 3.3s. No lockfile change needed; backlog entry moved to Resolved.
2. **First CI workflow** (`549200b`): `.github/workflows/ci.yml` — on `pull_request` + push to `main`: frozen install → `tsc --noEmit` → `vitest run` → `next build`, ubuntu-latest, 10-min timeout, concurrency-cancel per ref. Integration/live-LLM/e2e deliberately out of the gate per the roadmap (nightly integration run stays deferred with the rest of Lane 1A). `packageManager: pnpm@10.33.2` pinned in package.json for `pnpm/action-setup`.
3. **`NEXT_PUBLIC_CONVEX_URL` repo Actions variable set** (public dev-deployment client value, `hardy-hamster-888`) — `next build` prerenders `ConvexClientProvider`, which throws without it.
4. **Verification:** local trio green (tsc clean, 1161/1161 vitest, `next build` green with the redacted `.env.production.local` set aside to approximate CI's clean env, then restored). Live: **PR #30's own `ci` check passed in 51s** — the PR is the workflow's first real run. Merge awaits Rewant's word. Follow-up worth considering post-merge: mark the `ci` check required on `main` via branch protection.

**Session 26 addendum 2 — PR #30 merged + branch protection on.** Rewant: "merge #30 and turn on branch protection." Squash-merged as `dddc76b` (branch auto-deleted; both CI runs on the PR were green, 51s/48s). Branch protection enabled on `main` via the GitHub API: required status check = `ci`, `strict` off (no up-to-date-branch requirement — solo-dev friction not worth it), `enforce_admins` off so Rewant's direct build-log/docs pushes to `main` keep working (this very commit is the live test). The repo now has an enforced PR gate: frozen install + typecheck + 1161 vitest + next build on every PR before merge.

## 2026-07-06 — Session 27: build-plan strategy refresh (§7.1 post-MVP unified plan)

Trigger: Rewant asked what's doable without his input/keys, then: "use build plan… to strategize the entire strategy and technical architecture across 1–6 plus other features and functionalities of the product as per specs." Research pass (two parallel doc-summary agents over the assessment roadmap, vendor spike, scoping, auth-scoping, post-MVP backlog, F06–F09 specs) + full read of `build-plan.md`, then a docs-only edit — no code touched.

Changes to `docs/build-plan.md`:
1. **Header** flipped to "living plan" — Sections 1–9 frozen as the MVP record; new §7.1 marked ACTIVE, superseding §7's P1–P12 schedule.
2. **§3 feature-inventory statuses refreshed** (was stale since 2026-04-25): F01/F02 → shipped, F04/F05 → shipped (C1), status-refresh note added. Part of the Lane 1E doc-hygiene debt.
3. **New §7.1 — Post-MVP unified strategy**: merges the Fable roadmap, vendor spike, auth scoping walk, and housekeeping backlog into one wave plan. W0 solo hardening (Lane 1A remainder: local build fix, eslint, e2e webServer, disarmed nightly integration + housekeeping #8 memo audit + #15 confirm-card spike) → W1 voice vendor cycle (bake-off → Track 2 route table; gated on keys + Q2) → W2 foundation lanes 1B/1C/1D/1E → W3 auth (Convex Auth + Resend email-only; DLT long pole gone) with A2 harness parallel → W4 revenue (first-50, F03→F06, funnel events, pricing, Razorpay/Stripe) → W5 pillars (F07, F08 after marker-flatten, F09, F10, backlog promotions). Plus a 7-seam technical-architecture spine (voice route table, EXTRACT_MODEL_ID, useUserId identity seam, data-layer bounds/indexes/flatten, ConfirmCard design system, quality gates, Sarvam cost/scale posture) and a 6-item ordered decision queue for Rewant. Maintenance rule embedded (§7.1.5): strike-through on ship, decisions move into wave rows.

Not pushed — docs-only change on local `main`; push whenever convenient (branch protection allows Rewant's direct docs pushes; no PR needed per established practice). Remaining Lane 1E debt noted in W2: scoping.md reconciliation, system-map.md + feature-MD front-matter refresh, body-map C3 close/re-spike.

## 2026-07-07 — Session 28: W0+W2 hardening run (autonomous, per approved plan)

Executing the approved W0+W2 plan (`~/.claude/plans/jaunty-leaping-canyon.md`) end-to-end: step 0 docs push → W0-1/2/3 PRs → W0-4/5 doc tasks → W2-1/3/2 PRs → W2-5 (PR only). Pre-authorized: branch/commit/push/open/squash-merge on green `ci`. Excluded: W2-4 build (needs #15 pattern pick), W2-5 merge (scoping canon review), prod Convex deploy (ship-prod.sh stays Rewant's).

**Step 0:** the two session-27 docs files (build-plan §7.1 + build-log) committed and pushed to `main` (`5549454`).

**PR #31 W0-1 `chore/local-build-fix` — MERGED (squash `0274c18`, ci 1m6s).** ① Local build fixed: trashed stale `.env.production.local` (May-5 `vercel env pull` artifact whose empty `NEXT_PUBLIC_CONVEX_URL` outranked `.env.local` in `next build`); guard note in `.env.local.example`; local `pnpm build` verified green. ② eslint wired: eslint@9 + eslint-config-next@16 flat config (core-web-vitals + typescript), `pnpm lint` script, lint step in ci.yml. First-run wave 112 findings (39E/73W) — over the plan's ~50 budget, so per plan: `--fix` cleared ~40 stale disable directives, one real fix (unescaped apostrophe, ConditionField), react-hooks compiler rules (`set-state-in-effect`/`refs`/`purity`) downgraded to warn pending the W2-1 burn-down (the setState hits ARE the localStorage snippet W2-1 deletes), `^_` unused convention configured. Final 0 errors / 54 warnings. Gate: lint ✅ typecheck ✅ 1161/1161 ✅ build ✅.

**PR #32 W0-2 `chore/e2e-webserver` — MERGED (squash, ci 1m0s).** e2e webServer flipped from `next dev -p 3001` to `pnpm build && next start -p 3001` — specs now exercise the production bundle (no dev-compile latency / dev-only behaviors). Both specs green locally against the production server: 2 passed (2.3m; f04 6.0s, f05 49.5s). Test-auth strategy note added to build-plan W3 row: auth invalidates `seedTestUser` localStorage seeding → magic-link test bypass or pre-seeded session, decided inside W3. e2e stays out of the PR CI gate (unchanged policy).

**PR #33 W0-3 `ci/nightly-integration` — MERGED (squash, ci 1m0s) + dispatch-verified.** New `.github/workflows/nightly.yml`: cron 03:00 IST + workflow_dispatch. Leg 1 `pnpm test:integration` vs live dev Convex (per-run `qa_<uuid>` users, wiped in afterEach — cleanup verified in both files). Leg 2 `pnpm test:api:live` w/ `QA_RUN_LIVE_LLM=1` — step-level guard (secrets aren't allowed in job-level `if`) self-skips until the `AI_GATEWAY_API_KEY` repo secret exists; arms with no workflow change when Rewant adds it. Non-blocking, no branch-protection tie-in. No Sarvam secret needed (nothing in vitest hits live Sarvam). Manual dispatch verified post-merge: **integration job green; live-llm job green with "Run live LLM tests" step `skipped` + "disarmed" log line** — exactly the planned disarmed state.

**W0-4 housekeeping #8 CLOSED (memory edits, no code).** Audit verdicts (pre-verified in the plan) appended as dated AUDIT CLOSED banners to both stale memos (`project_saha_session_resume.md`, `project_saha_voice_c1_fix_f.md`): Bug 2 (null-name opener) FIXED via `profileResolved` gating + `selectOpener(state, name)` in `1a63036`/`2cc3074`; Bug 3 (Switch-to-taps z-index) FIXED via `SwitchToTapsButton.tsx` `fixed z-50` over BottomNav `z-40` (test exists). #8 moved to Resolved in `housekeeping_backlog.md`. Both memos now purely historical.

**W0-5 confirm-card UX spike WRITTEN (`docs/spikes/checkin-confirm-card-ux.md`) — awaiting Rewant's pattern pick; gates PR W2-4.** Current UX grounded on main (227+353-line cards, ~75–80% duplicated shell/state-machine/button-row ×4, silent unrecoverable dismiss, stack at the N=3 threshold, MedicationConfirmCard zero tests). Four patterns scored against accidental-tap risk / mid-conversation load / dismiss recoverability / implementation cost. **Recommendation: P1 inline-confirm-with-undo** (only pattern fixing dismiss recoverability by construction; cheapest; preserves smoked vocabulary; undo chips persist until flow unmount, not a 5s toast). P2 swipe disqualified on accidental-action risk for a joint-pain cohort. Grouped N>3 stack design included (N≥4 → collapsed group rows + Save all); ships in W2-4 regardless of pattern, as do dismiss recoverability + MedicationConfirmCard tests.

**PR #34 W2-1 `refactor/auth-seams` — MERGED (squash, ci 1m5s).** Lane 1B: auth is now a 1-file swap. New `lib/auth/use-user-id.ts` (`useUserId()` get-or-create hook; `readUserId()` for non-hook surfaces; `{create:false}` for the two detail pages that treat missing id as not-found) replaced the `saha.testUser.v1` snippet in 12 pages/components + PostHogProvider (IntakeTapList keeps its `userIdOverride` test seam; e2e specs keep their own copy until the W3 test-auth strategy). New `lib/auth/use-onboarding-guard.ts` extracted from /home + /medications + /medications/setup — the future auth-gate mount point. All 18 live `(api as any)` casts removed (plan said 17; grep found 18) with 7 narrow `Id<>` brand casts at mutation boundaries (PR #23 precedent); `npx convex codegen` re-run produced zero diff. `app/error.tsx` + `app/not-found.tsx` added in Saha voice. Gate: tsc ✅ lint 0 errors (54→47 warnings) ✅ 1161/1161 ✅ build ✅. Net −69 lines.

**PR #35 W2-3 `refactor/ui-primitives` — MERGED (squash, ci 1m1s).** Lane 1D part 1, zero-visual-change extractions only. New `lib/format/date.ts` (`todayIST()`, `formatISTDate()` short/long/compact, `formatISTTime()`) replaced all 13 `Asia/Kolkata` formatter sites — 5 local `todayIST()` copies, 3 card formatters (incl. EventConfirmCard's, killing its in-code TODO), 2 detail-page long formats, DayView header, journey/memory's `istDateOffset` inner read, and event-types' `formatTimeIST` (kept fixed-offset/no-Intl — it runs inside Convex handlers; relative import for the alias-free Convex tsconfig). New shared `components/ui/DeleteConfirmDialog.tsx` replaced the 2 copy-pasted DeleteConfirm dialogs (DiscardConfirm untouched — different semantics). **Card/PillButton/Field verified then deferred to W2-4:** duplication is real (28 card shells, 30+ pill buttons) but variants differ in rendered pixels (p-5/p-6, min-h-11/12, per-site colors) — unifying is a visual decision that belongs in the palette pass Rewant reviews, and would churn the same 12 check-in files W2-4 rewrites. Gate: tsc ✅ lint 0 errors ✅ 1161/1161 ✅ build ✅. Net −113 lines.

**PR #36 W2-2 `perf/query-date-bounds` — MERGED (squash, ci 1m2s). ⚠️ CONVEX PROD DEPLOY PENDING — Rewant's manual `scripts/ship-prod.sh` step; old handlers keep working until then.** Lane 1C, four strands: (1) date bounds ride the `by_user_date` index in all 6 unbounded handlers (listCheckins w/ cursor-aware upper bound, listEventsByRange ×4 collects, listVisits, getNextUpcomingVisit, listBloodWork, getContinuityState 30-day window); JS filters kept as defense; test mocks now APPLY gte/lte/lt. (2) `by_user_client_request` indexes on doctorVisits + bloodWork; both create-handlers' idempotency scans → point lookups; **ADR-036** records check-then-insert is TOCTOU-safe on Convex (serializable mutations) — index = efficiency + semantics, not a race fix; full ADR-034 uniqueness ships in W3. (3) Provider-429 → dedicated `rate_limited` codes on the 3 LLM routes honoring Retry-After end-to-end (shared `detectProviderRateLimit` structural helper, 3 client error classes, `extract-failure` 'rate-limited' kind bails answer loop immediately, distinct Stage-2 copy per feedback_server_429_ux; `Number('')===0` header footgun caught by a new test). (4) `continuity.upcomingEvent` wired from getNextUpcomingVisit — populated only when the next visit is exactly TOMORROW (branch copy says "tomorrow"); persona-era "Dr. Mehta" placeholder genericized to "Your doctor tomorrow" before real data could greet users with the wrong doctor's name. 13 new tests; 1174/1174. Mid-gate hiccup: the external volume briefly remounted and killed one `next build` — reran green, tree intact.

**PR #37 W2-5 `docs/scoping-reconcile` — OPEN, deliberately NOT merged (scoping.md is Rewant's canon; he reviews the diff).** Dated strike-through amendments, no silent rewrites: Community module marked post-MVP (F09/W5, per the 2026-04-26 scope lock) with the design retained as the locked F09 spec + nav-line annotation; Setup Part A mobile verification struck (SMS/DLT parked 2026-07-04 → W3 email magic link per auth-scoping.md) + sign-up-flow paragraph amended; system-map F04/F05 `:::shipped` + F01 label de-staled; feature front-matter 01/02/04 → `shipped`. Housekeeping #6 closed in the memory backlog: both body-map artifacts verified absent from main (`app/poc/` doesn't exist) — closed as "artifacts gone; re-spike if it returns."

**Session 28 wrap — W0 complete (3 PRs merged + 2 doc tasks), W2 lanes 1B/1C/1D-part-1 merged, 1E open for review. Not done in this run (by design): W2-4 confirm-card build (blocked on Rewant's #15 pattern pick from the new spike), W2-5 merge (Rewant's canon review), Convex prod deploy for W2-2 (`scripts/ship-prod.sh` — Rewant's manual step), `AI_GATEWAY_API_KEY` repo secret (arms the nightly LLM leg).** Every merged PR rode the full local gate (typecheck + lint + vitest + build) plus the required `ci` check; suite grew 1161 → 1174.

## 2026-07-07 — Session 29: W2-4 confirm-card build (PR #38 OPEN for Rewant)

Session-28 mop-up decisions arrived unfilled in the handoff; proceeded on the defaults the brief implies: **P1** (the spike's recommendation — the brief's undo-semantics spec is P1 verbatim), PR #37 left untouched (still Rewant's review), Convex prod deploy deferred (still flagged).

**PR #38 W2-4 `refactor/confirm-card` — OPEN, deliberately NOT merged (highest-visual-impact PR of the wave; Rewant eyeballs the diff + live-smokes the confirm flow). ci green 58s; Vercel preview up.** Three commits:

1. **`fix(f04)` — latent prod bug found while writing the dose-change coverage the spike demanded: every voice dose-change card confirm has thrown `dosage.checkin_id_required` since F04 C1.** The page sends `source: 'check-in'` without `checkInId` by design (cards are non-blocking; the check-in row may not exist yet — the page comment documents exactly this), but the handler required the id, so Save always landed on the retry card and retry could never succeed. Handler now accepts the omission ('module'-must-omit unchanged); tests updated. **⚠️ Fix is inert in prod until the Convex deploy below.**
2. **`refactor(check-in)` — ConfirmCard (kinds: dose-change | visit | blood-work) + ConfirmCardStack replace MedicationConfirmCard + EventConfirmCard.** P1 per spike §3: Save/Not-now collapse to status rows with Undo chips persisting until flow unmount; undo-after-save = existing softDeleteVisit/softDeleteBloodWork on the remembered row id, or a compensating reverse `recordDosageChange` (audit history never erased); undo-after-dismiss = prompt restore. Stack owns the N-rule (N≤3 individual/locked order around the summary slot; N≥4 grouped rows + conditional Save all, cards stay mounted while collapsed so unit picks survive). Retry-guard invariant ('error' stays out of the re-entry guard) ported + pinned for the dose variant; the old Medication card's dead error-state "Not now" fixed by the merged guard. Page handlers idempotent per card key. 22 tests; suite 1174 → 1188.
3. **`refactor(ui)` — zinc/teal → token palette across all 14 check-in surfaces** (ink*/rule/bg*/sage* utilities; dark: forks collapsed into the token media query) + `ui/PillButton` primitive (kills the 4× button row; adopted in ConfirmSummary + DiscardConfirm). Left alone on purpose: OrbStates' teal orb (hero element — Rewant's call), destructive reds, Card/Field (no byte-identical 3+ duplication left; shells differ by design).

Gate: typecheck ✅ · lint 0 errors/46 warnings (baseline 47) ✅ · 1188/1188 ✅ · build ✅ · required `ci` ✅. e2e untouched by policy (specs don't reference confirm-card testids).

**Rewant's pending list (updated):** ① review PR #38 (visual diff + live confirm-flow smoke) ② review/merge PR #37 ③ **Convex prod deploy** (`scripts/ship-prod.sh`) — now carries BOTH W2-2 (indexes/handlers) AND the #38 dosage-fix; dose-change voice confirms stay broken live until it runs ④ `AI_GATEWAY_API_KEY` secret ⑤ vendor keys + Q2/Q3/Q5. Housekeeping: #12 (date-bounded withIndex) closed in memory — verified shipped by PR #36; #15 spike answered by this build, closes when #38 merges.

### Session 29 addendum — PR #38 merged + Convex prod deploy DONE (same session)

Rewant reversed the leave-open call mid-session: **PR #38 squash-merged `4a18c7d` on his explicit go** (visual pass moved into the live smoke below), branch deleted. Pre-flight re-run green on merged main (1188/1188 · tsc · build).

**Convex prod deploy EXECUTED (walked with Rewant, ship-prod.sh steps 1–7).** Key hygiene: old `saha-prod-cli` value is unviewable by design; Rewant generated **`saha-prod-cli-2`** and piped it clipboard→`~/.saha-prod.env` (0600) without it entering chat; tempfile trashed post-deploy. Note: Rewant keeps the key value in his personal notes app — logged on the housekeeping #1/#2 exposure trail. Old-key revocation NOT confirmed — open ask.

Deploy results: `npx convex deploy` clean — **`by_user_client_request` indexes added on doctorVisits + bloodWork, no indexes deleted**, all functions pushed (includes W2-2 date-bounded handlers, `rate_limited` codes, `continuity.upcomingEvent`, AND the #38 `recordDosageChange` fix — dose-change confirms are now unbroken server-side). Verify: 37 functions in prod; `waitlist:count` = 12 (no drop). Vercel: prod env vars present; auto-promote Ready; `meetsaha.com/check-in` 200; **live bundle grep confirms `confirm-card-group` → prod serves the #38 front end**. No cycle tag (hardening wave, not a feature cycle).

**Remaining from this session: Rewant's live manual smoke** (ship-day rule — HTTP 200 ≠ smoke): ① dose-change card Save → saved row → Undo → re-save (also proves the prod fix end-to-end) ② visit + blood-work cards incl. "Not now" → Undo ③ a 4-card check-in → grouped presentation + Save all ④ palette eyeball across check-in (sage-on-cream; orb intentionally still teal) ⑤ spot-check the row landed in prod data. Then the standing items: PR #37 review, `AI_GATEWAY_API_KEY` secret, vendor keys + Q2/Q3/Q5.

## 2026-07-08 — Session 30: autonomous overnight run — A2 harness + #13 flatten + F03 chunking + #10 close

Overnight run per Rewant's session-30 routing: four lanes, no input until morning. Auth decisions D/F/G arrived unfilled → W3 skipped by rule. Pre-authorized branch/commit/push/PR/squash-merge on green `ci`, EXCEPT anything visual, anything touching scoping.md, and the F03 chunk docs — those stay open. Convex-singleton honored (Lane 2 ran alone in the main checkout after Lane 1 finished; Lane 3 lived in its own worktree). No Convex prod deploy, no vendor keys, no live LLM/voice. Both big lanes' first launch died instantly on the session-limit wall (reset 12:20am); relaunched clean, zero stray state.

**Lane 4 — housekeeping #10 CLOSED (verify-only, no code).** The Journey bottom CTA DID ship and the backlog entry was simply never struck: full Lane D cycle completed — spike doc `docs/spikes/journey-bottom-cta.md`, PR #25 "swap log-affordance popover for side-by-side CTA pills" merged 2026-05-23 (`bdb4774`), current `MemoryTab.tsx` carries the shipped pattern with in-code comments crediting Lane D, coverage at `tests/memory/log-affordance.test.tsx`. Closed as verified-shipped in the memory backlog; no re-spike.

**Lane 1 — A2 voice-telemetry harness SHIPPED (PR #40, merged `0f56c96`).** A2.2–A2.5 + the roadmap 429 scenario — the voice loop finally has a live-path gate. `e2e/voice-telemetry-smoke.spec.ts` (615 lines, 2 specs) drives the FULL check-in voice loop in a real browser — the ~8 arming/TTS/dispatch effects PR #21 died in — twice per run, asserting `voice_start_called` / `voice_stop_called` / `voice_rearm_fired` on the intercepted PostHog wire with props + the D4 `distinct_id` stitch across a reload. Second spec: answer-turn extract 429 `extract.rate_limited` (PR #36 shape) → bail to Stage 2 with the honest rate-limited notice, telemetry intact — Pattern B's standing gate. Fully stubbed: init-script fake getUserMedia (silent synthetic stream), SSE-shaped `/api/transcribe`, real-tiny-WAV `/api/speak` (so `onended` fires for real), scripted `/api/check-in/extract{,-event,-medication}`, PostHog ingest fulfilled + decoded (gzip/base64/plain). Zero live Sarvam/LLM/PostHog calls; NO product code touched. Four environment landmines documented in-file: Playwright's headless shell has no media capture (→ `channel: 'chromium'`); **posthog-js 1.376 silently drops every capture when `navigator.webdriver` is set (`isLikelyBot`)** — init-script mask; this alone explains any future "vitest-green, PostHog-empty" mystery under automation; the orb's infinite pulse defeats actionability (→ `reducedMotion`); fake-device flags are platform-flaky (→ the getUserMedia fake). A2.5 adapted from the 2026-05-25 plan (CI exists now): `.github/workflows/voice-harness.yml`, non-required + path-gated to the voice surface, prod-mode server, failure artifacts — green on the PR itself; `ci` required gate untouched. Existing F04/F05 e2e pinned byte-identical via `testIgnore`. Gate: tsc ✅ lint 0/46 ✅ 1188/1188 ✅ build ✅ new e2e 2/2 ×3 runs + CI ✅. **A2.6 live manual voice smoke on meetsaha.com remains Rewant's** — the harness is local/CI-only by design.
**⚠️ Real product bug found, NOT fixed (needs its own small PR — it's visual):** in `listening-answer` BOTH `StopButton` and `SwitchToTapsButton` render `fixed inset-x-0 [bottom:calc(5rem+env(safe-area-inset-bottom))] z-50` — "Switch to taps" fully covers "Tap when done", so every follow-up turn has no visible/tappable stop affordance and a tap aimed there bails the whole loop to Stage 2. `StopButton.tsx:19` / `SwitchToTapsButton.tsx:61`. P1 UX; survivable live only because VAD auto-stop + orb-tap exist. The harness stops via the orb.

**Lane 2 — housekeeping #13 bloodWorkMarkers flatten SHIPPED (PR #41, merged `725c3fb`).** Spine item 4 (§7.1.3) done ahead of F08: `bloodWork.markers[]` now dual-writes into a relational `bloodWorkMarkers` table — one row per marker, indexed `by_user_name_date (userId, name, date)` so "show CRP trend over 6 months" becomes an indexed range scan instead of a JS filter over every parent doc, plus `by_blood_work` for parent linkage. Names are canonical via `convex/markerNames.ts` (trim/collapse/case-fold + alias map for CRP/ESR/WBC/Hb spellings; unknown names pass through normalized), shared by dual-write AND backfill so trends can't fragment; the embedded array keeps as-entered spelling (canonical is a query concern, not display). Embedded array stays the read source for all F05 surfaces — nothing user-visible changed; fully additive (prod runs old code safely until deploy). Soft-delete mirrors `deletedAt` onto marker rows; edits rebuild the projection (one real bug caught by tests: date-only edits compared against the post-patch row — fixed by capturing `previousDate` before patching). Backfill `migrations:backfillBloodWorkMarkers` is idempotent + cursor-batched; verified on dev (hardy-hamster-888): run 1 `{scanned:13, backfilled:13, markerRowsInserted:20}`, run 2 skips all 13. ADR-037. Gate: tsc ✅ lint 0/46 ✅ **1188 → 1209** ✅ build ✅ F05 e2e 1/1 prod-mode ✅. **PROD PENDING (Rewant):** next `ship-prod.sh` now carries this schema + dual-write; after it, run `npx convex run migrations:backfillBloodWorkMarkers --prod` (safe to run twice).

**Lane 3 — F03 Patterns chunking: Track A draft + Track B 3-reviewer pass + fix pass (PR #39 OPEN for Rewant — do not merge without him).** Track A (`fde9d20`): feature MD `scoped → chunked` (44→253 lines) with C1 fully 4-laned — 3.A aggregation queries + contracts (`convex/patterns.ts` read-only: `getPatternsSeries`/`getPatternsUnlock`/`getPatternsSummary` as the proposed F06 contract) / 3.B pure-SVG viz library (multi-metric line, wellness ring, streak bar) / 3.C route + unlock gate + Home swap — and C2 sketched (3.D rules-based insights, 3.E insight surfaces, 3.F flag-inert paywall), plus `03-patterns-cycle-1-plan.md` (183 lines) on the F01 house pattern. Read-only invariant locked: zero writes, zero schema change, W2-2 bounds mandatory. Reconciled the scoping § Short-horizon vs § Whoop-charts tension: day-1 visuals on Home, Patterns tab unlocks day-14 + ≥8 live check-in days. Track B (`8194773`): three reviewer lenses (brief fidelity / spec+regression / edge cases) ran in parallel; every finding code-verified before applying. **3 blockers fixed in spec:** `[seed]`-prefix wipe strategy for the dose-change fixture (dosageChanges has no `providerUsed` — the drafted wipe semantics were unimplementable without a schema change); dual-progress locked copy "Day {N} of 14 · {C} of 8 check-ins" with clamped `progressDay` (the too-sparse case — day 20, 5 check-ins — previously read "Day 20 of 14"); day convention relocked device-local → `todayIST()` per the W2-3 single-home rule (flagged as OQ-8 — an overnight override of a Track A lock). 19/19 should-fixes + 12/12 nits applied, incl.: Memory deep-link param deferred to C2 (ownership contradiction), intake-adherence merge rule defined (check-in value wins, else ≥1 live intake event), flare-span gap-bridging specced, 8px streak cells get ≥44pt hit targets (joint-pain cohort), error states per F10 template, README row 03 synced. **10 OQs for Rewant** (7 original + OQ-8 IST override, OQ-9 intake merge, OQ-10 flare-gap) — `chunked → ready` gates on his answers. Reviewer verdicts: "unusually well-grounded — every schema field, index, enum, seam checked is accurate"; the blockers were spec decisions, now made and flagged.

**Session 30 wrap.** Merged: #40 (A2 harness), #41 (#13 flatten). Open for Rewant: #39 (F03 chunking, 10 OQs), #37 (scoping reconcile, untouched per rule). Housekeeping: #10 closed verified-shipped; #13 closed-in-code (prod backfill pending); NEW candidate — the StopButton/SwitchToTapsButton z-fight above. Suite 1188 → 1209; e2e specs 2 → 3 files (F04, F05, voice-telemetry ×2 tests); one new non-required workflow (`voice-harness.yml`). Worktree `saha-f03-docs` left in place while #39 is open. **Rewant's morning list: ① live manual smoke of the W2 ship (owed from session 29) ② PR #37 ③ PR #39 OQs (esp. OQ-8 IST + the F06 fork OQ-2) ④ Convex prod deploy note: next ship-prod.sh carries #41's schema, then the prod backfill command ⑤ StopButton z-fight fix (small visual PR) ⑥ `AI_GATEWAY_API_KEY` secret ⑦ vendor keys + Q2/Q3/Q5 + S1–S5 smoke ⑧ auth D/F/G (still the biggest gate) ⑨ confirm old `saha-prod-cli` revocation.**

## 2026-07-12 — Session 31: nightly-integration red fixed (PR #42, merged `11b2843`)

**Trigger.** Status check found the nightly integration job red 4 nights straight (since 2026-07-07). Traced: `tests/integration/medications.test.ts` test 5 still asserted the pre-#38 contract — `recordDosageChange` with `source: 'check-in'` and no `checkInId` must reject. PR #38 deliberately relaxed exactly that (the `dosage.checkin_id_required` rejection WAS the latent prod bug); #38 updated the unit tests but this nightly-only test wasn't in the PR gate and was missed. It started failing the first night after session 30's `convex dev --once` pushed the relaxed handler to dev. Stale test, not a product regression.

**Fix.** Test 5 rewritten to the documented contract: (a) `'module'` + checkInId rejects (`checkin_id_forbidden`, proven against a real check-in id so the rejection is the rule, not Id validation), (b) `'check-in'` without checkInId records unlinked — the #38 best-effort path finally has integration coverage, (c) `'check-in'` with checkInId records linked; dose patched through both changes, both audit rows asserted. Gate: test:integration 11/11 vs live dev · tsc · lint 0E/46W · 1209/1209 · build. **Dispatch-verified: nightly run `29165442669` green (integration + live-llm).**

**Environment note.** Built from a fresh shallow clone on the internal disk — the external project drive spent the session in a USB I/O-timeout → reset loop (Seagate Expansion, behind the 5-in-1 hub; partitions enumerate, mounts never complete). `.env.local` reconstructed from the known dev values. The canonical checkout on the external volume is untouched and one `git pull` from current once the drive is stable; hardware still under investigation (next step: drive direct into the Mac, no hub).

**Learning.** A Convex handler contract change must grep `tests/integration/` too — that suite runs nightly only, so the PR gate can't catch it. Added to memory as a standing rule.
