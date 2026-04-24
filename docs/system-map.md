# Sakhi — System Map

> **Living document.** Updated after every shipped cycle. See also: [build-plan.md](build-plan.md) Section 9A.

**Maintenance rule:** after every cycle ships, update this file:
- Feature dependency diagram — mark shipped features with `:::shipped` style.
- Cycle status diagram — highlight which phase is current.
- Docs topology — add new feature MDs as they scaffold.

---

## Map 1 — Feature dependency graph

Shows what depends on what, and which features are parallel-safe. Arrows flow from prerequisites to dependents.

```mermaid
graph TD
    F01[01 Daily Check-in<br/>voice + 5 metrics]
    F02[02 Memory<br/>30d scroll + filters]
    F03[03 Patterns<br/>14d+ chart]
    F04[04 Medications<br/>regimen + adherence]
    F05[05 Doctor Visits<br/>events + bloods]
    F06[06 Doctor Report<br/>hybrid PDF]
    F07[07 Prep-for-Visit<br/>checklists + Qs]
    F08[08 Journey<br/>aggregation]
    F09[09 Community<br/>parallel-safe]:::parallel
    F10[10 Edge Templates<br/>crosscut]:::crosscut

    F01 --> F02
    F01 --> F03
    F01 --> F04
    F01 --> F05
    F02 --> F06
    F03 --> F06
    F04 --> F06
    F05 --> F06
    F05 --> F07
    F06 --> F07
    F02 --> F08
    F03 --> F08
    F05 --> F08
    F06 --> F08

    classDef parallel fill:#dff0ff,stroke:#4a90d9
    classDef crosscut fill:#fff0dd,stroke:#d99a4a
    classDef shipped fill:#d7f5d4,stroke:#4aa843
```

**Legend:** blue = parallel-safe (no data deps, can run any phase). Amber = crosscut (stubs scaffolded with every feature, finalized last). Green (when applied) = shipped.

---

## Map 2 — Sub-agent topology per cycle

Shows which agents fire in parallel, which fire solo, and the dispatch boundaries.

```mermaid
graph LR
    O[Orchestrator<br/>Claude Code main]

    subgraph BuildMsg["Build dispatch — 1 multi-tool-call message"]
        BA[Build-A<br/>chunk N.A]
        BB[Build-B<br/>chunk N.B]
        BC[Build-C<br/>chunk N.C]
    end

    INT[Integrate slices]

    subgraph ReviewMsg["Review dispatch — 1 multi-tool-call message"]
        R1[Reviewer-1<br/>Brief alignment]
        R2[Reviewer-2<br/>Spec + regression]
        R3[Reviewer-3<br/>Edge cases]
    end

    FIX[Fix list applied]
    SP[Second-pass Reviewer<br/>1–2 missed items]
    SHIP[Shipped + changelog]

    O --> BA
    O --> BB
    O --> BC
    BA --> INT
    BB --> INT
    BC --> INT
    INT --> R1
    INT --> R2
    INT --> R3
    R1 --> FIX
    R2 --> FIX
    R3 --> FIX
    FIX --> SP
    SP --> SHIP
```

---

## Map 3 — Chunking cycle (F03–10) — dual track

Agent drafts + 3-reviewer-subagent check + Rewant review all run in parallel, then merge.

```mermaid
graph LR
    PA[Plan subagent<br/>drafts feature MD]

    subgraph ParallelReview["Parallel review — same multi-tool-call message"]
        CR1[Reviewer-1<br/>brief alignment]
        CR2[Reviewer-2<br/>spec + regression]
        CR3[Reviewer-3<br/>edge cases]
        HR[Rewant reads draft]
    end

    MRG[Merge findings<br/>into fix list]
    APP[Agent applies fixes]
    RDY[Feature → ready<br/>joins build queue]

    PA --> CR1
    PA --> CR2
    PA --> CR3
    PA --> HR
    CR1 --> MRG
    CR2 --> MRG
    CR3 --> MRG
    HR --> MRG
    MRG --> APP
    APP --> RDY
```

---

## Map 4 — Status lifecycle

The states every feature and chunk flows through.

```mermaid
stateDiagram-v2
    [*] --> scoped
    scoped --> chunked: chunking cycle
    chunked --> ready: subagent review + Rewant review merged
    ready --> building: 3 builders dispatched
    building --> in_review: slices integrated
    in_review --> fixing: review findings
    fixing --> second_review: re-reviewer dispatched
    second_review --> shipped: all green
    second_review --> fixing: more issues found
    shipped --> learned: post-ship entry appended
    learned --> [*]
```

---

## Map 5 — Docs topology

Where every doc lives and how they relate. Canonical docs on the left; generated / maintained docs on the right.

```mermaid
graph TD
    SC[docs/scoping.md<br/>Rewant-authored canon]
    ADR[docs/architecture-decisions.md<br/>append-only ADRs]
    PMB[docs/post-mvp-backlog.md<br/>deferred items]
    VB[Appendix B in build-plan<br/>verbatim brief]

    BP[docs/build-plan.md<br/>active plan]
    SM[docs/system-map.md<br/>this file]
    PT[docs/product-taxonomy.md<br/>capability map]
    TS[docs/tech-stack.md<br/>version ledger]

    FR[docs/features/README.md<br/>index + template]
    F01MD[01-daily-checkin.md]
    F02MD[02-memory.md]
    FNMD[03–10 stubs]

    CHG[docs/architecture-changelog.md<br/>dated changes]
    BL[docs/build-log.md<br/>session chronicle]

    SC --> BP
    VB --> BP
    BP --> FR
    BP --> SM
    BP --> PT
    BP --> TS
    FR --> F01MD
    FR --> F02MD
    FR --> FNMD
    F01MD -.refs.-> ADR
    F02MD -.refs.-> ADR
    F01MD -.logged in.-> CHG
    F02MD -.logged in.-> CHG
    BP -.session entry.-> BL
    PMB -.deferred items.-> FR
```
