# Handoff → Fresh "fixing" chat (2026-07-04)

This chat was **assessment only**. All execution moves to a fresh chat that Claude owns autonomously while Rewant steps away. This doc is the brief for that chat. Read it first, then `docs/assessment/2026-07-04-fable-assessment.md` + `2026-07-04-roadmap.md`.

## Decisions locked this session (do NOT re-litigate)
- **SMS auth (MSG91/DLT) is PARKED** for a much later build. Near-term auth = **email account creation** via the already-locked Convex Auth (Decision A) + Resend (Decision B). No external DLT clock. This removes the old "scheduling P0" entirely.
- **API rate-limiting is PARKED** until ~100 users of real production data exist. Currently working as expected; barely any users. Do not add a Vercel WAF rule now.
- **getCheckin ownership check is PRE-APPROVED** — build it without re-asking.
- **Token rotation happens LAST**, after the scripts are converted to env-var loading (so nothing breaks mid-fix). Rotation itself needs Rewant in the Vercel dashboard — leave a clear instruction, don't block on it.
- **Forward product priority = voice humanness** (see `docs/assessment/2026-07-04-voice-humanness.md`). The fixing chat handles emergencies; the *next* build focus is making the voice conversation feel human.

## The fixing chat's scope (in order)

### 1. Secret-leak remediation (the real Phase 0)
Root cause of the hardcoding: `scripts/posthog-smoke.mjs` + `isolate-418.mjs` are plain `node` `.mjs` scripts, and raw Node doesn't auto-load `.env` files the way Next.js does — so the Vercel bypass token got pasted in as a literal to make local runs work.
**Fix, in this order:**
1. Convert both scripts to read `process.env.VERCEL_AUTOMATION_BYPASS_SECRET` (and the PostHog key from env). Run them via `node --env-file=.env.local scripts/<name>.mjs` (Node 20.6+ native env loading — no new dependency). Store the token in `.env.local` (already gitignored).
2. Make the scripts **fail loud** if the env var is missing (throw with a clear message) — never fall back to a literal, so this can't recur.
3. Consider whether these smokes even need protected previews — if they can target prod (`meetsaha.com`, unprotected) or local `next start`, the bypass token isn't needed at all. Keep the env path only for the smoke-a-preview-before-promote case.
4. Add a `gitleaks` pre-commit hook (2nd leak — see `build-log.md:959`).
5. **THEN** rotate the exposed token in Vercel → Project Settings → Deployment Protection → Protection Bypass for Automation (regenerate). This kills the public value. Leave Rewant the exact clicks.

### 2. getCheckin ownership check (pre-approved)
`convex/checkIns.ts:295` (`getCheckinHandler`) — add a `userId` arg and assert `row.userId === args.userId`, return `null` on mismatch. Match the existing visit/med defense-in-depth pattern. Closes a live cross-user read hole for raw health transcripts.

### 3. Interim extract-429 fix (top voice correctness bug)
`app/check-in/page.tsx:901-909` — branch on `ExtractDailyCapError` (and error class generally) so the daily-cap 429 gives honest copy instead of silently collapsing to a cold tap form, and **stop the answer loop from silently writing metrics as "declined"** on repeated extract failure. This is the shippable-now slice; full graceful-failure narration (voice Pattern B) still waits for the A2 e2e harness.

### NOT in scope for the fixing chat
- Rate-limiting (parked).
- The full auth build (that's the Opus feature phase; only note that auth is now email-only).
- Voice Patterns A–D (that's the forward product work, separate from emergencies).

## Verification bar before the fixing chat calls anything done
- `pnpm typecheck` clean, `pnpm test:run` green (baseline 1068/1068).
- Both smoke scripts run from env vars with no literals in tracked files (`git grep` for the old token returns nothing).
- getCheckin returns null on owner mismatch (add/adjust a unit test).
- 429 no longer silently corrupts a check-in (test the error-class branch).
- Per Saha rule: log every change to `docs/build-log.md` same session; Convex prod deploy is a separate manual `scripts/ship-prod.sh` step if `convex/` is touched.

## Companion docs written this session
- `docs/assessment/2026-07-04-fable-assessment.md` — full 6-dimension findings.
- `docs/assessment/2026-07-04-roadmap.md` — phased plan (update it: SMS auth parked → auth is email-only, no DLT long-pole).
- `docs/assessment/2026-07-04-tech-stack-scale.md` — scalability to 10k–100k (being written this session).
- `docs/assessment/2026-07-04-voice-humanness.md` — the forward voice priority (being written this session).
