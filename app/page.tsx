export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-6 py-16 sm:py-24">
        <header className="flex flex-col gap-4">
          <p className="text-sm font-medium uppercase tracking-widest text-teal-700 dark:text-teal-400">
            Autoimmune Health Companion
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            A daily health journal for people living with autoimmune conditions — so your next doctor visit starts with data, not memory.
          </h1>
        </header>

        <section className="flex flex-col gap-5 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          <div className="flex gap-3">
            <span aria-hidden className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
            <p>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Daily check-in under 60 seconds.</span>{" "}
              Pain, stiffness, mood, energy. No jargon. No friction.
            </p>
          </div>
          <div className="flex gap-3">
            <span aria-hidden className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
            <p>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Patterns you&apos;d never spot alone.</span>{" "}
              Medication, symptoms, sleep, and flareups — plotted together over time.
            </p>
          </div>
          <div className="flex gap-3">
            <span aria-hidden className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
            <p>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">A one-tap doctor report.</span>{" "}
              Every 30 days, everything they need to ask better questions.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Join the waitlist
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              We&apos;ll email you when early access opens.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg">
            <iframe
              src="https://docs.google.com/forms/d/e/1FAIpQLSex-kdpv3Z5xuiI5zjNDwIq2wU0vVOeyn-lQB0gbodYdxmkCw/viewform?embedded=true"
              width="100%"
              height="520"
              frameBorder={0}
              marginHeight={0}
              marginWidth={0}
              title="Autoimmune Health Companion — waitlist signup"
            >
              Loading…
            </iframe>
          </div>
        </section>

        <footer className="flex flex-col gap-1 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          <p>Built as part of the AI Weekender challenge.</p>
          <p>Not medical advice. Talk to your doctor about any health decisions.</p>
        </footer>
      </main>
    </div>
  );
}
