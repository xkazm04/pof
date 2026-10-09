---
name: zelda
description: Long-running LEARNING loop that reads The Legend of Zelda - Breath of the Wild through the zeldaret/botw C++ decompilation (reference only, at a pinned commit) into PoF's catalog/module structure, to learn which PoF modules need a design or feature upgrade. Derived from /diablo v1.3, but autonomous - one '/zelda next' runs exactly ONE wave, records its own decisions as reversible, and resumes from the vault's State.md. Terminates when every botw src file is covered by an ingest spec or descoped with a reason AND a full round moves nothing. Every upgrade finding becomes a note in the vault's Zelda/Upgrades/. Invoke with /zelda [next | status | ingest].
version: 1.0
---

# /zelda — read a systemic open-world game to find out what PoF's modules are missing

**The product of this loop is the upgrade findings, not an ingest.** Breath of the Wild is the
opposite design pole from Diablo: a systemic open world (chemistry, physics-driven interaction, a
stamina-gated traversal kit, cooking, weather, a weapon economy that breaks). Every place a PoF
module or catalog has no home for one of its systems is a design or feature upgrade worth knowing.
A wave that ends with "PoF has no place for X, evidence `src/…` at the pin, proposed upgrade Y" is a
successful wave. A wave that maps X onto a field that cannot really hold it, to look covered, is
the only real failure.

> **Licence (operator, 2026-10-09):** zeldaret/botw is a Nintendo-derived decompilation.
> Reference only — **no code, identifier, string or number from it enters the PoF repo.** The repo
> may carry: the pinned commit, PATH globs over the tree (in spec and descope lists — its structure,
> the way /diablo carries column names), and PoF's own analysis. Extracted records live only in the
> wrapper store (`~/.pof/pof.db`) and in the vault. Tests use synthetic C++ written by hand.

> **Engine vs. memory.** This file is the engine. Memory is the Obsidian vault
> `C:/Users/kazda/Documents/Obsidian/pof/Zelda/` — **read `Zelda.md` first, every session.** It holds
> `State.md` (pin, status, resume point, termination numbers), `Backlog.md`, `Coverage.md` (the whole
> src tree broken into PoF's structure), `Path/` (the dependency graph), `Waves/` (one note per wave),
> `Adjustments.md`, `Findings.md` (defects in the SOURCE or the reader), `Decisions.md` (every
> decision the loop took, each reversible) and `Upgrades/` (one note per PoF upgrade finding).
> The vault has no undo: create new notes, append to the loop's own notes, never rewrite a note the
> loop did not create.

## The tools (never eyeball, never re-derive)

```bash
ROOT="C:/Users/kazda/kiro/reference/botw"       # blobless sparse clone (src + data), pinned in State.md
npx tsx scripts/zelda/ingest.ts --root "$ROOT"  # wrap every mapped spec (idempotent) + store report
npx tsx scripts/zelda/status.ts --root "$ROOT" [--json] [--depth N]   # coverage per area, trend, STOP rule
npx tsx scripts/zelda/coverage-rows.ts --root "$ROOT" [--all]  # re-derive Coverage.md rows from its globs + partition check
```

- **Library:** `src/lib/catalog/ingest/cppDecls.ts` (the `cpp-decls` reader — record shape documented
  there), `src/lib/catalog/ingest/botw.ts` (the pin, the class maps per area, `BOTW_DESCOPES`),
  `src/lib/catalog/reference/sources.ts` → `BOTW.tables` (one GLOB spec per mapped area),
  `src/lib/catalog/reference/pathCoverage.ts` (globs, covered/descoped/open, `terminationVerdict`).
- **A wrapper keeps the raw record and its current projection apart** (shared with /diablo). Every
  mapping adjustment is a re-projection: the store reports `created · rawChanged · reprojected ·
  unchanged` per run. An adjustment that moves none of those numbers did nothing measurable — say so.
- **Coverage is derived, never written down.** `status.ts` walks the clone's `src/` at the pin and
  classifies every file: covered (a spec glob reads it), descoped (a `BOTW_DESCOPES` glob, with its
  reason), or open. Both tools REFUSE a missing root and a clone whose HEAD is not the pin.
- **Wrap only, for the loop's whole life** (vault Decisions Z-D9, App Master 2026-10-09). Nothing is
  promoted into `catalog_entities` and no `botw` canon profile is registered: the product is upgrade
  findings, and a promoted entity would carry botw-derived names into produce prompts against the
  reference-only rule. Only the operator can reverse this.

## BOOT (every session)

1. Read the vault: `Zelda.md` → `State.md` → `Backlog.md` → `Coverage.md` → `Path/Index.md` → the
   newest `Waves/` note. Read `.claude/fleet-memory.md` (repo law). If `State.md` says
   `status: done`, print the final coverage histogram and stop.
2. **Check the pin.** `git -C "$ROOT" rev-parse HEAD` must equal `BOTW_PIN` (`ingest/botw.ts`) and
   `State.md`'s pin, and the clone must be clean. If not, **refuse**: record it in `Findings.md`,
   set nothing else, and end the session. A moved reference invalidates every count.
3. Run `ingest.ts` then `status.ts`. A non-zero **`rawChanged`** means the records moved under the
   wrappers (a reader change or a moved tree): record it in `Findings.md` and understand it first.
4. Act on the argument: `next` (default — run ONE wave) · `status` (snapshot only) · `ingest`
   (re-ingest + report only).

## One wave (`/zelda next`)

A **wave** is one coherent slice: one area of ≤ ~400 files, one reader upgrade, or one descope sweep.
Waves proceed on their own — **there is no GATE, no question tool and no `FLEET:NEXT`.** One
invocation runs exactly one wave and ends with `State.md` updated, so the next invocation resumes.

1. **Pick** from `State.md`'s resume point, else the `Backlog.md` top, else the largest OPEN row of
   `Coverage.md` that maps to an existing PoF home. Prefer the slice that unblocks a `Path/` node.
2. **Write `Waves/W<NN>-<slug>.md` BEFORE running anything** — goal, the area's glob, the PoF home,
   and PREDICTED numbers (files, records, created/unchanged, coverage counts after). Precise enough
   to fail.
3. **Look at the data first.** Read the area's records in the store (`reference_wrappers`, by SQL or
   `listWrappers`) and the reader's census — never paste them into the repo.
