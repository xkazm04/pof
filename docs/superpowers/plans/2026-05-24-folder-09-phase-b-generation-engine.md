# Folder 09 · Round 1 · Phase B — Generation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (chosen: inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** On top of Phase-A's lifecycle/persistence foundation, build the recipe-based generation engine — a typed `GenerationRecipe`, the Spellbook recipe, a `PromptBuilder.withAssetSpec(entity)` section, a `'generate'` `CLITaskType` + `TaskFactory.generate(entity, step)` wired to the `/api/catalog` `@@CALLBACK`, a single-dispatch batch queue, the `useGeneration` hook, and a Spellbook "(Re)generate" affordance.

**Architecture:** `recipe.ts` defines per-step prompts (pure, snapshot-testable) consuming an `AbilityEntry`. `cli-task.ts` gains a `'generate'` task whose `buildTaskPrompt` case assembles the recipe prompt + a callback to `/api/catalog` (`action:'transition'`, tamper-proof `staticFields {catalogId, entityId, nextLifecycle}`). `batch.ts` runs one dispatch at a time. `useGeneration` wraps `useModuleCLI.execute` + optimistic `applyLifecycle`. The Spellbook tab gets a per-ability "(Re)generate" button.

**Tech Stack:** TypeScript, Vitest, the existing `PromptBuilder`/`cli-task`/`useModuleCLI` seams, Zustand catalogStore (Phase A).

**Spec:** [`../specs/2026-05-24-folder-09-round-1-core-engine-generator-design.md`](../specs/2026-05-24-folder-09-round-1-core-engine-generator-design.md) §0 + §3.4. **Phase A plan:** [`2026-05-24-folder-09-generation-engine.md`](2026-05-24-folder-09-generation-engine.md).

**Reuse / additive-edit discipline (shared repo, 50+ worktrees):** `prompt-builder.ts` and `cli-task.ts` are **shared, hot files** — re-read each immediately before editing; add only (new method / new task type / new factory); never reformat existing code. `AbilitySpellbook/abilities/AbilitiesSection.tsx` was just retrofitted by the Step-1 CLI — **B6 re-reads it and stops if it conflicts**. Targeted `git add` per task; commit locally to master.

