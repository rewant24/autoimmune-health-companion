# Tech-Stack Scalability Assessment — 10k–100k Users

**Date:** 2026-07-04 · **Scope:** Can the current stack (Next.js 16 on Vercel · Convex · Sarvam AI · Vercel AI Gateway → OpenAI · PostHog · planned Convex Auth + Resend · planned Razorpay + Stripe) sustainably serve 10k–100k users on four axes: scalability, security/compliance, solo-builder operability, cost?

All vendor pricing/limits verified against sources fetched 2026-07-04 (URLs inline + Sources section). Anything not verifiable first-party is marked **UNVERIFIED**.

---

## 1. Verdict

The stack holds to 10k users with two code fixes and zero architecture changes; it holds to 100k users technically but not economically in its current shape. Infrastructure is not the constraint — Vercel Pro auto-scales to 30k concurrent function executions ([limits](https://vercel.com/docs/functions/limitations)) and Convex Pro's 25M included function calls only run ~$575/mo in overage at 100k DAU ([pricing](https://www.convex.dev/pricing)). What breaks first, in order: (1) **the unbounded `.collect()` query pattern** (`convex/checkIns.ts:436-446` collects a user's entire check-in history then date-filters in JS) hits Convex's hard 32,000-documents-scanned-per-query ceiling for long-tenured daily users and inflates DB bandwidth cost ~10× before that ([Convex limits](https://docs.convex.dev/production/state/limits)) — fix already planned; (2) **client-supplied `userId` with no auth** (`convex/extractAttempts.ts:81` keys the 5/day extract cost cap on a client string) is a security hole and a DPDP "reasonable security safeguards" exposure the moment there are strangers in the system; (3) **Sarvam voice economics**: STT+TTS is ~89% of COGS at ~₹79/active-user/month — 40% of the ₹199 price for a *paying* user and unrecoverable for free users, so the business breaks at scale before the servers do unless free-tier voice is capped and a Sarvam volume contract is negotiated. Nothing in the stack needs replacing for 100k users; three things need bounding.

---

## 2. Cost model

### Assumptions (stated once, used throughout)
- Every DAU completes 1 voice check-in/day, 30 days/month (worst-case: DAU = daily-check-in users, per the brief).
- Per check-in, midpoints of observed ranges: **3 extract LLM calls** (range 1–6), **3 STT calls @ ~30s audio** (range 1–5), **5 TTS calls @ ~250 chars** (range 2–8). Upper-bound sensitivity at the end.
- Extract call ≈ 1,500 input + 300 output tokens on `openai/gpt-4o-mini` (the model actually wired in — `lib/checkin/extract-prompt.ts:28`, `app/api/check-in/extract-medication/route.ts:41`). TTS model is `bulbul:v2` (`lib/voice/sarvam-tts-server.ts:33`).
- Convex: ~100 function calls/user/day (queries + mutations + reactive re-runs); ~5 range reads/day each scanning ~1 MB of history at 6-month average tenure (current unbounded-collect behavior).
- PostHog ~40 events/user/day. Storage growth ~5 KB/user/day (transcript + metrics + events).
- FX: ₹84/USD (assumption, not a sourced rate).

### Monthly cost at N daily-active check-in users

| Line item | Unit economics | 1k DAU | 10k DAU | 100k DAU |
|---|---|---|---|---|
| Sarvam STT (saarika, ₹30/hr, [pricing](https://docs.sarvam.ai/api-reference-docs/pricing)) | 1.5 min/day → ₹22.5/user/mo | ₹22.5k ($268) | ₹2.25L ($2,680) | ₹22.5L ($26,800) |
| Sarvam TTS (bulbul:v2, ₹15/10k chars, same source) | 37.5k chars/mo → ₹56.3/user/mo | ₹56.3k ($670) | ₹5.63L ($6,700) | ₹56.3L ($67,000) |
| OpenAI via AI Gateway (gpt-4o-mini $0.15/$0.60 per 1M — **UNVERIFIED**, off official pricing page, [tracker](https://www.aipricing.guru/openai-pricing/); Gateway adds zero markup, [docs](https://vercel.com/docs/ai-gateway/pricing)) | ~$0.04/user/mo | $40 | $400 | $4,000 |
| Convex (Pro $25 + $2/1M calls over 25M + $0.20/GB bandwidth over 50GB, [pricing](https://www.convex.dev/pricing)) | calls fine; bandwidth is the cost (unbounded collects) | ~$45 | ~$330 | ~$3,590 |
| Vercel (Pro $20 + fluid compute + bandwidth, [pricing](https://vercel.com/docs/functions/usage-and-pricing)) | memory-hours during STT/TTS proxy I/O-wait dominate | ~$30 | ~$110 | ~$900 |
| PostHog (1M free, then tiered, [pricing](https://posthog.com/pricing)) | 1.2k events/user/mo | ~$10 | ~$395 | ~$2,920 |
| Resend ([pricing](https://resend.com/pricing)) | auth emails only | $0 (free tier) | $20 | $350 |
| **Total** | | **~$1,063 (₹89k)** | **~$10,635 (₹8.9L)** | **~$105,560 (₹88.7L)** |
| **₹/active user/month** | | **~₹89** | **~₹89** | **~₹89** |

### Readings
- **Dominant cost driver: Sarvam voice, ~89% of total at every scale** (₹79 of ₹89/user/mo). Everything else combined is ~₹10/user/mo.
- **Cost is flat-linear at ~₹89/user/mo — there are no economies of scale anywhere in this stack.** Every vendor is usage-billed; doubling users doubles cost. The only levers are per-user usage reduction (shorter TTS replies, fewer round-trips, response caching) and negotiated Sarvam volume pricing ("volume discounts... contact our team" — [Sarvam pricing docs](https://docs.sarvam.ai/api-reference-docs/pricing)).
- **Margin math vs ₹199/mo:** COGS ₹89 = 45% of ARPU, before payment fees (Razorpay 2% + 18% GST on the fee + 0.9% published card-subscription layer ≈ ₹6–7/mo, [Razorpay pricing](https://razorpay.com/pricing/)). A paying daily user nets roughly ₹100/mo gross margin. **Free users are the killer:** at 5:1 free:paid, voice COGS per paying user is ~₹445 > ₹199 ARPU. Free tier must hard-cap voice minutes (the existing 5/day extract cap helps but does not cap STT/TTS).
- **Upper-bound sensitivity:** at the top of the given ranges (6 extract / 5 STT / 8 TTS calls, longer audio) per-user cost roughly doubles to ~₹160/mo — above break-even on ₹199 after fees. Instrument per-user voice-seconds and chars from day one.
- Switching TTS to bulbul:v3 (₹30/10k chars, beta pricing) doubles the TTS line — stay on v2 unless quality demands otherwise.
- The fixed floor (Vercel Pro $20 + Convex Pro $25 + PostHog $0 + Resend $0) is ~$45/mo — irrelevant at every scale considered.

---

## 3. Scalability per layer

### Vercel (Next.js 16, App Router, fluid compute)
- **Ceiling:** auto-scale to 30,000 concurrent function executions on Pro, 800s max duration, 4 GB / 2 vCPU max ([limitations](https://vercel.com/docs/functions/limitations)). 100k DAU peak (evening check-in window, ~20% in one hour) ≈ 300–500 concurrent voice-proxy invocations — 1–2% of the ceiling. Not a bottleneck at any scale in scope.
- **First bottleneck:** cost, not capacity — provisioned-memory GB-hours accrue during I/O wait while `/api/transcribe`, `/api/speak`, and the 3 extract routes hold open upstream calls ($0.0106/GB-hr US regions, [usage & pricing](https://vercel.com/docs/functions/usage-and-pricing)); the 4.5 MB request-body cap constrains audio upload size per STT call.
- **Mitigation:** keep audio chunks small (already chunked given 1–5 STT calls/check-in); default 2 GB memory is fine — don't raise it; 1 TB/mo included bandwidth covers ~10k DAU of TTS audio, $0.15/GB after ([pricing](https://vercel.com/pricing)).

### Convex
- **Ceilings that matter:** 32,000 documents scanned per query/mutation, 16 MiB read per transaction, 1s query/mutation timeout, 1 MiB max document ([limits](https://docs.convex.dev/production/state/limits)). Concurrency by deployment class (S16 → S256 → D1024) covers 100k-DAU peak mutation rates (~170/s, each <1s) comfortably.
- **First bottleneck: the unbounded collect pattern, and it's already in the code.** `listEventsByRangeHandler` (`convex/checkIns.ts:436-446`) does `.withIndex("by_user_date", q => q.eq("userId", args.userId)).collect()` — the whole user history — then filters `fromDate`/`toDate` in JS; same pattern for intakeEvents at `convex/checkIns.ts:458-468`, and ~25 more `.collect()` sites across `bloodWork.ts`, `doctorVisits.ts`, `intakeEvents.ts`, `medications.ts`. A 2-year daily user with medication intakes accumulates 2,000–4,000+ docs; multi-table range queries approach the 32k-scan wall for power users and, well before that, multiply DB bandwidth billing ~10× (the ~$2,990 bandwidth line at 100k in the cost table is mostly this).
- **Mitigation:** the already-planned fix — push date bounds into `withIndex` (per the existing memory-aggregation learning). Cuts the Convex line at 100k from ~$3,590 to roughly $700/mo and removes the scan-ceiling risk entirely. Do it before 1k DAU while query shapes are still easy to change.
- **Fan-out note:** no documented reactive-subscription fan-out limit found (**UNVERIFIED** — not on the limits page); per-user subscriptions (each client watching only its own rows) is the pattern Convex is built for, so no red flag at 100k.

### Sarvam AI (STT + TTS — the product's core loop)
- **Ceiling:** rate limits per account tier ([rate limits](https://docs.sarvam.ai/api-reference-docs/ratelimits)): STT REST 60/100/4,000 req/min and TTS REST 60/200/1,000 req/min on Starter/Pro/Business. At 100k DAU with 20% of check-ins in the peak hour: ~1,000 STT req/min (fits Business) but **~1,700 TTS req/min — exceeds even Business tier**. 10k DAU (~170 TTS req/min) needs Pro; ~100k needs an enterprise contract ("custom rate limits... contact our team").
- **First bottleneck:** the Pro→Business→enterprise ladder on TTS req/min, plus cost dominance (§2). Also: no public SLA terms document — the homepage advertises 99.9% uptime ([sarvam.ai](https://www.sarvam.ai/)) but contractual SLA is **UNVERIFIED** until an enterprise agreement exists. Single vendor, no fallback: no other provider matches saarika on Hinglish STT, so an outage is a full product outage.
- **Mitigation:** cache TTS for repeated prompts (greetings, confirmations — a large share of the 2–8 calls are templated), which cuts both cost and req/min; open the enterprise conversation at ~5k DAU; keep a degraded text-only check-in path as the outage fallback (bail-out "switch to taps" already exists as a pattern).

### AI Gateway → OpenAI
- **Ceiling:** effectively none at this scale. Gateway charges zero markup and no per-request fee, BYOK also free ([pricing](https://vercel.com/docs/ai-gateway/pricing)); OpenAI extract volume at 100k DAU is ~9M small calls/mo — routine.
- **First bottleneck:** model lifecycle, not capacity. The wired model `gpt-4o-mini` is off OpenAI's official pricing page (which now lists only the gpt-5.4/5.5 family — [pricing](https://developers.openai.com/api/docs/pricing)) though it has no API deprecation listed ([deprecations](https://developers.openai.com/api/docs/deprecations)). Forward path is gpt-5.4-nano at $0.20/$1.25 per 1M — still ~₹5/user/mo. Note the Zod `.optional()` → `.nullable()` structured-outputs constraint carries over on any model migration.
- **Mitigation:** none needed beyond scheduling a model bump; Gateway makes the swap a one-line model-id change with provider failover available.

### PostHog
- **Ceiling:** none technical at this scale; pure cost. 1M events/mo free, then tiered — ~$395/mo at 10k DAU, ~$2,920/mo at 100k DAU at 40 events/user/day ([pricing](https://posthog.com/pricing)).
- **First bottleneck:** event volume cost, plus data residency (US/EU only, no India region; region switch is a migration project, not a toggle — [migrations](https://posthog.com/docs/migrate/managed-migrations)).
- **Mitigation:** event allowlist + sampling before 10M events/mo; cuts the 100k-DAU line 5–10×. Decide the US-vs-EU region question before the event history gets heavy (see §7).

---

## 4. Compliance

### India DPDP Act (primary market → primary obligation)
Status as of July 2026: **DPDP Rules 2025 were notified November 13, 2025** ([PIB](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)) with phased enforcement: Consent Manager registration from **Nov 13, 2026**; the substantive obligations — notice/consent standards, security safeguards, breach notification, retention/erasure, data-principal rights, SDF duties, cross-border provisions — enforceable **May 13, 2027** ([timeline](https://www.india-briefing.com/news/india-dpdp-compliance-timeline-enforcement-2026-27-44740.html/)). Penalties: up to **₹250 crore** for failure of reasonable security safeguards, ₹200 crore for failure to notify breaches ([Schedule](https://www.dpdpa.com/theschedule.html)).

What this means for Saha specifically:
- **Health data is not a separate "sensitive" category under DPDP** — same baseline rules as all personal data — but volume + sensitivity feed **Significant Data Fiduciary** designation (Central Government notification; health-sector processors are widely expected candidates; no SDF list published yet — [SDF guide](https://www.dpdpa.com/blogs/significant_data_fiduciary_sdf_dpdpa_guide.html)). SDF status would add: India-based DPO, annual DPIA + independent audit, and — the one that matters for this stack — **Rule 13(3) data localization** for government-specified data categories, including traffic data ([Rule 13](https://www.dpdpa.com/dpdparules/rule13.html)). At single-digit to low-thousands of users Saha is very unlikely to be designated; at 100k Indian health-data users it is a live possibility.
- **Cross-border: currently lawful.** DPDP uses a blacklist/permissive model (transfers allowed by default; government may restrict by order — [Rule 15](https://www.dpdpa.com/dpdparules/rule15.html)), and **no restriction orders have been notified**. So US-region Convex, Vercel, PostHog, and OpenAI holding Indian health data is legal today. The exposure is forward-looking: an SDF designation + a Rule 13(3) localization order would strand the data layer in the US with no India region available from Convex (US/EU only — [regions](https://docs.convex.dev/production/regions)) or PostHog (US/EU only). Sarvam is the one vendor already "developed and operated entirely in India" and advertising DPDP compliance ([sarvam.ai](https://www.sarvam.ai/)).
- **Breach notification (Rule 7):** notify affected users "without delay" AND the Data Protection Board without delay, detailed report **within 72 hours** — no materiality threshold ([Rule 7](https://www.dpdpa.com/dpdparules/rule7.html)). A solo builder needs a pre-written runbook for this; 72 hours is short when you are also the person doing forensics.
- **Consent:** free/specific/informed/per-purpose, itemized plain-language notice, available in English + 22 scheduled languages (Rule 3). Saha currently has no consent capture at all (no auth, no accounts). This is buildable inside the Convex Auth + onboarding work and has a runway to May 2027 — but it must be designed in, not bolted on.
- **UNVERIFIED and material:** Sarvam's audio retention posture. Third parties claim zero retention post-processing, but no Sarvam-owned page states it. Every raw health voice recording transits their API. **Get retention + training-use terms in writing from Sarvam before scale.**

### HIPAA — honest applicability
HIPAA covers US covered entities (providers, plans, clearinghouses) and their business associates. Saha is a direct-to-consumer app with no US provider/insurer relationship: **HIPAA does not apply to Saha today; a BAA chain is a trust/marketing checkbox, not an obligation.** What actually covers US consumer users: the **FTC Health Breach Notification Rule** (2024 amendments explicitly cover non-HIPAA health apps — [FTC](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule)) and state laws like **Washington My Health My Data** (consent requirements + private right of action — [FTC health privacy hub](https://www.ftc.gov/business-guidance/privacy-security/health-privacy)). Those apply the moment the international tier has US users, BAA or not.

If the US tier later grows into B2B (employers, providers) and a real BAA chain is needed, the stack can deliver it:
- **Vercel:** BAA available on Pro as a self-serve paid add-on since Sept 2025 (price **UNVERIFIED**) ([changelog](https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams)).
- **Convex:** SOC 2 Type II; PHI allowed under a signed BAA ([security](https://www.convex.dev/security)) — but the pricing page places the BAA at **Business/Enterprise tier**, not Pro ([pricing](https://www.convex.dev/pricing)). This is the expensive link.
- **OpenAI:** self-serve via baa@openai.com, but only ZDR-eligible endpoints are covered ([help](https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai)); Vercel AI Gateway would need its team-wide ZDR add-on ($0.10/1k requests) or per-request ZDR in the chain.
- **PostHog:** BAA requires Boost ($250/mo) or above; their managed reverse proxy is excluded from the BAA ([HIPAA docs](https://posthog.com/docs/privacy/hipaa-compliance)).
- **Sarvam:** no HIPAA posture found (**UNVERIFIED/none**) — a US-PHI voice flow would need a different STT/TTS vendor or Sarvam enterprise terms.

### The single biggest compliance gap
**No authentication and no access control on live health data.** The prod system keys everything — including the extract cost cap (`convex/extractAttempts.ts:81`) — on a client-supplied `userId` string. (The `getCheckin` IDOR was fixed in code today, `b1ab7be`, pending prod deploy — but ownership checks against a client-supplied id are still obscurity, not access control.) Under DPDP this is a straight failure of "reasonable security safeguards," the ₹250-crore-ceiling penalty tier, and unlike consent tooling it has no May-2027 runway: it's a live exposure the day a stranger signs up. Auth (Convex Auth + Resend) with server-derived identity is simultaneously the security fix, the DPDP-consent anchor point, and the prerequisite for billing. Everything else in this section can wait; this cannot.

---

## 5. Ease of use — solo-builder operational load

This is the stack's strongest axis, and it mostly stays strong at 100k:

- **Deploys:** `git push` → Vercel; `npx convex deploy` as the known separate manual step. No servers, no containers, no OS patching, ever. The two-step deploy is the one standing footgun (already bitten and documented) — `scripts/ship-prod.sh` mitigates.
- **Migrations:** Convex schema changes are code-first with no SQL migration tooling to operate; the flip side is that backfills (e.g., the collect→index-bounds fix, or flattening an embedded array) are hand-written mutations you run yourself. Fine at 10k; at 100k, write backfills as paginated batch mutations to stay under the 1s/32k-doc transaction limits.
- **Monitoring:** Vercel + Convex + PostHog dashboards cover most of it, but there is no unified alerting today. Minimum viable at ~1k users: uptime check on meetsaha.com, Convex function-error alerting, a Sarvam-spend and voice-seconds-per-user metric (the COGS tripwire), and error tracking (e.g., Sentry). That's an afternoon of setup, not an ops burden.
- **Incident response:** the honest weak point. One person = no on-call rotation for a health app, and DPDP's 72-hour detailed breach report (from May 2027) assumes someone is awake. Pre-write the breach runbook; keep vendor status pages bookmarked; the text-only check-in fallback bounds the blast radius of a Sarvam outage.
- **Vendor count:** 6 today, 9 with auth-email + payments. All console-managed, no infrastructure to run. The real recurring load at 100k is **spend management** (five usage-billed vendors, each needing budget alerts) and **quota ladders** (Sarvam tier upgrades, Convex deployment class), not systems administration.

Net: a solo builder can genuinely run this to 100k users. The same is not true of any self-hosted alternative; the serverless premium in §2 is buying exactly this.

---

## 6. The single biggest scaling risk

**Sarvam concentration: the entire core interaction runs through one vendor whose pricing consumes 45% of ARPU, whose top public tier is too small for 100k-DAU peak TTS traffic, whose contractual SLA and audio-retention terms are unwritten, and for which no drop-in Hinglish-quality substitute exists.**

Defense of the choice: every other risk in this document has a cheap, known fix — the collect pattern is a planned refactor, auth is scheduled, PostHog cost is a sampling config, model deprecation is a one-line change. The Sarvam exposure is different in kind: it is simultaneously an economic ceiling (₹79 of ₹89/user/mo COGS — no path to healthy free-tier economics or sub-₹199 pricing without moving this number), a capacity ceiling (~1,700 TTS req/min at 100k-DAU peak vs 1,000 req/min on the Business tier), an availability risk (single vendor, no SLA contract, product is unusable without it), and a compliance unknown (raw health audio, retention terms UNVERIFIED) — and the mitigation for all four is the same non-trivial work: an enterprise negotiation plus engineering to reduce dependence per check-in (TTS caching of templated prompts, shorter generated replies, batch STT). If Sarvam repriced, rate-limited, or pivoted away from self-serve API access, Saha has no week-one alternative for Hinglish voice. Start the enterprise relationship early, in writing, and build the usage-reduction levers before they're urgent.

---

## 7. Decision points

| # | Revisit / do | Trigger (concrete metric) |
|---|---|---|
| 1 | Ship auth + server-derived `userId`; retire client-keyed cost caps (`getCheckin` IDOR itself fixed today, `b1ab7be` — deploy via `ship-prod.sh`) | Before the first stranger signs up (i.e., before any public/paid launch) — no scale trigger, it's already due |
| 2 | Land the index-bounded query fix (date bounds into `withIndex`, retire unbounded `.collect()` sites) | Before 1k DAU, or when any user's history exceeds ~500 documents, whichever is first |
| 3 | Instrument per-user voice-seconds + TTS chars; add per-tier voice caps | With the first paid tier — free tier must have a hard voice cap on day one |
| 4 | Open Sarvam enterprise conversation: volume pricing, custom rate limits, contractual SLA, **written audio-retention terms** | ~5k DAU, or peak TTS >150 req/min (Pro tier ceiling ~200), or before any external compliance review |
| 5 | Upgrade Convex plan / watch deployment class; re-run cost model | Function calls >20M/mo or DB bandwidth >40 GB/mo (approaching Pro included limits) |
| 6 | PostHog event allowlist + sampling; decide US-vs-EU region while migration is cheap | Events >5M/mo, or before storing any user-identifying properties beyond a pseudonymous id |
| 7 | Start DPDP consent + notice + retention/erasure build (inside auth/onboarding) | Now-ish: Rules already notified; substantive obligations enforceable **May 13, 2027** — begin no later than Q4 2026 |
| 8 | Write the DPDP breach runbook (72h DPBI report + user notice templates) | Before 1k users holding real health data |
| 9 | Watch for SDF designation criteria / Rule 13(3) localization categories; if health apps are named, plan India/EU data-layer options | Any MeitY notification of SDF classes or localization categories; also revisit at 50k Indian users regardless |
| 10 | BAA chain (Vercel Pro add-on, Convex Business tier, OpenAI ZDR, PostHog Boost) — only if US B2B emerges | First US employer/provider deal, **not** first US consumer (FTC HBNR + WA MHMDA apply to consumers regardless — comply with those at intl-tier launch) |
| 11 | Migrate extract model off `gpt-4o-mini` (off the official price page) to gpt-5.4-nano; re-test structured outputs (`.nullable()` rule) | Next extraction-prompt touch, or any OpenAI deprecation notice for the 4o family — note gpt-4.1-nano (unused) dies 2026-10-23 |
| 12 | Payments: Razorpay subscriptions with UPI AutoPay ≤₹15,000 (no per-debit OTP at ₹199/₹1,499); build 24h pre-debit-notification handling + mandate-churn dashboards | Pricing launch. RBI E-Mandate Framework 2026 (Apr 21, 2026) consolidated the rules; ₹15k AFA-free cap unchanged |
| 13 | International payments: Stripe India is still invite-only — decide invite pursuit vs Merchant-of-Record (Paddle/Dodo) | Intl-tier go decision; MoR likely wins for a solo builder (handles global sales tax) |
| 14 | Convex Auth: still beta (`@convex-dev/auth` 0.0.x, official beta banner) — acceptable now; re-evaluate vs Clerk/WorkOS | If still beta at 10k users, or on any backward-incompatible release |

---

## Sources

**Vercel:** https://vercel.com/pricing · https://vercel.com/docs/functions/usage-and-pricing · https://vercel.com/docs/functions/limitations · https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams · https://vercel.com/kb/guide/is-vercel-hipaa-compliant
**Convex:** https://www.convex.dev/pricing · https://docs.convex.dev/production/state/limits · https://www.convex.dev/security · https://docs.convex.dev/production/regions · https://news.convex.dev/we-finally-got-our-eu-visa/ · https://docs.convex.dev/auth/convex-auth · https://docs.convex.dev/auth · https://labs.convex.dev/auth
**Sarvam:** https://docs.sarvam.ai/api-reference-docs/pricing · https://docs.sarvam.ai/api-reference-docs/ratelimits · https://www.sarvam.ai/
**OpenAI / AI Gateway:** https://developers.openai.com/api/docs/pricing · https://developers.openai.com/api/docs/deprecations · https://developers.openai.com/api/docs/guides/your-data · https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai · https://openai.com/index/retiring-gpt-4o-and-older-models/ · https://www.aipricing.guru/openai-pricing/ (legacy-model prices, UNVERIFIED) · https://vercel.com/docs/ai-gateway/pricing · https://costbench.com/software/llm-api-providers/vercel-ai-gateway/
**PostHog:** https://posthog.com/pricing · https://posthog.com/docs/privacy/hipaa-compliance · https://posthog.com/docs/migrate/managed-migrations · https://posthog.com/blog/posthog-cloud-eu
**Resend:** https://resend.com/pricing
**Payments / RBI:** https://razorpay.com/pricing/ · https://razorpay.com/blog/cheapest-payment-gateway-for-recurring-billing-e-nach-upi-autopay-and-subscription/ · https://razorpay.com/docs/payments/subscriptions/?preferred-country=IN · https://stripe.com/in/pricing · https://stripe.com/billing/pricing · https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india · https://www.indialaw.in/blog/banking-and-finance/rbi-e-mandate-framework-2026/ · https://agrudpartners.com/rbi-digital-payments-e-mandate-2026/ · https://www.npci.org.in/product/autopay · https://complinity.com/legal-update/npci-issues-enhancement-of-upi-autopay-20728/
**DPDP:** https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf · https://www.india-briefing.com/news/india-dpdp-compliance-timeline-enforcement-2026-27-44740.html/ · https://www.dpdpa.com/dpdparules/rule7.html · https://www.dpdpa.com/dpdparules/rule13.html · https://www.dpdpa.com/dpdparules/rule15.html · https://www.dpdpa.com/theschedule.html · https://www.dpdpa.com/blogs/significant_data_fiduciary_sdf_dpdpa_guide.html · https://ourtake.bakerbotts.com/post/102lund/india-notifies-final-rules-for-digital-data-protection-act
**US health-app law:** https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-finalizes-changes-health-breach-notification-rule · https://www.federalregister.gov/documents/2024/05/30/2024-10855/health-breach-notification-rule · https://www.ftc.gov/business-guidance/privacy-security/health-privacy · https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0
