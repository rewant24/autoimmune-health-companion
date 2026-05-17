# Auth — scoping doc

**Status:** Phase 1 in progress — decisions A–H walked one at a time, locked here as we go.
**Owner:** Tab A (`feat/auth-scoping`, worktree `/Volumes/Coding Projects + Docker/saha-auth/`).
**Sprint:** [docs/sprints/2026-05-09-auth-ui-housekeeping.md](../sprints/2026-05-09-auth-ui-housekeeping.md) (lives on `main`; reachable via `git show main:docs/sprints/2026-05-09-auth-ui-housekeeping.md` from this worktree).
**Walk order:** A → B → C → D → F → E → G → H. Approved 2026-05-09.

**Current position (2026-05-16):**
- ✅ Decision A locked (Convex Auth) + HIPAA-grade architecture posture locked.
- ✅ Decision B locked (Resend, magic-link email transport). BAA-path comparison deferred to post-MVP HIPAA-compliance backlog.
- 📋 **Decision C researched 2026-05-16** — full India-vendor price-first sweep complete (see Sub-decision C below). Recommendation drafted: **MSG91 primary, 2Factor.in fallback**. MSG91 build plan inline. **Status: DEFERRED at Rewant's discretion (2026-05-16) — backlog item #24 tracks revisit + lock.** Twilio Verify rejected (60× cost for India-only). Sarvam confirmed not applicable (STT/TTS only, no SMS).
- ⏸ **Resume at Decision D (India locale detection) — or revisit Decision C lock when ready to begin DLT registration (3–7 business-day lead time).**
- See `docs/build-log.md` "2026-05-10 — Session 19" + "2026-05-16 — Session 20" for full context.

---

## Hard guardrails (non-negotiable)

These are project-level constraints that bound every decision below. They are not up for relitigation in this scoping doc.

1. **Production waitlist data is IMMUTABLE.** The `waitlist` table on `usable-zebra-515` holds the first ~50 users Rewant will be granting app access to. No migration script, no schema change, no auth wiring may touch any waitlist row. The `addEmail` and `count` handlers stay as the only writes/reads against this table; both remain unauthenticated (pre-auth surface).
2. **Convex prod deploy is a separate manual step** from Vercel auto-promote. Phase 3 ship gates on `scripts/ship-prod.sh` (per `feedback_remind_convex_deploy.md`).
3. **Migration of stub-userId rows** is irreversible on prod. Snapshot via `npx convex export` before run; require explicit Rewant approval at run-time.
4. **First 50 users are free.** No paywall, no Razorpay/Stripe wiring. Auth's purpose this sprint is identity, not gating.
5. **Sign-in methods are pre-locked** (sprint plan Decision 3): email magic link (all locales) + phone OTP (India only, locale-detected). Provider stack and transport choices live in §1, but the surface area of sign-in is fixed.
6. **Language convention** (CLAUDE.md, scoping.md): "support system" — never "caregiver" / "squad". Auth UI copy must comply.

---

## HIPAA-grade architecture posture (locked from Decision A walk, 2026-05-10)

Saha is **not legally bound by HIPAA** (D2C health-tracking app, not a US covered entity or business associate). The legally applicable regime is **India's DPDP Act 2023** for Indian users + GDPR/state laws for international.

**The locked stance:** ship "HIPAA-grade *posture*" — use HIPAA's controls as a quality bar even though the law doesn't compel them. Architecture is HIPAA-shaped now; formal BAAs deferred until a threshold is crossed (US clinical partnership, or scale beyond first 50 users).

**In scope this sprint (Phase 1 specs + Phase 3 implementation):**

1. **Audit log table at schema level** — `authAuditLog` table in `convex/schema.ts`. One row per auth event: sign-in, sign-out, failed attempt, password reset, MFA challenge (if added), session revocation. Columns: `userId`, `eventType`, `ip`, `userAgent`, `timestampMs`, `metadata: v.optional(v.any())`. Index `by_user_time`. Cheap to add now, brutal retrofit later.
2. **Soft-delete with audit trail** — extend existing `deletedAt` with `deletedBy: v.string()` (the userId who triggered) and `deletionReason: v.optional(v.string())` across `checkIns`, `intakeEvents`, `medications`, `dosageChanges`, `doctorVisits`, `bloodWork`, and `profiles` (if added per Decision F).
3. **MFA-ready data model** — `mfaEnabled: boolean` + `mfaMethod: 'totp' | 'sms' | null` columns added to profile shape now, even though MFA is **not** enforced at launch. Five-minute schema add; future-proofs without forcing MFA UX work.
4. **Privacy policy in HIPAA/DPDP-compatible language** — drafted in Phase 1 alongside scoping. Decision H is now constrained to *legal review timing only* — the language stance is locked.

**Deferred (NOT in this sprint):**
- Session revocation surface ("log out everywhere") — defer to post-launch.
- Data minimization audit on LLM extraction calls — ADR-020's 2000-token cap is acceptable for now.
- Formal BAAs with Convex / Resend / Twilio — defer until threshold (US clinical partnership or scale).

ADR coverage: bake-ins land in **ADR-035** (separate ADR, not folded into ADR-033).

---

## Swap-friendliness pattern (locked guidance, 2026-05-10)

Recommended pattern for keeping the auth stack replaceable. Surfaced during Decision A walk; influences B, C, and Phase 3 build.

- **Email transport (Decision B):** wrap in `lib/auth/email-transport.ts` adapter exposing `sendMagicLinkEmail(to, link)`. Single swap point. Use **React Email** for templates — portable across Resend (native) / SES (HTML output) / SendGrid (HTML output).
- **SMS transport (Decision C):** wrap in `lib/auth/sms-transport.ts` adapter exposing `sendPhoneOtp(phone, code)` + `verifyPhoneOtp(phone, code)`. Adapter shape must absorb both vendor-managed-lifecycle (Twilio Verify) and code-in-DB (MSG91) styles.
- **Sign-in UI:** build as plain Next.js Server-Action-backed forms, NOT Convex-Auth-specific React primitives. Adds ~30 min today; saves ~6h if Saha ever swaps auth providers.
- **Why this matters:** Convex Auth → Clerk swap = JWT-minting change + UI rewire; handler calls (`ctx.auth.getUserIdentity()`) survive intact. Adapter pattern + plain forms shrink the swap surface.
- **Caveat:** "plain Server-Action-backed forms" needs verification against Convex Auth's actual integration patterns at Phase 3 build kickoff. If Convex Auth strongly assumes its component primitives, the cost-benefit shifts.

