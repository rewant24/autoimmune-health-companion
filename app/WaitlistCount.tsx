"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

type Variant = "warm" | "calm";

export function WaitlistCount({ variant = "warm" }: { variant?: Variant }) {
  const count = useQuery(api.waitlist.count);

  // Show nothing while loading to avoid layout flash, then show evergreen copy
  // until we have a meaningful count.
  if (count === undefined) {
    return <span className="invisible">placeholder</span>;
  }

  const text =
    count === 0
      ? "Be among the first to try Saha."
      : count === 1
        ? "1 person on the list."
        : `${count.toLocaleString()} people on the list.`;

  if (variant === "calm") {
    return (
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
        {text}
      </span>
    );
  }

  return (
    <span className="text-sm text-teal-800/80 dark:text-teal-300/80">
      {text}
    </span>
  );
}
