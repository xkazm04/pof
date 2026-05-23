# Known-assets registry + pure-C++ AI generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the shipped character/AI knowledge into PoF so generation prompts use the real `/MoverTests/...` mannequin paths (instead of inventing them) and the `ai-behavior` module offers a pure-C++ AI-controller path that sidesteps the Behaviour-Tree binary-content wall.

**Architecture:** A new `src/lib/knowledge/ue-known-assets.ts` registry mirrors the existing `ue-gotchas.ts` pattern (typed array + a `formatKnownAssets(domains)` markdown renderer + a `knownAssetDomainsForModule(moduleId)` map). It is injected into the shared context header (`prompt-context.ts`) at the same seam as gotchas, **opt-in and domain-scoped** so only character/animation/enemy prompts carry it; `cli-task.ts`'s `buildTaskPrompt` opts in by mapping `task.moduleId` to domains. The `ai-behavior` module entry in `module-registry.ts` gains a BT-wall knowledge tip + a new `ai-7` checklist item reflecting the shipped `ARPGSimpleAIController`. All changes are additive; everything is TDD with vitest.

**Tech Stack:** TypeScript, vitest. App repo (`C:\Users\kazda\kiro\pof`) only — no UE project, no build, no Mixamo. Commit locally (user pushes manually).

**Conventions:** `@/` imports (never `../../`), no raw `console`, no hardcoded hex, ≤200 LOC per file. Run a single test file with `npx vitest run <path>`; full gate with `npm run validate` (typecheck + lint + test).

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `src/lib/knowledge/ue-known-assets.ts` | The registry + `formatKnownAssets` + `knownAssetDomainsForModule` | Create |
| `src/__tests__/knowledge/ue-known-assets.test.ts` | Registry data-integrity + format + mapping tests | Create |
| `src/lib/prompt-context.ts` | Add `knownAssetDomains?` opt; append the block at the gotchas seam | Modify (additive) |
| `src/__tests__/prompts/known-assets-injection.test.ts` | Header includes assets only when opted in | Create |
| `src/lib/cli-task.ts` | `buildTaskPrompt` maps `moduleId`→domains and opts in | Modify (additive) |
| `src/__tests__/lib/cli-task-known-assets.test.ts` | Character task injects paths; unrelated task doesn't | Create |
| `src/lib/module-registry.ts` | `ai-behavior`: BT-wall tip + `ai-7` pure-C++ controller item | Modify (additive) |
| `src/__tests__/registry/ai-behavior-surface.test.ts` | Module surfaces the wall + the pure-C++ item | Create |

**Shared-file caution:** `prompt-context.ts`, `cli-task.ts`, and `module-registry.ts` are central files other CLIs may edit. Every edit here is **additive** (a new opt field, a new appended block, a new tip, a new checklist item) — no existing entry is changed. Commit only these exact files.

---

## Task 1: `ue-known-assets` registry + helpers

**Files:**
- Create: `src/lib/knowledge/ue-known-assets.ts`
- Test: `src/__tests__/knowledge/ue-known-assets.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/knowledge/ue-known-assets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  UE_KNOWN_ASSETS,
  formatKnownAssets,
  knownAssetDomainsForModule,
} from '@/lib/knowledge/ue-known-assets';

describe('UE_KNOWN_ASSETS data integrity', () => {
  it('has the seeded mannequin assets', () => {
    expect(UE_KNOWN_ASSETS.length).toBeGreaterThanOrEqual(6);
  });

  it('every asset has non-empty fields and >=1 domain', () => {
    for (const a of UE_KNOWN_ASSETS) {
      expect(a.id, 'id').toBeTruthy();
      expect(a.path, `path for ${a.id}`).toBeTruthy();
      expect(a.type, `type for ${a.id}`).toBeTruthy();
      expect(a.description, `description for ${a.id}`).toBeTruthy();
      expect(a.source, `source for ${a.id}`).toBeTruthy();
      expect(a.domains.length, `domains for ${a.id}`).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = UE_KNOWN_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the MoverTests mannequin + M_EnemyRed paths', () => {
    const paths = UE_KNOWN_ASSETS.map((a) => a.path);
    expect(paths).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
    expect(paths).toContain('/MoverTests/Characters/Mannequins/Animations/ABP_Manny');
    expect(paths).toContain('/Game/VerticalSlice/M_EnemyRed');
  });
});

describe('formatKnownAssets', () => {
  it('renders a block for character with a MoverTests path', () => {
    const out = formatKnownAssets(['character']);
    expect(out).toContain('## Known Project Assets');
    expect(out).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
  });

  it('returns empty string for no domains', () => {
    expect(formatKnownAssets([])).toBe('');
  });

  it('returns empty string for a non-matching domain', () => {
    expect(formatKnownAssets(['materials'])).toBe('');
  });

  it('snapshot of the character block', () => {
    expect(formatKnownAssets(['character'])).toMatchSnapshot();
  });
});

describe('knownAssetDomainsForModule', () => {
  it('maps character + animation modules', () => {
    expect(knownAssetDomainsForModule('arpg-character')).toContain('character');
    expect(knownAssetDomainsForModule('arpg-animation')).toContain('animation');
  });

  it('maps the enemy module to character assets', () => {
    expect(knownAssetDomainsForModule('arpg-enemy-ai')).toContain('character');
  });

  it('returns [] for unrelated modules', () => {
    expect(knownAssetDomainsForModule('arpg-loot')).toEqual([]);
    expect(knownAssetDomainsForModule('materials')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/knowledge/ue-known-assets.test.ts`