---

## Section 1 — Provider stack (Decision A)

**Status:** **LOCKED 2026-05-10 — Convex Auth.**

### Decision

**Convex Auth** (`@convex-dev/auth`) is the auth provider for Saha.

### Rationale

- **Stack alignment.** First-party with Convex DB. `ctx.auth.getUserIdentity()` works natively in every handler — no JWT plumbing, no token-verification config. Identity + sessions live inside the same deployment that holds user data.
- **Sub-processor minimization.** Zero auth-vendor in the chain. User emails, phones, sessions never leave `usable-zebra-515`. This is the cornerstone of the HIPAA-grade posture: every external service that touches PII = a contract you'd eventually need; Convex Auth removes one such service entirely.
- **Cost.** $0 auth-vendor bill at MVP. SMS bill goes direct to whichever provider Decision C picks. No "Enterprise tier cliff" the way Clerk has for HIPAA-grade.
- **Vendor lock-in posture.** Low. `userId = identity.subject` is an opaque string Saha controls; export is straightforward. Correlated outage risk with Convex itself, but that's the same throat to choke as the DB anyway.

### Trade-offs accepted

- **Phone-OTP layer is custom code.** Convex Auth's OTP provider is shaped for email-OTP, not SMS. Wiring SMS means writing a custom auth provider that calls Twilio/MSG91 ourselves. **Mitigation:** Decision C will pick **Twilio Verify** (or equivalent) — its service absorbs brute-force, replay, and rate-limit risk inside the vendor. Saha's code surface shrinks to "call Twilio Verify and read the result," not "build OTP cryptography from scratch."
- **MFA, audit log, session revocation are DIY.** Build effort accepted as part of the HIPAA-grade bake-in scope. We'd be doing this work for HIPAA-grade posture regardless of provider.
- **Smaller ecosystem than Clerk.** Less battle-tested. Mitigation: small attack surface, single vendor (Convex team), tight feedback loop.

### Alternatives considered

- **Clerk.** Mature, polished, lowest friction. Bundled phone OTP. Free tier covers first 50 users. **Rejected** because: (a) introduces a sub-processor that processes auth PII, weakening the HIPAA-grade posture; (b) HIPAA BAA is locked behind their Enterprise tier (~$2k–$5k/mo), making "HIPAA-grade with formal BAAs" prohibitively expensive at MVP scale; (c) Vercel Marketplace integration is a friction-saver, not a strategic win.
- **Auth.js (NextAuth).** OSS, flexible. **Rejected** because: same DIY phone-OTP burden as Convex Auth, plus you also own JWT plumbing Convex Auth gives for free. Strictly worse than Convex Auth on the security + maintenance axes for this stack.

### Sub-decisions cascading from A

- **B — Magic-link email transport** — **LOCKED 2026-05-10 — Resend.** See sub-section below.
- **C — Phone OTP provider** — **RESEARCHED 2026-05-16, recommendation drafted (MSG91 primary, 2Factor fallback), LOCK DEFERRED.** Sarvam ruled out (STT/TTS only, no SMS). Twilio Verify ruled out for India-only (60× more expensive than India-native at 10k scale). See Sub-decision C below.

---

### Sub-decision B — Magic-link email transport

**Status:** **LOCKED 2026-05-10 — Resend.**

#### Decision

