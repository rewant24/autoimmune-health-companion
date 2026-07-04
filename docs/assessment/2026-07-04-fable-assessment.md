# Saha — Fable 5 Multi-Agent Assessment (2026-07-04)

**Method.** Six parallel dimension reviewers (backend/data, frontend/design, voice, quality/build, product/roadmap, security) read the codebase at `main = 2e87f16`. Every P0/P1 finding was handed to an independent adversarial verifier told to *refute* it against current code. Findings below carry the verdict. This is the input to [the roadmap](./2026-07-04-roadmap.md).

**One-line verdict.** The codebase is unusually disciplined for an MVP built by parallel agents — clean handler patterns, real test coverage, deliberate SSR-safety, good telemetry hygiene — but it carries **one live security emergency**, a **cost-abuse surface open on the public domain**, and a **doc layer that has drifted from reality** during the 6-week idle. None of the architecture needs a rewrite. It needs a hardening pass before the auth + revenue build.

---

## 🔴 P0 — Act today

### 1. Live secret leak: Vercel protection-bypass token committed to a PUBLIC repo
**Verdict: confirmed by direct check (not just agent claim).** `scripts/isolate-418.mjs:2` and `scripts/posthog-smoke.mjs:19` hardcode `BYPASS = 'ZmFX…fPNI'` (value redacted here; rotate it regardless — it shipped in public git history); `posthog-smoke.mjs:20` also pins a PostHog project key. Both files are `git ls-files`-tracked, and `rewant24/autoimmune-health-companion` is **PUBLIC**. The `x-vercel-protection-bypass` header defeats Vercel SSO/preview protection — anyone reading the repo can reach protected preview deployments.
**Fix (today, ~30 min):** rotate the bypass token in Vercel project settings; replace both literals with `process.env` reads; commit. Rotation is the real fix (the value is already public); history scrub is secondary. This is the **2nd occurrence** (see `build-log.md:959`) → add a `gitleaks` pre-commit hook so it can't recur. Effort: S.

### 2. `getCheckin` IDOR — any client can read any user's raw health transcript
**Verdict: confirmed.** `convex/checkIns.ts:295` (`getCheckinHandler`) takes only `{ id }`, no `userId` arg, no ownership comparison, and is exported as a public query on prod `usable-zebra-515`. Every other read/mutate path does defense-in-depth `row.userId === args.userId`; this one doesn't. Convex IDs aren't secret (they appear in create responses and links), so this is a real horizontal-access hole **today**, pre-auth.
**Fix:** add a `userId` arg and assert ownership (return `null` on mismatch), matching the visit/med pattern. Do it now — doesn't need the auth epic. Effort: S.

### 3. Extract-429 silent cliff — live in the voice loop
**Verdict: confirmed; severity downgraded P0→P1 by the verifier** (real user harm, but degraded-not-corrupt; roadmap treats it as the top voice fix). `app/check-in/page.tsx:901-909` collapses all extract errors — including the daily-cap 429 — to a silent `EXTRACTION_FAILED` that drops to a cold tap form, and in the answer loop it **silently writes metrics as declined**. With the prod cap at 5 extract calls/day and one call per answer turn, the cliff can trip *inside the first check-in of the day*.
**Fix (interim, shippable without the full harness):** branch on `ExtractDailyCapError` for honest copy; stop the loop from auto-declining metrics on repeated failure. Full graceful-failure narration (Pattern B) comes after the A2 harness. Effort: S interim / M full.

---

## 🟠 P1 — Before the auth + revenue build

### Backend / data
- **Open, money-costing API routes with bypassable caps.** `extract/route.ts:96` keys the 5/day cap on the *client-supplied* `userId` → rotate userId = unlimited paid LLM calls. `extract-event` and `extract-medication` carry **no cap at all** (their own comments admit it). `transcribe`/`speak` cap per-request size but not request volume. `proxy.ts` is host-redirect only — no rate limiting anywhere. Live financial-DoS vector on meetsaha.com. *Verified true/high.* **Fix:** Vercel WAF rate-limit rule on `/api/*` as a same-day stopgap; re-key caps on server-derived identity when auth lands. Effort: M.
- **Every list/range query collects full per-user history, then filters dates in JS.** `listEventsByRangeHandler` and five siblings (`checkIns.ts:432/454/495`, `continuity.ts:89`, `intakeEvents.ts:168`, `doctorVisits.ts:331`, `bloodWork.ts:390`) use `by_user_date` indexes bounded on `userId` only; the date component is never range-bound. `intakeEvents` grows fastest and the Memory feed re-runs this reactively. Cost/latency grow linearly with account age; **F06/F08 multiply it.** *Verified true/high.* **Fix:** push `gte/lte('date', …)` into the index predicate on all six paths — mechanical, do before F06/F08. Effort: M.
- **Auth swap is mechanical but the milestone is bigger than it looks.** Ownership checks are consistent (good), so `ctx.auth.getUserIdentity()` drops in cleanly — but there's **no users/profiles table** (profile is localStorage-only, `lib/profile/types.ts`), `TEST_USER_KEY` is re-declared in 10 page files, `getCheckin` lacks an owner check (#2 above), and `devSeed.wipeUser` is gated only by a `qa_` prefix. *Verified true/high.* Effort: L.

