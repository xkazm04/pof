# Combat Folder-03 Pending-Points Resolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the genuinely-pending points of improvements folder 03 (combat) across the PoF app and the UE pure-C++ side, against the corrected (non-stale) baseline.

**Architecture:** Phase A lands entirely in the PoF app worktree (branch `combat-03-improvements`) and is fully verifiable with `npm run validate`. Phase C edits the *shared* UE tree (`C:\Users\kazda\Documents\Unreal Projects\PoF`, branch `main`) in place, committing only the exact files touched — its compile + functional-test verification is deferred to a user-coordinated editor close.

**Tech Stack:** TypeScript / React 19 / Zustand, Vitest, Playwright (app); Unreal Engine 5 C++ / GAS / AFunctionalTest (game).

**Spec:** `docs/superpowers/specs/2026-05-24-combat-pending-resolution-design.md`

---

## File Structure

**Phase A (app, worktree):**
- Modify: `src/lib/module-registry.ts` — extend `arpg-combat` checklist prompts with wiring contracts (A1).
- Modify: `src/lib/evaluator/module-eval-prompts.ts` — add `combat-trace` pass + `tracePass` field + `getPassesForModule` (A2); add parallel-Health flag to `arpg-combat` qualityChecks (A5).
- Modify: `src/lib/evaluator/deep-eval-engine.ts` — use per-module passes when caller doesn't override (A2).
- Create: `src/components/modules/core-engine/unique-tabs/CombatActionMap/attributes/attribute-defaults-export.ts` — pure Python emitter (A3).
- Create: `src/components/modules/core-engine/unique-tabs/CombatActionMap/attributes/AttributeDefaultsTab.tsx` — editor UI (A3).
- Modify: `.../CombatActionMap/data.ts` — add `attributes` subtab + `ATTRIBUTE_ROWS` defaults (A3).
- Modify: `.../CombatActionMap/index.tsx` — render the attributes subtab (A3).
- Create: `.../CombatActionMap/polish/combat-feel-export.ts` — pure Python emitter (A4).
- Modify: `.../CombatActionMap/polish/FeedbackTab.tsx` — add "Export to UE" affordance (A4).
- Create tests: `src/__tests__/lib/combat-wiring-contracts.test.ts` (A1), `src/__tests__/evaluator/combat-trace-pass.test.ts` (A2), `src/__tests__/lib/combat-feel-export.test.ts` (A4), `src/__tests__/lib/attribute-defaults-export.test.ts` (A3), `src/__tests__/evaluator/combat-parallel-health.test.ts` (A5), `src/__tests__/lib/dt-attribute-defaults-presence.test.ts` (A6), `e2e/combat-loop.spec.ts` (A6).

**Phase C (UE, shared tree — paths under `C:\Users\kazda\Documents\Unreal Projects\PoF\Source\PoF\`):**
- Modify: `Player/ARPGPlayerCharacter.h` / `.cpp` — GAS-backed health getters + sync (C1).
- Modify: `AbilitySystem/GA_MeleeAttack.h` / `.cpp` — hit-pause + camera-shake knobs (C2).
- Modify: the enemy death path (`Enemy/ARPGEnemyCharacter.cpp` `OnDeathFromAbility`) — ragdoll + fade (C3).
- Create: `Test/Combat/VSCombatDamageFormulaTest.h` / `.cpp`, `Test/Combat/VSCombatTwoHealthSystemsTest.h` / `.cpp`, `Test/Combat/VSCombatAnimationDrivenPathTest.h` / `.cpp` (C4). (Confirm the actual test dir — recon saw `VS*Test` files; match their location.)

---

# PHASE A — PoF app (worktree, fully verifiable)

## Task A1: Wiring contracts on the `arpg-combat` checklist

**Files:**
- Modify: `src/lib/module-registry.ts` (the `'arpg-combat'` array under `ARPG_CHECKLISTS`, starts ~line 196)
- Test: `src/__tests__/lib/combat-wiring-contracts.test.ts`

Each combat ability prompt gains a one-line wiring contract using the same vocabulary as `formatWiringRequirements` (Granted by / Activated by / Damage path / Required content assets). The contract text is appended to the existing prompt string — it does not replace the current guidance.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/combat-wiring-contracts.test.ts
import { describe, it, expect } from 'vitest';
import { ARPG_CHECKLISTS } from '@/lib/module-registry';

const COMBAT = ARPG_CHECKLISTS['arpg-combat'];

describe('arpg-combat wiring contracts', () => {
  it('every combat checklist item names the four wiring points', () => {
    for (const item of COMBAT) {
      const p = item.prompt;
      expect(p, `${item.id} Granted by`).toMatch(/Granted by/i);
      expect(p, `${item.id} Activated by`).toMatch(/Activated by/i);
      expect(p, `${item.id} Damage path`).toMatch(/Damage path/i);
      expect(p, `${item.id} Required content assets`).toMatch(/Required content assets/i);
    }
  });

  it('the melee item defaults its damage path to Direct (gray-box)', () => {
    const acb1 = COMBAT.find((c) => c.id === 'acb-1')!;
    expect(acb1.prompt).toMatch(/Damage path[^\n]*Direct/i);
    expect(acb1.prompt).toContain('bUseAnimationDrivenDamage');
  });

  it('the combat checklist prompts are stable', () => {
    expect(COMBAT.map((c) => ({ id: c.id, prompt: c.prompt }))).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/lib/combat-wiring-contracts.test.ts`
Expected: FAIL — current prompts have no "Granted by"/"Activated by"/etc.

- [ ] **Step 3: Append a wiring contract to each `arpg-combat` prompt**

For each item in the `'arpg-combat'` array, append a contract sentence to the end of its `prompt` string. Use these exact additions (append, keep existing text):

- `acb-1` (melee): append
  ` **Wiring contract** — Granted by: BP_VSPlayer DefaultAbilities. Activated by: input action IA_AbilitySlot1 (tag Ability.Melee.Light). Damage path: Direct (gray-box, bUseAnimationDrivenDamage=false). Required content assets: AM_MeleeCombo montage (flag as binary), GE_Damage, AnimNotifyState_HitDetection — none required for the gray-box path.`
- `acb-2` (combo): append
  ` **Wiring contract** — Granted by: rides on GA_MeleeAttack (no separate grant). Activated by: combo-window input during AnimNotify_ComboWindow. Damage path: Direct (per-section offsets) until a sectioned montage lands. Required content assets: AM_MeleeCombo with named sections (binary).`
- `acb-3` (hit detection): append
  ` **Wiring contract** — Granted by: enabled by GA_MeleeAttack when bUseAnimationDrivenDamage=true. Activated by: AnimNotifyState_HitDetection begin/end window. Damage path: Animation-driven (fires Event.MeleeHit). Required content assets: a montage carrying AnimNotifyState_HitDetection (binary).`
- `acb-4` (apply damage via GAS): append
  ` **Wiring contract** — Granted by: GE_Damage referenced by the activating ability. Activated by: OnMeleeHit / the Direct self-apply. Damage path: shared by both modes. Required content assets: GE_Damage GameplayEffect class, UARPGDamageExecution.`
- `acb-5` (hit reaction): append
  ` **Wiring contract** — Granted by: GA_HitReact in the target's DefaultAbilities. Activated by: Event.HitReact gameplay event from the damage pipeline. Damage path: N/A (reaction). Required content assets: AM_HitReact montage (binary), camera-shake class.`
- `acb-6` (dodge i-frames): append
  ` **Wiring contract** — Granted by: BP_VSPlayer DefaultAbilities. Activated by: IA_Dodge input (tag Ability.Dodge). Damage path: N/A. Required content assets: AM_Dodge_* directional montages (binary), State.Invulnerable tag.`
- `acb-7` (death flow): append
  ` **Wiring contract** — Granted by: GA_Death in DefaultAbilities. Activated by: Event.Death from PostGameplayEffectExecute when Health<=0. Damage path: N/A. Required content assets: AM_Death montage (binary, optional — death works without it).`
- `acb-8` (combat feedback): append
  ` **Wiring contract** — Granted by: C++ properties on UGA_MeleeAttack (HitStopDuration, HitCameraShake). Activated by: confirmed-hit in the damage path. Damage path: N/A. Required content assets: a UCameraShakeBase subclass, Niagara hit VFX (binary, optional).`
- `acb-9` (test dummy / loop): append
  ` **Wiring contract** — Granted by: the dummy actor's own ASC + DefaultAbilities. Activated by: the functional test driving an attack. Damage path: Direct (gray-box). Required content assets: none for gray-box validation.`

- [ ] **Step 4: Run the test (snapshot writes on first run)**

Run: `npx vitest run src/__tests__/lib/combat-wiring-contracts.test.ts`
Expected: PASS (snapshot created).

- [ ] **Step 5: Commit**

```bash
git add src/lib/module-registry.ts src/__tests__/lib/combat-wiring-contracts.test.ts src/__tests__/lib/__snapshots__/combat-wiring-contracts.test.ts.snap
git commit -m "feat(registry): add per-ability wiring contracts to arpg-combat checklist (folder-03 app §1)"
```

---

## Task A2: Combat-trace evaluator pass ("trace one hit")

**Files:**
- Modify: `src/lib/evaluator/module-eval-prompts.ts`
- Modify: `src/lib/evaluator/deep-eval-engine.ts:73-90` (the `passes` default + module loop)
- Test: `src/__tests__/evaluator/combat-trace-pass.test.ts`

The new pass is **not** added to the global `EVAL_PASSES` (that would make every module run it). Instead it is appended per-module only when the module declares a `tracePass`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/evaluator/combat-trace-pass.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildEvalPrompt, PASS_LABELS, EVAL_PASSES, getPassesForModule,
} from '@/lib/evaluator/module-eval-prompts';