**Resend** (via Convex Auth's documented integration path) is the magic-link email transport for Saha at MVP.

#### Rationale

- **Lowest friction on the locked stack.** Convex Auth's docs assume Resend; ~15 min wire-up at Phase 3, vs ~1–2h SES sandbox-exit + DNS verification overhead. No transport-side blocker on the build path.
- **Adapter pattern absorbs swap risk.** Per the Swap-friendliness pattern above, email transport is wrapped behind `lib/auth/email-transport.ts` exposing `sendMagicLinkEmail(to, link)`, with templates rendered via React Email. Switching to SES (or SendGrid) at threshold-crossing time is a single-file swap, not a rewrite.
- **C-independent.** Resend has no coupling to Decision C (phone OTP provider). Locking B = Resend lets C walk freely without partial pre-commitment.
- **Free tier covers MVP scale.** Resend free tier = 3,000 emails/month. First 50 users at ~1 sign-in/week ≈ 200 emails/month. Zero transport cost through MVP.

#### Trade-offs accepted

- **BAA path not publicly documented.** If/when Saha needs a formal BAA (US clinical partnership, or scale beyond first 50 free users), Resend's BAA availability is a question to ask their team — not a known quantity today. Mitigated by: (a) HIPAA-grade *posture* is locked but formal BAAs are explicitly deferred per Decision A; (b) the adapter pattern means swapping to a transport with a clean BAA path (SES or SendGrid) is ~30 min of work when the threshold approaches.
- **One additional sub-processor in the chain.** Email content (sign-in link + recipient address) crosses Resend's infrastructure. Acceptable at MVP scale; revisited under formal BAA scope.

#### Alternatives considered

- **AWS SES.** Cheapest at scale ($0.10/1k), cleanest BAA path (AWS BAA is account-wide, well-understood). **Rejected for MVP** because: (a) ~1–2h sandbox-exit + DNS verification adds non-trivial Phase 3 friction for negligible benefit at first-50 scale; (b) BAA cleanliness only matters once the threshold is approached; (c) the adapter pattern means we can swap *to* SES later without architectural debt.
- **SendGrid.** Twilio-owned — would consolidate vendor relationship if Decision C lands on Twilio Verify (one BAA, one billing, one support touchpoint). **Rejected for MVP** because: (a) locking SendGrid now partially pre-commits Decision C; (b) the consolidation upside only materializes IF C → Twilio AND we eventually pursue formal BAAs (two conditional bets); (c) free tier is more restrictive (100/day vs 3k/month).

#### Deferred to backlog

The full BAA-readiness comparison across email transports (Resend / SES / SendGrid) and SMS providers is captured in `docs/post-mvp-backlog.md` → **HIPAA compliance / BAA readiness** → H1. Revisited when a threshold-crossing event approaches.

---

### Sub-decision C — Phone OTP provider

**Status:** **RESEARCHED 2026-05-16. Recommendation drafted (MSG91 primary, 2Factor.in fallback). LOCK DEFERRED at Rewant's discretion 2026-05-16. Backlog item #24 tracks revisit.**

#### Why deferred (not rejected)

Decision C is on the auth critical path — phone OTP cannot ship without it. Rewant deferred the lock on 2026-05-16 to absorb the research separately from the lock decision; the research, recommendation, and build plan are captured here in full so the revisit is a re-read, not a re-walk. **DLT registration carries a 3–7 business-day lead time** — when this unlocks, kick off DLT in parallel with whatever else is on the critical path.

#### Research summary — India-friendly, price-first sweep

USD→INR working rate: $1 ≈ ₹84 (May 2026). Two scale points priced:
- **MVP:** ~50 users × ~1 sign-in/week ≈ **200 SMS/month**.
- **10k steady state:** 10,000 users × ~1 sign-in/week × 2× resend buffer ≈ **80,000 SMS/month**.

##### Table 1 — Sorted by MVP monthly cost ascending (200 SMS/mo)

| Provider | Per-OTP (INR) | MVP cost (200/mo) | 10k-user cost (80k/mo) | DLT burden | API style | Notable caveat |
|---|---|---|---|---|---|---|
| **MSG91** | ₹0.18–0.25 | **₹0** (covered by Startup Program: 25k credits/mo × 6 mo) | ~₹14,400–15,200 | **Low (assisted)** | **Verify** (sendOTP / verifyOTP) | Startup credit requires business-domain email (not Gmail) |
| **Authkey.io** | ₹0.30 low / ~₹0.145 at 1M (+ ₹0.025 DLT scrubbing) | **₹0** (₹2,500 startup credit = ~10k msgs ≈ 50 mo at MVP rate) | ~₹10,000–14,000 | Low | Raw SMS with helpers | Business-domain email required for startup tier |
| **Fast2SMS** | ₹0.11–0.25 (sliding) | ~₹50 (after ₹50 free credit, ₹100 min recharge) | ~₹8,800–12,000 | Medium (self-serve) | **Raw SMS** | You roll your own OTP store + brute-force protection — bad fit for a health app |
| **Plivo Verify** | ₹0.20 | ~₹40 | ~₹16,000 | Medium | **Verify** (Fraud Shield free) | USD-billed (forex + 2–3% card markup) |
| **2Factor.in** | ₹0.12–0.15 | ~₹30 | **~₹9,600** | **Lowest (end-to-end, 1–3 days)** | **Verify** (`session_id` flow) | India-only vendor; no large startup credit pool |
| **Exotel** | ~₹0.18 (est.) | sales-call | ~₹14,400 (est.) | Low | Raw + voice | Credit-pool model; OTP-specific quote requires sales |
| **SMSCountry** | ~₹0.24 (est.) | 10k-msg starter pack ≈ ₹2,400 upfront | ~₹19,200 (est.) | Medium | Raw SMS | Min starter pack = bad MVP economics |
| **Gupshup** | ~₹0.18–0.30 (est.) | sales-call | ~₹14,400–24,000 (est.) | Low | Raw + Verify | Pricing opaque |
| **Sinch Verification** | not published | sales-call | sales-call | Medium | **Verify** | Pricing opaque for India |
| **Kaleyra / Tata Comms** | not published | sales-call | sales-call | Low | **Verify** | Enterprise-grade overkill for MVP |
| **Twilio Verify** | ~₹11 ($0.13 = $0.05 verification + $0.0832 India SMS segment) | ~₹2,200 | **~₹880,000** | **High (DIY DLT)** | **Verify** (Convex Auth has built-in provider) | **60× MSG91 at 10k. Rejected for India-only.** |

##### Table 2 — Sorted by 10k-user cost ascending (80k SMS/mo)

| Provider | 80k/mo cost (INR) | Per-OTP (INR) | DLT burden | API style | Caveat |
|---|---|---|---|---|---|
| **Fast2SMS** (volume tier) | ~₹8,800–12,000 | ₹0.11–0.15 | Medium | Raw SMS | You manage OTP lifecycle |
| **2Factor** (Growth) | **~₹9,600** | ₹0.12 | **Lowest** | **Verify** | India-only |
| **Authkey** (volume) | ~₹10,000–14,000 | ₹0.145 + ₹0.025 DLT | Low | Raw w/ helpers | Volume rates require ramp |
| **Exotel** (est.) | ~₹14,400 | ~₹0.18 | Low | Raw + voice | Sales-quoted |
| **MSG91** (100k tier) | ~₹14,400–15,200 | ₹0.18–0.19 | Low | **Verify** | Best balance of price + DX |
| **Gupshup** (est.) | ~₹14,400–24,000 | ~₹0.18–0.30 | Low | Raw + Verify | Pricing opaque |
| **Plivo Verify** | ~₹16,000 | ₹0.20 | Medium | **Verify** | USD forex risk |
| **SMSCountry** (est.) | ~₹19,200 | ~₹0.24 | Medium | Raw SMS | 10k starter only |
| **Twilio Verify** | **~₹880,000** | ~₹11 | **High (DIY)** | **Verify** | 60× cost of MSG91 |

#### Recommendation (drafted — pending Rewant lock)

**Primary: MSG91. Documented fallback: 2Factor.in.**

##### Why MSG91 as primary

- **MVP is free for 6 months.** The MSG91 Startup Program grants **25,000 OTP credits/month × 6 months** to new accounts on a business-domain email. That covers Saha up to ~6,000 users at current cadence — well past the locked "first 50 users free" gate. Zero auth SMS bill through the runway when it matters most.
- **True Verify-style API.** `sendOTP`, `verifyOTP`, `retryOTP` — vendor stores the code, vendor handles brute-force lockout, vendor rate-limits. This is exactly the "absorb the OTP lifecycle inside the vendor" stance locked in Decision A's trade-off section. No DIY OTP cryptography.
- **Assisted DLT registration.** MSG91 walks you through entity + template approval and runs DLT scrubbing on every send. The 3–7 business-day approval is unavoidable (it's the TRAI portal, not the vendor), but you don't navigate the JioTrueConnect / VI / Airtel / BSNL portals alone.
- **Published pricing, no sales-call dance.** ₹0.18–0.25 per OTP, tiered. Predictable cost at every scale.
- **Mid-pack cost at 10k.** ~₹14.4–15.2k/mo at 80k SMS — 50% more than 2Factor (~₹9.6k) but still under ₹0.20/OTP. The DX + startup-credit win at MVP outweighs the steady-state premium.

##### Why 2Factor as documented fallback (not primary)

- **Cheapest at scale.** ₹0.12 per OTP at Growth tier → ~₹9,600/mo at 80k SMS. ~33% cheaper than MSG91 at steady state.
- **Best DLT support in market.** End-to-end registration in 1–3 days (faster than MSG91's typical 3–7).
- **SLA-based billing.** Not charged for failed or late OTPs; backup-carrier re-routes are free.
- **True Verify-style** (`AUTOGEN/SEND_OTP` → `session_id` → `VERIFY_OTP`).
- **Why not primary:** smaller vendor, India-only, no equivalent of MSG91's 6-month startup credit pool. MVP would cost ~₹30/mo with 2Factor vs ₹0 with MSG91 — trivial absolute, but the startup credit also signals MSG91's commitment to early-stage customers.

The Swap-friendliness pattern (`lib/auth/sms-transport.ts` adapter) means switching MSG91 → 2Factor at the 25k/mo threshold (when MSG91's startup credits expire) is a single-file change. ~30 min of work, not a rewrite.

##### Why not the other contenders

- **Twilio Verify** — Convex Auth's built-in `TwilioVerify` provider is a convenience trap for India-only. You still DIY DLT registration **and** pay ~60× MSG91's rate at 10k scale (₹880k/mo vs ₹15k). The integration ease is real for US/global; for India-only it's the wrong tool. **Rejected.**
- **Fast2SMS** — cheapest published rate, but raw-SMS only. You'd build your own OTP table + brute-force lockout + resend rate-limit + expiry in Convex. For a healthtech app, rolling your own auth primitives violates the "absorb the lifecycle" stance from Decision A. **Rejected on principle, not price.**
- **Plivo Verify** — cleanest API ergonomics of the three Verify-style options, but USD-billed (forex + 2–3% card markup), no India startup credit, and 10% pricier than MSG91 at 10k scale. Worth re-checking IF Saha pivots toward global verification later. **Rejected for India-only path.**
- **SMSCountry** — 10k-message minimum starter pack ≈ ₹2,400 upfront for an MVP that needs 200 SMS. Bad economics. **Rejected.**
- **Gupshup / Kaleyra / Sinch / Exotel** — sales-call-only pricing means we can't price-compare like-for-like. All likely workable, none demonstrably better than MSG91/2Factor on published evidence. **Rejected on opacity.**
- **Authkey.io** — ₹2,500 startup credit ≈ 50 months of MVP coverage is genuinely attractive, but the API is raw-SMS-with-helpers (not Verify-style) and DLT scrubbing fee is itemised separately (₹0.025/SMS on top). MSG91's Verify API + bundled DLT scrubbing is the cleaner shape. **Close third; documented but not chosen.**

#### Gotchas to remember at lock time

1. **MSG91 + Authkey startup credits reject Gmail.** Sign up with a `@meetsaha.com` address (domain already owned).
2. **DLT registration takes 3–7 business days even with assisted vendors** (TRAI portal latency, not vendor latency). Start it the day Decision C locks, not on Phase 3 build day. If lock slips, kickoff slips.
3. **No BAA from MSG91 / 2Factor / Fast2SMS / Authkey.** Twilio + Plivo + Sinch offer BAAs (enterprise tier). Per locked HIPAA-grade posture, BAAs are explicitly deferred — this is a tiebreaker only and doesn't unseat MSG91. Captured in backlog H1.
4. **USD forex risk on Plivo / Twilio** if they ever resurface as alternatives.
5. **Verify-style API ≠ no rate-limit on our side.** MSG91 handles per-phone brute-force, but we still want a per-IP rate-limit at the Convex Auth layer to prevent enumeration attacks on the phone-entry form. Pre-flagged in build plan §4.

#### Build plan — MSG91 (kicks off the day Decision C locks)

**Phase 3 sequencing.** This plan slots into the existing Phase 3 build after Decision G (onboarding state machine) locks the sign-in surface placement. DLT registration is the long pole — start it BEFORE any code is written.

##### Step C-1 — DLT + MSG91 account prerequisites (Day 0, runs in parallel with code)

| # | Action | Owner | Duration | Blocker if missed |
|---|---|---|---|---|
| 1 | Sign up on MSG91 with `auth@meetsaha.com` (or similar non-Gmail business-domain address). | Rewant | 10 min | Startup credit rejected if Gmail |
| 2 | Apply to the **MSG91 Startup Program** (25k OTP credits/mo × 6 mo). | Rewant | 15 min form | Pay-as-you-go from day one if skipped |
| 3 | Register entity on the TRAI DLT portal (JioTrueConnect is the simplest entrypoint). Saha needs entity registration as the principal entity. | Rewant + MSG91 support | 1–3 business days | No SMS can be sent in production until this clears |
| 4 | Register **DLT sender ID** — 6-char alphanumeric, e.g. `SAHAOT` or `MEETSA`. | Rewant + MSG91 support | 1–2 business days (after entity) | Same as above |
| 5 | Register **DLT template** for OTP SMS. Template body must match the actual message bytes exactly (variable placeholders allowed, free-text not). Draft body: `<#> {#var#} is your Saha sign-in code. Valid for 5 minutes. Do not share.` | Rewant + MSG91 support | 1–2 business days | OTPs rejected by carrier scrubbing if template doesn't match |
| 6 | Link DLT credentials inside MSG91 dashboard. | Rewant | 10 min | OTPs won't send |

**Total DLT lead time: 3–7 business days.** This is why item #2 in the gotchas above is non-negotiable.

##### Step C-2 — Schema additions (no new tables; profile shape extension only)

Per Decision F (profile data location, pending). Once F locks:
- If F = Convex `profiles` table or hybrid: add `phoneNumber: v.optional(v.string())` (E.164 format, e.g. `+919876543210`) + `phoneVerifiedAt: v.optional(v.number())` to the profiles table shape.
- `authAuditLog` (from ADR-035) records every OTP send + verify attempt automatically — no extra schema.

##### Step C-3 — `lib/auth/sms-transport.ts` adapter (the swap-friendly seam)

Single file. Exports two functions matching the locked Swap-friendliness pattern:

```ts
// lib/auth/sms-transport.ts
import { z } from "zod";

const PhoneE164 = z.string().regex(/^\+91\d{10}$/, "India phone required");

export async function sendPhoneOtp(phone: string): Promise<{ requestId: string }> {
  PhoneE164.parse(phone);
  const resp = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: {
      "authkey": process.env.MSG91_AUTHKEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID!,
      mobile: phone.replace("+", ""), // MSG91 wants 919876543210 not +919876543210
      otp_length: 6,
      otp_expiry: 5, // minutes
    }),
  });
  if (!resp.ok) throw new Error(`sms-transport.send-failed:${resp.status}`);
  const body = await resp.json();
  return { requestId: body.request_id };
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<boolean> {
  PhoneE164.parse(phone);
  const resp = await fetch(
    `https://control.msg91.com/api/v5/otp/verify?mobile=${phone.replace("+", "")}&otp=${code}`,
    { method: "GET", headers: { "authkey": process.env.MSG91_AUTHKEY! } }
  );
  if (!resp.ok) return false;
  const body = await resp.json();
  return body.type === "success";
}
```

**Why this shape:** the adapter contract (`sendPhoneOtp` returns `{ requestId }`, `verifyPhoneOtp` returns boolean) absorbs both MSG91 (vendor-managed) and 2Factor (vendor-managed with `session_id`) cleanly. Fast2SMS-style raw SMS would require an extra `storeOtp` helper — explicitly out-of-shape, which is what protects us from accidentally regressing to roll-your-own.

##### Step C-4 — Convex Auth custom provider wiring

Convex Auth's `Phone` provider expects you to implement `verify` server-side. Wire `sendPhoneOtp` into the credential-create step, `verifyPhoneOtp` into the credential-check step. ~30 lines in `convex/auth.ts`. Pseudocode:

```ts
// convex/auth.ts (sketch — verify against @convex-dev/auth API at build time)
import { convexAuth } from "@convex-dev/auth/server";
import { Phone } from "@convex-dev/auth/providers/Phone";
import { sendPhoneOtp, verifyPhoneOtp } from "../lib/auth/sms-transport";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Phone({
      id: "phone-otp-india",
      maxAge: 60 * 5, // 5 min, matches MSG91 expiry
      async generateVerificationToken() {
        // MSG91 generates the OTP server-side; return a placeholder.
        // Real OTP lives at MSG91 keyed by phone.
        return "msg91-managed";
      },
      async sendVerificationRequest({ identifier: phone }) {
        await sendPhoneOtp(phone);
      },
      authorize: async ({ phone, code }) => {
        const ok = await verifyPhoneOtp(phone, code);
        if (!ok) throw new Error("auth.otp.invalid");
        return { phoneNumber: phone };
      },
    }),
    // ...EmailMagicLink({ Resend }) from Decision B
  ],
});
```

**Caveat:** Convex Auth's `Phone` provider API may diverge slightly from this sketch — verify against `@convex-dev/auth/providers/Phone` source at build kickoff. If their Phone provider strongly assumes generate-and-store-locally, we wrap with a custom `Credentials` provider instead.

##### Step C-5 — Per-IP rate limit at the public mutation layer

MSG91 handles per-phone brute-force, but a malicious actor could enumerate phone numbers by spamming the OTP-send endpoint with different numbers from the same IP. Defense:
- New `convex/rateLimits.ts` table: `{ ip: v.string(), eventType: v.string(), windowStartMs: v.number(), count: v.number() }` with index `by_ip_event_window`.
- Threshold: 10 OTP-sends per IP per 15 min. Returns `ConvexError({ code: "auth.rate_limited" })` past threshold; UI surfaces "Too many attempts — try again in 15 min."
- Same pattern as `extractAttempts` table (precedent in `convex/extractAttempts.ts`). Reuses the established cost-guard idempotency lesson (memory: `feedback_cost_guard_idempotent_on_request_id.md`).

##### Step C-6 — Sign-in UI

Per Swap-friendliness pattern: plain Next.js Server-Action-backed form, NOT Convex Auth React primitives. Two fields:
1. Phone number input (E.164 hint, "+91 prefix auto-added if missing").
2. OTP code input (6-digit, appears after `sendPhoneOtp` succeeds).

Resend OTP button rate-limited client-side (30s cooldown) + server-side (the per-IP limiter above).

##### Step C-7 — Test plan

- **Unit:** `lib/auth/sms-transport.test.ts` mocks `fetch`, asserts request shape (template_id, mobile format, headers) + success/failure paths.
- **Integration:** A live MSG91 test against `auth@meetsaha.com` registered as a test number, gated on `MSG91_LIVE_TEST=true` env so it doesn't run in CI by default. Same pattern as `tests/integration/medications-live.test.ts`.
- **Manual smoke (ship day):** per `feedback_ship_day_manual_smoke.md` — actually send an OTP to Rewant's real phone, verify it, sign in. Don't trust vitest alone.

##### Step C-8 — Env vars

| Var | Where | Notes |
|---|---|---|
| `MSG91_AUTHKEY` | Vercel prod + preview + dev; `.env.local` for local dev | The auth key from MSG91 dashboard |
| `MSG91_TEMPLATE_ID` | Same | DLT-registered template ID |
| `MSG91_SENDER_ID` | Same (informational; SDK reads from template) | 6-char DLT-approved sender |

Per `feedback_vercel_preview_env_pattern.md` — set these via `vercel env add` BEFORE the first push that uses them, then redeploy preview. Otherwise the preview build will 502 on OTP send.

##### Step C-9 — Cost monitoring

- Convex internal action (cron, daily) that reads `authAuditLog` and counts OTP-send events per day. Logged for now — no alert until cost crosses ₹500/mo (a deliberate cliff to force a "why did volume spike" review).
- At 25k credits/mo, MSG91 dashboard surfaces a usage meter — set a manual calendar reminder to check it monthly through the 6-month startup runway.

##### Step C-10 — Ship gates

Per `feedback_ship_day_manual_smoke.md` + `feedback_remind_convex_deploy.md`:
- 1054/1054 vitest + new SMS-transport unit tests green.
- `pnpm test:integration:live MSG91_LIVE_TEST=true` green at least once before ship.
- Manual smoke: send OTP to Rewant's real phone on prod URL.
- `scripts/ship-prod.sh` — Convex prod deploy required (touches `convex/auth.ts` + `convex/rateLimits.ts`).

#### Sub-decision C — Decision log entry (drafted, to commit when locked)

- **YYYY-MM-DD — Sub-decision C (phone OTP provider) — MSG91 primary, 2Factor.in documented fallback.** India-friendly Verify-style API, 6-month startup credit covers MVP runway, assisted DLT registration. Twilio Verify rejected on cost (60× at 10k scale for India-only). 2Factor named as adapter-pattern swap target if MVP volume crosses the 25k/mo MSG91 startup credit threshold.

---

## Section 2 — Sign-in methods

**Status:** locked (sprint plan Decision 3, 2026-05-09); Decision D (locale detection) still open.

### Locked
- **Email magic link** — primary, all locales.
- **Phone OTP** — secondary, India only, surfaced when locale = India.

### Why this set (and not OAuth / passwords)
*To be filled when D locks (rationale captured alongside locale-detection mechanism).*

### Decision D — India locale detection
**Status:** open.

#### Options
- `Accept-Language` header (server-side, free, low accuracy at IN border edges).
- IP geolocation (server-side, accurate, paid lookups).
- Explicit locale toggle (user-driven; zero ambiguity; one extra UI step).
- Phone-prefix entry (user types `+91…` → reveals OTP option).

#### Decision (LOCKED YYYY-MM-DD)
*To be filled.*

#### Rationale + alternatives considered
*To be filled.*

---

## Section 3 — Migration of existing data (Decision E)

**Status:** open. Walked AFTER Decision F (profile location), since profile location dictates what E migrates.

### Scope to migrate
Row-by-row inventory of stub-userId data on `usable-zebra-515`, to be queried at draft time:
- `checkIns`, `intakeEvents`, `medications`, `dosageChanges`, `doctorVisits`, `bloodWork`, `extractAttempts`, `continuity` (if present).
- Likely affected: ~5 prod waitlist users have NOT yet generated checkIns rows (waitlist signup ≠ app entry); the only stub-userId rows expected belong to Rewant's smoke testing on prod.

### Out of scope (immutable)
- `waitlist` table — see Hard guardrails §1.

### Options
- **Wipe** — delete all stub-userId rows in feature tables; waitlist preserved.
- **Adopt** — rewrite stub `userId` → first-signed-in real identity (one-time, Rewant's account).
- **Orphan** — leave rows; surface a "claim previous data" affordance post-sign-in (heavier UX work).

### Decision (LOCKED YYYY-MM-DD)
*To be filled.*

### Migration script outline
*To be filled when E locks. Skeleton:*
- Discovery query: distinct `userId` values per feature table on prod.
- Profile coupling: if Decision F = Convex `profiles` table, copy `saha.profile.v1` localStorage payloads into `profiles` rows in the same migration step (Risk #8 in sprint plan).
- Run mechanics: one-shot `convex run` script in `convex/migrations/`, gated on `process.env.SAHA_MIGRATION_CONFIRM === "yes-i-mean-it"`. Dry-run mode prints what would change.
- Snapshot prerequisite: `npx convex export` before run; recorded in Phase 3 Step 8.
- Rollback posture: none — restore from snapshot if catastrophic.

---

## Section 4 — Schema + handler refactor

**Status:** inventory locked; final shape pending Decision F (whether `profiles` table is added).

### Handler inventory

**32 handlers across 9 Convex files require migration. 2 (`waitlist`) are no-auth and remain untouched.**

| File | Handler | Kind | `userId` arg today | Idempotency | Indexes used | Post-auth shape |
|---|---|---|---|---|---|---|
| `convex/checkIns.ts` | `createCheckin` | mutation | `v.string()` | `clientRequestId` | `by_user_date` | drop arg, derive from `ctx.auth` |
| `convex/checkIns.ts` | `listCheckins` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/checkIns.ts` | `getCheckin` | query | absent (id-only) | — | implicit | add ownership check `row.userId === identity.subject` |
| `convex/checkIns.ts` | `getTodayCheckin` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/checkIns.ts` | `listEventsByRange` | query | `v.string()` | — | `by_user_date` (×4 tables) | drop arg |
| `convex/bloodWork.ts` | `createBloodWork` | mutation | `v.string()` | `clientRequestId` | `by_user_date` | drop arg |
| `convex/bloodWork.ts` | `updateBloodWork` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/bloodWork.ts` | `softDeleteBloodWork` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/bloodWork.ts` | `listBloodWork` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/bloodWork.ts` | `getBloodWorkByDate` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/medications.ts` | `createMedication` | mutation | `v.string()` | — | — | drop arg |
| `convex/medications.ts` | `updateMedication` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/medications.ts` | `deactivateMedication` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/medications.ts` | `listActiveMedications` | query | `v.string()` | — | `by_user_active` | drop arg |
| `convex/medications.ts` | `listAllMedications` | query | `v.string()` | — | `by_user` | drop arg |
| `convex/medications.ts` | `getTodayAdherence` | query | `v.string()` | — | `by_user_active`, `by_user_date` | drop arg |
| `convex/intakeEvents.ts` | `logIntake` | mutation | `v.string()` | `clientRequestId` | `by_user_med_date`, `by_user_date` | drop arg |
| `convex/intakeEvents.ts` | `softDeleteIntake` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/intakeEvents.ts` | `listIntakeEvents` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/intakeEvents.ts` | `listIntakeEventsByDate` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/doctorVisits.ts` | `createVisit` | mutation | `v.string()` | `clientRequestId` | `by_user_date` | drop arg |
| `convex/doctorVisits.ts` | `updateVisit` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/doctorVisits.ts` | `softDeleteVisit` | mutation | `v.string()` | — | implicit | drop arg, ownership check |
| `convex/doctorVisits.ts` | `listVisits` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/doctorVisits.ts` | `getNextUpcomingVisit` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/doctorVisits.ts` | `getVisitsByDate` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/dosageChanges.ts` | `recordDosageChange` | mutation | `v.string()` | — | `by_user_med`, `by_user_changed_at` | drop arg, ownership check via med row |
| `convex/dosageChanges.ts` | `listDosageChanges` | query | `v.string()` | — | `by_user_med`, `by_user_changed_at` | drop arg |
| `convex/continuity.ts` | `getContinuityState` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/extractAttempts.ts` | `incrementAndCheck` | mutation | `v.string()` | — | `by_user_date` | drop arg |
| `convex/extractAttempts.ts` | `getCount` | query | `v.string()` | — | `by_user_date` | drop arg |
| `convex/extractAttempts.ts` | `resetForUserOnDate` | internalMutation | `v.string()` | — | `by_user_date` | **keep arg** (called from authenticated action; internal only) |
| `convex/waitlist.ts` | `addEmail` | mutation | absent | — | `by_email` | **no auth — pre-auth surface, immutable** |
| `convex/waitlist.ts` | `count` | query | absent | — | — | **no auth — public count, immutable** |

### Schema additions / changes
- **Unique index `(userId, clientRequestId)`** added to `checkIns`, `intakeEvents`, `doctorVisits`, `bloodWork` — closes housekeeping #14 / `feedback_clientRequestId_unique_index.md` TOCTOU race. Locked under ADR-034.
- **`profiles` table** — added IFF Decision F selects "Convex `profiles` table" or "hybrid". Shape and indexes specified once F locks.
- **No other schema changes.** All existing user-scoped indexes (`by_user_date`, `by_user_med_date`, `by_user_active`, `by_user`, `by_user_med`, `by_user_changed_at`) stay as-is — `userId` field becomes server-derived but the index definitions don't move.

### Defense-in-depth pattern (post-migration)
Edit/delete handlers (`updateBloodWork`, `softDeleteBloodWork`, `updateMedication`, `deactivateMedication`, `softDeleteIntake`, `updateVisit`, `softDeleteVisit`, `recordDosageChange`, `getCheckin`) keep the row-ownership check, but the comparison is against `identity.subject` rather than a client-supplied arg. Pseudocode:
```ts
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new ConvexError({ code: "auth.unauthenticated" });
const row = await ctx.db.get(args.id);
if (!row || row.userId !== identity.subject) {
  throw new ConvexError({ code: "auth.forbidden" });
}
```

---

## Section 5 — Profile data location (Decision F)

**Status:** open. Walked BEFORE Decision E.

### Today's state
- `saha.profile.v1` localStorage key (schema v2 per ADR-029) — see `lib/profile/types.ts:48–59`, `lib/profile/storage.ts:37,107`.
- `saha.testUser.v1` localStorage key — UUID stub, written across 14+ pages via `getOrCreateTestUserId()`.
- **No Convex `profiles` table.** Confirmed against `convex/schema.ts`.

### Profile shape (v2, from `lib/profile/types.ts`)
- `name: string | null`
- `dobMonth: number | null` (1–12; optional per ADR-029)
- `dobYear: number | null` (4-digit; optional per ADR-029)
- `email: string | null`
- `condition: Condition | null` (enum)
- `conditionOther: string | null`
- `onboarded: boolean`
- `createdAtMs`, `updatedAtMs`, `v: 2`

### Options
- **localStorage only** — status quo. Multi-device parity = none. Onboarding speed = fast.
- **Convex `profiles` table** — canonical truth on server. Multi-device parity = native. Onboarding speed = one round-trip per write.
- **Hybrid** — Convex canonical, localStorage cache for fast onboarding reads. Multi-device parity = good. Complexity = highest.

### Decision (LOCKED YYYY-MM-DD)
*To be filled.*

### Rationale + alternatives considered
*To be filled.*

---

## Section 6 — Onboarding state machine (Decision G)

**Status:** open. Walked AFTER Decisions A and F.

### Today's flow
1. **Landing:** `app/page.tsx` → `<LandingPage />` (no gate).
2. **Onboarding gate:** `app/home/page.tsx:36–40` — `useEffect` calls `readProfile()`. If `!profile || !profile.onboarded`, redirect to `/onboarding/1`.
3. **Onboarding screens 1–5:** `app/onboarding/[step]/page.tsx` (dynamic route).
4. **Setup B (4 steps):** `/setup/{name,dob,email,condition}/page.tsx` — DOB optional per ADR-029.
5. **Welcome:** `/welcome` → `markOnboarded()` → `/home`.

### Options
- **Auth gate first** — `app/page.tsx` (or middleware) requires sign-in before any onboarding screen renders.
- **Profile gate first** — onboarding screens render anonymously; auth happens at the end (e.g., before `/welcome`).
- **Hybrid** — onboarding informational screens (1–5) render anonymously; auth gate before Setup B (where real PII is captured).

### Sub-question — popup vs redirect on iOS
iOS Safari OAuth-popup behavior is a known papercut (sprint plan Risk #2). Magic-link flow sidesteps popups entirely (link opens in same tab). Phone OTP is in-app form. The popup question only applies if a future OAuth provider lands.

### Decision (LOCKED YYYY-MM-DD)
*To be filled.*

### Rationale + alternatives considered
*To be filled.*

---

## Section 7 — Privacy policy + T&C (Decision H, appendix)

**Status:** partially constrained — language stance LOCKED 2026-05-10 (HIPAA/DPDP-compatible language, drafted in Phase 1). Only legal-review timing remains open.

### What's already locked (from Decision A walk)
- **Language stance:** privacy policy + T&C drafted in HIPAA + India DPDP Act 2023 compatible language (consent · purpose limitation · sensitive-PII handling · breach notification · data-subject rights). Not optional.
- **Drafting timing:** drafts produced during Phase 1 alongside the scoping doc. Not deferred.

### What remains open — legal review timing
- **Pre-launch legal review** — block launch on a counsel-reviewed privacy policy + T&C. India DPDP considerations apply.
- **Post-launch acceptable for first 50 free users** — ship with the HIPAA/DPDP-compatible draft, formal legal review during the first-50 window before opening signups beyond.

### Decision (LOCKED YYYY-MM-DD)
*To be filled.*

### Rationale + alternatives considered
*To be filled.*

---

## ADR drafts (after all decisions lock)

To be appended to `docs/architecture-decisions.md` (next number is **ADR-032**):

- **ADR-032 — Auth provider: Convex Auth (LOCKED 2026-05-10).** Captures A + B + C with rationale; records HIPAA-grade-posture and sub-processor-minimization arguments. **C section pending Rewant lock** — recommendation drafted (MSG91 primary, 2Factor fallback) but not yet committed.
- **ADR-033 — Server-derived `userId` (supersedes ADR-019):** every public mutation/query reads `ctx.auth.getUserIdentity()`; defense-in-depth ownership check on edit/delete handlers; internalMutations keep explicit `userId` arg.
- **ADR-034 — `clientRequestId` unique-index pattern:** schema-level unique index on `(userId, clientRequestId)` for the 4 idempotency tables. Closes housekeeping #14.
- **ADR-035 — HIPAA-grade architecture posture (LOCKED structure 2026-05-10).** Audit log table · soft-delete with audit trail · MFA-ready data model. Cross-references Decision H for privacy-policy language coupling.

---

## Decision log (running)

Format: `YYYY-MM-DD — Decision X (label) — outcome.`

- **2026-05-10 — Decision A (auth provider) — Convex Auth.** First-party stack alignment; sub-processor minimization for HIPAA-grade posture; zero auth-vendor cost; phone-OTP DIY accepted (mitigated by Twilio Verify in Decision C).
- **2026-05-10 — HIPAA bake-ins set (Decision A walk-out) — locked.** In scope: audit log table · soft-delete with audit trail · MFA-ready data model · privacy policy in HIPAA/DPDP-compatible language. Out of scope this sprint: session revocation surface, LLM-extraction data-minimization audit, formal BAAs.
- **2026-05-10 — ADR structure (Decision A walk-out) — separate ADR-035** for HIPAA-grade architecture; not folded into ADR-033.
- **2026-05-10 — Decision B (magic-link email transport) — Resend.** Convex Auth's documented happy path; ~15 min Phase 3 wire-up; adapter (`lib/auth/email-transport.ts`) + React Email templates absorb swap cost; C-independent. SES + SendGrid BAA-path comparison deferred to post-MVP HIPAA-compliance backlog (H1).
- **2026-05-16 — Decision C (phone OTP provider) — RESEARCHED, lock DEFERRED.** Full India-vendor price-first sweep done (MSG91, 2Factor.in, Plivo Verify, Twilio Verify, Fast2SMS, Authkey.io, Exotel, SMSCountry, Gupshup, Sinch, Kaleyra). Sarvam confirmed not applicable (STT/TTS only). Twilio Verify rejected on cost (60× MSG91 at 10k scale for India-only — ₹880k/mo vs ₹15k/mo). Recommendation drafted: **MSG91 primary** (true Verify-style API, 25k OTP credits/mo × 6 mo Startup Program, assisted DLT), **2Factor.in documented fallback** (₹9.6k/mo at 10k scale via adapter swap). MSG91 build plan inline (C-1 through C-10). Lock deferred at Rewant's discretion; backlog item #24 tracks revisit. DLT registration is the long pole (3–7 business days) — kick off the day this locks.

---

## References

### Memory
- `feedback_persist_design_qa.md` — write decisions through to memory/doc same turn.
- `feedback_clientRequestId_unique_index.md` — TOCTOU pattern coupled to auth.
- `feedback_remind_convex_deploy.md` — Convex prod deploy is a separate manual step.
- `feedback_branch_base_for_pr_scope.md` — branch off main by default.
- `feedback_ship_day_manual_smoke.md` — vitest green is not enough.
- `feedback_env_shape_parity.md` — local → dev → prod same shape, different data.

### Project docs
- `docs/scoping.md` — canonical scoping (wins on conflict).
- `docs/architecture-decisions.md` — ADR-019 (to be superseded), ADR-022 (`clientRequestId` precedent), ADR-029 (profile schema v2).
- `docs/post-mvp-backlog.md` — items #14, #17, #20.
- `docs/sprints/2026-05-09-auth-ui-housekeeping.md` (on `main`) — canonical sprint plan.