Expected: FAIL — cannot resolve `@/lib/knowledge/ue-known-assets`.

- [ ] **Step 3: Implement the registry**

`src/lib/knowledge/ue-known-assets.ts`:

```ts
/**
 * Real UE asset paths the project already has (or a documented fallback), so
 * generation prompts reference exact paths instead of inventing them.
 * Ground-truthed by the vertical-slice Characters sub-project + the enemy-AI
 * deliverable. Mirrors the `ue-gotchas.ts` pattern.
 */
export interface KnownAsset {
  id: string;
  /** Exact UE content path. */
  path: string;
  /** Asset type, e.g. 'SkeletalMesh', 'AnimBlueprint', 'MaterialInstance'. */
  type: string;
  description: string;
  /** Where it comes from, e.g. 'MoverTests plugin', 'project'. */
  source: string;
  /** Relevance tags so a prompt only carries the assets its domain needs. */
  domains: string[];
}

export const UE_KNOWN_ASSETS: KnownAsset[] = [
  {
    id: 'skm-manny',
    path: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny',
    type: 'SkeletalMesh',
    description:
      'Rigged player mannequin (UE 5.7 MoverTests plugin). No download — enable the plugin.',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'skm-manny-simple',
    path: '/MoverTests/Characters/Mannequins/Meshes/SKM_Manny_Simple',
    type: 'SkeletalMesh',
    description: 'Simplified mannequin used for the enemy in the vertical slice.',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'sk-mannequin',
    path: '/MoverTests/Characters/Mannequins/Meshes/SK_Mannequin',
    type: 'Skeleton',
    description: 'Target skeleton for Mixamo retargeting (mixamo_pipeline.py default).',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'abp-manny',
    path: '/MoverTests/Characters/Mannequins/Animations/ABP_Manny',
    type: 'AnimBlueprint',
    description:
      'Ready-made locomotion AnimBP (idle/walk/run) — avoids the AnimBP-authoring wall. Generated class: ABP_Manny_C.',
    source: 'MoverTests plugin',
    domains: ['character', 'animation'],
  },
  {
    id: 'mi-manny-01',
    path: '/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_01',
    type: 'MaterialInstance',
    description: 'Default mannequin material instance (player).',
    source: 'MoverTests plugin',
    domains: ['character'],
  },
  {
    id: 'mi-manny-02',
    path: '/MoverTests/Characters/Mannequins/Materials/Instances/Manny/MI_Manny_02',
    type: 'MaterialInstance',
    description:
      'Alternate mannequin MI — TOO SUBTLE for visual enemy distinction; prefer M_EnemyRed.',
    source: 'MoverTests plugin',
    domains: ['character'],
  },
  {
    id: 'm-enemy-red',
    path: '/Game/VerticalSlice/M_EnemyRed',
    type: 'Material',
    description:
      'Strong-red enemy material (base + emissive) — the enemy-distinction default, clearly distinct from the silver player mannequin.',
    source: 'project',
    domains: ['character'],
  },
  {
    id: 'thirdperson-mannequin-fallback',
    path: '/Game/Characters/Mannequins/ (ThirdPerson template — only if migrated)',
    type: 'SkeletalMesh + AnimBlueprint',
    description:
      'FALLBACK only: the ACharacter-based ThirdPerson mannequin + ABP_Manny/ABP_Quinn, to migrate into /Game/Characters/ if MoverTests ABP_Manny is ever found Mover-coupled. Documented, not the default.',
    source: 'ThirdPerson template',
    domains: ['character', 'animation'],
  },
];

/**
 * Render the known assets whose `domains` intersect `domains` as a markdown
 * block. Returns '' when `domains` is empty or nothing matches — so prompts
 * that don't opt in (or aren't character/animation) are unaffected.
 */
export function formatKnownAssets(domains: string[]): string {
  if (!domains || domains.length === 0) return '';
  const relevant = UE_KNOWN_ASSETS.filter((a) =>
    a.domains.some((d) => domains.includes(d)),
  );
  if (relevant.length === 0) return '';
  const lines = relevant.map(
    (a) => `- **${a.path}** (${a.type}, ${a.source}) — ${a.description}`,
  );
  return `## Known Project Assets (use these EXACT paths — do not invent paths)\n${lines.join('\n')}`;
}

