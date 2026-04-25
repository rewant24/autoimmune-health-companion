import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Saha",
  description:
    "What Saha collects, what we don't, and how to ask us to forget you. Plain language, no legalese.",
};

const lastUpdated = "April 25, 2026";

export default function PrivacyPage() {
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
            "radial-gradient(45% 35% at 6% 30%, rgba(92, 138, 127, 0.12) 0%, rgba(92, 138, 127, 0) 60%)",
        }}
      />

      <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 pb-28 pt-10 sm:pt-14">
        {/* Top nav */}
        <nav className="flex items-center justify-between animate-fade-up">
          <Link href="/" className="flex items-center gap-2">
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
          </Link>
          <Link href="/" className="type-label transition-colors hover:text-ink">
            ← Back home
          </Link>
        </nav>

        {/* Header */}
        <header className="flex flex-col gap-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <p className="type-label">Privacy</p>
          <h1 className="type-display-lg">
            Plain language.
            <br />
            <em className="italic-soft">No tracking</em> behind the scenes.
          </h1>
          <p className="type-body-lg max-w-xl">
            This is what Saha collects today, what we don&apos;t, and how to
            ask us to forget you. We&apos;ll keep it readable as the product
            grows.
          </p>
          <p className="type-label">Last updated {lastUpdated}</p>
        </header>

        {/* Where we are right now */}
        <Section label="Where we are right now">
          <P>
            Saha is in active development. The only thing this site does
            today is collect an email address so we can tell you when early
            access opens. There is no app yet, no voice check-ins yet, no
            health data yet.
          </P>
          <P>
            That means our privacy surface area is tiny — and we&apos;re
            writing this page to lock in the commitments now, before the
            product gets bigger.
          </P>
        </Section>

        {/* What we collect today */}
        <Section label="What we collect — today">
          <ul className="flex flex-col gap-4">
            <Bullet
              t="Your email address"
              d="So we can email you when early access opens. That's the entire reason."
            />
            <Bullet
              t="The timestamp of when you signed up"
              d="So we can roll out access in waves and prevent duplicate signups."
            />
          </ul>
          <P>
            That&apos;s it. We don&apos;t ask for your name, your condition,
            your location, your phone number, or anything else. If a field
            isn&apos;t on the form, we don&apos;t have it.
          </P>
        </Section>

        {/* What we don't do */}
        <Section label="What we don't do">
          <ul className="flex flex-col gap-4">
            <Bullet
              t="No tracking pixels"
              d="We don't run Google Analytics, Meta pixels, TikTok pixels, LinkedIn Insight, Hotjar, FullStory, or session replay. Inspect the page source — there are no third-party trackers loaded."
            />
            <Bullet
              t="No advertising networks"
              d="Saha is not ad-supported. We don't share data with ad networks because we don't have a relationship with any."
            />
            <Bullet
              t="No selling, ever"
              d="We will not sell your email or any future health data to anyone. Not to data brokers, not to insurers, not to pharma. This isn't going to change."
            />
            <Bullet
              t="No AI training on your transcripts"
              d="When the product launches and you start speaking to Saha, your voice transcripts will not be used to train language models — ours or anyone else's. Your speech belongs to you."
            />
          </ul>
        </Section>

        {/* What we'll collect when the product launches */}
        <Section label="What we'll collect when the product launches">
          <P>
            We&apos;re writing this so you know what&apos;s coming. When Saha
            opens to early access, the app will need a few categories of data
            to do its job:
          </P>
          <ul className="flex flex-col gap-4">
            <Bullet
              t="Voice check-ins"
              d="Audio you record (or its transcription) is stored so you can scroll back through your timeline. You can delete any check-in. You can delete all of them."
            />
            <Bullet
              t="Health data you enter"
              d="Medications, doctor visits, blood work, symptoms, mood. Anything you tell Saha about your health. Stored to power patterns and reports."
            />
            <Bullet
              t="Account basics"
              d="Email, optional name, condition selection, time zone."
            />
          </ul>
          <P>
            We&apos;ll publish a more detailed version of this section before
            anyone starts using the app. Nothing on this list is being
            collected today.
          </P>
        </Section>

        {/* Who can see your data */}
        <Section label="Who can see your data">
          <P>
            Right now, the only people with access to the waitlist are the
            small team building Saha. We use your email to send you one or
            two messages: a confirmation, and a notification when early
            access opens. We don&apos;t add you to a marketing list. We
            don&apos;t share it with partners.
          </P>
          <P>
            When the product launches, your health data will be visible to
            you and to people you explicitly choose to share it with (e.g. a
            doctor receiving your generated report). Nobody else.
          </P>
        </Section>

        {/* The services we rely on */}
        <Section label="The services we rely on">
          <P>
            We try to use the smallest stack possible. Today the page is
            served by our hosting provider, and the waitlist email is stored
            in <Strong>Convex</Strong>, our backend database. Convex stores
            data encrypted at rest. When we add an email-sending service,
            we&apos;ll name it here.
          </P>
          <P>
            We&apos;ll keep this section honest as the stack grows. If we add
            a service that processes your data, you&apos;ll see it on this
            page.
          </P>
        </Section>

        {/* Your rights */}
        <Section label="Your rights">
          <ul className="flex flex-col gap-4">
            <Bullet
              t="Ask what we have"
              d="Email us and we'll tell you exactly what's stored against your address."
            />
            <Bullet
              t="Get it deleted"
              d="Email us and we'll remove your address from the waitlist. We aim to do it within a week."
            />
            <Bullet
              t="Export it"
              d="Right now there's nothing to export but an email. When the product launches, you'll be able to export your full record from inside the app."
            />
          </ul>
          <P>
            For any of these,{" "}
            <a
              href="mailto:prakash.rewant24@gmail.com"
              className="underline underline-offset-4"
              style={{ color: "var(--sage-deep)" }}
            >
              email prakash.rewant24@gmail.com
            </a>{" "}
            and we&apos;ll handle it.
          </P>
        </Section>

        {/* Cookies */}
        <Section label="Cookies">
          <P>
            We don&apos;t set tracking cookies on this site. Your browser may
            store small technical items (like the waitlist form remembering
            your email if you fill it in twice in a row) but nothing is
            shipped to a third party for analytics or advertising.
          </P>
        </Section>

        {/* Children */}
        <Section label="Children">
          <P>
            Saha is not designed for children under 13 and we don&apos;t
            knowingly collect data from them. If you believe a child has
            joined the waitlist, email us and we&apos;ll remove their entry.
          </P>
        </Section>

        {/* Changes */}
        <Section label="Changes to this page">
          <P>
            When we update this page, we&apos;ll change the &ldquo;last
            updated&rdquo; date at the top and note what changed in plain
            language. If a change materially affects how your data is used,
            we&apos;ll email you about it.
          </P>
        </Section>

        {/* Not medical advice */}
        <Section label="Not medical advice">
          <P>
            Saha is being built as a companion for people living with
            autoimmune conditions. It will not be a substitute for medical
            care, diagnosis, or treatment. Talk to your doctor about any
            health decisions.
          </P>
        </Section>

        {/* Contact */}
        <section
          className="rounded-2xl border p-8"
          style={{
            borderColor: "var(--rule)",
            background: "var(--bg-card)",
          }}
        >
          <p className="type-label">Questions</p>
          <h2 className="type-display-md mt-3">Talk to us.</h2>
          <p className="type-body mt-4 max-w-md">
            If anything on this page is unclear, or you want a more detailed
            answer about something specific, email us. A real person will
            reply.
          </p>
          <a
            href="mailto:prakash.rewant24@gmail.com"
            className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--sage-deep)" }}
          >
            prakash.rewant24@gmail.com
            <span aria-hidden>→</span>
          </a>
        </section>

        {/* Footer */}
        <footer
          className="flex flex-col gap-3 border-t pt-10"
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-2xl"
              style={{
                fontFamily: "var(--font-fraunces)",
                color: "var(--sage-deep)",
                fontVariationSettings: "'SOFT' 50, 'opsz' 24, 'wght' 500",
                letterSpacing: "-0.01em",
              }}
            >
              Saha
            </Link>
            <Link href="/" className="type-label transition-colors hover:text-ink">
              ← Back home
            </Link>
          </div>
          <p className="type-label">© {new Date().getFullYear()} Saha · in active development · not medical advice</p>
        </footer>
      </main>
    </div>
  );
}

/* ---------- small composition helpers ---------- */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="grid grid-cols-1 gap-5 border-t pt-10 md:grid-cols-12 md:gap-8"
      style={{ borderColor: "var(--rule)" }}
    >
      <p className="type-label md:col-span-4">{label}</p>
      <div className="flex flex-col gap-5 md:col-span-8">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="type-body"
      style={{ fontSize: "1.0625rem", lineHeight: 1.7, color: "var(--ink-muted)" }}
    >
      {children}
    </p>
  );
}

function Bullet({ t, d }: { t: string; d: string }) {
  return (
    <li className="flex flex-col gap-1">
      <span
        className="text-[15px] font-medium"
        style={{ color: "var(--ink)" }}
      >
        {t}
      </span>
      <span className="type-body" style={{ fontSize: "0.9375rem" }}>
        {d}
      </span>
    </li>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-medium" style={{ color: "var(--ink)" }}>
      {children}
    </strong>
  );
}
