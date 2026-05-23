# 01 · Generation Quality

## Scope

Improving the *autonomous* output PoF's prompts and scaffolding produce when
Claude generates UE C++. SP-B drove Claude through PoF's module checklists and
got *a lot* of compiling C++ — but each successive sub-project (PS-1, HUD,
Characters) found the same defect class: **the code compiles, but it was
never wired into anything runnable**, and several gameplay paths have latent
bugs that only show up the first time something exercises them.

## Current state

SP-B's autonomous run produced real game code (combat, enemy, loot, HUD,
damage numbers — 12+ source files). Every subsequent sub-project surfaced one
or more concrete gaps in that generation:

- The player ASC was **never granted any ability** — PS-1 added a
  `DefaultAbilities` array on `ARPGCharacterBase` to close it.
- The input pipeline was **only half-wired** — Enhanced Input lives on
  `ARPGPlayerController` but no `IMC` and only 2 of the ~22 referenced
  `IA_*` assets existed. PS-1 had to create the `IMC` + a `BP_VSPlayerController`.
- `GA_MeleeAttack`'s damage is **gameplay-event-gated** on `Event.MeleeHit`
  fired by a hit-detection AnimNotifyState — but `AM_MeleeCombo` is an empty
  shell with no notifies, so damage never applies in normal play. PS-1's
  functional test had to send `Event.MeleeHit` itself.
- `UARPGLootDropComponent` binds the `OnEnemyDeath` delegate of
  `AARPGEnemyCharacter` specifically — but PS-1's first try used
  `ARPGCombatTestDummy`, where loot never drops.
- `UARPGHUDWidget` and `UARPGMainHUDWidget` use `BindWidget` and need
  companion UMG Widget Blueprints — but no `WBP_*` assets exist anywhere, and
  Python cannot author UMG widget trees. The HUD sub-project sidestepped via
  `UBossHealthBarWidget`'s pure-C++ pattern.
- The mannequin swap surfaced a synchronous-callback race in `GA_MeleeAttack`'s
  fallback-window guard (`OnInterrupted` fired before `bUsingFallbackWindow`
  was set — `EndAbility` killed the listener).
- `MaterialExpressionConstant3Vector`'s output pin is `""`, not `"RGB"` —
  `connect_material_property("RGB", ...)` silently returns false and produces
  a black material. Caught only when the enemy rendered black.

The pattern: **generation is good at producing classes; it is bad at wiring
them together, at producing companion content (BPs/WBPs/AnimBPs), and at
catching subtle UE-API pitfalls.**

## Key lessons

1. **"Compiles" ≠ "runs."** Every sub-project's first verification surfaced
   wiring gaps. The generation prompts need to demand — and ideally verify
   — that a generated system can actually fire its end-to-end path.
2. **Binary content (`WBP_*`, `AnimBP_*`, `.umap`, `SK_*`, `MID_*`) can't be
   Python-authored.** Generation prompts must either emit pure-C++ widget
   patterns (the `UBossHealthBarWidget` model) or flag the binary-content
   dependency explicitly so a follow-up step provides it.
3. **The "ground-truth before plan" pattern works.** Every sub-project that
   sent an exploration agent before writing the plan caught at least one
   wrong assumption (no skeleton, BindWidget chains, `Constant3Vector` pin
   name). Bake this into the generation workflow.
4. **Subtle UE-API pitfalls bite repeatedly.** The Python material-pin name,
   the `RebuildWidget` vs `NativeConstruct` timing, `MoverTests` plugin
   asset mounting under `-run=pythonscript` — these are *known* gotchas that
   should be in PoF's prompt knowledge.

## Isolated-CLI session focus

A session assigned this concern works in:
- `src/lib/module-registry.ts` (per-checklist prompts)
- `src/lib/prompts/` (prompt builders)
- `src/lib/prompt-context.ts` (shared prompt context)
- `src/lib/evaluator/module-eval-prompts.ts` (evaluation criteria)
- `src/lib/feature-definitions.ts` (cross-module dep declarations)

It does *not* touch the UE project's game code (the per-system improvements
in folders 02–08 do that). Its UE-side outputs are *better prompts*, not new
game code.
