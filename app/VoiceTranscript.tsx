/**
 * Voice transcript mock — the signature element.
 *
 * Shows the product's actual differentiator: speech in, structured data out.
 * Three lines of plausible check-in transcript with extracted entities
 * highlighted. Below: a strip of the chips Sakhi would have captured.
 *
 * No real audio — this is a static, accessible visual representation.
 */

const TRANSCRIPT = [
  {
    text: "Pain in my hands today, maybe a ",
    highlight: "4 out of 10",
    rest: ".",
    type: "pain" as const,
  },
  {
    text: "Started the new ",
    highlight: "methotrexate",
    rest: " dose yesterday.",
    type: "med" as const,
  },
  {
    text: "Slept maybe ",
    highlight: "six hours",
    rest: ", woke up around four.",
    type: "sleep" as const,
  },
];

const HIGHLIGHT_BG: Record<"pain" | "med" | "sleep", string> = {
  pain: "rgba(197, 133, 107, 0.18)",     // terracotta wash
  med: "rgba(92, 138, 127, 0.18)",        // sage wash
  sleep: "rgba(232, 201, 168, 0.32)",     // sand wash
};

const HIGHLIGHT_TEXT: Record<"pain" | "med" | "sleep", string> = {
  pain: "#A6573B",
  med: "#2F5A52",
  sleep: "#7B5B3A",
};

const CHIPS = [
  { label: "Pain · 4/10", type: "pain" as const },
  { label: "Methotrexate · new dose", type: "med" as const },
  { label: "Sleep · 6h", type: "sleep" as const },
];

export function VoiceTranscript() {
  return (
    <figure className="flex flex-col gap-5">
      <div
        className="relative rounded-2xl border p-6 shadow-[0_8px_30px_rgba(31,42,36,0.06)]"
        style={{
          borderColor: "var(--rule)",
          background: "var(--bg-elevated)",
        }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full animate-breathe"
              style={{ background: "var(--sage)" }}
              aria-hidden
            />
            <span className="type-label">Recording · 0:47</span>
          </div>
          <span className="type-label">Today · 8:14am</span>
        </div>

        {/* Animated waveform — small, sits above the transcript */}
        <div className="mb-5 flex h-9 items-center justify-center gap-[3px]" aria-hidden>
          {Array.from({ length: 32 }).map((_, i) => {
            // Pseudo-natural amplitude pattern
            const heights = [
              0.3, 0.5, 0.7, 0.9, 0.6, 0.4, 0.5, 0.8, 0.95, 0.7,
              0.5, 0.3, 0.45, 0.65, 0.85, 0.5, 0.4, 0.3, 0.55, 0.75,
              0.9, 0.6, 0.4, 0.3, 0.5, 0.7, 0.85, 0.6, 0.4, 0.3, 0.4, 0.5,
            ];
            const h = heights[i % heights.length];
            return (
              <span
                key={i}
                className="block w-[3px] rounded-full animate-wave"
                style={{
                  height: `${h * 100}%`,
                  background: "var(--sage)",
                  opacity: 0.55 + h * 0.45,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            );
          })}
        </div>

        {/* Transcript lines */}
        <div className="flex flex-col gap-3">
          {TRANSCRIPT.map((line, i) => (
            <p
              key={i}
              className="type-body animate-fade-up"
              style={{
                color: "var(--ink)",
                animationDelay: `${0.4 + i * 0.25}s`,
              }}
            >
              {line.text}
              <span
                className="rounded-md px-1.5 py-0.5 font-medium"
                style={{
                  background: HIGHLIGHT_BG[line.type],
                  color: HIGHLIGHT_TEXT[line.type],
                }}
              >
                {line.highlight}
              </span>
              {line.rest}
            </p>
          ))}
        </div>

        {/* Captured strip */}
        <div
          className="mt-6 flex flex-col gap-3 border-t pt-5"
          style={{ borderColor: "var(--rule)" }}
        >
          <span className="type-label" style={{ color: "var(--sage-deep)" }}>
            → Captured automatically
          </span>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((chip, i) => (
              <span
                key={chip.label}
                className="rounded-full border px-3 py-1 text-xs animate-fade-up"
                style={{
                  borderColor: HIGHLIGHT_TEXT[chip.type],
                  color: HIGHLIGHT_TEXT[chip.type],
                  background: HIGHLIGHT_BG[chip.type],
                  animationDelay: `${1.3 + i * 0.15}s`,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.02em",
                }}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="type-body italic-soft">
        Speak naturally. Sakhi pulls the structure.
      </figcaption>
    </figure>
  );
}
