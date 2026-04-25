# Saha

A voice-first health companion for people living with autoimmune conditions.

> *Saha* (सह) — Sanskrit, two meanings at once: *to endure* and *with*. Because autoimmune is a long carry, and you don't carry it alone. Saha holds the days you can't, and walks beside the days you can.

**Live:** https://saha-health-companion.vercel.app

## What it does

- **Daily check-in under 60 seconds** — pain, stiffness, mood, energy, meds
- **Patterns you'd never spot alone** — medication, symptoms, sleep, flareups plotted together over time
- **A one-tap doctor report** — every 30 days, everything they need to ask better questions

## Stack

- Next.js 16 (App Router, Turbopack) + Tailwind 4
- Convex (backend + realtime DB)
- Vercel (hosting)

Built as part of the [AI Weekender Builder Handbook](https://growthx.club/docs/ai-weekender-builder-handbook) weekender challenge. Status: **Day 2 — waitlist live, scoping + POC in progress.**

## Local dev

```bash
npm install
npx convex dev        # in one terminal — runs the Convex backend
npm run dev           # in another — runs Next.js at localhost:3000
```
