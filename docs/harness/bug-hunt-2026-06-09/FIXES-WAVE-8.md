# Bug Hunter Fix Wave 8 — Final criticals (sim math, FK enforcement, catalog matching)

> 3 commits, 3 critical findings closed. After this wave, 17 of 18 criticals are closed — only the React item-double-produce remains (deferred to a UI-state pass).
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Full suite unchanged at the known 15-fail flake baseline (no new FK violations surfaced).

## Theme

The last three server-side criticals, each a different class: a sim formula that double-applies a multiplier, a declarative DB constraint that was never enforced, and a catalog match that fired on substrings.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `0a01cd8` | combat-damage-tuning #1 | critical | `lib/combat/simulation-engine.ts` |
| 2 | `265b4ee` | ai-testing-localization #1 | critical | `lib/db.ts` |
| 3 | `25d6de5` | crash-analysis-pattern-library #4 | critical | `lib/pattern-library-db.ts`, `lib/pattern-extractor.ts` |

## What was fixed

1. **Combat armor multiplier squared** (`0a01cd8`). `calculateDamage` computed `effectiveArmor = targetAttrs.armor * (isPlayer ? enemyDamageMul : playerArmorMul) * armorEffectivenessWeight`. But `buildPlayerAttributes` already baked `playerArmorMul` into `attrs.armor`, so applying it again squared the player's mitigation (a slider set to ×2 was read as ×4), and feeding `enemyDamageMul` (a *damage* knob) into the enemy's armor made raising enemy damage also raise enemy armor. Now `effectiveArmor = targetAttrs.armor * armorEffectivenessWeight`, so every survival/DPS/TTK/alert number matches the documented `Armor/(Armor+100)` curve once any knob leaves 1.0.
2. **`ON DELETE CASCADE` never fired** (`265b4ee`). SQLite enforces foreign keys *per connection* and defaults them OFF; `getDb` never enabled the pragma, so every declared `REFERENCES … ON DELETE CASCADE` was decorative — deleting a suite orphaned its scenarios forever, and inserts could reference nonexistent parents. Whether cascade fired was even non-deterministic (two unrelated modules toggled the pragma based on init order). `getDb` now runs `db.pragma('foreign_keys = ON')` once on the shared connection; the full test suite surfaced **no** new FK violations.
3. **Anti-pattern keywords matched substrings** (`25d6de5`). `checkPromptForAntiPatterns` matched trigger keywords with `lower.includes(kw)`, so `state` matched inside `stateful` and `cast` inside `broadcast` — firing a blocking-style "this approach failed 85% — switch?" warning on unrelated prompts and training users to ignore the guardrail entirely. Matching now tokenizes the prompt into whole words and requires ≥2 distinct keyword hits, and keyword mining (`extractTriggerKeywords`) requires 5+ chars, a wider stopword list, and the same tokenization so generic tokens can't become triggers.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors |
| `eslint` (changed files) | 0 errors (pre-existing unused warnings only) |
| Full `vitest run` | 3925 pass / 15 fail — **identical to the pre-existing flake baseline**, no `FOREIGN KEY` errors → the global pragma is safe |

## Cumulative status — ALL waves

| Wave | Theme | Closed | Crit | High |
|------|-------|-------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| 4 | Shared-singleton concurrency | 3 | 3 | 0 |
| 2 | Atomicity & write races | 3 | 3 | 0 |
| 5 | UE5 codegen correctness | 3 | 1 | 2 |
| 3 | Silent-failure safety gates | 3 | 1 | 1 |
| 7 | Determinism & timestamps | 4 | 1 | 2 |
| 8 | Final criticals | 3 | 3 | 0 |
| **Total** | | **28 / 140** | **17 / 18 (94%)** | **9 / 70** |

## Patterns established (catalogue items 22–24)

22. **A value scaled at construction must not be re-scaled at use.** If a build step bakes a multiplier into a field, applying the same knob again downstream squares it. Each tuning knob maps to exactly one axis and one application site.
23. **Declared FK constraints are inert unless `foreign_keys = ON`.** SQLite defaults the pragma OFF per connection, so `REFERENCES … ON DELETE CASCADE` does nothing until enabled. Enable it once at connection creation (`getDb`), never ad-hoc per feature — otherwise enforcement depends on init order.
24. **Match user input against a catalog on token boundaries, with a distinctiveness floor.** Unanchored `includes` lets a short catalog entry match inside larger words; tokenize both sides into word sets and intersect, require a minimum number of hits, and mine catalog terms with a stopword + min-length filter.

## What remains

28 of 140 closed; **17 of 18 criticals**. The only open critical is **item-pipeline-steps #1 — stale-closure double-produce** (a React fix in the layout-lab produce flow, deferred with the other UI-state changes to a session that can validate against the running app). Open highs/mediums: the deferred items from Waves 2/3/4/5/7 (self-heal tri-state, UE5 connection-manager lifecycle, audio scene lost-update, pipeline rollback, cpp-parser nested-paren regex, bestiary clamp, weekly-digest timezone, and the lower-severity tail). A future session resumes from the INDEX + these 8 wave summaries.
