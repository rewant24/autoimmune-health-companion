---
number: 10
name: Edge-case Templates
slug: edge-case-templates
status: scoped
depends_on: []
blocks: []
owner: rewant
scoping_ref: docs/scoping.md#feature-10-edge-case-templates
adr_refs: []
last_updated: 2026-04-25
---

# Feature 10 — Edge-case Templates

## Intent

Full-screen handlers for the unhappy paths: connection error, transcription fail, save fail, offline, empty Journey. Each is a reusable template that any feature can drop in when its path fails. Scaffolded minimally alongside every feature (starting with Feature 01 Cycle 1 where 1.C has an error slot), and finalized as a polish cycle at the end of the build.

## Scope in / out

- **In (MVP):** 5 templates: connection error, transcription fail, save fail, offline, empty Journey. Each template accepts: heading, body, primary action, secondary action.
- **Out (backlog):** animated illustrations, template theming, contextual error-specific help links, crash reporter integration.

## Dependencies

- **Reads:** none.
- **Blocks:** none.

**Crosscut.** Consumed by every feature. Stubs land in F01 C1; each feature adds its error-slot integrations as it ships; F10 polish cycle finalizes copy + visuals at the end.

## Chunks

Estimated: **1 cycle × 3 chunks = 3 chunks** (finalization only; scaffolding happens per feature).

**First build task = chunking cycle** (dual-track), triggered as the last cycle of the build.

## Review notes
_Empty._

## Learnings
_Empty._
