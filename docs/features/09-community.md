---
number: 09
name: Community
slug: community
status: scoped
depends_on: []
blocks: []
owner: rewant
scoping_ref: docs/scoping.md#feature-9-community
adr_refs: []
last_updated: 2026-04-25
---

# Feature 09 — Community

## Intent

Slack-style peer channels. Auto-created from the AARDA (American Autoimmune Related Diseases Association) condition list. Text-only, pseudonymous posting. Rewant-admin for MVP. Single-select condition per user for MVP; multi-select deferred. Reduces the loneliness of chronic illness (per user research).

## Scope in / out

- **In (MVP):** AARDA-seeded channels, pseudonymous user identity, text-only messages, rewant-admin moderation view, single-select condition.
- **Out (backlog):** images/attachments, DMs, multi-select conditions, sub-channels, community-elected moderators, advanced Community features.

## Dependencies

- **Reads:** user profile (condition selection).
- **Blocks:** none.

**Parallel-safe.** This feature has no data dependencies and can run during any phase's review wait window.

## Chunks

Estimated: **2 cycles × 3 chunks = 6 chunks.**

**First build task = chunking cycle** (dual-track).

## Review notes
_Empty._

## Learnings
_Empty._