### Frontend / design
- **Two design languages ship on the same screen.** The entire F01 check-in surface uses zinc/Tailwind defaults while every other surface — and the F04/F05 confirm cards rendered *on the check-in screen* — uses the warm editorial token system. *Verified true/high.* Highest visual-impact item; schedule with primitive extraction (15 files). Effort: M.
- **Confirm-card duplication + unbounded stack.** `MedicationConfirmCard` and `EventConfirmCard` are ~85% duplicated; the stack has no depth cap (known N>3 threshold problem) and **the stack JSX is duplicated across two render branches** of the 1549-line `check-in/page.tsx`. *Verified true/high.* **Fix:** merge into one `ConfirmCard` + `ConfirmCardStack` before any F06/F08 extractor adds a 4th card type. Effort: M.
- **18 stale `(api as any)` casts** erase Convex type safety across all F04/F05 surfaces; the "codegen not ready" justification expired 2026-05-09. *Verified true/high.* Purely mechanical removal. Effort: S.
- **`getOrCreateTestUserId` copy-pasted 10+ times** with divergent signatures — the exact seam the auth wave replaces. Consolidating into one `useUserId()` hook now converts auth's frontend footprint from ~12 files to 1. *Verified true/high.* Effort: S.
- **No route error boundaries or custom 404 anywhere in `app/`.** Convex throws land on Next's unstyled default; auth adds new failure modes (expired session, forbidden reads). *Verified true/high.* Add `app/error.tsx` + `not-found.tsx`. Effort: S.

### Voice
- **Telemetry instruments only STT arming** — the P0 path, TTS failures, and session outcomes emit nothing, and the **Layer 2 PostHog live smoke was never run**. The P0 is invisible in prod. *Verified true/high.* Half-day stitch: `voiceLog` on the cap/failure/TTS-reject paths + a session-outcome event + run the smoke. Effort: S.
- **Mic can stay live during Stage 2.** `BAIL_TO_TAPS` and page navigation never stop the provider; `VoiceProvider` has no `abort()`. Privacy-relevant for a health app. *Verified true/high.* Effort: M.
- **The maintainable core wraps a fragile untested layer.** The 19-state reducer is pure and exhaustively tested; the ~8 interdependent effects in `check-in/page.tsx` that own arming/TTS/dispatch are where PR #21 died and have zero live-path test coverage. *Verified true/high.* The A2 e2e harness is the right standing gate; it's unstarted. Effort: M.

