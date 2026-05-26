# Quality gate — content fidelity + wiring (blocking)

A passing test proves a row's `StepSpec` is **structurally well-formed**. It does **not** prove the row produces **Diablo-grade content that is correctly wired**. So every row also passes a **quality-gate review** by a fresh reviewer subagent — a *blocking* REVISE loop (author → review → REVISE → re-review → APPROVE), exactly like the spec/code reviewers in subagent-driven development. Tests passing is **necessary, not sufficient**.

Source of truth for the bar: [`ARPG-LAWS.md`](ARPG-LAWS.md) (the systems) + the **Canon** (`src/lib/catalog/canon/canon-seed.ts`, scoped laws) + the row's `plan.md` (design intent). The reviewer reads those, not just the pipeline file.

## The rubric (three dimensions; all must meet bar to APPROVE)

### 1. Content fidelity — *is it Diablo-grade, per the laws?*
Judge the **produced content**, not field-presence. For each producible step, check it obeys the relevant ARPG law with concrete, in-envelope numbers — examples by row type:
- **Item:** rarity drives an *affix budget* (Rare ≤3 prefix + ≤3 suffix); affixes are real, tiered, and ilvl-gated with magnitudes in range; a weapon has a damage range + attack speed + crit, not a single number; `requiredLevel ≈ ilvl − (5..15)`.
- **Monster:** a per-type **resistance profile**, a rarity life/damage multiplier, a real **ability set** (linked), telegraphed patterns — not stat inflation.
- **Ability / status:** damage uses the **added → increased → more** model and a real damage **type**; a status' identity is its granted `State.*` tag with a real ailment formula (ignite/bleed/poison/shock…).
- **Loot:** weighted by monster rarity × area level; references real item bases; rarity baseline sane.
- **Economy/crafting:** real sinks; currency-as-mutation where applicable; margins in envelope.
- **Lore/brief/quest:** faithful to the post-Sundering setting + tone; **non-generic** (no lorem-ipsum / placeholder prose); a quest has a reachable stage graph with success **and** fail terminals.
- **Numbers** sit in the `proj-balance` envelopes (tier power ≈100 ±10%, price/power 0.8–1.2×) + the system-specific envelopes in `ARPG-LAWS.md`.
- **Schema-down:** content matches the **existing UE/TS enums** (e.g. damage type is the code's `Ice`, not `Cold`) — flag drift, don't invent.

### 2. Wiring — *does it connect, and is the contract declared?*
- Cross-catalog `links` **resolve** (`linkTargetsExist`) or are honestly **deferred** to a named upstream row (not silently dangling).
- Every produced artifact declares the **wiring contract** — **Granted by · Activated by · Dependencies · Verification** (`arpg-wiring-contract`). "Compiled but not granted/activated" is **NOT** done.
- Correct UE artifact mapping (affix → `GE_`; status → `GE_` + `State.*` tag; stat → `DT_AttributeDefaults` row), `proj-naming` prefixes.

### 3. Acceptance integrity — *is the gate honest?*
- Acceptance is **derived** from the produced data (no faked pass); tiers are honest (runtime/visual genuinely `deferred` at L3/L4, never faux-passed at L0).
- `npm run check:scoped` is green (tests + tsc + lint on the row's files). Necessary, not sufficient.

## Verdict
- **APPROVE** — all three dimensions meet bar; record a one-line rationale.
- **REVISE** — list each gap as `step · dimension · concrete fix` (e.g. "Affixes · fidelity · only 1 generic affix; Rare needs ≤3p/3s tiered, ilvl-gated, magnitudes per `ARPG-LAWS §2`"). The author subagent fixes and the reviewer re-reviews. Repeat until APPROVE. Do **not** advance the row on a REVISE.

## Reviewer subagent prompt (template)
```
You are the QUALITY GATE for the catalog row "<row>" (catalogId `<id>`). Verify INDEPENDENTLY —
read the actual code + the laws, do not trust the author's report.

Read: src/lib/catalog/pipelines/<id>.ts (+ its test), docs/catalog/ARPG-LAWS.md, the scoped
Canon rules in src/lib/catalog/canon/canon-seed.ts (scope 'global' + '<id>'), and the
seeded entity it drives (src/lib/catalog/seed-*.ts / new-catalogs.ts — the design intent
+ the real ids/enums to validate against). Then score the rubric in
docs/catalog/QUALITY-GATE.md:
  1. Content fidelity — is each step's produced content Diablo-grade per ARPG-LAWS + Canon,
     with concrete in-envelope numbers, faithful tone, matching the existing UE/TS enums?
  2. Wiring — do links resolve/defer honestly? Is the Granted-by/Activated-by/Dependencies/
     Verification contract declared per producible artifact? Correct GE/DataTable/naming mapping?
  3. Acceptance integrity — derived (not faked); honest tiers; `check:scoped` green.
Run `npx vitest run src/__tests__/lib/catalog/pipelines/<id>.test.ts` and
`npx tsc --noEmit 2>&1 | grep -v AssetInspector | grep -iE "error TS"` yourself.
Return: VERDICT = APPROVE (one-line rationale) or REVISE (list each gap as
`step · dimension · concrete fix`). Be specific and cite ARPG-LAWS sections / canon ids.
```

## Where this fits the per-CLI loop
The [`AUTHORING.md`](AUTHORING.md) loop gains a step: after `check:scoped` is green, the row is **not done** until a quality-gate reviewer returns APPROVE. In the orchestrated wave the controller dispatches the reviewer; in the separate-terminal swarm each CLI dispatches its own reviewer subagent (or the operator runs the gate) before committing the row as complete.
