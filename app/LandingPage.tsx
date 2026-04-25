import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";
import { WaitlistCount } from "./WaitlistCount";
import { CheckInGrid } from "./CheckInGrid";
import { VoiceTranscript } from "./VoiceTranscript";
import { GetStartedCTA } from "@/components/landing/GetStartedCTA";

const conditions = [
  "Lupus",
  "Rheumatoid arthritis",
  "Hashimoto's",
  "Multiple sclerosis",
  "Crohn's",
  "Psoriasis",
  "Sjögren's",
  "Ankylosing spondylitis",
  "Type 1 diabetes",
  "Celiac",
];

const pillars = [
  {
    bucket: "Capture",
    label: "01",
    items: [
      { t: "Voice check-in", d: "Sixty seconds a day. No forms — Saha carries the record with you." },
      { t: "Medications", d: "Dosage, schedule, adherence. Track every dose change." },
      { t: "Visits & blood work", d: "Captured by hand or pulled from your voice." },
    ],
  },
  {
    bucket: "Understand",
    label: "02",
    items: [
      { t: "Memory", d: "Your last 30 days as a scrollable, editable timeline." },
      { t: "Patterns", d: "Symptoms, sleep, mood, meds — plotted together." },
      { t: "Journey", d: "The full looking-back view of your autoimmune life." },
    ],
  },
  {
    bucket: "Show up prepared",
    label: "03",
    items: [
      { t: "Doctor Report", d: "Talking points and trends — one PDF your doctor will actually read." },
      { t: "Prepare for visit", d: "Checklist, annotations, questions ready for the room." },
      { t: "Community", d: "Pseudonymous peer channels — you aren't doing this alone." },
    ],
  },
];

const privacyClaims = [
  {
    t: "No tracking pixels.",
    d: "We don't run Google Analytics, Meta pixels, or session replays. We can't see your screen.",
  },
  {
    t: "Your transcripts never train an AI.",
    d: "What you say to Saha stays between you and Saha. Not used for model training. Not sold.",
  },
  {
    t: "Delete in one tap.",
    d: "Export your full record any time. Delete your account and we forget you — voice transcripts and all.",
  },
];

