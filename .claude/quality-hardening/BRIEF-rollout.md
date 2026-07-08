# Text re-produce rollout — agent protocol

You re-produce the TEXT-config content for a set of catalogs using the proven hardening
technique, so the map turns green after a batch rejudge. This is breadth (one strong pass per
step), not the deep single-step loop — author with the technique, apply, move on. Do NOT run
judge-one per step (a batch rejudge happens after the whole fleet finishes). Work in repo root.

## The technique (this is the whole point — apply it to every config)
Author each config as a STRUCTURED design doc, not a prose blurb. Every field load-bearing:
- **Single source of truth:** every number appears once; derive dependents with the arithmetic
  SHOWN, forward-derived from primitives — never reverse-engineer a figure to hit a target.
- **Sibling-sourced:** cross-reference the entity's OTHER steps by their real values (ids,
  prices, stats, labels); contradicting a sibling is an automatic failure. Add a
  crossReferences / statHooks block that mirrors the hard numbers.
- **Prove hard cases inline** (worked math, ICU plural/gender arms, state machines, edge cases).
- **Scope depth to the subject** (a baseline Common scoped down; a boss scoped up).
- **Disclose your own edge cases** precisely (beats claiming false airtightness).
- Refuse vaporware; declarative voice; NO meta-commentary defending numbers; NO raw engine
  tokens/enums leaking into prose. Keep each config under ~50k chars.
(The same technique is banked in `src/lib/prompts/quality` TEXT_TECHNIQUE.)

## Procedure — for EACH catalog in your assignment
1. Dump the catalog once for sibling context (session-unique filename):
   `npx tsx scripts/get-config.ts --catalog <c> --out <c>-all.json`
   This is `{ step: config }` for every step — read it to know the entity's real values.
   (If a catalog has >1 real entity, do each entity: add `--entity <e>`; skip test/smoke entities
   like `item-mcp-smoke`, `test-headless-*`.)
2. For EACH text-config step listed in your assignment for that catalog:
   a. Author the improved config JSON to a unique file, e.g. `<c>-<stepslug>.json`, applying the
      technique above and staying consistent with the siblings you read in step 1.
   b. Apply it: `npx tsx scripts/apply-config.ts --catalog <c> --entity <e> --step "<step>" --file <c>-<stepslug>.json`
      (prints `checker=pass|pending` — either is fine; the rejudge scores content, not shape).
3. Move to the next catalog. Report a compact table of what you applied (catalog::step → checker).

## Rules
- Author breadth-first: one strong technique-driven pass per step. No per-step judging.
- Ground every claim in the real siblings — do NOT invent values that contradict them.
- Use session-unique temp filenames (parallel agents share the cwd).
