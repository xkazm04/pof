---
name: diablo
description: Long-running LEARNING loop that breaks Diablo I (1996) down through PoF's catalog pipelines and replicates it toward UE — not to ship a game, but because every place PoF cannot hold, derive or produce what a complete shipped ARPG needed is an adjustment worth making. Phase A resolves the ingest backlog; Phase B replicates the game in dependency-ordered WAVES, each ending at a HUMAN GATE (never auto-proceeds). The dependency chronology ("we cannot create X without Y"), the adjustment ledger and all wave state live in the Obsidian vault (Diablo/). Invoke with /diablo [next | status | backlog | path | gate | ingest].
version: 1.3
---

# /diablo — replicate a shipped ARPG to find out what PoF is missing

**The product of this loop is the adjustments, not the remake.** The operator expects hundreds
to thousands of them before PoF can break Diablo I down and rebuild it in UE, and then the
project is deleted. So a wave that ends with "we could not, because X" and a precise X is a
successful wave. A wave that papers over X to look finished is the only real failure.

> **Licence (decided 2026-09-22 by the operator):** reference-only learning exercise; no
> remake ships; the project is deleted at the end. Provenance and the per-row licence note stay
> on every ingested entity anyway — they are how an ingested value is told apart from a
> designed one, which the loop needs regardless of licence.

> **Engine vs. memory.** This file is the engine. Memory is the Obsidian vault
> `C:/Users/kazda/Documents/Obsidian/pof/Diablo/` — **read `Diablo.md` first, every session.**
> It holds `State.md` (resume point), `Backlog.md`, `Path/` (the dependency graph — the
> "chronology of game making"), `Waves/` (one note per wave), `Adjustments.md` (the ledger)
> and `Findings.md` (defects in the SOURCE data, not in PoF).

## The tools (never eyeball, never re-derive)

```bash
ROOT="C:/Users/kazda/kiro/reference/devilutionX/assets/txtdata"   # sparse clone, pinned (see State.md)
npx tsx scripts/diablo/ingest.ts --root "$ROOT"                           # wrap every mapped table (idempotent)
npx tsx scripts/diablo/ingest.ts --root "$ROOT" --promote bestiary --ids d1-MT_NZOMBIE,…   # promote a wave's slice
npx tsx scripts/diablo/status.ts [--json]                                 # the GATE snapshot + coverage trend
```

- **Library:** `src/lib/catalog/reference/` (wrappers, techniques, sources, links, census, store,
  promotion) and `src/lib/catalog/ingest/` (TSV reader, `FieldMap` audit, decoders, the Diablo
  mapping in `diablo1.ts`). Tables are registered in `reference/sources.ts` → `DIABLO1.tables`.
- **A wrapper keeps the raw source row and its current projection apart.** Every mapping
  adjustment is a re-projection: the store reports `created · rawChanged · reprojected ·
  unchanged` per run, and `status.ts` shows the coverage trend across runs. An adjustment that
  does not move one of those numbers did nothing measurable — say so.
- **Pipelines** are driven through pof-mcp (`pof_get_pipeline`, `pof_get_step`,
  `pof_submit_artifact`, `pof_get_acceptance`, `pof_list_entities`) or the `/layout` lab, where
  promoted entities appear with an **INGEST** tag (provenance in its tooltip).
- **UE** is at `C:/Users/kazda/Documents/Unreal Projects/PoF` (schema lives there: `F*Row`
  structs, `UARPGItemDefinition`, `ARPGAttributeSet`, `ARPGAffixTypes`, `GE_DifficultyScaling`).

## BOOT (every session)

1. Read the vault: `Diablo.md` → `State.md` → `Backlog.md` → `Path/Index.md` → the newest
   `Waves/` note. Read `.claude/fleet-memory.md` (repo law). Obey `State.md`'s `status`:
   **`awaiting-gate` means the operator has not answered — ask, do not proceed.**
2. `cd` nowhere; run `ingest.ts` then `status.ts`. A non-zero **`rawChanged`** means the upstream
   data moved under the wrappers: record it in `Findings.md` and understand it before anything else.
3. State the resume point in one line to the operator, then act on the argument:
   `next` (default) · `status` (snapshot only) · `backlog` (Phase A only) · `path` (print the
   ready frontier) · `gate` (re-present the open gate) · `ingest` (re-ingest + report only).

## Phase A — resolve the backlog

