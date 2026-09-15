---
name: personal-loop
description: OPERATOR-PAIRED quality walk over /status?tab=pipelines — one pipeline item (catalog × step) at a time, in a FROZEN column-major order (every pipeline's step 1 top-to-bottom, then every step 2, …). For each item the LLM produces its best pilot-entity output aimed at the cell's ceiling on BOTH axes (R ladder + A craft axis), STOPS for the user's feedback on UI / prompt / functionality, applies it, fans the settled result out to the catalog's other entities, then RECERTIFIES the cell (improved / held / degraded). Progress + settled topics live in the Obsidian vault (Personal/) so no session re-raises a settled topic. Invoke with /personal-loop [next | status | reorder | reopen <topic> | <catalog> "<step>"]. Unlike gap-/green-/readiness-loop it never auto-proceeds past an item.
---

# Personal Loop — walk the map with the operator, item by item

One question per item: **what is the best this step can produce toward its ceiling, and what does the operator want changed about how it is produced?**

The other loops are autonomous (readiness-loop drives, gap-loop makes cells real, green-loop drives judged quality, craft-loop gauges). This one is **paired**: the LLM does the producing and measuring, the operator steers the product — its prompts, its UI, its functionality — and every item ends with an honest recertification. It shares their law: **never move a level by weakening a checker, judge or lens; move it by making the output genuinely better.**

> Engine vs. memory: this file is the engine. Memory is the **Obsidian vault**
> `C:/Users/kazda/Documents/Obsidian/pof/Personal/` (override with `POF_PERSONAL_VAULT`) —
> `Personal.md` (home), `order.json`/`order.md` (frozen walk), `topics.md` (settled topics),
> `items/<slug>.md` (one note per item). Read it FIRST every session.

## The two tools (never eyeball /status, never re-derive a grade)

```bash
npx tsx scripts/personal-loop/order.ts snapshot     # freeze the walk (first run, or /personal-loop reorder)
npx tsx scripts/personal-loop/order.ts next         # next open item (JSON: n, column, catalogId, step, slug)
npx tsx scripts/personal-loop/order.ts status       # progress + regenerate order.md
npx tsx scripts/personal-loop/recertify.ts <catalog> "<step>" [--entity <id>] [--baseline | --compare] [--json]
```

Both import the map's own `buildSwimlane` / `sortLanes` / `readinessOf` / `craftForCell` and read `~/.pof/pof.db` read-only — verified identical to `/status` and `scripts/readiness/inventory.ts` on all 344 cells (2026-09-15). If one ever disagrees with the map, that is a bug in an import, not an opinion: stop and fix it.

- **Order is frozen.** `sortLanes` re-sorts by readiness, so lifting a cell would reshuffle a live order. The snapshot is only retaken on an explicit `reorder`.
- **Status lives in the item note** (`status: todo | in-progress | done | skipped | parked`), never in `order.json`.
- **Baselines** are saved beside the note (`items/<slug>.baseline.json`, `items/<slug>.<entity>.baseline.json` for the pilot), so a walk interrupted across sessions still compares against the reading taken BEFORE any work.

## Session flow

**BOOT → (per item: BASELINE → RECALL → LOCATE → PILOT → STOP ⇄ FEEDBACK → FAN-OUT → RECERTIFY → WRAP) → next item.**

### BOOT
1. Read `.claude/fleet-memory.md` (repo rule) and the vault: `Personal/Personal.md`, `topics.md`.
2. No `order.json` → `order.ts snapshot` and create `Personal.md` from the template below.
3. `order.ts status`. Resume an `in-progress` item before starting a new one (its note says which round it was in).
4. Arguments: `next` (default) · `status` (print and stop) · `reorder` (re-snapshot — confirm first, it re-sequences the rest of the walk) · `reopen <topic>` (mark that topics.md line `reopened` so it may be raised again) · `<catalog> "<step>"` (jump to one item out of order; the cursor is unchanged).
5. Environment: PoF dev server — verify `curl -s -o /dev/null -w "%{http_code}" <origin>/layout` → 200 (port varies 3001/3002/…); set `POF_JUDGE_ORIGIN=<origin>` on every judge/config script.

### 1. BASELINE
`recertify.ts <catalog> "<step>" --baseline` → create `items/<slug>.md` (template below) with `status: in-progress` and `before:` filled from the reading (`R2 blocked · A4~ (ceiling A4)`).

### 2. RECALL — do not revisit settled topics
Read the item note (if resumed) and grep `topics.md` for every line whose scope covers this item: `global`, `deliverable:<class>`, `archetype:<id>`, `catalog:<id>`, `step:<label>` (a step label spans catalogs — all Concept Briefs share `step:Concept Brief`), `item:<slug>`. A settled topic is **applied silently** and **never re-proposed** as a suggestion unless its line is marked `reopened` or the operator raises it. This is also how column-walk leverage works: a prompt decision settled on the first Concept Brief is a `step:Concept Brief` topic every later Concept Brief inherits.

### 3. LOCATE — name the surfaces the operator can steer
Before producing, find and cite (`file:line`) the four levers for this step:
- **spec** — `src/lib/catalog/pipelines/<catalog>.ts` step entry: `archetype`, `view`, `produce`, `accept`.
- **prompt** — what actually drives generation: the step's `CliProduce` `buildPrompt` / generative frame (`src/components/layout-lab/steps/`), the quality techniques (`src/lib/prompts/quality/`), canon (`src/lib/catalog/canon/canon-seed.ts`). A constant `produce` body with no prompt is itself a finding worth showing.
- **UI** — the component the operator sees in `/layout` for this step.
- **measure** — the accept checker, the judge class + rubric (`src/lib/judge/rubrics.ts`), the craft lens (`src/lib/craft/lenses/<lens>.md`, via the reading's `a.lens`).

Read the reading's `fact` first: `deliverable`, `generatorWired`, `judge`, `checkerMeaningful`.

### 4. PILOT — best output for ONE entity
- **Pick the pilot**: the entity whose reading is worst-but-real (lowest judge score / failing checker with real content); for an R0 cell, the catalog's first canonical entity. Never a synthetic entity. `recertify.ts ... --entity <id> --baseline`.
- **Produce through the product's own path** (the prompt/generator the app uses — CLI produce, `/api/leonardo`, `/api/visual-gen/generate`, `/api/audio-gen`, UE Python), so operator feedback on a prompt or UI changes the product, not just one DB row. Hand-authoring DB content is allowed only for a text step whose app path IS an LLM authoring pass, and must follow green-loop's entity-coherence rules (read ALL sibling steps + canon first; single-source numbers; no defensive meta-commentary). Engine recipes: gap-loop's EXECUTE palette (media) and green-loop's loop (text) — reuse them, do not re-invent.
- **Aim at the ceiling on both axes**: R4 (strict judge ≥90 median-of-3 on the current rubric, or a real L3/L4 gate) → R5 where UE realization exists; A at `a.ceiling` (3d-mesh/animation cap A2, 2d-art A3, text/code/audio/vfx A4).
- **Measure the pilot independently**: judge via `scripts/judge-run.ts --catalog <c> --step "<s>" --entity <e>` (`--median 3` once in-loop draws reach ≥85); craft via ONE fresh Opus subagent that reads the artifact + lens + siblings and POSTs `/api/craft-verdicts` (never the agent that authored the content — craft-loop's independence rule).
- **Spend**: stop and ask before any single item exceeds ~$5 of paid generation.

### 5. STOP — every item, no exceptions
Present one fixed block, then call **AskUserQuestion** (options: `Good — fan out`, `Skip item`, `Park item`; free-text *Other* = feedback). Never end the item on your own judgement.

```
━━ #<n>/<of> · col <column> · <catalog> · <step> ━━
BEFORE   cell <R> · <A>  (ceiling <A-ceiling>)       pilot <entity>: <R> · <A>
MADE     <what changed + where to look: /layout → <catalog> → <entity> → <step>;
          /status?entity=<catalog>:<entity>; file/image path>
PILOT    judge <verdict> <score> (<median-3|single>) · craft <A> (<lens> v<n>)
TO CEILING  <the named findings still standing between the pilot and its ceiling>
SURFACES prompt <file:line> · UI <file:line> · spec <file:line> · checker <file:line>
SETTLED  <n> topics applied silently (<scopes>)
```

Special stops (still a stop):
- **At ceiling on both axes** → a one-line stop: "at ceiling — anything to adjust?".
- **Honest floor** — `generatorWired: false` for a media deliverable, or a recorded floor in `.claude/gap-loop/lessons.md` → do NOT produce a stand-in; stop naming the capability gap and offer: wire a generator (becomes functionality work) / skip / park.
- **Blocked on environment** (UE editor needed, dev server down) → say exactly what is needed; the operator starts the editor on request.

### 6. FEEDBACK rounds
For each operator message:
1. Classify every point: **ui** · **prompt** · **functionality** · **content** (this entity only) · **measure** (they dispute a judge/lens → record it; never edit a rubric/lens/checker to pass — lens changes go through craft-loop's bump + review).
2. Apply it in the smallest correct place (repo rules: `@/` imports, no hex, logger, ≤200 LOC generated files, shared manifest components). Run the touched tests + `npm run typecheck`.
3. Re-produce the pilot, re-measure, STOP again with the same block (MADE now lists the round's changes).
4. Append the round to the item note and **settle topics**: every decision (accepted OR rejected) → one `topics.md` line with the widest honest scope. Ask the scope only when it is genuinely ambiguous (e.g. "apply to every Concept Brief or just bestiary?").
5. Commit narrowly after each round that touched the repo (`git add <specific files>` — shared tree; never `-a`; never push).

### 7. FAN-OUT — after "Good"
Apply the settled prompt/UI/functionality to the catalog's remaining (non-synthetic) entities via the same path. Text fan-out keeps green-loop's rules (entity-coherent, judge ONCE per content change, sequential official draws). Up to 10 Opus subagents may take one entity each when the path is identical and write sets are disjoint (DB rows only); the driver reviews every result. A fan-out entity that fails its checker or judge is reported, not retried in a spiral.

### 8. RECERTIFY
1. Re-judge changed entities (once each) and re-gauge craft with a fresh subagent for changed content — a stale A reading reports `unmeasured`, never a pass.
2. `recertify.ts <catalog> "<step>" --compare` → `R <before → after> improved|held|degraded`, `A … improved|held|degraded|baselined|unmeasured`, overall = worst news.
3. **Degraded** or **unmeasured** → STOP and show why (which entities, which findings) before WRAP. Degraded is never wrapped silently; the operator decides fix / accept / revert.

### 9. WRAP the item
- Note: `status: done` (or `skipped` / `parked` with the reason), `after:`, `movement:`, final surfaces touched, commit SHAs.
- `order.ts status` (regenerates `order.md`); update `Personal.md` "Last session" line.
- Move to `order.ts next` and begin BASELINE — the walk continues until the operator stops the session.

### End of session
Append at most 2 lines to `.claude/fleet-memory.md` (DELIVERED + a DECISION/CONVENTION only if genuinely reusable) and commit it scoped: `git commit --only .claude/fleet-memory.md -m '…'`. Final recap line: `FLEET:NEXT — continue /personal-loop at #<n> <catalog> · <step>` (the walk is never "done" mid-map).

## Vault templates

`Personal/Personal.md`
```markdown
---
type: personal/home
updated: YYYY-MM-DD
---
# Personal loop — operator-paired pipeline walk
Skill: `.claude/skills/personal-loop/SKILL.md` · Order: [[order]] · Topics: [[topics]]
## Last session
- YYYY-MM-DD — items #a–#b; movements …; next #n
```

`Personal/topics.md` — one line per settled decision, append-only (mark `reopened` in place when the operator reopens one):
```markdown
- [YYYY-MM-DD] scope:step:Concept Brief · prompt · DECISION: briefs lead with the player fantasy, mechanics second → [[items/bestiary--concept-brief]]
- [YYYY-MM-DD] scope:global · ui · REJECTED: collapsing the provenance strip — operator wants it always visible → [[items/…]]
```

`Personal/items/<slug>.md`
```markdown
---
type: personal/item
catalog: <catalogId>
step: <step label>
n: <n>
column: <column>
status: in-progress
pilot: <entityId>
before: R2 blocked · A4~ (ceiling A4)
after:
movement:
updated: YYYY-MM-DD
---
# <catalog> · <step>
## Surfaces
## Rounds
### Round 1 — YYYY-MM-DD
- produced / measured:
- operator:
- changes (commits):
- settled → topics:
## Recertify
```