describe('combat-trace evaluator pass', () => {
  it('is not part of the global default passes', () => {
    expect(EVAL_PASSES).not.toContain('combat-trace');
  });

  it('is appended only for arpg-combat', () => {
    expect(getPassesForModule('arpg-combat')).toContain('combat-trace');
    expect(getPassesForModule('arpg-loot')).not.toContain('combat-trace');
  });

  it('has a label', () => {
    expect(PASS_LABELS['combat-trace']).toBe('Combat Trace');
  });

  it('produces a one-hit call-graph prompt for arpg-combat', () => {
    const out = buildEvalPrompt({
      moduleId: 'arpg-combat', pass: 'combat-trace',
      projectName: 'PoF', moduleName: 'PoF', sourcePath: 'Source/PoF',
    });
    const lower = out.toLowerCase();
    expect(lower).toContain('trace one hit');
    expect(lower).toContain('call graph');
    expect(lower).toContain('attributes read');
    expect(lower).toContain('binary asset');
    expect(out).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/evaluator/combat-trace-pass.test.ts`
Expected: FAIL — `getPassesForModule` undefined, `'combat-trace'` not a pass.

- [ ] **Step 3a: Extend the pass type, labels, and context type**

In `src/lib/evaluator/module-eval-prompts.ts`:

```ts
export type EvalPass = 'ground-truth' | 'structure' | 'quality' | 'performance' | 'combat-trace';

export const EVAL_PASSES: EvalPass[] = ['ground-truth', 'structure', 'quality', 'performance'];

export const PASS_LABELS: Record<EvalPass, string> = {
  'ground-truth': 'Ground Truth',
  structure: 'Structure',
  quality: 'Quality',
  performance: 'Performance',
  'combat-trace': 'Combat Trace',
};
```

Add the optional field to the context interface:

```ts
interface ModuleEvalContext {
  focus: string;
  structureChecks: string;
  qualityChecks: string;
  performanceChecks: string;
  /** Optional combat-specific "trace one hit" pass (only arpg-combat sets it). */
  tracePass?: string;
}
```

- [ ] **Step 3b: Add the trace prompt to the `arpg-combat` context**

Inside `MODULE_CONTEXTS['arpg-combat']`, add a `tracePass` field (after `performanceChecks`):

```ts
    tracePass: `For ability GA_MeleeAttack, trace ONE hit end-to-end. Produce a numbered call graph naming, in order:
1. The actor that activates the ability and HOW (input action / tag / AI controller call).
2. The activation tag/event and the ability's ActivateAbility entry point.
3. The damage path taken — Direct (gray-box self-apply) vs Animation-driven (Event.MeleeHit notify) — and which branch runs when bUseAnimationDrivenDamage is false.
4. The GameplayEffect applied (GE_Damage) and the execution calc (UARPGDamageExecution).
5. The attributes READ (e.g. AttackPower, Armor, CriticalChance, resistances) and the attributes WRITTEN (IncomingDamage, Health).
6. The delegate(s) broadcast on damage/death (OnHealthChanged, Event.Death, OnEnemyDeath) and their listeners.
Then FLAG any step that needs a binary asset (montage, AnimNotify in a montage, BT, .umap) that cannot be authored from code. If the damage GE reads an attribute that no GE/DataTable sets (e.g. Armor with no DT_AttributeDefaults), flag it as a no-op.
Output the numbered call graph first, then the JSON findings array.`,
```

- [ ] **Step 3c: Teach the prompt builder + add `getPassesForModule`**

Update `getPassDescription` and `getPassChecks` to handle `'combat-trace'`, and add the per-module helper:

```ts
function getPassDescription(pass: EvalPass): string {
  if (pass === 'ground-truth') return GROUND_TRUTH_DESCRIPTION;
  switch (pass) {
    case 'structure':
      return 'Analyze code organization, file layout, class hierarchy, and module boundaries. Are classes in the right files? Is the inheritance correct? Are responsibilities properly separated?';
    case 'quality':
      return 'Analyze UE5 best practices, coding conventions, correctness, and anti-patterns. Is the code following Unreal conventions? Are there bugs, incorrect usage, or missed edge cases?';
    case 'performance':
      return 'Analyze performance patterns: tick usage, memory allocation, object pooling, async loading, and scalability. Are there unnecessary per-frame costs? Missing pooling? Synchronous loads?';
    case 'combat-trace':
      return 'Trace one hit end-to-end and produce a check-able call graph, flagging any step that depends on a binary asset or reads an attribute nothing sets.';
  }
}

function getPassChecks(ctx: ModuleEvalContext | undefined, pass: EvalPass): string {
  if (pass === 'ground-truth') return GROUND_TRUTH_CHECKS;
  if (pass === 'combat-trace') {
    return ctx?.tracePass ?? '- (No combat-trace defined for this module.)';
  }
  if (!ctx) {
    switch (pass) {
      case 'structure':
        return '- Check file organization and class hierarchy\n- Verify proper use of UE5 module patterns\n- Check for circular dependencies';
      case 'quality':
        return '- Check UE5 coding conventions (UPROPERTY, UFUNCTION, etc.)\n- Look for common anti-patterns\n- Verify error handling';
      case 'performance':
        return '- Check for unnecessary Tick usage\n- Look for synchronous asset loading\n- Verify object pooling where appropriate';
    }
  }
  switch (pass) {
    case 'structure':
      return ctx.structureChecks;
    case 'quality':
      return ctx.qualityChecks;
    case 'performance':
      return ctx.performanceChecks;
    default:
      return '';
  }
}

/**
 * The passes to run for a module: the global defaults plus any module-specific
 * extra pass (e.g. arpg-combat's combat-trace). Non-combat modules are unchanged.
 */
export function getPassesForModule(moduleId: string): EvalPass[] {
  const extra = MODULE_CONTEXTS[moduleId]?.tracePass ? (['combat-trace'] as EvalPass[]) : [];
  return [...EVAL_PASSES, ...extra];
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/__tests__/evaluator/combat-trace-pass.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the engine to use per-module passes when not overridden**

In `src/lib/evaluator/deep-eval-engine.ts`, import `getPassesForModule` and change the loop so the default expands per module (keep explicit overrides honored). Around line 73-90:

```ts
import { buildEvalPrompt, EVAL_PASSES, PASS_LABELS, getEvaluableModuleIds, getPassesForModule } from './module-eval-prompts';
// ...
export async function runDeepEval(options: DeepEvalOptions): Promise<DeepEvalResult> {
  const {
    moduleIds = getEvaluableModuleIds(),
    passes,              // <-- was: passes = EVAL_PASSES
    projectContext,
    projectPath,
    onProgress,
    // ...
  } = options;
  // ...
  for (const moduleId of moduleIds) {
    const modulePasses = passes ?? getPassesForModule(moduleId);
    for (const pass of modulePasses) {
      // ...unchanged body...
    }
  }
}
```

(If `DeepEvalOptions.passes` is non-optional, make it optional: `passes?: EvalPass[]`.)

- [ ] **Step 6: Run the full evaluator test suite to confirm no regression**

Run: `npx vitest run src/__tests__/evaluator/`
Expected: PASS (ground-truth-pass.test.ts still green; combat-trace added).

- [ ] **Step 7: Commit**

```bash
git add src/lib/evaluator/module-eval-prompts.ts src/lib/evaluator/deep-eval-engine.ts src/__tests__/evaluator/combat-trace-pass.test.ts src/__tests__/evaluator/__snapshots__/combat-trace-pass.test.ts.snap
git commit -m "feat(eval): add combat-trace 'trace one hit' pass for arpg-combat (folder-03 app §3)"
```

---

## Task A3: `DT_AttributeDefaults` editor + Python emitter

**Files:**
- Create: `.../CombatActionMap/attributes/attribute-defaults-export.ts`
- Create: `.../CombatActionMap/attributes/AttributeDefaultsTab.tsx`
- Modify: `.../CombatActionMap/data.ts` (add `attributes` subtab + `ATTRIBUTE_ROWS`)
- Modify: `.../CombatActionMap/index.tsx` (render the subtab)
- Test: `src/__tests__/lib/attribute-defaults-export.test.ts`

The emitter is a pure function (TDD'd); the UI is a thin editor over it.

- [ ] **Step 1: Write the failing test for the emitter**

```ts
// src/__tests__/lib/attribute-defaults-export.test.ts
import { describe, it, expect } from 'vitest';
import {
  buildAttributeDefaultsPython, DEFAULT_ATTRIBUTE_ROWS, type AttributeRow,
} from '@/components/modules/core-engine/unique-tabs/CombatActionMap/attributes/attribute-defaults-export';

describe('attribute-defaults Python emitter', () => {
  it('ships Player / Skeleton / Boss default rows', () => {
    expect(DEFAULT_ATTRIBUTE_ROWS.map((r) => r.rowName)).toEqual(['Player', 'Skeleton', 'Boss']);
  });

  it('emits a create_asset call for a DataTable with the init row struct', () => {
    const py = buildAttributeDefaultsPython(DEFAULT_ATTRIBUTE_ROWS);
    expect(py).toContain('import unreal');
    expect(py).toContain('DT_AttributeDefaults');
    expect(py).toContain('/Game/Data');
    expect(py).toContain('DataTable');
    expect(py).toContain('FARPGAttributeInitRow');
  });

  it('writes one row per archetype with its Health value', () => {
    const rows: AttributeRow[] = [{ rowName: 'Player', values: { Health: 120, MaxHealth: 120, Armor: 5 } }];
    const py = buildAttributeDefaultsPython(rows);
    expect(py).toContain('Player');
    expect(py).toContain('120');
    expect(py).toContain('armor'); // set_editor_property uses snake_case
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/lib/attribute-defaults-export.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the emitter**

```ts
// src/components/modules/core-engine/unique-tabs/CombatActionMap/attributes/attribute-defaults-export.ts

/** One archetype row of FARPGAttributeInitRow values. */
export interface AttributeRow {
  rowName: string;
  values: Record<string, number>;
}

/** The FARPGAttributeInitRow fields the editor exposes (subset of the C++ struct). */
export const ATTRIBUTE_FIELDS = [
  'Health', 'MaxHealth', 'Mana', 'MaxMana',
  'Strength', 'Dexterity', 'Intelligence',
  'Armor', 'AttackPower', 'CriticalChance', 'CriticalDamage',
  'FireResistance', 'IceResistance', 'LightningResistance',
  'CharacterLevel',
] as const;

export const DEFAULT_ATTRIBUTE_ROWS: AttributeRow[] = [
  { rowName: 'Player', values: { Health: 100, MaxHealth: 100, Mana: 50, MaxMana: 50, Strength: 10, Dexterity: 10, Intelligence: 10, Armor: 5, AttackPower: 10, CriticalChance: 0.05, CriticalDamage: 0.5, FireResistance: 0, IceResistance: 0, LightningResistance: 0, CharacterLevel: 1 } },
  { rowName: 'Skeleton', values: { Health: 40, MaxHealth: 40, Mana: 0, MaxMana: 0, Strength: 6, Dexterity: 8, Intelligence: 2, Armor: 2, AttackPower: 6, CriticalChance: 0.02, CriticalDamage: 0.5, FireResistance: 0, IceResistance: 0, LightningResistance: 0, CharacterLevel: 1 } },
  { rowName: 'Boss', values: { Health: 600, MaxHealth: 600, Mana: 100, MaxMana: 100, Strength: 20, Dexterity: 12, Intelligence: 14, Armor: 15, AttackPower: 25, CriticalChance: 0.1, CriticalDamage: 1.0, FireResistance: 0.25, IceResistance: 0.25, LightningResistance: 0.25, CharacterLevel: 5 } },
];

/**
 * Emit a UE Python script that creates /Game/Data/DT_AttributeDefaults as a
 * UDataTable whose row struct is FARPGAttributeInitRow, populated with the given
 * rows. Field names match the C++ USTRUCT exactly (no bool props here, so the
 * `b`-prefix-drop gotcha does not apply).
 */
export function buildAttributeDefaultsPython(rows: AttributeRow[]): string {
  const L: string[] = [];
  L.push('# Generated by PoF — DT_AttributeDefaults emitter (folder-03 app §4)');
  L.push('import unreal');
  L.push('');
  L.push('PACKAGE_PATH = "/Game/Data"');
  L.push('ASSET_NAME = "DT_AttributeDefaults"');
  L.push('');
  L.push('tools = unreal.AssetToolsHelpers.get_asset_tools()');
  L.push('# Row struct FARPGAttributeInitRow is exposed to Python as ARPGAttributeInitRow (UE drops the F prefix).');
  L.push('row_struct = unreal.load_object(None, "/Script/PoF.ARPGAttributeInitRow")');
  L.push('factory = unreal.DataTableFactory()');
  L.push('factory.struct = row_struct');
  L.push('dt = tools.create_asset(ASSET_NAME, PACKAGE_PATH, unreal.DataTable, factory)');
  L.push('');
  for (const row of rows) {
    L.push(`# ── ${row.rowName} ──`);
    L.push(`${rowVar(row)} = unreal.ARPGAttributeInitRow()`);
    for (const [field, value] of Object.entries(row.values)) {
      // set_editor_property uses snake_case; field names here are plain (no bool b-prefix)
      L.push(`${rowVar(row)}.set_editor_property("${toSnake(field)}", ${value})`);
    }
    L.push(`unreal.DataTableFunctionLibrary.add_data_table_row(dt, "${row.rowName}", ${rowVar(row)})`);
    L.push('');
  }
  L.push('unreal.EditorAssetLibrary.save_loaded_asset(dt)');
  L.push('unreal.log("DT_AttributeDefaults written with %d rows" % ' + rows.length + ')');
  return L.join('\n');
}

function rowVar(row: AttributeRow): string {
  return `row_${row.rowName.toLowerCase()}`;
}

function toSnake(field: string): string {
  return field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
```

- [ ] **Step 4: Run the emitter test**

Run: `npx vitest run src/__tests__/lib/attribute-defaults-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the `attributes` subtab to `data.ts`**

In `.../CombatActionMap/data.ts`, extend the subtab union + list and export the default rows for the UI:

```ts
export type CombatSubtab = 'features' | 'flow' | 'hits' | 'metrics' | 'feedback' | 'attributes';
```

Add to `COMBAT_SUBTABS` (after the `feedback` entry; import `Table` from lucide-react at the top):

```ts
  { key: 'attributes', label: 'Attribute Defaults', icon: Table, narrative: 'Seed Stats', subtitle: 'DT_AttributeDefaults — per-archetype base attributes, emits a UE Python builder' },
```

- [ ] **Step 6: Implement the editor tab**

```tsx
// src/components/modules/core-engine/unique-tabs/CombatActionMap/attributes/AttributeDefaultsTab.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { Table, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { ACCENT } from '../data';
import { BlueprintPanel, SectionHeader } from '../../_design';
import {
  ATTRIBUTE_FIELDS, DEFAULT_ATTRIBUTE_ROWS, buildAttributeDefaultsPython,
  type AttributeRow,
} from './attribute-defaults-export';

export function AttributeDefaultsTab() {
  const [rows, setRows] = useState<AttributeRow[]>(() =>
    DEFAULT_ATTRIBUTE_ROWS.map((r) => ({ rowName: r.rowName, values: { ...r.values } })));
  const [copied, setCopied] = useState(false);

  const script = useMemo(() => buildAttributeDefaultsPython(rows), [rows]);

  const setValue = useCallback((rowName: string, field: string, value: number) => {
    setRows((prev) => prev.map((r) =>
      r.rowName === rowName ? { ...r, values: { ...r.values, [field]: value } } : r));
  }, []);

  const copyScript = useCallback(() => {
    void navigator.clipboard?.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [script]);

  return (
    <motion.div data-testid="combat-attribute-defaults" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-3 overflow-x-auto">
        <SectionHeader label="Attribute Defaults (DT_AttributeDefaults)" color={ACCENT} icon={Table} />
        <table className="w-full text-xs font-mono mt-2">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left pr-2">Attribute</th>
              {rows.map((r) => <th key={r.rowName} className="px-2 text-right">{r.rowName}</th>)}
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTE_FIELDS.map((field) => (
              <tr key={field} className="border-t border-border/30">
                <td className="pr-2 py-0.5">{field}</td>
                {rows.map((r) => (
                  <td key={r.rowName} className="px-2 py-0.5 text-right">
                    <input
                      type="number"
                      aria-label={`${r.rowName} ${field}`}
                      value={r.values[field] ?? 0}
                      onChange={(e) => setValue(r.rowName, field, Number(e.target.value))}
                      className="w-16 bg-surface/60 rounded px-1 text-right"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </BlueprintPanel>

      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="UE Python — create DT_AttributeDefaults" color={ACCENT} icon={Table} />
          <button onClick={copyScript} className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border border-border/50 hover:bg-surface/50 cursor-pointer">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto text-text-muted">{script}</pre>
      </BlueprintPanel>
    </motion.div>
  );
}
```

(Confirm `BlueprintPanel`/`SectionHeader` are exported from `../../_design` — `FeedbackTab.tsx` imports them from there.)

- [ ] **Step 7: Render the subtab in `index.tsx`**

Add the import and the conditional block. Import:

```tsx
import { AttributeDefaultsTab } from './attributes/AttributeDefaultsTab';
```

Add inside the `AnimatePresence` content block (after the `feedback` block):

```tsx
            {activeTab === 'attributes' && (
              <VisibleSection moduleId={moduleId} sectionId="attribute-defaults">
                <AttributeDefaultsTab />
              </VisibleSection>
            )}
```

- [ ] **Step 8: Typecheck + lint + run the affected tests**

Run: `npm run typecheck && npx vitest run src/__tests__/lib/attribute-defaults-export.test.ts`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/CombatActionMap/attributes/ src/components/modules/core-engine/unique-tabs/CombatActionMap/data.ts src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx src/__tests__/lib/attribute-defaults-export.test.ts
git commit -m "feat(combat): DT_AttributeDefaults editor + UE Python emitter (folder-03 app §4)"
```

---

## Task A4: Combat-feel "Export to UE" emitter

**Files:**
- Create: `.../CombatActionMap/polish/combat-feel-export.ts`
- Modify: `.../CombatActionMap/polish/FeedbackTab.tsx` (add export affordance)
- Test: `src/__tests__/lib/combat-feel-export.test.ts`

The emitter maps the FeedbackTab tuner values to the **C2** combat-feel C++ properties on `UGA_MeleeAttack`. Property names MUST match C2 exactly: `HitStopDuration`, `HitStopTimeDilation`, `HitCameraShakeScale`.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/lib/combat-feel-export.test.ts
import { describe, it, expect } from 'vitest';
import { buildCombatFeelPython } from '@/components/modules/core-engine/unique-tabs/CombatActionMap/polish/combat-feel-export';

describe('combat-feel Python emitter', () => {
  const values = { shakeScale: 1.2, hitstopDuration: 0.08, screenFlashAlpha: 0.2, vfxScale: 2, sfxVolume: 0.7, sfxPitch: 1, shakeDecay: 0.5, hitstopEase: 0.5 };

  it('sets the C2 melee-ability feel properties by their exact C++ names', () => {
    const py = buildCombatFeelPython(values);
    expect(py).toContain('import unreal');
    expect(py).toContain('hit_stop_duration');     // HitStopDuration -> snake
    expect(py).toContain('hit_camera_shake_scale'); // HitCameraShakeScale -> snake
    expect(py).toContain('0.08');
    expect(py).toContain('1.2');
    expect(py).toContain('GA_MeleeAttack');
  });

  it('documents the unmapped tuner knobs as comments (no silent drop)', () => {
    const py = buildCombatFeelPython(values);
    expect(py).toContain('screen_flash'); // surfaced even if no C++ home yet
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/lib/combat-feel-export.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the emitter**

```ts
// src/components/modules/core-engine/unique-tabs/CombatActionMap/polish/combat-feel-export.ts

/**
 * Emit a UE Python script that pushes the FeedbackTab tuner values onto the
 * combat-feel C++ properties added in Phase C (UGA_MeleeAttack CDO). Property
 * names here must match the C++ UPROPERTYs in GA_MeleeAttack.h exactly
 * (HitStopDuration, HitStopTimeDilation, HitCameraShakeScale), set via
 * set_editor_property in snake_case.
 */
export function buildCombatFeelPython(values: Record<string, number>): string {
  const L: string[] = [];
  L.push('# Generated by PoF — combat-feel emitter (folder-03 app §5 -> game §6)');
  L.push('import unreal');
  L.push('');
  L.push('# Targets the GA_MeleeAttack Blueprint CDO (BP_GA_MeleeAttack under /Game).');
  L.push('ability_path = "/Game/Blueprints/Abilities/BP_GA_MeleeAttack.BP_GA_MeleeAttack_C"');
  L.push('cdo = unreal.get_default_object(unreal.load_class(None, ability_path))');
  L.push('');
  // Mapped knobs -> C++ properties (snake_case of the UPROPERTY names).
  L.push(`cdo.set_editor_property("hit_stop_duration", ${num(values.hitstopDuration, 0.05)})`);
  L.push(`cdo.set_editor_property("hit_camera_shake_scale", ${num(values.shakeScale, 1.0)})`);
  L.push('');
  L.push('# Unmapped tuner knobs (no C++ home yet) — surfaced for the operator:');
  L.push(`# screen_flash_alpha = ${num(values.screenFlashAlpha, 0)}`);
  L.push(`# vfx_scale = ${num(values.vfxScale, 1)}, sfx_volume = ${num(values.sfxVolume, 0.7)}, sfx_pitch = ${num(values.sfxPitch, 1)}`);
  L.push(`# shake_decay = ${num(values.shakeDecay, 0.5)}, hitstop_ease = ${num(values.hitstopEase, 0.5)}`);
  L.push('');
  L.push('unreal.EditorAssetLibrary.save_loaded_asset(cdo.get_outer())');
  L.push('unreal.log("Combat-feel values applied to BP_GA_MeleeAttack CDO")');
  return L.join('\n');
}

function num(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
```

- [ ] **Step 4: Run the emitter test**

Run: `npx vitest run src/__tests__/lib/combat-feel-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the export affordance to `FeedbackTab.tsx`**

`FeedbackTab` already receives `feedbackValues`. Add a collapsible "Export to UE" panel at the end of its returned JSX. Add imports at the top:

```tsx
import { useState, useMemo, useCallback } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { buildCombatFeelPython } from './combat-feel-export';
import { BlueprintPanel } from '../../_design'; // if not already imported
```

Inside the component body, before `return`:

```tsx
  const [copied, setCopied] = useState(false);
  const feelScript = useMemo(() => buildCombatFeelPython(feedbackValues), [feedbackValues]);
  const copyFeel = useCallback(() => {
    void navigator.clipboard?.writeText(feelScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [feelScript]);
```

Add this block as the last child of the outer `motion.div`:

```tsx
      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="Export to UE (apply to GA_MeleeAttack)" color={ACCENT} icon={Download} />
          <button data-testid="combat-feel-export" onClick={copyFeel} className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border border-border/50 hover:bg-surface/50 cursor-pointer">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? 'Copied' : 'Copy Python'}
          </button>
        </div>
        <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto text-text-muted">{feelScript}</pre>
      </BlueprintPanel>
```

(`ACCENT` and `SectionHeader` are already imported in `FeedbackTab.tsx`; only add what's missing.)

- [ ] **Step 6: Typecheck + run the test**

Run: `npm run typecheck && npx vitest run src/__tests__/lib/combat-feel-export.test.ts`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/modules/core-engine/unique-tabs/CombatActionMap/polish/ src/__tests__/lib/combat-feel-export.test.ts
git commit -m "feat(combat): combat-feel 'Export to UE' Python emitter on FeedbackTab (folder-03 app §5)"
```

---

## Task A5: Parallel-Health pitfall detector in the combat evaluator

**Files:**
- Modify: `src/lib/evaluator/module-eval-prompts.ts` (`arpg-combat` `qualityChecks`)
- Test: `src/__tests__/evaluator/combat-parallel-health.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/evaluator/combat-parallel-health.test.ts
import { describe, it, expect } from 'vitest';
import { buildEvalPrompt } from '@/lib/evaluator/module-eval-prompts';

describe('combat parallel-Health detector', () => {
  it('the quality pass flags the two-Health-systems pitfall', () => {
    const out = buildEvalPrompt({
      moduleId: 'arpg-combat', pass: 'quality',
      projectName: 'PoF', moduleName: 'PoF', sourcePath: 'Source/PoF',
    });
    const lower = out.toLowerCase();
    expect(lower).toContain('two health');
    expect(lower).toContain('plain float');
    expect(lower).toContain('postgameplayeffectexecute');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/__tests__/evaluator/combat-parallel-health.test.ts`
Expected: FAIL.

- [ ] **Step 3: Append the flag to `arpg-combat` qualityChecks**

In `MODULE_CONTEXTS['arpg-combat'].qualityChecks`, append (keep existing text):

```
Additionally: detect parallel Health bookkeeping — a plain float Health/MaxHealth member on the character (e.g. AARPGPlayerCharacter::GetHealth) alongside the GAS Health attribute (UARPGAttributeSet). The HUD and damage pipeline use GAS; the float is a latent inconsistency. Flag it and recommend: deprecate the plain float OR sync it from GAS in PostGameplayEffectExecute. Two Health systems must not drift.
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/__tests__/evaluator/combat-parallel-health.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluator/module-eval-prompts.ts src/__tests__/evaluator/combat-parallel-health.test.ts
git commit -m "feat(eval): flag parallel-Health pitfall in arpg-combat quality pass (folder-03 app §6)"
```

---

## Task A6: `DT_AttributeDefaults` presence test + `combat-loop` e2e

**Files:**
- Create: `src/__tests__/lib/dt-attribute-defaults-presence.test.ts`
- Create: `e2e/combat-loop.spec.ts`

- [ ] **Step 1: Write the presence test (skipped-with-reason until the asset lands)**

The asset is a binary `.uasset` in the UE project that this session cannot author; the test documents the gap per tests.md app §3. Use `it.skip` with the reason in the title so it shows in the report as a known gap.

```ts
// src/__tests__/lib/dt-attribute-defaults-presence.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// The active UE project (see memory: reference_ue_project_location).
const UE_CONTENT_DATA = 'C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Data';
const DT_PATH = join(UE_CONTENT_DATA, 'DT_AttributeDefaults.uasset');

describe('DT_AttributeDefaults content presence', () => {
  // Skipped until the emitter (Task A3) is run in the editor to author the asset.
  it.skip('DT_AttributeDefaults.uasset exists (TODO: run the A3 emitter in-editor to create it)', () => {
    expect(existsSync(DT_PATH)).toBe(true);
  });

  it('the presence-test target path is well-formed', () => {
    expect(DT_PATH).toMatch(/Content[\\/]Data[\\/]DT_AttributeDefaults\.uasset$/);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/__tests__/lib/dt-attribute-defaults-presence.test.ts`
Expected: PASS (1 passed, 1 skipped).

- [ ] **Step 3: Write the `combat-loop` e2e spec**

Asserts the combat module renders and dispatches a wired ability prompt (the app-observable exit criterion). Follows `e2e/core-engine-modules.spec.ts` helpers.

```ts
// e2e/combat-loop.spec.ts
import { test, expect, type Page } from '@playwright/test';

async function openCombat(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  try {
    const pofBtn = page.locator('button', { hasText: 'PoF' }).first();
    await pofBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pofBtn.click();
    await page.waitForTimeout(2000);
  } catch { /* already past launcher */ }
  const coreBtn = page.getByRole('button', { name: 'Core Engine' });
  await coreBtn.waitFor({ state: 'visible', timeout: 15000 });
  await coreBtn.click();
  await page.waitForTimeout(1000);
  const combatBtn = page.locator('nav button, nav [role="button"], nav div[class*="cursor"]')
    .filter({ hasText: 'Combat' }).first();
  await combatBtn.waitFor({ state: 'visible', timeout: 5000 });
  await combatBtn.click();
  await page.waitForTimeout(1500);
}

test.describe('Combat loop', () => {
  test.setTimeout(60000);

  test('combat module renders its action-map subtabs', async ({ page }) => {
    await openCombat(page);
    await expect(page.getByTestId('pof-module-arpg-combat-tab-flow')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('pof-module-arpg-combat-tab-feedback')).toBeVisible();
    await expect(page.getByTestId('pof-module-arpg-combat-tab-attributes')).toBeVisible();
  });

  test('the attribute-defaults tab emits a DataTable Python builder', async ({ page }) => {
    await openCombat(page);
    await page.getByTestId('pof-module-arpg-combat-tab-attributes').click();
    const panel = page.getByTestId('combat-attribute-defaults');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel.locator('pre')).toContainText('DT_AttributeDefaults');
    await expect(panel.locator('pre')).toContainText('FARPGAttributeInitRow');
  });
});
```

- [ ] **Step 4: Run the e2e spec (requires the dev server; skip if unavailable)**

Run: `npx playwright test e2e/combat-loop.spec.ts` (only if the e2e runner is configured locally; otherwise note it runs in CI).
Expected: PASS, or deferred to CI with a note.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/lib/dt-attribute-defaults-presence.test.ts e2e/combat-loop.spec.ts
git commit -m "test(combat): DT_AttributeDefaults presence gap test + combat-loop e2e (folder-03 tests app §3, e2e §1)"
```

---

## Task A7: Phase A gate — full validate

- [ ] **Step 1: Run the full validation suite**

Run: `npm run validate`
Expected: typecheck clean, lint clean, all vitest green (baseline 1061 + new tests).

- [ ] **Step 2: If anything fails, fix forward** (do not weaken assertions). Re-run until green. Watch for **foreign** failures from the shared app tree — if a failing test touches files outside this plan's scope, report it rather than "fixing" someone else's work.

---

# PHASE C — UE pure-C++ (shared tree; committed-but-unverified pending editor close)

> **Shared-tree rules:** edit in place on branch `main`; **`git add` only the exact files below**; never `git add -A`; never switch branches. After writing, leave a note for the user to close the editor for a full rebuild (new `UCLASS`es + Live Coding). Do NOT run a build that could clobber other CLIs' WIP unless the user asks.

> **Before each task:** `Read` the actual current file first — the code blocks below are the *target* additions; splice them into the real surrounding code rather than assuming exact line numbers.

## Task C1: Resolve the double-Health bookkeeping (game §5)

**Files (under `…\PoF\Source\PoF\`):**
- Modify: `Player/ARPGPlayerCharacter.h` (the `GetHealth/GetMaxHealth/GetHealthPercent` inline getters, ~lines 61-68)
- Modify: `Player/ARPGPlayerCharacter.cpp` (add a GAS read helper + keep the float synced)

GAS is the source of truth. The getters read GAS when an ASC + AttributeSet exist, falling back to the float before possession.

- [ ] **Step 1: Read the current getters and the ASC accessor**

Read `Player/ARPGPlayerCharacter.h` and `.cpp`. Confirm how the ASC is reached (`GetAbilitySystemComponent()` from the base) and that `UARPGAttributeSet` is included.

- [ ] **Step 2: Make the getters GAS-backed (header)**

Replace the inline float getters with declarations, and add a private GAS reader:

```cpp
// ARPGPlayerCharacter.h — replace the inline getters
UFUNCTION(BlueprintPure, Category = "Combat|Health")
float GetHealth() const;

UFUNCTION(BlueprintPure, Category = "Combat|Health")
float GetMaxHealth() const;

UFUNCTION(BlueprintPure, Category = "Combat|Health")
float GetHealthPercent() const;

private:
/** Reads a GAS attribute current value; returns Fallback if no ASC/AttributeSet yet. */
float ReadGASHealth(bool bMax, float Fallback) const;
```

- [ ] **Step 3: Implement the GAS-backed getters (cpp)**

```cpp
// ARPGPlayerCharacter.cpp
#include "AbilitySystemComponent.h"
#include "AbilitySystem/ARPGAttributeSet.h"

float AARPGPlayerCharacter::ReadGASHealth(bool bMax, float Fallback) const
{
    if (const UAbilitySystemComponent* ASC = GetAbilitySystemComponent())
    {
        const FGameplayAttribute Attr = bMax
            ? UARPGAttributeSet::GetMaxHealthAttribute()
            : UARPGAttributeSet::GetHealthAttribute();
        bool bFound = false;
        const float Val = ASC->GetGameplayAttributeValue(Attr, bFound);
        if (bFound) { return Val; }
    }
    return Fallback; // pre-possession / no ASC yet
}

float AARPGPlayerCharacter::GetHealth() const     { return ReadGASHealth(/*bMax=*/false, Health); }
float AARPGPlayerCharacter::GetMaxHealth() const  { return ReadGASHealth(/*bMax=*/true,  MaxHealth); }
float AARPGPlayerCharacter::GetHealthPercent() const
{
    const float Max = GetMaxHealth();
    return Max > 0.f ? GetHealth() / Max : 0.f;
}
```

- [ ] **Step 4: Keep the plain float synced from GAS (so legacy consumers don't drift)**

The legacy `OnHealthChanged`/`TakeDamageAmount` path reads the float. Bind to the GAS Health change so the float mirrors GAS. In `BeginPlay` (or after ASC init), add:

```cpp
if (UAbilitySystemComponent* ASC = GetAbilitySystemComponent())
{
    ASC->GetGameplayAttributeValueChangeDelegate(UARPGAttributeSet::GetHealthAttribute())
       .AddUObject(this, &AARPGPlayerCharacter::OnGASHealthChanged);
}
```

Add the handler (header decl + cpp) that mirrors GAS → float and re-broadcasts the legacy delegate:

```cpp
void AARPGPlayerCharacter::OnGASHealthChanged(const FOnAttributeChangeData& Data)
{
    Health = Data.NewValue;            // keep the deprecated float in lockstep with GAS
    OnHealthChanged.Broadcast(Health, GetMaxHealth());
}
```

Add a `// DEPRECATED: GAS (UARPGAttributeSet::Health) is the source of truth; this float is mirrored, not authoritative.` comment above the float `Health`/`MaxHealth` UPROPERTYs. Do **not** delete the float (live consumers: HUD legacy path, `TakeDamageAmount`).

- [ ] **Step 5: Stage ONLY these files** (no build here — verification is C4 + the user's editor)

```bash
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" add Source/PoF/Player/ARPGPlayerCharacter.h Source/PoF/Player/ARPGPlayerCharacter.cpp
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" commit -m "fix(combat): make player Health getters read GAS, mirror float from GAS (folder-03 game §5)"
```

---

## Task C2: Hit-pause + camera-shake knobs on `UGA_MeleeAttack` (game §6)

**Files:**
- Modify: `AbilitySystem/GA_MeleeAttack.h` (add four UPROPERTYs + one helper decl)
- Modify: `AbilitySystem/GA_MeleeAttack.cpp` (apply on confirmed hit, in both the gray-box self-apply and `OnMeleeHit`)

Property names MUST match Task A4's emitter: `HitStopDuration`, `HitStopTimeDilation`, `HitCameraShake`, `HitCameraShakeScale`.

- [ ] **Step 1: Read the current damage-apply path** — find `ApplyMeleeDamageTo` and `OnMeleeHit` (recon: ~lines 378-385) and the gray-box self-apply branch.

- [ ] **Step 2: Add the knobs (header)**

```cpp
// GA_MeleeAttack.h — add under a "Melee|Feel" category
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Feel", meta = (ClampMin = "0.0", ClampMax = "0.5"))
float HitStopDuration = 0.08f;

UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Feel", meta = (ClampMin = "0.01", ClampMax = "1.0"))
float HitStopTimeDilation = 0.1f;

UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Feel")
TSubclassOf<UCameraShakeBase> HitCameraShake;

UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Melee|Feel", meta = (ClampMin = "0.0", ClampMax = "10.0"))
float HitCameraShakeScale = 1.0f;

private:
/** Brief global time-dilation freeze + camera shake on a confirmed hit. */
void ApplyHitFeel();
void RestoreTimeDilation();
FTimerHandle HitStopTimerHandle;
```

- [ ] **Step 3: Implement `ApplyHitFeel` (cpp)**

```cpp
// GA_MeleeAttack.cpp
#include "Kismet/GameplayStatics.h"
#include "GameFramework/PlayerController.h"
#include "Camera/CameraShakeBase.h"

void UGA_MeleeAttack::ApplyHitFeel()
{
    AActor* Avatar = GetAvatarActorFromActorInfo();
    if (!Avatar) { return; }
    UWorld* World = Avatar->GetWorld();
    if (!World) { return; }

    // Hit pause: real-time so the freeze itself isn't dilated away.
    if (HitStopDuration > 0.f)
    {
        UGameplayStatics::SetGlobalTimeDilation(World, HitStopTimeDilation);
        World->GetTimerManager().SetTimer(
            HitStopTimerHandle, this, &UGA_MeleeAttack::RestoreTimeDilation,
            HitStopDuration, /*bLoop=*/false);
    }

    // Camera shake on the instigating player camera (guarded for headless/no-PC).
    if (HitCameraShake)
    {
        if (APawn* Pawn = Cast<APawn>(Avatar))
        {
            if (APlayerController* PC = Cast<APlayerController>(Pawn->GetController()))
            {
                PC->ClientStartCameraShake(HitCameraShake, HitCameraShakeScale);
            }
        }
    }
}

void UGA_MeleeAttack::RestoreTimeDilation()
{
    if (AActor* Avatar = GetAvatarActorFromActorInfo())
    {
        if (UWorld* World = Avatar->GetWorld())
        {
            UGameplayStatics::SetGlobalTimeDilation(World, 1.0f);
        }
    }
}
```

- [ ] **Step 4: Call `ApplyHitFeel()` on a confirmed hit**

In `ApplyMeleeDamageTo(...)` (the shared damage path used by both the gray-box self-apply and `OnMeleeHit`), after a *successful* damage application and before returning, call `ApplyHitFeel();`. If there is no single shared apply function, call it in both branches right after the GE is applied to a valid target.

- [ ] **Step 5: Stage ONLY these files + commit**

```bash
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" add Source/PoF/AbilitySystem/GA_MeleeAttack.h Source/PoF/AbilitySystem/GA_MeleeAttack.cpp
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" commit -m "feat(combat): hit-pause + camera-shake feel knobs on GA_MeleeAttack (folder-03 game §6)"
```

---

## Task C3: Ragdoll death + fade-out (game §7)

**Files:**
- Modify: the enemy death handler — `Enemy/ARPGEnemyCharacter.cpp` `OnDeathFromAbility` (confirm the exact file/owner of `SetLifeSpan(EnemyDestroyDelay)`; recon shows GA_Death dispatches to `AARPGEnemyCharacter::OnDeathFromAbility`).

- [ ] **Step 1: Read the current enemy death handler** — find where `SetLifeSpan` is called and confirm `EnableRagdoll()` is visible from there (it's on `AARPGCharacterBase`, the parent).

- [ ] **Step 2: Enable ragdoll before the lifespan timer, add a guarded fade**

In `OnDeathFromAbility`, before `SetLifeSpan(...)`:

```cpp
// Physical death: ragdoll the corpse so it reacts instead of T-posing on a timer.
EnableRagdoll();

// Best-effort fade-out over the lifespan: only if the mesh material exposes an
// opacity/dissolve scalar param. Gray-box opaque materials are skipped cleanly.
if (USkeletalMeshComponent* MeshComp = GetMesh())
{
    if (UMaterialInterface* Mat = MeshComp->GetMaterial(0))
    {
        UMaterialInstanceDynamic* MID = MeshComp->CreateAndSetMaterialInstanceDynamic(0);
        // The driver (a simple timeline/timer lerping "DissolveAmount" 0->1 over
        // EnemyDestroyDelay) is set up here; if the param is absent the MID is
        // harmless. Implement the lerp with a repeating timer that calls
        // MID->SetScalarParameterValue("DissolveAmount", Alpha).
        (void)MID;
    }
}
```

Add a small timer-driven fade helper (`StartCorpseFade(float Duration)`) that lerps `DissolveAmount` 0→1; `SetScalarParameterValue` on a missing param is a no-op, so this stays safe for gray-box. Keep `SetLifeSpan(EnemyDestroyDelay)` as the destroy trigger.

- [ ] **Step 3: Stage ONLY these files + commit**

```bash
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" add Source/PoF/Enemy/ARPGEnemyCharacter.cpp Source/PoF/Enemy/ARPGEnemyCharacter.h
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" commit -m "feat(combat): ragdoll + best-effort fade on enemy death (folder-03 game §7)"
```

---

## Task C4: UE combat functional tests (tests.md UE §2, §3, §5)

**Files (under `…\PoF\Source\PoF\Test\Combat\` — match the existing `VS*Test` location confirmed in recon):**
- Create: `VSCombatDamageFormulaTest.h/.cpp`
- Create: `VSCombatTwoHealthSystemsTest.h/.cpp`
- Create: `VSCombatAnimationDrivenPathTest.h/.cpp`

> These are new `UCLASS`es: they require a full editor-closed rebuild before they run. Write + commit now; verification is the user's editor-coordination step.

- [ ] **Step 1: Read an existing test for the exact base/pattern** — open `VSCombatGrayBoxPathTest.h/.cpp` (or `ARPGFunctionalTestBase`) and mirror its class macro, includes, and phase/assert helpers (`AssertTrue`, `FinishTest`).

- [ ] **Step 2: `VSCombatDamageFormulaTest`** — invoke `UARPGDamageExecution` (or apply `GE_Damage` with `AttackPower=10`, `Armor=4`, known base) against a freshly-initialized target ASC and assert the result equals the **actual** C++ formula:
  `Final = (Base + AttackPower*Scaling) * CritMult * (1 - Armor/(Armor+100)) * (1 - ElemResist)`.
  With no crit and no elemental tag: `Final = (Base + 10) * (1 - 4/104)`. Assert with a small epsilon. (Do NOT hardcode the doc's simplified `base+10-4`.)

```cpp
// VSCombatDamageFormulaTest.cpp (sketch — match the real base class API)
void AVSCombatDamageFormulaTest::OnRunTest()
{
    const float Base = 20.f, AttackPower = 10.f, Armor = 4.f, Scaling = 1.f;
    const float Expected = (Base + AttackPower * Scaling) * (1.f - Armor / (Armor + 100.f));
    const float Actual = /* apply GE_Damage to a target ASC seeded with Armor=4, attacker AttackPower=10, read Health delta */;
    AssertTrue(FMath::IsNearlyEqual(Actual, Expected, 0.01f),
        FString::Printf(TEXT("damage %.3f != expected %.3f"), Actual, Expected));
    FinishTest(EFunctionalTestResult::Succeeded, TEXT("damage formula"));
}
```

- [ ] **Step 3: `VSCombatTwoHealthSystemsTest`** — after C1, assert the player's float getter equals GAS:

```cpp
AARPGPlayerCharacter* P = GetPlayerCharacter();
UAbilitySystemComponent* ASC = P->GetAbilitySystemComponent();
bool bFound = false;
const float GasHealth = ASC->GetGameplayAttributeValue(UARPGAttributeSet::GetHealthAttribute(), bFound);
AssertTrue(bFound && FMath::IsNearlyEqual(P->GetHealth(), GasHealth, 0.01f),
    TEXT("AARPGPlayerCharacter::GetHealth() must equal GAS Health after the §5 resolution"));
```

- [ ] **Step 4: `VSCombatAnimationDrivenPathTest`** — register it **disabled** with a clear reason (gated on a real `AM_MeleeCombo` with a hit notify). Use the project's convention for a disabled functional test (e.g. set the actor's `bIsEnabled = false` in the constructor and log the reason, or guard `OnRunTest` to immediately `FinishTest(EFunctionalTestResult::Default, TEXT("disabled: needs real AM_MeleeCombo + hit notify"))`). Add a top-of-file comment:

```cpp
// DISABLED until a real AM_MeleeCombo montage with AnimNotifyState_HitDetection exists.
// When it does: set bUseAnimationDrivenDamage=true on BP_GA_MeleeAttack, advance the
// montage, and assert damage applied via OnMeleeHit (a counter or log line).
```

- [ ] **Step 5: Stage ONLY these files + commit**

```bash
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" add Source/PoF/Test/Combat/VSCombatDamageFormulaTest.h Source/PoF/Test/Combat/VSCombatDamageFormulaTest.cpp Source/PoF/Test/Combat/VSCombatTwoHealthSystemsTest.h Source/PoF/Test/Combat/VSCombatTwoHealthSystemsTest.cpp Source/PoF/Test/Combat/VSCombatAnimationDrivenPathTest.h Source/PoF/Test/Combat/VSCombatAnimationDrivenPathTest.cpp
git -C "C:/Users/kazda/Documents/Unreal Projects/PoF" commit -m "test(combat): damage-formula, two-health, disabled anim-driven functional tests (folder-03 tests UE §2,3,5)"
```

- [ ] **Step 6: Hand off the build/verify step to the user**

Report: the new UE `UCLASS` tests + the C1/C2/C3 changes need a full editor-closed rebuild (Live Coding cannot add new reflected types). Ask the user to close the shared editor when convenient, then run the PoFEditor build + `Automation RunTests` on the VS map. Note that a foreign CLI's in-flight `.cpp` may break the monolithic build — report, don't fix theirs.

---

## Final: update the improvements docs + memory

- [ ] **Step 1:** In `docs/improvements/03-combat/INDEX`-level status (and/or the folder docs), correct the "nothing shipped" baseline note to reflect that §1/§4 + GrayBox/AbilityGrant tests were already done and this plan resolved the rest. (App repo, worktree — commit with the Phase A work.)
- [ ] **Step 2:** Add/refresh a project memory pointer for folder-03 status (mirrors `project_improvements_04_hud_ui`).
