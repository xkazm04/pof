# <Entity> — Catalog Pipeline Brief

**Category:** <Category> · **Catalog:** `<catalogId>` (<new|existing>) · **Owning module:** `<module>`
**Description:** <description>

> Read [`../../index.md`](../../index.md) first — it carries the shared execution contract, agent roles, test-gate definition, and the PoF-systems map. This brief is the entity-specific layer.

## Target asset (build this one end-to-end)
**<Target Asset Name>** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
<ordered checklist of the row's steps; each: `- [ ] N. <Step>` — _agent role · reuse-or-⚠️gap_>

## PoF integration
- **Pipeline tracks:** `<tracks>`
- **Data schema:** design during the schema step; persist via the catalog `data` field.
- **Reuse:** <existing PoF capabilities to reuse> · **Gaps:** <known missing capabilities>

## Cross-catalog dependencies
<explicit links to other catalog rows this entity consumes/produces>

## Session Findings
_Fill this in at the end of the session._
### Cross-catalog opportunities
-
### Gaps / blockers for future sessions
-