`Backlog.md` lists every item with `status: open | done | decision | descoped`.
- **S/M items with an obvious fix** → TDD, one commit each (`diablo: <item> — …`), mark `done`,
  add an `Adjustments.md` line with the measured effect.
- **`decision` items** (a schema choice, a new catalog, a genre assumption) are never decided by
  the loop. Collect them; when only decisions remain, go to the GATE with a recommendation for each.
- New defects found while working are ADDED to the backlog with evidence — the list is allowed
  to grow; that is the point.

## Phase B — replicate in waves

A **wave** is one coherent slice that can be reviewed in one sitting: a style decision, a
family of entities through their pipelines, one system. Never "all 112 monsters".

1. **Pick** from the ready frontier: a `Path/` node whose `requires:` are all `done`. Prefer the
   node that unblocks the most others. Write `Waves/W<NN>-<slug>.md` (goal, nodes, entities, the
   expected numbers BEFORE running anything).
2. **Look at the data first.** For any table the wave touches, read its value census (the
   ingest summary flags undecoded sentinels; `censusTable` gives the rest). Every Diablo mapping
   defect so far — `spell = Null` ×142, `treasure = None`, `bookLevel = -1`, flag lists in one
   cell — was a vocabulary nobody had looked at.
3. **Map.** Extend `diablo1.ts` / add a table to `DIABLO1.tables`. Every column classified
   (`mapped` / `dropped` with a reason / `gap` with a reason); `unclassified` is a defect. Pin
   the real upstream header in the mapping test (column NAMES only — values never enter the repo).
4. **Promote only the wave's slice**, then drive its pipelines. Record every step that fails,
   defers, or needs a field the entity cannot supply.
5. **Forge the path.** Each "cannot do X without Y" becomes (or extends) a `Path/` node with the
   evidence (file:line, the failing step, the missing field). New prerequisites are discovered,
   not planned — the graph is supposed to grow.
6. **Measure.** `status.ts` before/after; write the deltas into the wave note and `Adjustments.md`.
7. **GATE — stop.** Set `State.md` `status: awaiting-gate`, then ask the operator with the
   question tool: what landed, what the snapshot says, the decisions needed (each with a
   recommendation), and the proposed next wave. Options: continue as proposed · continue with
   changes · re-do this wave · stop. **Never emit `FLEET:NEXT` at a gate** — the orchestrator may
   auto-answer it, which is exactly what a human gate exists to prevent.

## Delegating to Codex (executor) — Claude oversees

Large volumes of well-specified work go to codex-cli; judgment stays here.

```bash
npx tsx scripts/codex/dispatch.ts run <task.json>          # own worktree + branch codex/<id>
npx tsx scripts/codex/dispatch.ts diff <id>                # review
npx tsx scripts/codex/dispatch.ts resume <id> "<precise follow-up>"   # same session, full context
npx tsx scripts/codex/dispatch.ts land <id>                # apply to main tree (NOT committed)
npx tsx scripts/codex/dispatch.ts record <id> --verdict … --class <taskClass> --notes "…"
npx tsx scripts/codex/dispatch.ts discard <id> · stats · list
```

Task files live in the vault (`Diablo/Codex/tasks/<id>.json`, shape = `CodexTask` in
`src/lib/codex-exec/brief.ts`); the ledger is `Diablo/Codex/ledger.jsonl`.

**Routing (operator policy, `src/lib/codex-exec/routing.ts`):** `bulk` → `gpt-5.6-sol` low/medium ·
`complex` → `gpt-5.6-sol` high (xhigh when hardest) · `visual` (2D/3D understanding & design) →
`gpt-6-astra` medium/high. The visual tier is a HYPOTHESIS: Astra's "best at 3D" claim rests on one
vendor number that GameEngineBench inverts. Grade its output with PoF's own gates (vision critique,
mesh/rig gates), never its self-report.