**Grounded facts:**
- `SpellbookAbility` (from `…/AbilitySpellbook/data`): `{ id, name, category, element, tier, damage, manaCost, cooldown, radar:[5], description, color, tag }`. `off-fire-01` = "Fireball", tag `Ability.Fire.Fireball`, damage 35, manaCost 20, cooldown 3.
- `AbilityEntry` (Phase A): `CatalogEntityBase & { catalogId:'spellbook'; data: SpellbookAbility }`.
- `useModuleCLI({moduleId, sessionKey, label, accentColor, onComplete}).execute(task)` scans the project, calls `buildTaskPrompt(task, ctx)`, dispatches; `@@CALLBACK` resolution (POST to the task's callback url) is handled by the terminal.
- `cli-task.ts` exports `CLITaskType`, `CLITask`, `buildTaskPrompt`, `TaskFactory`, `registerCallback`, `buildCallbackSection` (internal), `getCallback`.

---

## Phases B5/B6 note

B1–B4 (engine core: new files + minimal additive edits to `prompt-builder.ts` and `cli-task.ts`) are detailed below and fully TDD'd. **B5 (`useGeneration` hook) and B6 (Spellbook affordance)** touch UI + the collision-prone `AbilitiesSection.tsx`; they are outlined at the end and executed after a re-read checkpoint, so the exact JSX insertion is decided against the file's then-current state.

---

## Task B1: `recipe.ts` — recipe model + Spellbook recipe

**Files:**
- Create: `src/lib/catalog/recipe.ts`
- Test: `src/__tests__/lib/catalog/recipe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/recipe.test.ts
import { describe, it, expect } from 'vitest';
import { getRecipe, STEP_TO_LIFECYCLE, SPELLBOOK_RECIPE } from '@/lib/catalog/recipe';
import type { AbilityEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.7', dynamicContext: undefined,
};

const fireball: AbilityEntry = {
  id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: {
    id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 35, manaCost: 20, cooldown: 3, radar: [0.7, 0.85, 0.3, 0.5, 0.5],
    description: 'Hurl a ball of fire', color: '#f00', tag: 'Ability.Fire.Fireball',
  },
};

describe('getRecipe', () => {
  it('returns the spellbook recipe for the spellbook catalog', () => {
    expect(getRecipe('spellbook')).toBe(SPELLBOOK_RECIPE);
  });
  it('returns undefined for a catalog with no recipe yet', () => {
    expect(getRecipe('bestiary')).toBeUndefined();
  });
});

describe('STEP_TO_LIFECYCLE', () => {
  it('maps each step to its resulting lifecycle', () => {
    expect(STEP_TO_LIFECYCLE['scaffold-cpp']).toBe('scaffolded');
    expect(STEP_TO_LIFECYCLE['author-python']).toBe('generated');
    expect(STEP_TO_LIFECYCLE['wire']).toBe('wired');
    expect(STEP_TO_LIFECYCLE['verify']).toBe('verified');
  });
});

describe('SPELLBOOK_RECIPE.buildStepPrompt', () => {
  it('orders the four pipeline steps', () => {
    expect(SPELLBOOK_RECIPE.steps).toEqual(['scaffold-cpp', 'author-python', 'wire', 'verify']);
  });
  it('embeds the ability spec (name, tag, stats) in the scaffold prompt', () => {
    const p = SPELLBOOK_RECIPE.buildStepPrompt(fireball, 'scaffold-cpp', ctx);
    expect(p).toContain('Asset Specification');
    expect(p).toContain('Ability.Fire.Fireball');
    expect(p).toContain('Fireball');
    expect(p).toContain('UARPGGameplayAbility'); // GAS convention from best-practices
  });
  it('references the functional test in the verify prompt', () => {
    const p = SPELLBOOK_RECIPE.buildStepPrompt(fireball, 'verify', ctx);
    expect(p).toContain(SPELLBOOK_RECIPE.testPath!);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/recipe.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/catalog/recipe"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/catalog/recipe.ts
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityEntry, CatalogEntityBase, LifecycleState } from '@/lib/catalog/types';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';

export type GenerationStep = 'scaffold-cpp' | 'author-python' | 'wire' | 'verify';

/** The lifecycle a completed step advances the entity to. */
export const STEP_TO_LIFECYCLE: Record<GenerationStep, LifecycleState> = {
  'scaffold-cpp': 'scaffolded',
  'author-python': 'generated',
  'wire': 'wired',
  'verify': 'verified',
};

export interface GenerationRecipe<T extends CatalogEntityBase = CatalogEntityBase> {
  id: string;
  catalogId: string;
  steps: GenerationStep[];
  /** Functional test that gates the verify step. */
  testPath?: string;
  buildStepPrompt(entity: T, step: GenerationStep, ctx: ProjectContext): string;
}

/** GAS conventions carried into every Spellbook generation prompt (from the Ability Forge knowledge). */
const GAS_BEST_PRACTICES = [
  'The ability MUST extend `UARPGGameplayAbility` (include "AbilitySystem/ARPGGameplayAbility.h").',
  'Constructor sets SetAssetTags, ActivationOwnedTags, ActivationBlockedTags, AbilityManaCost, CooldownGameplayEffectClass, AbilityCooldownTag.',
  '`State.Dead` and `State.Stunned` are always in ActivationBlockedTags.',
  'Use SetByCaller `Data.Damage.Base` for damage, not hardcoded GE magnitudes.',
  'Gray-box first: if the montage is empty, drive damage with a WaitDelay fallback window (the GA_MeleeAttack pattern) so the gameplay still lands.',
  'CDO-vs-instance: set class-pointer props on the placed instance, not only the CDO.',
];

const STEP_TASK: Record<GenerationStep, (e: AbilityEntry) => string> = {
  'scaffold-cpp': (e) =>
    `Scaffold the C++ \`UGameplayAbility\` subclass for "${e.name}" (activation tag \`${e.data.tag}\`). ` +
    `Create the header + cpp under Source/PoF/AbilitySystem/, compile with the editor CLOSED, then report.`,
  'author-python': (e) =>
    `Author the Blueprint config + GameplayEffect data for "${e.name}" via the FULL editor ` +
    `(\`-ExecutePythonScript=\`), not \`-run=pythonscript\`. Build the BP_GA_${e.name.replace(/\s+/g, '')} config asset.`,
  'wire': (e) =>
    `Wire "${e.name}" so it activates in-game: grant it on the player's DefaultAbilities and bind its input/tag ` +
    `(\`${e.data.tag}\`). Set class-pointer props on the placed instance, not only the CDO.`,
  'verify': (e) =>
    `Run the functional test that proves "${e.name}" works in-engine (activate by tag → target attribute changes). ` +
    `Judge success by the test result in the Automation log, not file existence.`,
};