4. **Map or descope.** A spec is a glob + a `botwClassMap(...)` in `ingest/botw.ts`, every column
   classified (`mapped` / `dropped` with a reason / `gap` with a reason); `unclassified` is a defect.
   A descope is a glob + a reason in PoF's own words, and only when sure (engine infrastructure UE
   already provides, platform services, build files). Doubt stays OPEN.
5. **Learn.** Read the records against the PoF module / catalog the area maps to
   (`src/lib/module-registry.ts`, `src/lib/catalog/pipelines/`). Each finding goes to exactly one place:
   - a PoF module or catalog needs a design or feature upgrade → **one note in `Upgrades/`** (format below);
   - "PoF cannot do X without Y" → a `Path/` node with evidence;
   - a defect in the reference or in the reader → `Findings.md`;
   - a measured change to PoF's mapping/reader → `Adjustments.md`.
6. **Measure.** `ingest.ts` + `status.ts`; write the real numbers against the predictions into the
   wave note, and the store report into `Adjustments.md` when the mapping moved.
7. **Decide and record.** Where /diablo would stop at a gate, /zelda takes its own recommendation,
   writes it to `Decisions.md` as `Z-D<n>` (decision · why · how to reverse), and continues.
   Stop and leave the decision OPEN only for what the repo law reserves to a human (scope change,
   spend, money/data risk, a goal conflict, a recipe failing three runs straight) — set
   `State.md` `status: blocked` with the question.
8. **Wrap.** Update `State.md` (resume point = the next wave's first item; termination numbers),
   `Coverage.md` rows, `Backlog.md`. Commit the repo change with a pathspec (`zelda: W<NN> …`).

## Goal-2 output — upgrade notes

Every finding that a PoF module needs a design or feature upgrade is one note
`Upgrades/U<NNN>-<slug>.md`:

```yaml
module: <module id from module-registry, or catalog id from catalog/pipelines>
kind: design | feature | new-module
size: S | M | L | XL
evidence: "src/<path> @ <pin, 7 chars>"   # paths only; describe the shape in PoF's words
status: proposed
```

Body: what botw shows (in PoF's words, no quoted code), what PoF has today, the proposed upgrade,
and its size. The run's `result.json` lists every new upgrade note as a question, so the Director
can file it as an idea. An area with **no PoF home** is itself an upgrade finding (`new-module`).

## TERMINATION — the achievable maximum (adapted from readiness-loop STOP)

The loop ends when **both** hold:
- every `src/` file at the pin is covered by an ingest spec or descoped with a recorded reason
  (`open = 0`), and
- a full round moves nothing: no created, rawChanged or reprojected wrapper, no newly covered or
  descoped path, and no new `Path/` node, `Findings.md` entry or `Upgrades/` note.

`status.ts` computes this (`terminationVerdict`) from the last two recorded rounds; one round can
never prove it. Then write the final coverage histogram and the descope reasons to `State.md` and
set `status: done`. **Never** reach it by descoping what you have not read, reclassifying a gap as a
drop, or dropping a spec glob — that is not a maximum, it is a lie with a nicer colour.

## Forging the Path (shared with /diablo)

One note per node in `Path/`, frontmatter `kind · status · requires · evidence`. A dependency is
written down only with evidence (a botw path at the pin, a PoF file:line that cannot hold it, a
missing field). When a node completes, append one line to `Path/Index.md`'s **Chronology**.

## Laws

- **Values never enter the repo.** Globs, the pin, column names of PoF's own reader, PoF's analysis:
  yes. Identifiers, strings, numbers, code from the clone: no. Before every commit, check that no
  added line was copied from the clone (grep the diff's added identifiers against the clone).
- **No media models** of any kind (image, video, audio; local or cloud) and no commercial services.
  Only the claude CLI and Blender renders. Media-dependent work is recorded as `model-blocked`.
- **Consult the registry BEFORE a design decision.** Resolve subjects through `.ai/registry-map.json`
  / `knowledge/<domain>/index.json` (`subjects[slug].file`), at least `import-normalization` and
  `reference-parity-gating`. Where the chassis falls short, record a deviation in `Backlog.md`.
- **Never weaken a checker or a mapping to make a number move.** Coverage rises by reading a file
  or descoping it with a true reason, never by widening a descope over unread code.
- **Commit with a pathspec**, never push, never touch `.claude/fleet-memory.md` from a builder run.
- **One wave per invocation.** Never chain waves in one session; the resume point is the handoff.

## Reflection

At the end of each session append to `LESSONS.md` beside this file only what would change how the
loop runs. Project facts go in the vault, not here.