| Delegate | Keep with the overseer |
|---|---|
| a table's mapping AFTER its census has been read and the destinations decided | gate decisions, Path evidence, `State.md`, the backlog's status |
| decoders, lib hardening, tests, script plumbing with acceptance commands | canon/law choices, D-decisions, registry deviations |
| N independent tables/entities in parallel — one task each | promote/demote (writes the operator's DB), anything in the UE project |
| image critique / art-direction review (`visual`, read-only) | commits (always pathspec), fleet memory |
| 2D/3D prompt or spec DRAFTS (`visual`, design) — returned as proposals | deciding a wave is done |

**Oversight protocol (every task):**
1. Brief = goal + read-first + SCOPE + acceptance commands (+ images). Codex reads no CLAUDE.md, no
   vault — every law it must obey travels in the brief (`REPO_LAWS`).
2. Review the diff: any REMOVED line in an existing test is a red flag; `land` warns on out-of-scope
   files; a disclosed, justified deviation is fine, an undisclosed one is a revision.
3. Re-run the acceptance commands YOURSELF — its report is a claim. Then check real-data behaviour
   (re-ingest: `unchanged` means nothing moved that should not have).
   Read vitest's `Errors` line, not only `FAIL`: an unhandled rejection fails the RUN while every
   file passes. A delegate's "unrelated" / "pre-existing" is a claim too — reproduce it on master.
4. Accept → `land`, commit with a pathspec (name the task id + model in the message). Otherwise
   `resume` with a precise instruction; after 2 follow-ups, take it over or re-tier it.
5. `record` the verdict with a task CLASS, then `discard`.

**Calibration (the "independent vs needs instructions" answer):** `dispatch.ts stats` gives first-pass
and accepted rates per tier · model · class. ≥ 80 % first-pass over ≥ 5 tasks → shorter briefs and
parallel batches are fine for that class; < 50 % → longer brief with a worked example, a higher
tier, or keep it in-house. Up to ~3 write tasks in parallel (shared `node_modules`, CPU).

**Environment facts (probed 2026-09-22, codex-cli 0.155.1 — encoded in `src/lib/codex-exec/args.ts`):**
stdin must be closed or `exec` hangs; `-i` is variadic so the prompt is fenced by `--`; long briefs go
via stdin (`-- -`); Windows `workspace-write` refuses child processes (vitest `spawn EPERM`), so write
tasks use `--approve-for-me` (sandbox kept, escalations auto-reviewed) — never the bypass flag;
`--approve-for-me` excludes `-s`; `resume` inherits the session's access and accepts `--output-schema`;
a fresh worktree needs the `node_modules` junction and the generated pipeline registry (the dispatcher
does both); remove the junction with `rmdir`, never recursively.

## Forging the Path (the chronology of game making)

One note per node in `Path/`, frontmatter:

```yaml
kind: style | system | content | data | capability
status: open | ready | in-progress | done | blocked
requires: ["[[Style - Art Direction]]", "[[Data - Ingest Foundation]]"]
evidence: "why this dependency is real — file:line, failing step, missing field"
```

A dependency is written down only with evidence (a failing step, a missing field, a prompt that
had nothing to cite). "Feels like it comes first" is not evidence. When a node completes, append
one line to `Path/Index.md`'s **Chronology** (date · node · what made it done), so the order
PoF actually needed things in is recoverable later — that sequence is a finding in itself.

## Laws

- **Values never enter the repo.** Mappings, column names, tests with real HEADERS: yes. Rows: no.
- **Promote selectively.** The wrapper store holds the whole game; the lab shows only what a
  wave is reviewing.
- **Schema flows down from UE** (canon `proj-sot`). If an ingested field has no home, first check
  whether UE already has it (it usually does: slots, resistances, affixes, difficulty scaling) —
  then the adjustment is aligning the app to UE, and that choice goes to the gate.
- **Consult the registry BEFORE a design decision, not after.** Resolve the governing subjects
  through `.ai/registry-map.json` / `knowledge/<domain>/index.json` (for this loop at least
  `import-normalization` and `reference-parity-gating`). Where the chassis falls short, record a
  deviation in `Backlog.md` § registry deviations — never lower the standard to fit the code.
  Parity law for Phase B: a step SEEDED from the reference is never graded `pass` for matching the
  reference; parity is measured by a tool that reads both sides through the same pipeline.
- **Never weaken a checker or a mapping to make a number move.** Coverage rises by mapping a
  column correctly, never by reclassifying a gap as a drop.
- **Commit with a pathspec**, never push (repo law). One `diablo:` commit per backlog item or wave.
- **Stop at every gate.** Phase A may run several S/M items between gates; Phase B never runs
  two waves without the operator.

## Reflection

At the end of each session append to `LESSONS.md` beside this file only what would change how
the loop runs (a new trap, a better measurement). Project facts go in the vault, not here.