export const SPELLBOOK_RECIPE: GenerationRecipe<AbilityEntry> = {
  id: 'spellbook-ga',
  catalogId: 'spellbook',
  steps: ['scaffold-cpp', 'author-python', 'wire', 'verify'],
  testPath: 'Project.Functional Tests.Maps.VSAbility.VSAbilityTest',
  buildStepPrompt(entity, step, ctx) {
    const builder = new PromptBuilder()
      .withProjectContext(ctx)
      .withDomainContext('Gameplay Ability System (GAS) authoring for the PoF ARPG.')
      .withAssetSpec(entity)
      .withTask(`Spellbook · ${step}`, STEP_TASK[step](entity))
      .withBestPractices(GAS_BEST_PRACTICES);
    if (step === 'verify') {
      builder.withSuccessCriteria([
        `The functional test \`${this.testPath}\` returns Result={Success}.`,
        `"${entity.name}" activates by tag \`${entity.data.tag}\` and changes the target's attribute.`,
      ]);
    }
    return builder.build();
  },
};

const RECIPES: Record<string, GenerationRecipe<AbilityEntry>> = {
  spellbook: SPELLBOOK_RECIPE,
};

/** The recipe for a catalog, or undefined if none is registered yet. */
export function getRecipe(catalogId: string): GenerationRecipe | undefined {
  return RECIPES[catalogId];
}
```

> Depends on `PromptBuilder.withAssetSpec` (Task B2). If running strictly in order, B2's method won't exist yet — write B2 first, or stub `withAssetSpec` is unavailable. **Execution order: do B2 before B1's Step 4.** (B1 Step 1–3 can be written; the test passes only after B2 lands.) To keep each task green-on-commit, **B2 is committed first** (see ordering note).

- [ ] **Step 4: (after B2) Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/recipe.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/recipe.ts src/__tests__/lib/catalog/recipe.test.ts
git commit -m "feat(catalog): generation recipe model + Spellbook GA recipe (folder-09 R1 Phase B)"
```

**Ordering note:** execute **B2 first** (it has no dependency on B1), then B1, so every commit is green.

---

## Task B2: `PromptBuilder.withAssetSpec(entity)` (additive)

**Files:**
- Modify: `src/lib/prompts/prompt-builder.ts`
- Test: `src/__tests__/prompts/asset-spec.test.ts`

Adds one section. Renders after Task Instructions, before Wiring Requirements.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/prompts/asset-spec.test.ts
import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '@/lib/prompts/prompt-builder';

