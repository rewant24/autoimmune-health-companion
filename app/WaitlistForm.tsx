"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; alreadyOnList: boolean }
  | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm() {
  const addEmail = useMutation(api.waitlist.addEmail);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({ kind: "error", message: "Please enter a valid email address." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      const result = await addEmail({ email: trimmed });
      setStatus({ kind: "success", alreadyOnList: result.alreadyOnList });
      setEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Try again?";
      setStatus({ kind: "error", message });
    }
  }

  if (status.kind === "success") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border px-5 py-4"
        style={{
          background: "var(--sage-soft)",
          borderColor: "var(--sage-deep)",
          color: "var(--sage-deep)",
        }}
      >
        <span
          aria-hidden
          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full animate-breathe"
          style={{ background: "var(--sage-deep)" }}
        />
        <p
          className="text-[15px] leading-[1.55]"
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontVariationSettings: "'SOFT' 100, 'opsz' 24, 'wght' 420",
            fontStyle: "italic",
          }}
        >
          {status.alreadyOnList
            ? "You're already on the list — we'll email you when early access opens."
            : "You're on the list. We'll email you when early access opens."}
        </p>
      </div>
    );
  }

  const isSubmitting = status.kind === "submitting";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        type="email"
        name="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status.kind === "error") setStatus({ kind: "idle" });
        }}
        disabled={isSubmitting}
        className="flex-1 rounded-xl border px-4 py-3 text-base outline-none transition-colors focus:ring-2 disabled:opacity-60"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--rule)",
          color: "var(--ink)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          // Custom focus visuals via CSS vars on a real ring color
          boxShadow: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--sage-deep)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(47, 90, 82, 0.18)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--rule)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-xl px-5 py-3 text-base transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: "var(--sage-deep)",
          color: "var(--bg-elevated)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontWeight: 500,
          letterSpacing: "-0.005em",
          boxShadow: "0 1px 0 rgba(31, 42, 36, 0.04), 0 6px 18px rgba(47, 90, 82, 0.16)",
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting) e.currentTarget.style.background = "var(--ink)";
        }}
        onMouseLeave={(e) => {
          if (!isSubmitting) e.currentTarget.style.background = "var(--sage-deep)";
        }}
      >
        {isSubmitting ? "Joining…" : "Join waitlist"}
      </button>
      {status.kind === "error" && (
        <p
          role="alert"
          className="text-[14px] leading-[1.5] sm:basis-full"
          style={{ color: "#A6573B" }}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