### Quality / build
- **Local `pnpm build` fails on main** — redacted `.env.production.local` sets `NEXT_PUBLIC_CONVEX_URL=""`, shadowing `.env.local`. Build is green once supplied, but `ship-prod.sh`'s "build green locally" pre-flight is currently impossible to satisfy. *Do first.* Effort: S.
- **E2E suite is red on main** — but proven **environmental**, not a regression: `next dev` cold-compile on the slow external volume times out; the identical F05 flow passes in 2.5s against `next start`. **Fix the webServer to `next build && next start` before the auth wave** (auth flows are exactly what needs browser e2e). Effort: M.
- **No CI and no linter exist at all.** A minimal gate (frozen install + typecheck + unit + build) is measured **under ~7 min**. `eslint-disable` comments reference rules that never run. Land eslint flat-config inside the CI PR. Effort: S each.
- **Baseline confirmed healthy:** tsc clean, 1068/1068 unit (15.8s), 11/11 integration vs live dev Convex (79s). msw lockfile drift (housekeeping #16) is **closed** — verified clean after `a3d345a`.

### Security (multi-user posture)
- **The whole datastore is a public multi-tenant read surface.** `listCheckins/listVisits/listBloodWork/listActiveMedications/getContinuityState/listIntakeEvents` all trust a client-supplied `userId`; the only barrier is UUID unguessability — security-through-obscurity, not access control. Fine for one trusted user, unsafe as the deployed multi-user system. *This is the core auth (Lane B) deliverable.* Effort: L.

### Product / roadmap (documentation drift — dangerous because scoping.md is the contractual conflict-winner)
- **scoping.md contradicts reality:** still claims Community is MVP Pillar 4 and specs a mobile-verification setup flow — both superseded. *Verified.* Must be reconciled before it misleads the build. Effort: M.
- **Auth is the sole launch blocker and its wall-clock long pole (Decision C → MSG91 DLT registration, 3–7 business days) has been parked 7 weeks.** *P0 for scheduling.* Effort: S to unblock (make the decision + start the clock).
- **Monetization inversion:** every paid-tier value prop (F03 Patterns, unlimited F06 Doctor Reports, WhatsApp share, unlimited Memory history) is an **unbuilt feature**. The revenue rubric has no path to first rupee without F03 + F06. Effort: L.

---

## 🟡 P2 — Opportunistic / fold into adjacent work

Backend: `dosageChanges` trusts client `oldDose` over the row's actual dose and has no `clientRequestId`; **intake events don't snapshot med name/dose** so history rewrites itself after a dose change (F06 report accuracy depends on fixing this — M); timezone split (device-local dates vs hardcoded `Asia/Kolkata` in visit/blood-work server logic) breaks UTC+13/+14 users — lock a convention before the international tier; `createCheckin` accepts any string as a date; AI Gateway 429s collapse to generic 502. **TOCTOU de-flagged:** Convex serializable mutations make check-then-insert safe — no unique index needed; record as an ADR so it stops resurfacing.

Frontend: `/visits` and `/blood-work` are structural clones (list/new/[id] + duplicated `DeleteConfirm`); design tokens consumed via repeated inline style objects instead of shared primitives; latent SSR-divergence in `prefersReducedMotion` lazy initializers (same #418 class PR #29 fixed); `/visits` + `/blood-work` have **no nav entry point** (F08 IA must decide where they live); landing demo components live loose in `app/` root; detail pages filter the full list client-side instead of a `getById` query.

Voice: `parseErrorPayload` collapses all `voice.*` server codes except `rate_limited` to `network` (wrong UI copy + mislabeled telemetry); Pattern B's proposed recovery copy is wrong for the 429 class ("ask one at a time" still burns capped calls) — B must fork terminal vs transient failures.

Security: extract routes echo raw upstream `err.message` to clients (info disclosure); `waitlist.count` and `extractAttempts.getCount` are public info surfaces to lock at auth.

Docs: journey-bottom-cta spike still "DRAFT" though it shipped as PR #25; **body-map C3 artifacts don't exist in any git history** — the sprint's binary decision is unexecutable as written (close or re-spike); broken `scoping_ref` anchors; taxonomy Billing branch contradicts the free-first-50 amendment; junk `~$-target-patterns.md` temp file in the spikes dir.

---

## What's genuinely strong (don't touch)

- Convex argument validators precise on every function; range validation with `ConvexError` codes.
- API boundary validation solid: type guards, `DATE_RE`, content-type allowlist, byte + duration caps.
- Secrets *in env* are correct: `SARVAM_API_KEY`/`AI_GATEWAY_API_KEY` never `NEXT_PUBLIC`, TTS module `import 'server-only'`, `.env*` gitignored (the leak is in *scripts*, not env config).
- Telemetry hygiene deliberate: no transcripts/health values in PostHog, session replay + autocapture disabled.
- One testable handler-extraction pattern across all 8 Convex modules; consistent soft-delete + idempotency conventions; full `.nullable()` compliance for OpenAI structured outputs.
- SSR-safety handled with real discipline (the `useState`+`useEffect` pattern from `feedback_ssr_safe_browser_only_checks.md` is applied).

---

## Verification scorecard

Of the P0/P1 findings sent to adversarial refutation: **all survived at high confidence**, with two severity adjustments the roadmap honors — `bloodWork.markers[]` embedding downgraded P1→P2 (F06 ships fine on the embedded shape; only F08 needs the flatten), and the extract-429 cliff downgraded P0→P1 (degraded UX, not data corruption). One duplication finding was judged **understated** by its verifier. The security dimension's original workflow agent hit a schema-retry cap; it was re-run standalone and its P0 secret-leak claim was then confirmed by direct `git ls-files` + `gh repo view` check.