export function LandingPage() {
  return (
    <div
      className="grain relative min-h-screen"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 40% at 88% 8%, rgba(197, 133, 107, 0.18) 0%, rgba(197, 133, 107, 0) 60%), radial-gradient(45% 35% at 6% 30%, rgba(92, 138, 127, 0.15) 0%, rgba(92, 138, 127, 0) 60%)",
        }}
      />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-32 px-6 pb-28 pt-10 sm:gap-36 sm:pt-14">
        {/* Top nav */}
        <nav className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full animate-breathe"
              style={{ background: "var(--sage-deep)" }}
            />
            <span
              className="text-2xl"
              style={{
                fontFamily: "var(--font-fraunces)",
                color: "var(--sage-deep)",
                fontVariationSettings: "'SOFT' 50, 'opsz' 24, 'wght' 500",
                letterSpacing: "-0.01em",
              }}
            >
              Saha
            </span>
          </div>
          <div className="flex items-center">
            <a
              href="#waitlist"
              className="type-label transition-colors hover:text-ink"
            >
              Join waitlist →
            </a>
          </div>
        </nav>

        {/* HERO — inline email, transcript on the right (between text and form on mobile) */}
        <section className="grid grid-cols-1 items-start gap-10 md:grid-cols-12 md:gap-x-12 md:gap-y-14">
          {/* Hero copy — top-left on desktop, first on mobile */}
          <div
            className="md:col-span-7 md:row-start-1 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 type-label"
              style={{
                borderColor: "var(--rule)",
                background: "var(--bg-card)",
              }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full animate-breathe"
                style={{ background: "var(--sage)" }}
              />
              Voice-first · for autoimmune
            </span>

            <h1 className="type-display-xl mt-7">
              The friend who{" "}
              <em className="italic-soft">remembers</em>,
              <br />
              so you don&apos;t have to.
            </h1>

            <p
              className="type-body-lg mt-6 max-w-lg"
              style={{ color: "var(--ink)" }}
            >
              A health companion for life with an autoimmune condition.
            </p>

            <p
              className="type-body mt-4 max-w-lg"
              style={{ color: "var(--ink-muted)" }}
            >
              Sixty seconds a day. Saha remembers your symptoms,
              medications, and visits — so when the room rushes, you walk in
              prepared.
            </p>

            {/* Sub-hero quote + response — north-star anchor */}
            <div className="mt-8 max-w-lg">
              <blockquote className="border-l-2 pl-4" style={{ borderColor: "var(--sage-deep)" }}>
                <p
                  style={{
                    fontFamily: "var(--font-fraunces)",
                    fontSize: "1.0625rem",
                    fontStyle: "italic",
                    fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 380",
                    color: "var(--ink)",
                    lineHeight: 1.5,
                  }}
                >
                  &ldquo;I need more positive reinforcement through seeing a
                  picture of what works for me — but I don&apos;t have the
                  tools to make that picture on my own yet.&rdquo;
                </p>
                <p className="type-label mt-3">
                  Autoimmune patient · arthritis
                </p>
              </blockquote>
              <p
                className="type-body mt-5 max-w-lg"
                style={{ color: "var(--ink-muted)" }}
              >
                You shouldn&apos;t have to be your own pattern detective.
                Saha gives you a picture of what works for you — every
                dose change, every flare, every off day, plotted so you can
                finally see what&apos;s actually helping.
              </p>
            </div>

            {/* Onboarding-shell cycle: primary hero CTA. Pre-hydration label
                = "Get started" → /onboarding/1; post-hydration when the
                profile is onboarded, label flips to "Open your home page"
                → /home. Waitlist form below stays intact. */}
            <div className="mt-8">
              <GetStartedCTA />
            </div>
          </div>

          {/* Hero visual — VOICE transcript (the differentiator). Spans both rows on desktop, sits between copy and form on mobile. */}
          <div
            className="md:col-span-5 md:row-start-1 md:row-span-2 animate-fade-up md:sticky md:top-10"
            style={{ animationDelay: "0.25s" }}
          >
            <VoiceTranscript />
          </div>

          {/* Form + conditions — bottom-left on desktop, last on mobile (after transcript) */}
          <div
            className="md:col-span-7 md:row-start-2 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Inline email — primary conversion path */}
            <div className="max-w-lg">
              <WaitlistForm />
              <div className="mt-3">
                <WaitlistCount variant="warm" />
              </div>
            </div>

            {/* Conditions — moved up from below the fold; this is the highest-trust signal */}
            <div className="mt-10">
              <p className="type-label mb-3">For people with</p>
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border px-3 py-1 text-[13px]"
                    style={{
                      borderColor: "var(--rule)",
                      background: "var(--bg-card)",
                      color: "var(--ink)",
                    }}
                  >
                    {c}
                  </span>
                ))}
                <span
                  className="rounded-full border border-dashed px-3 py-1 text-[13px]"
                  style={{
                    borderColor: "var(--ink-subtle)",
                    color: "var(--ink-subtle)",
                  }}
                >
                  + 90 more
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* "Over 30 days, this becomes" — grid moves here, with narrative purpose */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="type-label">Over time</p>
            <h2 className="type-display-md mt-3">
              One minute a day,
              <br />
              thirty days of evidence.
            </h2>
            <p
              className="type-body mt-5 max-w-md"
              style={{ color: "var(--ink-muted)" }}
            >
              Each voice check-in becomes a quiet record. A flare on day 16,
              calm weeks before and after — visible to you, and ready for the
              room when you walk in.
            </p>
          </div>
          <div className="md:col-span-8">
            <CheckInGrid />
          </div>
        </section>

        {/* Pull quote — single italic moment in body, kept restrained */}
        <section
          className="grid grid-cols-1 gap-6 border-y py-14 md:grid-cols-12 md:gap-12"
          style={{ borderColor: "var(--rule)" }}
        >
          <p className="type-label md:col-span-3">From research</p>
          <blockquote className="md:col-span-9">
            <p
              className="leading-[1.15] sm:text-4xl"
              style={{
                fontFamily: "var(--font-fraunces)",
                fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
                fontVariationSettings: "'SOFT' 100, 'opsz' 96, 'wght' 380",
                fontStyle: "italic",
                color: "var(--ink)",
              }}
            >
              &ldquo;By the time I&apos;m in the room, I&apos;ve forgotten
              what I wanted to ask.&rdquo;
            </p>
            <p className="type-label mt-5">
              Autoimmune patient · arthritis
            </p>
          </blockquote>
        </section>

        {/* What's inside — three buckets, story not dump */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="type-label">What&apos;s inside Saha</p>
            <h2 className="type-display-md mt-3">
              Three jobs.
              <br />
              Nine pieces. One quiet companion.
            </h2>
            <p
              className="type-body mt-5 max-w-md"
              style={{ color: "var(--ink-muted)" }}
            >
              Voice is the front door. Behind it: everything an autoimmune
              life actually needs — capture, understand, show up prepared.
            </p>
          </div>

          <div className="md:col-span-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {pillars.map((bucket) => (
              <div
                key={bucket.bucket}
                className="flex flex-col gap-5 rounded-2xl border p-6"
                style={{
                  borderColor: "var(--rule)",
                  background: "var(--bg-card)",
                }}
              >
                <div className="flex items-baseline justify-between">
                  <h3
                    className="type-heading"
                    style={{ color: "var(--sage-deep)" }}
                  >
                    {bucket.bucket}
                  </h3>
                  <span
                    className="type-label"
                    style={{ color: "var(--sage-deep)" }}
                  >
                    {bucket.label}
                  </span>
                </div>
                <ul
                  className="flex flex-col divide-y"
                  style={{ borderColor: "var(--rule)" }}
                >
                  {bucket.items.map((item, i) => (
                    <li
                      key={item.t}
                      className="flex flex-col gap-1 py-4"
                      style={{
                        borderTopColor: "var(--rule)",
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopStyle: "solid",
                      }}
                    >
                      <span
                        className="text-[15px] font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {item.t}
                      </span>
                      <span className="type-body" style={{ fontSize: "0.875rem" }}>
                        {item.d}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Founder note + Why Saha — combined trust block */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="type-label">A note from the builder</p>

            <div className="mt-5 flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background: "var(--sage-deep)",
                  color: "var(--bg-elevated)",
                  fontFamily: "var(--font-fraunces)",
                  fontSize: "1.5rem",
                  fontVariationSettings: "'SOFT' 50, 'opsz' 24, 'wght' 500",
                }}
                aria-hidden
              >
                R
              </div>
              <div className="flex flex-col">
                <span
                  className="text-[15px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  Rewant
                </span>
                <span
                  className="type-label"
                  style={{ letterSpacing: "0.14em" }}
                >
                  Building Saha
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <p className="type-body">
                I started Saha after a year of patient interviews. The same
                story, again and again: people doing real work to manage their
                condition, then losing the thread the moment the visit started.
              </p>
              <p className="type-body">
                Tracking can&apos;t add cognitive load to a life that&apos;s
                already heavy. Voice felt like the only honest answer.
              </p>
            </div>
          </div>

          <div className="md:col-span-8 md:pl-12 md:border-l" style={{ borderColor: "var(--rule)" }}>
            <p className="type-label">Why Saha</p>
            <h2
              className="type-display-lg mt-3"
              style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)" }}
            >
              The room is rushed. Your body keeps notes you can&apos;t.
            </h2>
            <div
              className="mt-6 flex flex-col gap-5"
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "1.0625rem",
                lineHeight: 1.7,
                color: "var(--ink-muted)",
              }}
            >
              <p>
                People living with autoimmune conditions often track in
                scraps — notes app, calendar, memory. Then in the doctor&apos;s
                office, fifteen minutes feels like five, and the pattern that
                mattered last Tuesday is gone.
              </p>
              <p>
                Saha removes the cognitive load. You speak — naturally,
                briefly — and a quiet record builds itself. When your visit
                comes, the data is already there.
              </p>
              <p
                className="text-base"
                style={{
                  fontFamily: "var(--font-fraunces)",
                  color: "var(--sage-deep)",
                  fontStyle: "italic",
                  fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 380",
                }}
              >
                Saha — सह — Sanskrit, two meanings at once: <em>to endure</em>{" "}
                and <em>with</em>. Because autoimmune is a long carry, and you
                don&apos;t carry it alone. Saha holds the days you can&apos;t,
                and walks beside the days you can.
              </p>
            </div>
          </div>
        </section>

        {/* Specific privacy stance — precondition to the second ask, not a postscript */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="type-label">A specific promise</p>
            <h2 className="type-display-md mt-3">
              We mean it
              <br />
              about your privacy.
            </h2>
            <p
              className="type-body mt-5 max-w-md"
              style={{ color: "var(--ink-muted)" }}
            >
              Most health apps say &ldquo;we care about privacy&rdquo; and run
              ad pixels behind the page. Here&apos;s exactly where Saha
              stands.
            </p>
          </div>

          <div className="md:col-span-8">
            <ul
              className="flex flex-col"
              style={{ borderTop: `1px solid var(--rule)` }}
            >
              {privacyClaims.map((claim) => (
                <li
                  key={claim.t}
                  className="grid grid-cols-1 gap-3 py-7 md:grid-cols-[1fr_2fr] md:gap-12"
                  style={{ borderBottom: `1px solid var(--rule)` }}
                >
                  <h3
                    className="type-heading"
                    style={{ fontSize: "1.25rem" }}
                  >
                    {claim.t}
                  </h3>
                  <p className="type-body">{claim.d}</p>
                </li>
              ))}
            </ul>
            <p className="type-label mt-5">
              Saha is in active development · not medical advice · talk to
              your doctor about health decisions
            </p>
          </div>
        </section>

        {/* Boundary statement — what Saha is not. Sits between privacy and the final ask. */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="type-label">Where we stop</p>
            <h2 className="type-display-md mt-3">Not a diagnostic tool.</h2>
          </div>
          <div className="md:col-span-8">
            <p
              className="type-body"
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.7,
                color: "var(--ink-muted)",
              }}
            >
              Saha doesn&apos;t tell you what&apos;s wrong, doesn&apos;t
              recommend tests, doesn&apos;t suggest treatment changes.
              That&apos;s the conversation between you and your doctor — and
              the one we want to make better. What Saha does is hold your
              story so you walk into that conversation with it ready.
            </p>
          </div>
        </section>

        {/* Final waitlist CTA — sits after privacy so the answer precedes the ask */}
        <section
          id="waitlist"
          className="relative overflow-hidden rounded-[28px] border p-8 sm:p-14"
          style={{
            borderColor: "var(--rule)",
            background:
              "linear-gradient(135deg, var(--bg-elevated) 0%, var(--sage-soft) 100%)",
          }}
        >
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="type-label">Join the waitlist</p>
              <h2 className="type-display-lg mt-3">Be there on day one.</h2>
              <p
                className="type-body-lg mt-5 max-w-md"
                style={{ color: "var(--ink-muted)" }}
              >
                Early access opens soon. We&apos;ll email you. That&apos;s it.
              </p>
              <ul
                className="mt-8 flex flex-col gap-3 text-[15px]"
                style={{ color: "var(--ink)" }}
              >
                {[
                  "First access on launch",
                  "Free for early users",
                  "Help shape what we build next",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--sage-deep)" }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p
                className="mt-8 max-w-md text-[14px]"
                style={{
                  fontFamily: "var(--font-fraunces)",
                  fontStyle: "italic",
                  color: "var(--sage-deep)",
                  fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 380",
                }}
              >
                Saha — सह — Sanskrit. Endurance, and together. The two
                things this asks of all of us.
              </p>
            </div>

            <div className="md:col-span-5 md:self-end">
              <div
                className="rounded-2xl border p-6"
                style={{
                  borderColor: "var(--rule)",
                  background: "var(--bg-elevated)",
                }}
              >
                <p className="type-label">Your email</p>
                <div className="mt-4">
                  <WaitlistForm />
                </div>
                <div className="mt-4">
                  <WaitlistCount variant="warm" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer — proper, with discoverability */}
        <footer
          className="grid grid-cols-1 gap-10 border-t pt-12 md:grid-cols-12"
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="md:col-span-4">
            <span
              className="text-2xl"
              style={{
                fontFamily: "var(--font-fraunces)",
                color: "var(--sage-deep)",
                fontVariationSettings: "'SOFT' 50, 'opsz' 24, 'wght' 500",
                letterSpacing: "-0.01em",
              }}
            >
              Saha
            </span>
            <p
              className="type-body mt-3 max-w-xs"
              style={{ fontSize: "0.9375rem" }}
            >
              A voice-first health companion for people living with autoimmune
              conditions.
            </p>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div className="flex flex-col gap-3">
              <p className="type-label">Product</p>
              {/*
                Single "Open the app" entry — points at the onboarding
                entry so first-time visitors who scroll to the footer
                without using the hero CTA still land in the same flow.
                Already-onboarded users will tap through quickly (5
                screens, no required input). The hero <GetStartedCTA />
                remains the smart-routing primary entry that skips to
                /home for returning users.
              */}
              <Link href="/onboarding/1" className="text-[14px] hover:underline" style={{ color: "var(--ink)" }}>
                Open the app
              </Link>
              <a href="#waitlist" className="text-[14px] hover:underline" style={{ color: "var(--ink)" }}>
                Join waitlist
              </a>
              <a href="mailto:prakash.rewant24@gmail.com" className="text-[14px] hover:underline" style={{ color: "var(--ink)" }}>
                Contact
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="type-label">Trust</p>
              <Link href="/privacy" className="text-[14px] hover:underline" style={{ color: "var(--ink)" }}>
                Privacy
              </Link>
              <span className="type-label" style={{ color: "var(--ink-subtle)" }}>
                Not medical advice
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <p className="type-label">Status</p>
              <span className="type-label" style={{ color: "var(--ink-subtle)" }}>
                In active development
              </span>
              <span className="type-label" style={{ color: "var(--ink-subtle)" }}>
                © {new Date().getFullYear()} Saha
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
