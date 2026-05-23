---
date: 2026-05-23
status: draft
sub_project: Character CLI #2 — known-assets registry + pure-C++ AI generator
parent: docs/improvements/02-character/pof-app.md (§2 + §4)
---

# Known-assets registry + pure-C++ AI-controller generator

## Context

Second deliverable of the character CLI (folder `02-character`). The first
deliverable shipped a hostile enemy (a pure-C++ `ARPGSimpleAIController` + the
`GA_EnemyMeleeAttack` gray-box fallback, gated by `AVSEnemyAttackTest`). This
deliverable encodes that hard-won knowledge **back into the PoF app** so future
generation is higher-quality and doesn't re-discover the same walls:

1. PoF currently asks Claude to *invent* UE asset paths (mannequin meshes,
   AnimBP) during character generation — error-prone. The Characters sub-project
   ground-truthed the real `/MoverTests/...` paths; they belong in a registry
   the prompts read from (pof-app.md §2).
2. The `ai-behavior` module's checklist/quick-actions are entirely
   Behaviour-Tree-centric — `ai-1` even generates a BT-dependent `AAIController`
   that hits the binary-content wall (BT graphs can't be Python-authored), and
   nothing acknowledges that wall or offers the pure-C++ alternative that the
   character CLI just proved works (pof-app.md §4).

This is **pure app-side TypeScript** — no UE editor, no build, no Mixamo.

## Established facts (on-disk, verified 2026-05-23)

- `src/lib/knowledge/ue-gotchas.ts` is the model: `interface Gotcha { id;
  summary; detail; appliesTo: PromptKind[]; source }`, `export const
  UE_GOTCHAS: Gotcha[]`, and `formatGotchas(kind): string` rendering a markdown
  block. `PromptKind` is defined in `src/lib/knowledge/types.ts`
  (`'ue-cpp' | 'ue-python' | 'packaging' | 'web'`).
- It is consumed in `src/lib/prompt-context.ts`: imported at line 12, and
  `buildProjectContextHeader(ctx, opts)` appends it at lines 381–385
  (`const gotchas = formatGotchas(promptKind); if (gotchas) header += …`),
  right after the `## Rules` block, alongside `formatBinaryContentTripwire`.
  `opts` is `ContextHeaderOptions` (has `promptKind`, default `'ue-cpp'`).
- Its test `src/__tests__/knowledge/ue-gotchas.test.ts` checks: array length,
  per-entry required fields, unique ids, `formatGotchas` filters by kind,
  returns `''` for `'web'`, and a snapshot. This is the template for the new
  registry test.
- The `ai-behavior` module entry is at `src/lib/module-registry.ts:776`:
  `quickActions` `ai-1..ai-4` (all BT/perception/EQS/combat), `checklist`
  `ai-1..ai-6` (BT controller, behaviour trees, perception, EQS, squad, debug),
  one `knowledgeTip`. None mention the BT-graph wall; none offer a pure-C++
  controller. Checklist items are `{ id, label, description, prompt }`.
- The shipped controller (`ARPGSimpleAIController`, UE repo) is the reference
  for the generator prompt: `OnPossess` caches the enemy; `Tick` finds the
  player, steers toward it (nav-independent `AddMovementInput` or `MoveToActor`),
  faces it, and `TryActivateAbilitiesByTag(Ability.Enemy.Melee)` on cooldown.
  Set as `AIControllerClass` on the placed instance (not just the CDO).

## Goals

1. A `ue-known-assets` registry of the real UE asset paths PoF should reference,
   mirroring the `ue-gotchas` pattern.
2. That registry is **consumed** by character/animation/AI generation prompts —
   domain-scoped so it never pollutes unrelated prompts.
3. The `ai-behavior` module acknowledges the BT-graph wall and offers a tracked
   pure-C++ AI-controller generator reflecting the shipped pattern.
4. Tests guard all three against regression.

## Non-goals

- No UI components (no wizard — that's pof-app.md §1, a separate deliverable),
  no Mixamo workflow surface (§3), no Gemini verify step (§6).
- No UE-project changes, no build, no editor run.
- No rewrite of the existing BT-centric `ai-behavior` items — they stay valid
  for when the BT-asset wall is solved; the pure-C++ item is *added alongside*.
- No richer per-asset verification schema — YAGNI; the 09 roadmap's Round-2
  known-assets registry can supersede this later.

## Decision record (from brainstorming)

1. **Scope = registry + prompt wiring + AI-module updates + tests** (chosen over
   registry-only; the wiring is what delivers value — Claude uses real paths).
2. **Registry in `src/lib/knowledge/ue-known-assets.ts`** (chosen over the
   literal `src/lib/ue-known-assets.ts` in pof-app.md) — consistent with the
   `knowledge/` convention + where `prompt-context.ts` imports such helpers.
3. **Domain-scoped, opt-in injection** via a new `knownAssetDomains?: string[]`
   on `ContextHeaderOptions` — additive, zero effect until a caller opts in.
4. **A new tracked checklist item** (`ai-7`) + a knowledge tip (chosen over a
   one-off quick action or rewriting `ai-1`).

## Design

### 1. `src/lib/knowledge/ue-known-assets.ts`

```ts
import type { PromptKind } from './types';

export interface KnownAsset {
  id: string;
  path: string;          // exact UE content path, e.g. '/MoverTests/.../SKM_Manny'
  type: string;          // 'SkeletalMesh' | 'AnimBlueprint' | 'Material' | ...
  description: string;
  source: string;        // 'MoverTests plugin' | 'project' | 'ThirdPerson template'
  domains: string[];     // relevance tags: 'character' | 'animation' | 'ai'
}

export const UE_KNOWN_ASSETS: KnownAsset[] = [ /* mannequin set + M_EnemyRed + TP fallback */ ];

/** Render assets whose `domains` intersect `domains` as a markdown block. '' if none. */
export function formatKnownAssets(domains: string[]): string;
```

Entries (from the Characters sub-project ground truth):
`SKM_Manny`, `SKM_Manny_Simple`, `SK_Mannequin`, `ABP_Manny`, `MI_Manny_01`,
`MI_Manny_02` (each `/MoverTests/...`, domains `['character','animation']`);
`M_EnemyRed` (`/Game/VerticalSlice/M_EnemyRed`, the enemy-distinction default
because `MI_Manny_02` is too subtle, domain `['character']`); the Third-Person
template mannequin path documented as the *fallback* if `MoverTests`'s ABP is
ever found Mover-coupled (flagged, domain `['character','animation']`).

`formatKnownAssets(domains)` filters `UE_KNOWN_ASSETS` to entries sharing a
domain, renders `## Known Project Assets (use these EXACT paths — do not invent)`
with one `- **<path>** (<type>, <source>) — <description>` line each; returns
`''` when `domains` is empty or nothing matches.

### 2. Prompt wiring (`src/lib/prompt-context.ts`)

- Add `knownAssetDomains?: string[]` to `ContextHeaderOptions`.
- In `buildProjectContextHeader`, after the gotchas/tripwire append (line ~385):
  ```ts
  const knownAssets = formatKnownAssets(opts.knownAssetDomains ?? []);
  if (knownAssets) header += `\n\n${knownAssets}`;
  ```
- The character/animation/AI generation path passes `knownAssetDomains` derived
  from the task's `moduleId` (`arpg-character`/`arpg-animation` →
  `['character','animation']`; `ai-behavior`/`arpg-enemy-ai` → `['ai']`). The
  exact mapping helper + call-site (in `buildTaskPrompt` / the per-domain
  builders) is a plan-time detail; the seam and opt-in mechanism are fixed here.
- Default behaviour unchanged: callers that omit `knownAssetDomains` get `''`.

### 3. `ai-behavior` module updates (`src/lib/module-registry.ts`)

- **Knowledge tip:** *"Behaviour Tree graphs are binary content — they cannot be
  authored from Python (same wall as UMG/AnimBP). PoF generates the C++ leaf
  nodes (BTTask/BTService/BTDecorator); the BT graph itself is editor-authored.
  For a vertical slice or a simple enemy, prefer a pure-C++ AI controller."*
- **New checklist item `ai-7` — "Pure-C++ AI controller (no Behaviour Tree)":**
  prompt instructs Claude to create `AARPGSimpleAIController : AAIController`
  that, in `Tick`: finds the player, steers toward it (nav-independent
  `AddMovementInput` on a flat arena, or `MoveToActor` with a NavMesh), faces
  it, and activates the enemy's attack ability **by gameplay tag** respecting an
  attack cooldown; set it as `AIControllerClass` on the enemy BP's **placed
  instance** (not only the CDO — the documented serialization trap); verify with
  an `AFunctionalTest` (player takes damage), not a file-existence check. The
  prompt names the binary-wall sidestep explicitly so the generated controller
  needs no BT asset.

### 4. Tests

- `src/__tests__/knowledge/ue-known-assets.test.ts` (mirrors
  `ue-gotchas.test.ts`): `UE_KNOWN_ASSETS` non-empty; every entry has non-empty
  `id`/`path`/`type`/`description`/`source` and ≥1 `domains`; ids unique; the
  `MoverTests` mannequin paths present (snapshot guards accidental deletion —
  future character generation depends on them); `formatKnownAssets(['character'])`
  contains a mannequin path; `formatKnownAssets([])` returns `''`;
  `formatKnownAssets(['materials'])` (no match) returns `''`.
- A `module-registry` test asserting the `ai-behavior` module's `knowledgeTips`
  contains the BT-wall acknowledgement (substring "cannot be authored from
  Python") and its `checklist` contains an item whose label/prompt offers a
  pure-C++ AI controller (substring "AAIController" + "no Behaviour Tree" /
  "without a Behaviour Tree"). Guards both lessons from regression.

## Cross-cutting

- **Repo:** all changes are PoF-app-side → committed to the app repo (commit
  locally; user pushes manually). No UE-project changes.
- **Shared-tree caution:** `prompt-context.ts` and `module-registry.ts` are
  shared, central files other CLIs may edit. Edits here are **additive**
  (a new opt field + an appended block; a new tip + a new checklist item) — no
  changes to existing entries — to minimise merge friction.
- **Conventions:** `@/` imports, no raw `console`, no hardcoded hex,
  ≤200 LOC per file. The new registry + test are small, focused files.

## Definition of done

1. `ue-known-assets.ts` exists with the mannequin set + `M_EnemyRed` + TP
   fallback and a working `formatKnownAssets`.
2. `ContextHeaderOptions.knownAssetDomains` added; `buildProjectContextHeader`
   appends known-assets when opted in; the character/animation/AI path opts in.
3. `ai-behavior` module has the BT-wall tip + the `ai-7` pure-C++ controller
   item.
4. Both tests pass; `npm run validate` (typecheck + lint + test) is green.
5. No existing prompt's output changes unless its domain opts in (verified by a
   test that a non-character prompt header is unchanged).

**Success criterion:** a character/AI generation prompt now carries the exact
`/MoverTests/...` paths and the pure-C++ controller path, so Claude stops
inventing asset paths and stops generating BT-dependent controllers that hit the
wall — without affecting any unrelated prompt.

## Risks & mitigations

- **Injection pollutes unrelated prompts** → domain-scoped opt-in; a test
  asserts a non-character header is byte-unchanged.
- **Stale asset paths** (a `MoverTests` path renamed upstream) → the snapshot
  test flags accidental edits; paths are ground-truthed from the shipped slice.
- **Shared-file merge friction** → additive-only edits; exact-path commits.

## Next steps

1. Spec self-review (inline).
2. User reviews this spec.
3. `writing-plans` → implementation plan.
4. Execute: registry → wiring → module updates → tests → `npm run validate`.
