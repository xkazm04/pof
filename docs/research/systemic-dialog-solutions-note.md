# Systemic Dialog Quest Solutions — spec note (backlog)

> Source: Timothy Cain, "Dialog Quest Solutions" (youtu.be/1xvLwldNHc4), /research run 2026-08-12.
> Status: **backlog delta, not built.** Pairs with the radiant-quest backlog idea
> (`idea-2a2e30d7-radiant-quest-variation-engine`) and the new `dialogue-quests`
> evaluator context in `src/lib/evaluator/module-eval-prompts.ts`.

## The open problem (Cain's challenge)

Combat and stealth quest solutions are **systemic**: data-driven, they fall out of the
rules (spawn tables, lock-pick/strength/explosive checks on a chest, a key ID matching a
chest ID buys kill/pickpocket solutions in 10 seconds). Dialog solutions are **100%
handcrafted** — so maps accumulate far more combat/stealth solutions than talk solutions,
and talk-build coverage erodes. Cain: *"if you can figure out a way of setting up NPC data
and world data so that dialogue solutions fall out of it as easily as the combat and
stealth solutions, I think that's going to be the next big thing."*

## Why PoF is unusually positioned

PoF's generation stack is *literally the systemizer he's asking for*: an LLM can author the
dialog lines, but the SYSTEMIC part is the data model, not the prose. The shape that makes
dialog solutions fall out of rules:

1. **Declarative condition/effect entries on NPCs** (already a structureCheck in the new
   `dialogue-quests` eval context): each NPC carries data — `knows: [fact-ids]`,
   `wants: [item-ids/favors]`, `fears: [tags]`, `disposition`, faction reputation hooks.
2. **Quest gates reference facts/items, not lines**: a boss's "talk him down" branch unlocks
   on `has_fact(autopsy-report-read) AND (has_item(report) OR speech >= X)` — the Fallout
   Master pattern, expressed as data.
3. **The generator's job**: given a quest gate + the NPC data graph, EMIT the connective
   tissue (who knows the fact, what they want for it, which skills unlock each hop) and
   then LLM-write the lines for each hop. Multi-stage by construction — the one-shot
   anti-pattern becomes structurally impossible.
4. **Coverage checker**: with solutions as data, per-build coverage (combat/stealth/talk %)
   is countable — the Josh-Sawyer-on-Pillars skill-usage tracking, automated.

## When to build

When quest/dialogue content becomes a catalog pipeline focus (the `dialogue-quests`
module today has checklist prompts + eval criteria but no generation pipeline). Effort XL:
data model + generator + coverage checker. First slice candidate: the fact/wants/fears NPC
data schema + a coverage counter over existing quest artifacts (M, measurable, no LLM).
