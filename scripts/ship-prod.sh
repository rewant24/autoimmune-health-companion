#!/usr/bin/env bash
# ship-prod.sh — canonical sequence for shipping a feature cycle to prod.
#
# This script is INFORMATIONAL ONLY. It prints the steps; it does not execute
# them. Run each step yourself, in order, verifying the output before moving on.
#
# Why a script and not just docs? So the sequence lives next to the code, gets
# committed alongside infra changes, and shows up in `ls scripts/` when you're
# trying to remember "what's the deploy order again."
#
# History — three feature cycles in a row (F02 C1, F01 C2, rebrand) shipped
# without running `npx convex deploy`. The Vercel auto-promote on `main` merge
# does NOT touch Convex. If your cycle adds Convex functions or schema, you
# MUST run convex deploy explicitly or prod will run stale code.

set -e

cat <<'EOF'

  ┌────────────────────────────────────────────────────────────────┐
  │  Saha — Ship a feature cycle to prod                           │
  └────────────────────────────────────────────────────────────────┘

  PRE-FLIGHT
    1. Working tree clean on `main`:
         git status                    # expect "nothing to commit"
         git log --oneline -3          # confirm the squash-merge landed

    2. Tests + types + build green locally:
         npx vitest run
         npx tsc --noEmit
         npx next build

  CONVEX PROD (this is the step that gets skipped — DO NOT skip)
    3. Deploy Convex functions + schema to prod:
         npx convex deploy --env-file <prod-env-tempfile>

       The tempfile must contain:
         CONVEX_DEPLOYMENT=prod:usable-zebra-515
         CONVEX_DEPLOY_KEY=<key from dashboard>

       `--prod` is NOT a valid flag for `convex deploy`. The env-file path
       is the only working non-interactive form.

    4. Verify Convex prod state:
         npx convex function-spec --env-file <prod-env-tempfile> | grep '"identifier":'
           # expect the function count you just deployed

         npx convex run --env-file <prod-env-tempfile> 'waitlist:count'
           # data tripwire — value should not have dropped

  VERCEL PROD
    5. Verify prod env vars are present (presence only — values are redacted):
         vercel env ls production

       Required for Saha as of 2026-04-26:
         NEXT_PUBLIC_CONVEX_URL          (https://usable-zebra-515.convex.cloud)
         NEXT_PUBLIC_F02_C1_SHIPPED      (true)
         AI_GATEWAY_API_KEY              (auto-injected OIDC; only set if overriding)

    6. Vercel auto-promotes `main` to prod within ~2 min of merge. Skip the
       manual `vercel --prod` — it just creates a duplicate deploy. Wait, then:

         vercel ls --prod | head -3     # confirm the new deploy is READY

       If you need to redeploy a specific commit (e.g. after fixing prod env
       vars without a code change):
         vercel redeploy <prod-deploy-id> --target production

  SMOKE
    7. Curl the prod URL — expect 200:
         curl -sI https://saha-health-companion.vercel.app/check-in | head -1

    8. Open the live site, do one real check-in flow, verify it lands in
       Convex prod (`npx convex data --env-file <prod-env-tempfile> checkIns`).

  POST-SHIP
    9. Tag the cycle if it was a feature cycle:
         git tag -a fNN-cM/shipped -m "fNN cycle M shipped"
         git push origin fNN-cM/shipped

   10. Update docs/build-log.md and add a ship-day learnings note under the
       project memory entry in ~/.claude/projects/-Users-rewantprakash-1/memory/MEMORY.md.

EOF
