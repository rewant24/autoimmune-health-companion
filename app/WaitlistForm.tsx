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
        className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100"
      >
        {status.alreadyOnList
          ? "You're already on the list — we'll email you when early access opens."
          : "You're on the list. Watch your inbox — we'll email you when early access opens."}
      </div>
    );
  }

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
        disabled={status.kind === "submitting"}
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="rounded-lg bg-teal-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
      >
        {status.kind === "submitting" ? "Joining…" : "Join waitlist"}
      </button>
      {status.kind === "error" && (
        <p
          role="alert"
          className="text-sm text-red-700 sm:basis-full dark:text-red-400"
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
