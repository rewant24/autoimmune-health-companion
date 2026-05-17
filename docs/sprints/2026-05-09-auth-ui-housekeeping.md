# Sprint plan — Auth + UI follow-ups + targeted housekeeping

**Sprint kicked off:** 2026-05-09
**Sprint owner:** Rewant
**Sprint codename:** Lane B (Auth) + Lane C (UI) + Lane 3 (Housekeeping)
**Status:** Phase 0 complete (doc updates landed). **Phase 2 (Lane C) SHIPPED 2026-05-10 — PR #23 squash `c5f1dbb`.** Phase 1 (Lane B auth scoping) in flight on Tab A. **Phase 2b (Lane D — Journey bottom CTA) added 2026-05-10** per Rewant; reopens housekeeping #10 as a spike-first UI cycle in a new Tab D. Phase 3 (Lane B build) unblocked once scoping locks AND Lane D ships.

---

## One-line summary

This is the **MVP-completion sprint**. F05 closed the MVP feature scope; this sprint closes the remaining non-feature gap (auth) plus a tight UI polish pass and the housekeeping items that have been carried long enough.

---

## Sprint scope (locked)

### In scope

| Lane | What | Cycle shape |
|---|---|---|
| **B — Auth** | Provider integration, full handler migration off client-trusted `userId`, prod stub-userId migration, `clientRequestId` unique index, onboarding state-machine refactor | Multi-cycle: scope → review → build (3 parallel subagents) → review (3 parallel subagents) → fix → ship |
| **C — UI follow-ups** ✅ SHIPPED 2026-05-10 (PR #23 `c5f1dbb`) | (1) MemoryTab/DayView completed check-ins expanded by default. (2) Check-in summary above visit/blood-work cards. (3) Memory vs Journey naming. (4) Bonus: housekeeping #11 — remove 11 `(api as any)` casts in `app/check-in/page.tsx` | Single PR, single review pass, ship in 1–2 sessions |
| **D — Journey bottom CTA** (added 2026-05-10) | Reopens housekeeping #10. The "+ Log visit or blood work" `<details>` popover at the bottom of MemoryTab needs a more crafted pattern. Spike-first: 3–4 design alternatives, recommend, approve, build. | Spike doc → recommendation → approval → single PR + single review pass |
| **3 — Housekeeping decision** | #6 body-map spike — binary call: schedule F01 C3 OR delete `app/poc/body-map/page.tsx` | Decision only (no work this sprint, unless answer is "delete") |

### Out of scope (deferred with reason)

- **#8 Stale Voice C1 memos audit** — Rewant call 2026-05-09. Memos already have supersession headers; revisit later.
- **#12 Date-bounded `withIndex`** — defer to F08 prep (Journey aggregation).
- **#13 Embedded `bloodWork.markers` flattening** — defer to F08 prep. Needs prod migration.
- **#15 Confirm-card approve/cancel UX spike (visit + blood-work cards)** — distinct from #10 (#10 is the bottom-of-Journey CTA; #15 is the mid-check-in extracted-event cards). Stays open. Pick up post-Lane-B scope.
- **#1 + #2 Convex deploy-key rotations** — deprioritized 2026-04-29 standing decision.
- **F06 Doctor Report, F07 Prepare-for-Visit, F08 Journey aggregation** — explicitly post-launch.
- **Pricing + Razorpay/Stripe integration** — first 50 users free per 2026-05-09 decision.
- **Top-nav "+" CTA, photo/Drive upload + OCR, blood-work units localization** — new features; need scoping post-auth.

---

## Decisions locked at sprint kickoff (2026-05-09)

| # | Decision | Source |
|---|---|---|
| 1 | MVP launches free for first 50 users; pricing decision deferred until post-50 telemetry | Rewant 2026-05-09 |
| 2 | Auth pulled into MVP completion sprint (was post-MVP) | Rewant 2026-05-09 |
| 3 | Sign-in methods: email magic link (all locales) + phone OTP (India only, locale-detected) | Rewant 2026-05-09 |
| 4 | Sprint sequence: Lane B → Lane C → Lane 3 | Original prompt |
| 5 | #8 Voice C1 memo audit deferred this sprint | Rewant 2026-05-09 |
| 6 | Two-tab parallel work via git worktrees off `main` | Recommended + approved |
| 7 | Lane C ships before Lane B build phase starts | Sequencing rule (avoids Convex dev singleton conflict) |

## Decisions still open (to walk in Phase 1 scoping)

| # | Decision | Notes |
|---|---|---|
| A | **Auth provider stack** — Convex Auth vs Clerk vs Auth.js | Convex Auth is the strong default; compare explicitly before locking. Decision criterion: cost + friction + Convex compatibility + India-friendly |
| B | **Magic-link transport** — Convex's built-in vs Resend vs SES vs SendGrid | Affects email deliverability + cost |
| C | **Phone OTP provider** — Twilio Verify vs Sarvam vs MSG91 (India-native) | India-first picks may have better deliverability + lower cost |
| D | **India locale detection** — `Accept-Language` header / IP geo / explicit locale toggle / phone-prefix entry | Determines when phone OTP is offered |
| E | **Stub-userId data migration** — wipe / adopt onto first signed-in identity / orphan | ~5 prod waitlist + Rewant smoke data on `usable-zebra-515` |
| F | **Profile data location** — localStorage / Convex `profiles` table / hybrid | Today: `saha.profile.v1` in localStorage (DOB month/year, condition, email per ADR-029) |
| G | **Onboarding state machine post-auth** — auth gate → profile gate → home; OAuth-popup vs redirect on iOS web | The `app/journey/layout.tsx` + onboarding-shell flow needs reworking |
| H | **Privacy policy + T&C update** — pre-launch legal review or post-launch acceptable for first 50 free users | India PDP Bill considerations; sensitive-PII line crossed once we store email + identity + health markers |
| I | **#6 body-map spike** — schedule F01 C3 or delete the spike | Binary call this sprint; resolution lives in Lane 3 |
| J | **Memory vs Journey naming** (Lane C item 3) | Read `docs/product-taxonomy.md` first; surface the question + relevant excerpt; do NOT unilaterally pick |

---

## Parallel-tab setup (recommended + approved)

Two git worktrees off `main`, one Claude Code tab per worktree.

```
~/saha-auth/   # Tab A: Lane B (auth)        feat/auth-scoping → feat/auth-build
~/saha-ui/     # Tab B: Lane C (UI follow-ups) feat/ui-followups
```

Bootstrap commands (run from canonical repo `/Volumes/Coding Projects + Docker/autoimmune-health-companion/`):

```bash
git worktree add ../saha-auth -b feat/auth-scoping main
git worktree add ../saha-ui   -b feat/ui-followups  main
git worktree add ../saha-cta  -b feat/journey-cta-ui main   # added 2026-05-10 for Lane D
```

### File-ownership boundary (zero overlap)

| Area | Tab A (auth) | Tab B (UI — closed) | Tab D (Journey CTA) |
|---|---|---|---|
| `convex/*.ts` | OWNS (during build phase) | NEVER touched | NEVER touches |
| `convex/schema.ts` | OWNS | NEVER touched | NEVER touches |
| `docs/architecture-decisions.md` | OWNS (new ADRs) | NEVER touched | NEVER touches |
| `docs/features/auth-scoping.md` | OWNS (new file) | NEVER touched | NEVER touches |
| `app/journey/layout.tsx` | OWNS (onboarding state machine) | NEVER touched | NEVER touches |
| `app/(auth)/*` (new) | OWNS | NEVER touched | NEVER touches |
| `app/check-in/page.tsx` | NEVER touches | OWNED (shipped via PR #23) | NEVER touches |
| `components/memory/MemoryTab.tsx` | NEVER touches | OWNED (shipped) | OWNS — `LogVisitOrBloodWorkAffordance` (line 149) |
| `components/memory/DayView.tsx` | NEVER touches | OWNED (shipped) | NEVER touches |
| `docs/spikes/journey-bottom-cta.md` (new) | NEVER touches | NEVER | OWNS |
| `docs/product-taxonomy.md` | NEVER touches | READ-ONLY (decision input) | NEVER touches |
| `docs/sprints/2026-05-09-auth-ui-housekeeping.md` (this doc) | Both tabs READ; only canonical session updates | — | READ |

### Convex dev singleton rule

Only one Claude tab can run `npx convex dev` against `hardy-hamster-888` at a time without conflict.

- **Tab A (scoping):** markdown only, never runs `convex dev`.
- **Tab B (UI — closed):** ran `next dev` only; never `convex dev`. Branch shipped + worktree can be cleaned up.
- **Tab D (Journey CTA):** runs `next dev` only; uses existing schema. Does NOT run `convex dev`. No `convex/` changes.
- **Tab A (build phase):** OWNS `convex dev`. Starts only AFTER **both** scoping locks AND Lane D ships.

This rule is the reason Phase 1 (Tab A) + Phase 2b (Tab D) can run in true parallel, and Phase 3 (Tab A build) cannot start until Lane D ships.

### Why not parallel POCs of two auth providers?

A natural alternative is "Tab A = Convex Auth POC, Tab B = Clerk POC, pick the winner." Rejected because both POCs would touch the same `convex/*.ts` files + the same onboarding shell — guaranteed merge conflict. The provider decision belongs in scoping (Phase 1, decision **A**), not in code.

---

## Phase-by-phase plan

### Phase 0 — Sprint kickoff doc updates (DONE 2026-05-09)

- [x] `~/.claude/projects/-Users-rewantprakash-1/memory/project_saha_mvp_scope.md` — first 50 free, auth pulled into MVP
- [x] `~/.claude/projects/-Users-rewantprakash-1/memory/housekeeping_backlog.md` — sprint absorption + deferral markers on items #6, #8, #10, #11, #12, #13, #14
- [x] `docs/post-mvp-backlog.md` — item #17 (monetization) deferred-until-post-50 marker; item #20 (auth enforcement) → moved into MVP marker
- [x] `docs/sprints/2026-05-09-auth-ui-housekeeping.md` — this doc

### Phase 1 — Lane B scoping (Tab A, markdown only)

**Branch:** `feat/auth-scoping`
**Owner:** Tab A
**Output:** locked scoping doc + draft ADRs + handler-migration list

Steps:
1. Create worktree: `git worktree add ../saha-auth -b feat/auth-scoping main`.
2. Create `docs/features/auth-scoping.md` with the 6 section skeleton:
   1. Provider stack (Decision A)
   2. Sign-in methods (locked: email magic link + India phone OTP) — capture rationale + India-detection mechanism (Decision D)
   3. Migration of existing data (Decision E)
   4. Schema + handler refactor — full audit list of every `convex/*.ts` mutation + query that takes `userId: v.string()`
   5. Profile data location (Decision F)
   6. Onboarding state machine (Decision G)
3. Walk decisions in order **one at a time**. Lock each before moving on. Persist each lock in the scoping doc immediately (per `feedback_persist_design_qa.md`).
4. After all 6 sections lock, draft:
   - **ADR (new):** Auth provider choice + rationale
   - **ADR (new):** Server-derived `userId` (supersedes ADR-019)
   - **ADR (new):** `clientRequestId` unique-index pattern (folds in housekeeping #14)
   - **Handler-migration list:** every `convex/*.ts` mutation + query, with current arg shape and target post-auth shape
   - **Migration script outline:** for prod stub-userId rows (Decision E)
5. **Stop. Wait for Rewant sign-off before any code.** This is the playbook's "scoping locks" gate.

### Phase 2 — Lane C UI follow-ups (Tab B, runs in parallel with Phase 1) — **SHIPPED 2026-05-10**

**Branch:** `feat/ui-followups` (deleted post-merge)
**Owner:** Tab B (separate Claude Code session pointed at `~/saha-ui/`)
**Output:** PR #23 squash-merged `c5f1dbb` to `main`. Items 1, 2, 4 landed as code; item 3 (Memory vs Journey) resolved as "leave as-is" (no code change). Prod routes 200 on `https://www.meetsaha.com/{check-in,journey/memory}`. Worktree retained for now; cleanup pending in Phase 4.

Steps:
1. Create worktree: `git worktree add ../saha-ui -b feat/ui-followups main`.
2. **Item 1** — completed check-ins expanded by default
   - Read `components/memory/DayView.tsx` and `components/memory/MemoryTab.tsx` first
   - Find the collapsed-state default; flip it
   - Re-run vitest + check tests for regression
3. **Item 2** — check-in summary above visit/blood-work cards
   - Read `app/check-in/page.tsx` first (summary section + EventConfirmCard / MedicationConfirmCard mounts ~lines 1100 and 1230 per F05 plan)
   - Reorder
   - Smoke the visual order
4. **Item 3** — Memory vs Journey naming
   - Read `docs/product-taxonomy.md` first
   - **Don't unilaterally pick.** Surface the taxonomy excerpt + the question to Rewant. If taxonomy locks one term, update the other UI label. If both correct (Journey = pillar, Memory = screen within), the fix is explanatory copy not renaming.
5. **Bonus while-here (housekeeping #11)** — `npx convex codegen`, remove the 11 `(api as any)` casts in `app/check-in/page.tsx`. Expect tsc clean. Skip if it surfaces unexpected type drift; flag separately.
6. Single reviewer subagent pass per playbook.
7. Fix any reviewer findings.
8. Open PR off `main`. Merge.
9. Live smoke on `https://www.meetsaha.com/check-in` post-promote: completed check-ins expanded, summary above cards, naming applied.
10. **No `npx convex deploy` needed** (no `convex/` changes).
11. Update housekeeping_backlog.md: move #11 to Resolved with the squash hash. Close out the Lane C entry.
12. Tab B is now done for this sprint.

### Phase 2b — Lane D — Journey bottom CTA (Tab D, added 2026-05-10)

**Branch:** `feat/journey-cta-ui` off `main` (post-Lane-C)
**Owner:** Tab D (separate Claude Code session pointed at `/Volumes/Coding Projects + Docker/saha-cta/`)
**Output:** spike doc + recommendation + (after Rewant approval) single PR shipping the chosen pattern
**Reopens:** housekeeping #10. Promoted from "post-MVP no urgency" → in this sprint per Rewant 2026-05-10.

Why this is its own lane (not folded back into Lane C): Lane C already shipped (PR #23). Reopening Lane C would mean a new branch off main anyway. Cleaner to lane it explicitly so the file-ownership matrix and the Convex dev singleton rule stay clear.

Why spike-first: the current `<details>` popover is functional but design-thin. Several alternatives exist (sheet popover, side-by-side pills, FAB, two-button row). Picking one without surfacing trade-offs is exactly the kind of unilateral design call we want to avoid.

Steps:
1. Create worktree: `git worktree add ../saha-cta -b feat/journey-cta-ui main` (off post-Lane-C `main`).
2. Read the current affordance: `components/memory/MemoryTab.tsx` lines 132–195 (`LogVisitOrBloodWorkAffordance`). Note the test ID surface: `memory-log-affordance`, `memory-log-affordance-trigger`, `memory-log-affordance-visit`, `memory-log-affordance-bloodwork`. Find existing tests covering these.
3. Read the original locked spec: `docs/features/05-doctor-visits.md:124` ("single button at the bottom of the day view: + Log visit or blood work").
4. Read related context: `docs/product-taxonomy.md` (Memory vs Journey terminology — Lane C resolved this as "leave as-is"; Journey = pillar, Memory = screen within).
5. **Spike doc** at `docs/spikes/journey-bottom-cta.md`. Capture:
   - Current UX with markup snippet + screenshot description
   - 3–4 alternative patterns. Reference set:
     - **A. Sheet-style popover** (Radix `Dialog` or hand-rolled bottom sheet — "+ Log visit or blood work" trigger opens a bottom sheet with two larger options)
     - **B. Two side-by-side CTA pills** (no popover — both "Log visit" and "Log blood work" rendered inline; trades discoverability simplicity for vertical space)
     - **C. FAB pattern** (floating action button bottom-right with sheet menu; consistent with `RegimenList` add-affordance pattern per `components/medications/RegimenList.tsx:12`)
     - **D. Inline two-button row under a section header** (no popover, no FAB — "Add to your record" header + two pill buttons)
   - Pros/cons for each against:
     - Discoverability (does Sonakshi find it on first session?)
     - Tap target on mobile (44pt minimum; `<details>` summary is borderline)
     - Consistency with rest of Memory surface (visual rhythm continuity)
     - Implementation cost (Radix dependency? Outside-click handling?)
     - Accessibility (focus management, screen-reader labels, keyboard nav)
   - **Recommend ONE** with the reasoning written out.
6. Surface the spike doc to Rewant. **Stop. Wait for approval before coding.**
7. After approval, build the chosen pattern in `components/memory/MemoryTab.tsx`:
   - Preserve the existing test IDs where possible (so existing test coverage stays green)
   - Update the `LogVisitOrBloodWorkAffordance` component (or replace it)
   - Update existing MemoryTab tests; add new tests for the chosen pattern's interaction model
8. Single reviewer subagent pass per playbook.
9. Fix findings.
10. Open PR off `main`. Merge as squash.
11. Live smoke on `https://www.meetsaha.com/journey/memory`: tap the new affordance, verify both routes (`/visits/new` and `/blood-work/new`) open correctly, verify visual consistency with rest of Memory tab.
12. **No `npx convex deploy` needed** (no `convex/` changes).
13. Update `~/.claude/projects/-Users-rewantprakash-1/memory/housekeeping_backlog.md`: move #10 to Resolved with the squash hash. Update this sprint doc § Decision log.
14. Tab D is done for this sprint.

### Phase 3 — Lane B build (Tab A, after Phase 1 locks AND Lane D ships)

**Branch:** rebase `feat/auth-scoping` on latest `main` OR fresh `feat/auth-build` off post-Lane-D `main`
**Owner:** Tab A
**Output:** auth merged + Convex prod deployed

Steps:
1. Confirm Lane C **and Lane D** are merged into `main`. Pull latest.
2. Spawn 3 parallel build subagents (per playbook):
   - **Lane B-1:** Auth provider integration (provider config, sign-in routes, session plumbing). Wires up email magic link first; phone OTP layer second.
   - **Lane B-2:** Handler migration. Every `convex/*.ts` mutation/query swaps `userId: v.string()` arg for `ctx.auth.getUserIdentity()`. Defense-in-depth `row.userId === userId` match preserved (sourced from auth instead of args). Includes `clientRequestId` unique index across `intakeEvents`, `medications`, `doctorVisits`, `bloodWork` (folds in housekeeping #14).
   - **Lane B-3:** Migration script for existing prod stub-userId rows + onboarding state machine refactor in `app/journey/layout.tsx` + profile data location wiring (per Decision F).
3. Integrate all three lanes back into `feat/auth-build`.
4. Spawn 3 parallel reviewer subagents per playbook.
5. Fix findings. Second reviewer pass if substantial.
6. Open PR off `main`. Merge as squash.
7. **Convex prod deploy is a SEPARATE manual step.** Use `scripts/ship-prod.sh` (or `CONVEX_DEPLOYMENT=prod:usable-zebra-515 npx convex deploy --yes`). This is NOT automated by Vercel auto-promote — flag it explicitly at PR-merge time. See `feedback_remind_convex_deploy.md`.
8. **Run prod migration script** for stub-userId rows. **Require explicit Rewant approval before running.** This is irreversible on prod.
9. **Live manual smoke on `https://www.meetsaha.com`** per `feedback_ship_day_manual_smoke.md`. Walk:
   - Sign-up flow (new email)
   - Sign-up flow (Indian phone — verify locale detection triggers OTP option)
   - Sign-in flow (returning user)
   - Sign-out
   - Existing-data adoption: Rewant's account inherits prior smoke data per migration decision
   - Every previously-userId-arg surface still works: check-in submit, intake log, medications, doctor visits, blood work
10. Update `project_saha_status.md` with new ship state (auth live, MVP completed).
11. Close housekeeping #14 in `housekeeping_backlog.md`.

### Phase 4 — Sprint close (after Lane B ships)

**Owner:** canonical session (no worktree)

Steps:
1. **#6 body-map binary decision** — present v2 silhouette state, ask once, execute:
   - If schedule: create `docs/features/01-daily-checkin-c3-body-map.md` from the spike, lift `<BodyMap>` out of POC, add `painLocations` to `lib/checkin/types.ts` + `convex/schema.ts`, add `lib/checkin/condition-regions.ts`. (Likely a separate cycle, not this sprint.)
   - If delete: `trash app/poc/body-map/page.tsx` + close the spike doc with a "decision: deleted 2026-MM-DD" header. Move housekeeping #6 to Resolved.
2. Update `~/.claude/projects/-Users-rewantprakash-1/memory/project_saha_status.md` with end-of-sprint ship state.
3. Append `~/.claude/projects/-Users-rewantprakash-1/memory/session-log.md` with sprint summary.
4. Update `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md` index if any new feedback memos got written during the sprint.
5. Cleanup worktrees: `git worktree remove ../saha-auth && git worktree remove ../saha-ui` once branches are merged.

---

## Risks tracked

| # | Risk | Mitigation |
|---|---|---|
| 1 | Phase 1 + Phase 2 truly parallel only because Phase 1 is markdown-only. The transition into Phase 3 (Tab A build) MUST wait for Lane C to ship. | Rule made explicit in this doc; surfaced again at the Phase 1 → Phase 3 boundary. Tab A pauses if Tab B hasn't shipped. |
| 2 | iOS web OAuth-popup vs redirect friction is a known UX papercut. | Bake into Decision G in the scoping doc, don't gloss. Test on iOS Safari before ship. |
| 3 | Prod stub-userId migration on `usable-zebra-515` is irreversible. ~5 waitlist rows + Rewant smoke data. | Migration script runs ONCE, requires explicit Rewant approval at Phase 3 step 8. Wipe / adopt / orphan choice locked in scoping (Decision E). |
| 4 | `clientRequestId` unique index (#14) is part of Lane B ship — not optional. If Lane B-2 stalls on the index migration, we don't ship auth without it. | Reviewer subagents flag any "auth merged without index" state. Same migration window, same handlers, atomic. |
| 5 | Convex `npx convex deploy` is a separate manual step from Vercel auto-promote. Easy to forget. | `feedback_remind_convex_deploy.md` rule fires; Phase 3 step 7 explicitly calls it out. Use `scripts/ship-prod.sh`. |
| 6 | Two-tab work could drift if Tab B's PR sits unmerged for too long while Tab A's scoping rolls forward. | Lane C is single-PR / single-review-pass / single-session by design. If it can't ship in 1–2 sessions, it gets re-scoped, not stretched. |
| 7 | Privacy policy + T&C status (Decision H) is a legal-review question that may block launch. | Surface early in scoping. If legal review is required pre-launch, that's a Lane B blocker — log explicitly, don't bury it in code work. |
| 8 | Profile data location migration (Decision F) — if `saha.profile.v1` localStorage moves to Convex `profiles` table, every existing user (Rewant + 5 waitlist) has localStorage state that needs adopting on first sign-in. | Couples to Decision E. Scoping must define both moves as one migration step, not two. |
| 9 | Lane D scope creep — easy to drift from "improve the bottom CTA" into "rethink Memory navigation entirely." | Spike doc forces 3–4 alternatives; recommendation is one pattern, not a redesign. Tab D ships single PR; if it grows beyond that, it gets re-scoped. |
| 10 | Lane D delays Lane B build start — Phase 3 is now gated on Lane D ship + scoping locks (was just scoping locks). | Lane D is a small UI cycle. If it can't ship in 1–2 sessions, fall back to the original `<details>` and re-defer #10. Lane B doesn't wait indefinitely. |

---

## Doc-update register (so backlog doesn't drift during the sprint)

This is the running list of which docs get touched at which phase. Anything not on this list is out of scope for the sprint.

| Doc | Phase | What changes |
|---|---|---|
| `~/.claude/projects/-Users-rewantprakash-1/memory/project_saha_mvp_scope.md` | 0 | Pricing decision + auth pull-in (DONE) |
| `~/.claude/projects/-Users-rewantprakash-1/memory/housekeeping_backlog.md` | 0 + 2 + 2b + 3 + 4 | Sprint markers (DONE) → #11 Resolved (Phase 2 DONE) → #10 reopened + Resolved (Phase 2b) → #14 Resolved (Phase 3) → #6 decision (Phase 4) |
| `docs/spikes/journey-bottom-cta.md` (new) | 2b | Created by Tab D. 3–4 design alternatives + recommendation. |
| `docs/post-mvp-backlog.md` | 0 + Phase 1 + Phase 4 | #17 + #20 markers (DONE) → any new deferral notes from scoping decisions → close-out moves |
| `docs/sprints/2026-05-09-auth-ui-housekeeping.md` (this doc) | All | Phase status updates as the sprint advances |
| `docs/features/auth-scoping.md` | 1 | Created. 6-section skeleton → fills in across decisions A–H |
| `docs/architecture-decisions.md` | 1 + 3 | New ADRs at end of Phase 1 (provider, server-userId, clientRequestId index pattern) → re-numbered if needed at Phase 3 |
| `docs/architecture-changelog.md` | 3 | Append entries for auth ship + index migration + profile-table migration |
| `docs/build-log.md` | All | Append entries per session per build-log convention |
| `docs/build-plan.md` | 1 | Add the auth lane explicitly if not already present |
| `docs/system-map.md` | 3 | Update auth + onboarding flow paths once Lane B ships |
| `docs/product-taxonomy.md` | 2 | READ-ONLY for Lane C item 3 unless Rewant decides naming change. If changed, log under Decision J in this doc. |
| `~/.claude/projects/-Users-rewantprakash-1/memory/project_saha_status.md` | 4 | Updated post-Lane-B ship |
| `~/.claude/projects/-Users-rewantprakash-1/memory/session-log.md` | 4 | Append sprint summary |
| `~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md` | 4 | Index any new feedback memos |

---

## Decision log (running)

Append decisions here as they lock during the sprint. Format: `YYYY-MM-DD — Decision N (label) — outcome.`

- **2026-05-09 — Decision 1 (pricing posture)** — Free for first 50 users, then revisit. No payment integration this sprint.
- **2026-05-09 — Decision 2 (auth into MVP)** — Auth pulled from post-MVP into MVP completion sprint.
- **2026-05-09 — Decision 3 (sign-in methods)** — Email magic link (all locales) + phone OTP (India only, locale-detected).
- **2026-05-09 — Decision 4 (sprint sequence)** — Lane B → Lane C → Lane 3.
- **2026-05-09 — Decision 5 (#8 deferral)** — Voice C1 memo audit deferred this sprint.
- **2026-05-09 — Decision 6 (parallel-tab mechanics)** — Two git worktrees off `main`; Tab A = scoping then build, Tab B = Lane C UI; Lane C ships before Tab A's build phase begins.
- **2026-05-09 — Decision 7 (Lane C / Lane B build sequencing)** — Lane C must ship before Lane B build phase starts. Convex dev singleton is the gating constraint.
- **2026-05-10 — Decision J (Memory vs Journey naming)** — Leave as-is. Bottom-nav pillar = "Journey", screen heading = "Memory". Matches taxonomy (Journey = F08 unified pillar; Memory = F02 30d scroll within). No rename, no explanatory subtitle at MVP scale. Revisit if F08 ships and the pillar contains a sibling screen.
- **2026-05-10 — Lane C shipped** — PR #23 squash-merged `c5f1dbb`. Four items: Memory completed expanded by default; ConfirmSummary above visit/blood-work cards; Memory/Journey decision (above); housekeeping #11 codegen-cast cleanup. tsc + 1054/1054 vitest + build all green; single reviewer pass with no MUST/SHOULD findings; prod routes 200 on `https://www.meetsaha.com/{check-in,journey/memory}` post-promote. Housekeeping #11 moved to Resolved.
- **2026-05-10 — Decision 8 (Lane D added)** — Reopen housekeeping #10 (Journey bottom CTA) as Lane D this sprint. Spike-first cycle in new Tab D / `saha-cta` worktree branched off post-Lane-C `main` (`c5f1dbb`). Lane B build now gated on BOTH scoping locks AND Lane D ship. Reasoning: the `<details>` popover affordance is the MVP-critical friction point Rewant flagged as needing more craft before launch — bundling now keeps it inside this sprint's UI window rather than carrying it into post-launch. Stays separate from #15 (mid-check-in confirm-card UX) which is a different surface and stays open.

(Decisions A–H still open as of 2026-05-10; Decision I (#6 body-map) deferred to Phase 4. To be walked in Phase 1.)

---

## References

### Memory (auto-memory system)
- `project_saha_mvp_scope.md` — MVP scope memo (amended 2026-05-09)
- `project_saha_status.md` — current ship state
- `project_saha_shipping_rule.md` — Convex prod deploy is a separate manual step
- `housekeeping_backlog.md` — full backlog with sprint markers
- `reference_project_process.md` — playbook (scope → POC → parallel build → review → ship)
- `feedback_branch_base_for_pr_scope.md` — branch off main by default
- `feedback_ship_day_manual_smoke.md` — vitest green is not enough
- `feedback_remind_convex_deploy.md` — Vercel auto-promote rebuilds Next.js only
- `feedback_persist_design_qa.md` — write decisions through to memory same turn
- `feedback_clientRequestId_unique_index.md` — TOCTOU pattern coupled to auth
- `feedback_env_shape_parity.md` — local → dev → prod same shape, different data

### Project docs
- `docs/scoping.md` — canonical scoping (wins on conflict)
- `docs/build-plan.md`
- `docs/system-map.md`
- `docs/product-taxonomy.md`
- `docs/post-mvp-backlog.md` (with 2026-05-09 amendments to items #17 + #20)
- `docs/architecture-decisions.md` (especially ADR-019 client-trusted userId — superseded in this sprint)
- `docs/architecture-changelog.md`
- `docs/features/01-daily-checkin.md` … `05-doctor-visits.md`
- `docs/spikes/body-map-tap-input.md` (housekeeping #6)