describe('PromptBuilder.withAssetSpec', () => {
  const built = new PromptBuilder()
    .withRawProjectContext('## Project Context\nPoF')
    .withAssetSpec({
      id: 'ga-fireball', name: 'Fireball',
      categoryPath: ['Offensive', 'Fire'], tags: ['basic'],
      data: { tag: 'Ability.Fire.Fireball', damage: 35 },
    })
    .withRawTask('## Task\nGenerate it')
    .build();

  it('includes an Asset Specification section with the entity fields', () => {
    expect(built).toContain('## Asset Specification');
    expect(built).toContain('Fireball');
    expect(built).toContain('Offensive ▸ Fire');
  });
  it('serializes the typed data payload as JSON', () => {
    expect(built).toContain('"tag": "Ability.Fire.Fireball"');
    expect(built).toContain('"damage": 35');
  });
  it('renders the spec after the task and before nothing breaks build()', () => {
    expect(built.indexOf('## Task')).toBeLessThan(built.indexOf('## Asset Specification'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/prompts/asset-spec.test.ts`
Expected: FAIL — `withAssetSpec is not a function`.

- [ ] **Step 3: Re-read `prompt-builder.ts`, then add the field + method + build() line (additive)**

Re-read the file. Add a private field next to the others:
```ts
  private _assetSpec: string | null = null;
```
Add the method (after `withRawTask`):
```ts
  /**
   * Set the Asset Specification section — serializes a catalog entity's identity
   * and typed `data` payload so the generation recipe can turn it into UE.
   */
  withAssetSpec(entity: {
    id: string; name: string; categoryPath: string[]; tags: string[];
    data?: Record<string, unknown>;
  }): this {
    const lines = [
      '## Asset Specification',
      '',
      `- **id**: \`${entity.id}\``,
      `- **name**: ${entity.name}`,
      `- **category**: ${entity.categoryPath.join(' ▸ ')}`,
      `- **tags**: ${entity.tags.length ? entity.tags.join(', ') : '(none)'}`,
    ];
    if (entity.data && Object.keys(entity.data).length > 0) {
      lines.push('', '```json', JSON.stringify(entity.data, null, 2), '```');
    }
    this._assetSpec = lines.join('\n');
    return this;
  }
```
In `build()`, render it immediately after `parts.push(this._taskInstructions);`:
```ts
    parts.push(this._taskInstructions);

    if (this._assetSpec) {
      parts.push(this._assetSpec);
    }
```
Optionally add `{ section: 'assetSpec', present: !!this._assetSpec }` to `audit()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/prompts/asset-spec.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts/prompt-builder.ts src/__tests__/prompts/asset-spec.test.ts
git commit -m "feat(prompts): PromptBuilder.withAssetSpec section (folder-09 R1 Phase B)"
```

---

## Task B3: `'generate'` CLITask + `TaskFactory.generate`

**Files:**
- Modify: `src/lib/cli-task.ts`
- Test: `src/__tests__/lib/catalog/generate-task.test.ts`

Adds a `'generate'` task type whose `buildTaskPrompt` case emits the recipe's step prompt + a callback to `/api/catalog` (`action:'transition'`) with tamper-proof `staticFields`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/generate-task.test.ts
import { describe, it, expect } from 'vitest';
import { buildTaskPrompt, TaskFactory } from '@/lib/cli-task';
import type { GenerateTask } from '@/lib/cli-task';
import type { AbilityEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF', projectPath: 'C:/proj/PoF', ueVersion: '5.7', dynamicContext: undefined,
};
const fireball: AbilityEntry = {
  id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: {
    id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 35, manaCost: 20, cooldown: 3, radar: [0.7, 0.85, 0.3, 0.5, 0.5],
    description: 'Hurl a ball of fire', color: '#f00', tag: 'Ability.Fire.Fireball',
  },
};

describe('TaskFactory.generate', () => {
  it('builds a generate task carrying entity + step + origin', () => {
    const t = TaskFactory.generate('arpg-gas', fireball, 'scaffold-cpp', 'http://localhost:3000', 'Gen Fireball');
    expect(t.type).toBe('generate');
    expect(t.step).toBe('scaffold-cpp');
    expect(t.entity.id).toBe('ga-fireball');
  });
});

describe('buildTaskPrompt(generate)', () => {
  const t: GenerateTask = TaskFactory.generate('arpg-gas', fireball, 'scaffold-cpp', 'http://localhost:3000', 'Gen Fireball');
  const prompt = buildTaskPrompt(t, ctx);

  it('embeds the recipe step prompt (asset spec + GAS convention)', () => {
    expect(prompt).toContain('Asset Specification');
    expect(prompt).toContain('Ability.Fire.Fireball');
    expect(prompt).toContain('UARPGGameplayAbility');
  });
  it('includes a @@CALLBACK block targeting the transition action', () => {
    expect(prompt).toContain('@@CALLBACK:');
    expect(prompt).toContain('ueAssets');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/generate-task.test.ts`
Expected: FAIL — `generate` is not a property of `TaskFactory`.

- [ ] **Step 3: Re-read `cli-task.ts`, then add the type, interface, build case, and factory (additive)**

Re-read the file. Make these additive changes:

(a) Extend the `CLITaskType` union with `| 'generate'`.

(b) Add the task interface (after the other `*Task` interfaces):
```ts
import type { AbilityEntry } from '@/lib/catalog/types';
import { getRecipe, STEP_TO_LIFECYCLE, type GenerationStep } from '@/lib/catalog/recipe';

/**
 * Generation task — drives one recipe step for a catalog entity and reports
 * the produced UE assets + lifecycle transition back to /api/catalog.
 */
export interface GenerateTask extends CLITask {
  type: 'generate';
  entity: AbilityEntry;
  step: GenerationStep;
  appOrigin: string;
}
```

(c) Add a `case 'generate':` in `buildTaskPrompt` (before `default:`):
```ts
    case 'generate': {
      const gt = task as GenerateTask;
      const recipe = getRecipe(gt.entity.catalogId);
      if (!recipe) return gt.entity.name; // no recipe — nothing to dispatch
      const base = recipe.buildStepPrompt(gt.entity, gt.step, ctx);
      const cbId = registerCallback({
        url: `${gt.appOrigin}/api/catalog`,
        method: 'POST',
        staticFields: {
          action: 'transition',
          catalogId: gt.entity.catalogId,
          entityId: gt.entity.id,
          nextLifecycle: STEP_TO_LIFECYCLE[gt.step],
        },
        schemaHint: '  "ueAssets": ["<UE asset path(s) you created/modified>"],\n  "testResult": "pass|fail"  // only for the verify step',
      });
      return `${base}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
    }
```

(d) Add the factory method to `TaskFactory`:
```ts
  /** Create a generation task for one recipe step of a catalog entity. */
  generate(
    moduleId: SubModuleId,
    entity: AbilityEntry,
    step: GenerationStep,
    appOrigin: string,
    label: string,
  ): GenerateTask {
    return { type: 'generate', moduleId, prompt: '', label, entity, step, appOrigin };
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/generate-task.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cli-task.ts src/__tests__/lib/catalog/generate-task.test.ts
git commit -m "feat(cli-task): 'generate' task type + TaskFactory.generate → /api/catalog callback (folder-09 R1 Phase B)"
```

---

## Task B4: `batch.ts` — single-dispatch queue

**Files:**
- Create: `src/lib/catalog/batch.ts`
- Test: `src/__tests__/lib/catalog/batch.test.ts`

Pure queue logic with an injectable async `dispatch(entity, step)` so it's testable without the CLI: runs **one at a time**, advances each only on its own success, and a failure marks that entity failed without aborting the rest.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/catalog/batch.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runBatch } from '@/lib/catalog/batch';

describe('runBatch', () => {
  it('dispatches one entity at a time (never concurrent)', async () => {
    let active = 0; let maxActive = 0;
    const dispatch = vi.fn(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--; return { ok: true as const };
    });
    await runBatch(['a', 'b', 'c'], 'scaffold-cpp', dispatch);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
  });

  it('reports per-entity results and continues past a failure', async () => {
    const dispatch = vi.fn(async (id: string) =>
      id === 'b' ? { ok: false as const, error: 'boom' } : { ok: true as const });
    const res = await runBatch(['a', 'b', 'c'], 'wire', dispatch);
    expect(res).toEqual([
      { entityId: 'a', ok: true },
      { entityId: 'b', ok: false, error: 'boom' },
      { entityId: 'c', ok: true },
    ]);
    expect(dispatch).toHaveBeenCalledTimes(3); // failure did not abort the queue
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/catalog/batch.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/catalog/batch"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/catalog/batch.ts
import type { GenerationStep } from '@/lib/catalog/recipe';

export type DispatchResult = { ok: true } | { ok: false; error: string };
export interface BatchEntryResult { entityId: string; ok: boolean; error?: string }

/**
 * Run a generation step across many entities as a queue — exactly one dispatch
 * in flight at a time (the SP-B single-dispatch lesson). Each entity's result is
 * recorded; a failure does not abort the rest.
 */
export async function runBatch(
  entityIds: string[],
  step: GenerationStep,
  dispatch: (entityId: string, step: GenerationStep) => Promise<DispatchResult>,
): Promise<BatchEntryResult[]> {
  const results: BatchEntryResult[] = [];
  for (const entityId of entityIds) {
    try {
      const r = await dispatch(entityId, step);
      results.push(r.ok ? { entityId, ok: true } : { entityId, ok: false, error: r.error });
    } catch (e) {
      results.push({ entityId, ok: false, error: e instanceof Error ? e.message : 'dispatch threw' });
    }
  }
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/catalog/batch.test.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalog/batch.ts src/__tests__/lib/catalog/batch.test.ts
git commit -m "feat(catalog): single-dispatch batch queue (folder-09 R1 Phase B)"
```

---

## Engine-core checkpoint

After B2→B1→B3→B4: run
`npx vitest run src/__tests__/lib/catalog src/__tests__/prompts/asset-spec.test.ts` (expect all green) and `npx tsc --noEmit` (expect 0 project-wide). Commit boundary; **checkpoint with the operator before B5/B6** (they touch the shared, recently-retrofitted Spellbook UI).

---

## Task B5 (outline): `useGeneration` hook

**Files:** Create `src/hooks/useGeneration.ts`; Test `src/__tests__/hooks/useGeneration.test.ts` (logic-only via mocked `useModuleCLI`).

Wraps `useModuleCLI({ moduleId:'arpg-gas', sessionKey:`gen-${entity.id}`, … })`. `generate(entity, step)`:
1. optimistic: `useCatalogStore.getState().setGenerationRun?`/`applyLifecycle` is **not** called pre-dispatch (gate is server-authoritative); instead set an in-flight marker.
2. `execute(TaskFactory.generate('arpg-gas', entity, step, getAppOrigin(), `Gen ${entity.name}`))`.
3. on the callback-driven `/api/catalog` success, re-fetch lifecycle and `loadLifecycle(records)` so the badge reflects server truth.
Detailed steps written after the engine-core checkpoint (depends on final hook shape + `getAppOrigin` import).

## Task B6 (outline): Spellbook "(Re)generate" affordance

**Files:** Modify `AbilitySpellbook/abilities/AbilitiesSection.tsx` (re-read first — Step-1 CLI owns it).

Add a small "(Re)generate" button on the selected-ability card next to the existing `LifecycleBadge`, calling `useGeneration().generate(entry, nextStepFor(entry.lifecycle))`. Disabled while running. **Re-read the file immediately before editing; if its structure has changed or another session added a generation affordance, STOP and report rather than conflict.** No new test (UI wiring); verify via `npm run typecheck` + targeted catalog tests staying green + a no-regression read.

---

## Self-review notes

- **Spec coverage (§3.4):** recipe model + Spellbook recipe ✔ (B1), `.withAssetSpec` ✔ (B2), `'generate'` task + `TaskFactory.generate` + `@@CALLBACK` to `/api/catalog` ✔ (B3), single-dispatch batch ✔ (B4), dispatch hook + UI affordance ✔ (B5/B6 outline). Live UE = Phase C.
- **Ordering:** B2 before B1 (B1's prompt uses `withAssetSpec`); then B3 (imports recipe), B4. Every commit green.
- **Type consistency:** `GenerationStep`, `STEP_TO_LIFECYCLE`, `GenerationRecipe`, `SPELLBOOK_RECIPE`, `getRecipe`, `GenerateTask`, `TaskFactory.generate`, `runBatch`/`DispatchResult`/`BatchEntryResult`, `withAssetSpec` are used identically across tasks/tests.
- **Additive-only edits** to `prompt-builder.ts` and `cli-task.ts`; `AbilitiesSection.tsx` re-read-gated.