/**
 * Map a PoF module id to the known-asset domains its generation prompts should
 * carry. Returns [] for modules that don't deal with characters/animation, so
 * `formatKnownAssets([])` injects nothing.
 */
export function knownAssetDomainsForModule(moduleId: string): string[] {
  switch (moduleId) {
    case 'arpg-character':
    case 'arpg-animation':
      return ['character', 'animation'];
    case 'arpg-enemy-ai':
      return ['character'];
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run it, verify it passes (writes the snapshot)**

Run: `npx vitest run src/__tests__/knowledge/ue-known-assets.test.ts`
Expected: PASS; a new `src/__tests__/knowledge/__snapshots__/ue-known-assets.test.ts.snap` is written.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowledge/ue-known-assets.ts src/__tests__/knowledge/ue-known-assets.test.ts src/__tests__/knowledge/__snapshots__/ue-known-assets.test.ts.snap
git commit -m "feat(knowledge): ue-known-assets registry (mannequin paths + M_EnemyRed)"
```

---

## Task 2: Inject known-assets into the context header

**Files:**
- Modify: `src/lib/prompt-context.ts` (interface `ContextHeaderOptions` ~line 234; `buildProjectContextHeader` append ~line 385)
- Test: `src/__tests__/prompts/known-assets-injection.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/prompts/known-assets-injection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/proj/PoF',
  ueVersion: '5.7',
};

describe('buildProjectContextHeader known-assets injection', () => {
  it('includes known assets when a character domain is opted in', () => {
    const out = buildProjectContextHeader(ctx, { knownAssetDomains: ['character'] });
    expect(out).toContain('## Known Project Assets');
    expect(out).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
  });

  it('does not include known assets when not opted in', () => {
    const out = buildProjectContextHeader(ctx);
    expect(out).not.toContain('## Known Project Assets');
  });

  it('does not include known assets for an empty domain list', () => {
    const out = buildProjectContextHeader(ctx, { knownAssetDomains: [] });
    expect(out).not.toContain('## Known Project Assets');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/prompts/known-assets-injection.test.ts`
Expected: FAIL — the first test fails (`## Known Project Assets` not found) and/or a TS error on the unknown `knownAssetDomains` opt.

- [ ] **Step 3: Edit `prompt-context.ts` (additive)**

(a) Add the import near the existing gotchas import (line ~12, next to `import { formatGotchas } from '@/lib/knowledge/ue-gotchas';`):

```ts
import { formatKnownAssets } from '@/lib/knowledge/ue-known-assets';
```

(b) Add the field to `ContextHeaderOptions` (after `promptKind?: PromptKind;`, line ~244):

```ts
  /** Known-asset domains to inject (e.g. ['character','animation']). Empty/omitted → nothing injected. */
  knownAssetDomains?: string[];
```

(c) In `buildProjectContextHeader`, immediately after the tripwire append (the lines `const tripwire = formatBinaryContentTripwire(promptKind); if (tripwire) header += ...`, ~line 385), add:

```ts
  const knownAssets = formatKnownAssets(opts.knownAssetDomains ?? []);
  if (knownAssets) header += `\n\n${knownAssets}`;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/prompts/known-assets-injection.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompt-context.ts src/__tests__/prompts/known-assets-injection.test.ts
git commit -m "feat(prompts): opt-in known-assets injection in the context header"
```

---

## Task 3: Wire `buildTaskPrompt` to opt in by module

**Files:**
- Modify: `src/lib/cli-task.ts` (`buildTaskPrompt` ~line 215; the `checklist`/`quick-action`/`feature-fix` header calls at ~221, ~243, ~253)
- Test: `src/__tests__/lib/cli-task-known-assets.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/cli-task-known-assets.test.ts` (mirrors the `TaskFactory.checklist(...)` idiom already used in `src/__tests__/lib/cli-task.test.ts:13`):

```ts
import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/proj/PoF',
  ueVersion: '5.7',
};

describe('buildTaskPrompt known-assets wiring by module', () => {
  it('injects mannequin paths for a character checklist task', () => {
    const task = TaskFactory.checklist(
      'arpg-character',
      'cc-1',
      'Create the player character.',
      'Player',
      'http://localhost:3000',
    );
    const out = buildTaskPrompt(task, ctx);
    expect(out).toContain('/MoverTests/Characters/Mannequins/Meshes/SKM_Manny');
  });

  it('does not inject mannequin paths for an unrelated module', () => {
    const task = TaskFactory.checklist(
      'arpg-loot',
      'loot-1',
      'Create a loot table.',
      'Loot',
      'http://localhost:3000',
    );
    const out = buildTaskPrompt(task, ctx);
    expect(out).not.toContain('/MoverTests/');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/lib/cli-task-known-assets.test.ts`
Expected: FAIL — the character task's output does not yet contain the MoverTests path.

- [ ] **Step 3: Edit `cli-task.ts` (additive)**

(a) Add the import near the top (next to the `buildProjectContextHeader` import at line ~12):

```ts
import { knownAssetDomainsForModule } from '@/lib/knowledge/ue-known-assets';
```

(b) In `buildTaskPrompt`, just after `const isUE5 = ...;` (line ~216), compute the domains once:

```ts
  const knownAssetDomains = isUE5 ? knownAssetDomainsForModule(task.moduleId) : [];
```

(c) Pass it to the three generation header calls. Change:
- line ~221 (checklist): `const header = buildProjectContextHeader(ctx);` → `const header = buildProjectContextHeader(ctx, { knownAssetDomains });`
- line ~243 (quick-action / ask-claude): `const header = buildProjectContextHeader(ctx);` → `const header = buildProjectContextHeader(ctx, { knownAssetDomains });`
- line ~253 (feature-fix): `const header = buildProjectContextHeader(ctx);` → `const header = buildProjectContextHeader(ctx, { knownAssetDomains });`

(Leave `feature-review` and any `module-scan` header calls unchanged — those are review/scan prompts that don't generate assets. `knownAssetDomains` is `[]` for non-character modules, so this is a no-op there.)

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/lib/cli-task-known-assets.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cli-task.ts src/__tests__/lib/cli-task-known-assets.test.ts
git commit -m "feat(cli-task): opt character/enemy prompts into known-assets injection"
```

---

## Task 4: `ai-behavior` module — BT-wall tip + pure-C++ controller item

**Files:**
- Modify: `src/lib/module-registry.ts` (the `ai-behavior` entry, `id: 'ai-behavior'` at ~line 776 — its `knowledgeTips` ~788 and `checklist` ~791)
- Test: `src/__tests__/registry/ai-behavior-surface.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/registry/ai-behavior-surface.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SUB_MODULE_MAP } from '@/lib/module-registry';

describe('ai-behavior module surfaces the BT wall + a pure-C++ controller', () => {
  const mod = SUB_MODULE_MAP['ai-behavior'];

  it('exists', () => {
    expect(mod).toBeDefined();
  });

  it('has a knowledge tip acknowledging the BT-graph wall', () => {
    const tips = (mod!.knowledgeTips ?? [])
      .map((t) => `${t.title} ${t.content}`)
      .join(' ');
    expect(tips).toContain('cannot be authored from Python');
  });

  it('has a pure-C++ AI controller checklist item that needs no Behaviour Tree', () => {
    const items = mod!.checklist ?? [];
    const hit = items.find((i) =>
      /pure-?c\+\+/i.test(i.label) ||
      /no behaviour tree|without a behaviour tree/i.test(`${i.label} ${i.prompt}`),
    );
    expect(hit, 'a pure-C++ AI controller checklist item').toBeTruthy();
    expect(hit!.prompt).toContain('AAIController');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/__tests__/registry/ai-behavior-surface.test.ts`
Expected: FAIL — no BT-wall tip, no pure-C++ item yet.

- [ ] **Step 3: Edit the `ai-behavior` entry in `module-registry.ts` (additive)**

(a) Add to the `knowledgeTips` array (after the existing `'AI is Claude\'s strength'` tip, ~line 789):

```ts
      { title: 'Behaviour Trees are binary content', content: 'BT graphs cannot be authored from Python (same wall as UMG/AnimBP). PoF generates the C++ leaf nodes (BTTask/BTService/BTDecorator); the BT graph itself is editor-authored. For a vertical slice or a simple enemy, prefer the pure-C++ AI controller below.', source: 'vertical-slice: characters' },
```

(b) Add a new checklist item at the end of the `checklist` array (after `ai-6`, ~line 797):

```ts
    { id: 'ai-7', label: 'Pure-C++ AI controller (no Behaviour Tree)', description: 'A BT-free AAIController that chases the player and attacks on range — sidesteps the BT-graph binary-content wall.', prompt: 'Create a pure-C++ AARPGSimpleAIController : AAIController for my UE5 project — NO Behaviour Tree and NO blackboard (BT graphs are binary content that cannot be authored from Python). In OnPossess: cache the controlled enemy pawn. In Tick: get the player pawn via UGameplayStatics::GetPlayerPawn; if both are alive, compute distance; if farther than the enemy AttackRange, steer toward the player with AddMovementInput (nav-independent on a flat arena) or MoveToActor (requires a NavMeshBoundsVolume); when within range, face the player (SetActorRotation toward it) and activate the enemy attack ability BY GAMEPLAY TAG (AbilitySystemComponent->TryActivateAbilitiesByTag) respecting a per-instance attack cooldown. Set this class as AIControllerClass on the enemy Blueprint — IMPORTANT: set it on the PLACED INSTANCE in the level, not only the CDO, because a UE Python session can bake the native default into the .umap and silently override the CDO at runtime. Add "AIModule" to PublicDependencyModuleNames in the Build.cs if it is not already there. Verify with an AFunctionalTest that places the player within range and asserts the player GAS Health drops — do NOT rely on a file-existence check, which is gameable.' },
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/__tests__/registry/ai-behavior-surface.test.ts`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/module-registry.ts src/__tests__/registry/ai-behavior-surface.test.ts
git commit -m "feat(ai-behavior): BT-wall knowledge tip + pure-C++ AI controller checklist item"
```

---

## Task 5: Full validation gate

**Files:** none (verifies the whole change set).

- [ ] **Step 1: Run the full gate**

Run: `npm run validate`  (typecheck + lint + test)
Expected: all green — no TS errors, no ESLint errors (watch for: unused imports, raw `console`, hardcoded hex, `../../` imports), all tests pass including the 4 new files + the snapshot.

- [ ] **Step 2: Fix any issues inline, re-run**

If lint flags an unused import (e.g. a leftover `PromptKind` import in the new registry file — there should be none, the file imports nothing), or typecheck flags the `knownAssetDomains` opt, fix and re-run `npm run validate` until green.

- [ ] **Step 3: Final commit (only if Step 2 changed files)**

```bash
git add -p
git commit -m "chore: validation fixups for known-assets + ai-behavior"
```

---

## Self-Review

**Spec coverage:**
- Spec Design §1 (registry) → Task 1 (`ue-known-assets.ts` with the mannequin set + `M_EnemyRed` + TP fallback + `formatKnownAssets`). The `knownAssetDomainsForModule` mapping also lands here (plan-time refinement: domains are `character`/`animation` only — the AI module's guidance comes from the module registry in Task 4, not from asset injection, since AI controllers need no asset paths; `arpg-enemy-ai`→`['character']`).
- Spec Design §2 (prompt wiring) → Task 2 (the `knownAssetDomains` opt + append) + Task 3 (the `moduleId`→domains opt-in in `buildTaskPrompt`).
- Spec Design §3 (ai-behavior updates) → Task 4 (BT-wall tip + `ai-7` item).
- Spec Design §4 (tests) → the test in every task + the "non-character header unchanged" assertion (Task 2, test 2/3; Task 3, test 2).
- Spec DoD #5 ("no existing prompt changes unless its domain opts in") → Task 2 test "does not include … when not opted in" + Task 3 test "unrelated module".

**Placeholder scan:** none — every code step has complete, runnable code; every run step has an exact command + expected result.

**Type consistency:** `formatKnownAssets(domains: string[])`, `knownAssetDomainsForModule(moduleId: string): string[]`, and `KnownAsset` are used identically across Tasks 1–3 and the tests; `ContextHeaderOptions.knownAssetDomains?: string[]` matches the call `buildProjectContextHeader(ctx, { knownAssetDomains })`; `SUB_MODULE_MAP['ai-behavior']` and `TaskFactory.checklist(moduleId, itemId, prompt, label, appOrigin)` match the verified exports/signatures.
