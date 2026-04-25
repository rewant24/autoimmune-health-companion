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
