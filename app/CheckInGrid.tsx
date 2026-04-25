/**
 * 30-day check-in grid — the hero visual.
 *
 * Each dot is a day. Color/size encodes a fictional symptom severity
 * (light = good day, dark = flare). A faint trend line is drawn through
 * the grid on load to suggest "patterns over time." Two designated dots
 * breathe at human-respiratory rate to suggest the product is alive
 * and listening. All animations respect prefers-reduced-motion.
 */

const DAYS = 30;
const COLS = 6;

// Plausible 30-day curve — gentle wave with a small mid-month flare.
const severity: number[] = [
  0.2, 0.25, 0.3, 0.4, 0.35, 0.3,
  0.25, 0.3, 0.45, 0.55, 0.5, 0.4,
  0.35, 0.5, 0.7, 0.85, 0.75, 0.55,
  0.4, 0.35, 0.3, 0.25, 0.3, 0.4,
  0.45, 0.4, 0.3, 0.25, 0.2, 0.2,
];

// Map [0..1] severity to a sage→terracotta color stop.
function colorFor(s: number): string {
  // 0 = pale sage, 0.5 = mid sage, 1 = deep terracotta
  if (s < 0.4) return "#A8C7BD";
  if (s < 0.55) return "#5C8A7F";
  if (s < 0.75) return "#C5856B";
  return "#A6573B";
}

function sizeFor(s: number): number {
  return 14 + s * 6; // 14 → 20px
}

export function CheckInGrid() {
  const rows = Math.ceil(DAYS / COLS);
  const cellW = 48;
  const cellH = 48;
  const width = COLS * cellW;
  const height = rows * cellH;

  // Build polyline points through the grid centers.
  const points = severity
    .map((s, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = col * cellW + cellW / 2;
      // Trend line bobs vertically inside the row by severity.
      const cy = row * cellH + cellH / 2 + (s - 0.5) * 8;
      return `${cx},${cy}`;
    })
    .join(" ");

  return (
    <figure className="flex flex-col gap-5">
      <div
        className="relative rounded-2xl border border-rule bg-bg-elevated p-6 shadow-[0_8px_30px_rgba(31,42,36,0.06)]"
        style={{ background: "var(--bg-elevated)" }}
      >
        {/* Header label inside the card — looks like a real product chip */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "var(--ink-subtle)", fontFamily: "var(--font-mono)" }}
            >
              Last 30 days
            </span>
            <span
              className="mt-0.5 text-sm"
              style={{ color: "var(--ink-muted)" }}
            >
              Symptom check-ins
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full animate-breathe"
              style={{ background: "var(--sage)" }}
              aria-hidden
            />
            <span
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "var(--ink-subtle)", fontFamily: "var(--font-mono)" }}
            >
              Listening
            </span>
          </div>
        </div>

        {/* The grid */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          className="block"
          aria-label="A 30-day calendar where each dot is a daily voice check-in. Color shows symptom severity over time, with a small flare around day 15."
          role="img"
        >
          {/* Trend line — drawn after dots fade in */}
          <polyline
            points={points}
            fill="none"
            stroke="var(--sage-deep)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-line"
          />

          {/* Dots */}
          {severity.map((s, i) => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const cx = col * cellW + cellW / 2;
            const cy = row * cellH + cellH / 2;
            const r = sizeFor(s) / 2;
            const fill = colorFor(s);

            // Designate two dots to "breathe" — last entry (today) and the flare peak (day 16).
            const isLive = i === DAYS - 1 || i === 15;

            return (
              <g
                key={i}
                style={{
                  // Stagger fade-in
                  animationDelay: `${i * 35}ms`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transformBox: "fill-box",
                }}
                className="animate-dot-in"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  className={isLive ? "animate-breathe" : undefined}
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    transformBox: "fill-box",
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "var(--ink-subtle)", fontFamily: "var(--font-mono)" }}
            >
              Calm
            </span>
            <div
              className="h-1.5 w-32 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #A8C7BD 0%, #5C8A7F 45%, #C5856B 75%, #A6573B 100%)",
              }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "var(--ink-subtle)", fontFamily: "var(--font-mono)" }}
            >
              Flare
            </span>
          </div>
          <span
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--ink-subtle)", fontFamily: "var(--font-mono)" }}
          >
            Day 30 · ready for visit
          </span>
        </div>
      </div>

      <figcaption
        className="text-sm italic"
        style={{ color: "var(--ink-muted)", fontFamily: "var(--font-fraunces)" }}
      >
        What 30 days of Saumya looks like — one voice check-in a day, building a
        record you and your doctor can read at a glance.
      </figcaption>
    </figure>
  );
}
