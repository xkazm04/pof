# ECW Spellbook Logic Editor (pilot) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Replace the spellbook Logic tab with six aspect cards (Type · Damage · Cooldown · Cost · Effect mapping · Requirements) that display the ability's real state and dispatch per-aspect CLI changes.

**Architecture:** Register a `SpellbookLogicWorkspace` for `('spellbook','logic')` (resolves before the wildcard in `trackWorkspaceRegistry`). Pure `damage-formula.ts` (extracted from the legacy `DamageCalcSection` formula) + `logic-prompts.ts` (one parameterized CLI-prompt builder). Display bits are inlined + theme-consistent (no legacy-UI imports). Read-only display from `entity.data`; changes via `useModuleCLI('arpg-gas')`.

**Tech Stack:** React 19, Zustand, Vitest. **Spec:** `docs/superpowers/specs/2026-05-25-pof-ecw-spellbook-logic-design.md`.

**Invariants:** branch-local commits; `@/` imports; no hardcoded hex in source (element color read from `entity.data.color` at runtime is fine); theme typography (sans content, mono for tags/ids); co-author tag; each task ends ECW vitest green + eslint/tsc clean (excl. 3 pre-existing AssetInspector).

---

## Task 1: `damage-formula.ts` (extracted pure calc)

**Files:** Create `src/lib/ability/damage-formula.ts`; Test `src/__tests__/lib/ability/damage-formula.test.ts`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest';
import { calculateDamage, formulaPreview } from '@/lib/ability/damage-formula';

describe('calculateDamage', () => {
  it('matches the legacy formula at the legacy defaults', () => {
    // 50*(1+100/100)=100; armorRed 50/150=.3333; afterArmor 100*.6667=66.67;
    // expectedCrit 1+.15*(1.5-1)=1.075; final 66.67*1.075 ≈ 71.67
    expect(calculateDamage(50, 100, 50, 15, 1.5)).toBeCloseTo(71.67, 1);
  });
  it('no power/armor/crit → base damage', () => {
    expect(calculateDamage(40, 0, 0, 0, 1.5)).toBeCloseTo(40, 5);
  });
  it('armor mitigates', () => {
    expect(calculateDamage(100, 0, 100, 0, 1)).toBeCloseTo(50, 5); // 100*(1-100/200)
  });
});

describe('formulaPreview', () => {
  it('mentions the base damage', () => {
    expect(formulaPreview({ damage: 40 })).toContain('40');
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/__tests__/lib/ability/damage-formula.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement**
```ts
// src/lib/ability/damage-formula.ts
/**
 * GAS damage model, extracted verbatim from the legacy DamageCalcSection:
 *   scaled    = base · (1 + power/100)
 *   afterArmor= scaled · (1 - armor/(armor+100))
 *   expCrit   = 1 + (critChancePct/100)·(critMult-1)
 *   final     = afterArmor · expCrit
 */
export function calculateDamage(base: number, power: number, armor: number, critChancePct: number, critMult: number): number {
  const scaled = base * (1 + power / 100);
  const afterArmor = scaled * (1 - armor / (armor + 100));
  const expectedCritMulti = 1 + (critChancePct / 100) * (critMult - 1);
  return afterArmor * expectedCritMulti;
}

/** Short human-readable readout of how the base damage is applied. */
export function formulaPreview(ability: { damage: number }): string {
  return `${ability.damage} base · ×(1+power) · armor-mitigated · crit-scaled`;
}
```
- [ ] **Step 4:** Run → PASS (4). **Step 5:** Commit `feat(ability): damage-formula — extracted GAS damage calc (Spellbook Logic C.1)`.

---

## Task 2: `logic-prompts.ts` (parameterized CLI-prompt builder)

**Files:** Create `src/lib/ability/logic-prompts.ts`; Test `src/__tests__/lib/ability/logic-prompts.test.ts`.

- [ ] **Step 1: Failing test**
```ts
import { describe, it, expect } from 'vitest';
import { buildLogicChangePrompt, LOGIC_ASPECTS, type LogicAspect } from '@/lib/ability/logic-prompts';

const ability = { name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced' };

describe('buildLogicChangePrompt', () => {
  it('names the ability, the tag, and the aspect intent', () => {
    const p = buildLogicChangePrompt('damage', ability, '  hit harder  ');
    expect(p).toContain('Fireball');
    expect(p).toContain('Ability.Fire.Fireball');
    expect(p).toMatch(/damage/i);
    expect(p).toContain('hit harder');
    expect(p).not.toContain('  hit harder'); // trimmed
  });
  it('instructs editing the GAS source, not inventing one', () => {
    const p = buildLogicChangePrompt('requirements', ability, '');
    expect(p).toMatch(/UARPGGameplayAbility|DT_AbilityCatalog/);
  });
  it('exposes the six aspects', () => {
    expect(LOGIC_ASPECTS).toEqual(['type', 'damage', 'cooldown', 'cost', 'effects', 'requirements'] satisfies LogicAspect[]);
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**
```ts
// src/lib/ability/logic-prompts.ts
export const LOGIC_ASPECTS = ['type', 'damage', 'cooldown', 'cost', 'effects', 'requirements'] as const;
export type LogicAspect = (typeof LOGIC_ASPECTS)[number];

export interface AbilityRef {
  name: string; element: string; tag: string; category: string; tier: string;
}

const ASPECT_INTENT: Record<LogicAspect, string> = {
  type: 'change the classification (category / element / tier) and its gameplay tag',
  damage: 'tune the base damage and how it scales',
  cooldown: 'change the cooldown duration (and its cooldown GE/tag)',
  cost: 'tune the mana/resource cost',
  effects: 'author the GameplayEffects this ability applies (DoT/buff/debuff via GAS)',
  requirements: 'set the activation requirements (activation-owned / activation-blocked tags)',
};

/**
 * CLI prompt to change one Logic aspect of a spellbook ability. Edits the SOURCE
 * (the UARPGGameplayAbility subclass + DT_AbilityCatalog row) reusing existing GAS
 * conventions — never invents a new system. Pure; the workspace dispatches it.
 */
export function buildLogicChangePrompt(aspect: LogicAspect, ability: AbilityRef, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    `For the spellbook ability "${ability.name}" (gameplay tag ${ability.tag}, ${ability.category}/${ability.element}/${ability.tier}), ${ASPECT_INTENT[aspect]}.`,
    trimmed ? `Designer intent: "${trimmed}"` : 'No extra intent — propose a sensible improvement and confirm before applying.',
    'Edit the existing UARPGGameplayAbility subclass and its DT_AbilityCatalog row (FARPGAbilityCatalogRow); reuse the existing GAS effect/tag conventions — do not invent a new system.',
    `Report the asset path and the exact fields you changed for ${ability.name}.`,
  ].join('\n');
}
```
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(ability): logic-prompts — per-aspect CLI change prompts (Spellbook Logic C.2)`.

---

## Task 3: `SpellbookLogicWorkspace` + registration

**Files:** Create `src/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace.tsx`; Modify `src/components/ecw/pipeline/workspaces/register.ts`; Test `src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx`.

- [ ] **Step 1: Failing test**
```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpellbookLogicWorkspace } from '@/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({ useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }) }));
vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })));

const fireball: StoredCatalogEntity = {
  id: 'off-fire-01', catalogId: 'spellbook', name: 'Fireball', categoryPath: ['Offensive', 'Fire'], tags: [], lifecycle: 'planned',
  data: { id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'advanced', damage: 40, manaCost: 20, cooldown: 6, color: '#f87171', tag: 'Ability.Fire.Fireball' },
};

describe('SpellbookLogicWorkspace', () => {
  beforeEach(() => { usePipelineStore.setState({ tracksByEntity: {} }); execute.mockClear(); });
  afterEach(cleanup);

  it('shows the ability state across the six aspect cards', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    expect(screen.getByText('Offensive')).toBeTruthy();           // Type
    expect(screen.getByText('Fire')).toBeTruthy();
    expect(screen.getByText('advanced')).toBeTruthy();
    expect(screen.getByText('Ability.Fire.Fireball')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();                  // Damage value
    expect(screen.getByText(/6s|6\b/)).toBeTruthy();              // Cooldown
    expect(screen.getByText('20')).toBeTruthy();                  // Cost
    expect(screen.getByText(/Effect/i)).toBeTruthy();
    expect(screen.getByText(/Requirements/i)).toBeTruthy();
  });

  it('dispatches an aspect-scoped CLI change when a card button is clicked', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /tune damage/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Fireball');
    expect(task.prompt).toMatch(/damage/i);
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `SpellbookLogicWorkspace.tsx`. Structure: `<PipelineTrackDetail entity trackId="logic" />` then a `space-y-3 px-4 py-3` column of six aspect cards. Read `a = entity.data as SpellbookAbility-ish`. A shared optional `instruction` textarea at the bottom; each card's button dispatches `cli.execute(TaskFactory.quickAction('arpg-gas', buildLogicChangePrompt(aspect, abilityRef, instruction), \`Logic · ${entity.name}\`))`.
  - Inlined display bits (theme-consistent, no legacy imports): a `Badge` span (`text-2xs px-2 py-0.5 rounded-full bg-surface text-text-muted`), a `StatBar` (label + `h-1.5 bg-surface` track + emerald fill at `value/max*100%`, `max` per aspect: damage 100, mana 100), the element badge colored via `style={{ color: a.color }}`, the gameplay tag in `font-mono text-2xs`.
  - Cards: **Type** (category/element/tier badges + tag, "Reclassify" button), **Damage** (`{a.damage}` + StatBar + `formulaPreview(a)`, "Tune damage" button), **Cooldown** (`{a.cooldown}s` + a small bar, "Change cooldown" button), **Cost** (`{a.manaCost}` mana StatBar, "Tune cost" button), **Effect mapping** (element-implied GE label via a small `ELEMENT_GE` map e.g. Fire→`GE_Fire_DoT` + the tag, "Author effects" button), **Requirements** (the tag + "Blocked while Dead/Stunned" note, "Author requirements" button).
  - `abilityRef = { name, element, tag, category, tier }` from `a` for the prompt builder.
  - Each card wrapped in a `rounded-lg border border-border/40 bg-surface-deep p-3` section with a `text-sm font-semibold text-text` title.
- [ ] **Step 4: Register** — in `register.ts` add `import { SpellbookLogicWorkspace } from './SpellbookLogicWorkspace';` and `registerTrackWorkspace('spellbook', 'logic', SpellbookLogicWorkspace);`.
- [ ] **Step 5:** Run `npx vitest run src/__tests__/components/ecw/pipeline/SpellbookLogicWorkspace.test.tsx` → PASS; `npx tsc --noEmit` (grep, excl AssetInspector) CLEAN; `npx eslint` on touched files clean.
- [ ] **Step 6: Commit** `feat(ecw): SpellbookLogicWorkspace — six aspect cards + per-aspect CLI change (Spellbook Logic C.3)`.

---

## Task 4: registry resolution test

**Files:** Modify `src/__tests__/components/ecw/inspector/trackWorkspaceRegistry.test.tsx`.

- [ ] Add a test: after `import '@/components/ecw/pipeline/workspaces/register'`, `getTrackWorkspace('spellbook','logic')` is the `SpellbookLogicWorkspace` (exact wins over the wildcard `('*','logic')` LogicWorkspace), while `getTrackWorkspace('bestiary','logic')` is the generic `LogicWorkspace`.
- [ ] Run → PASS. Commit `test(ecw): spellbook logic workspace resolves over the wildcard (Spellbook Logic C.4)`.

---

## Final verification
- [ ] `npx vitest run src/__tests__/components/ecw src/__tests__/lib/ability` — all green.
- [ ] `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v AssetInspector || echo CLEAN` — CLEAN.
- [ ] Manual smoke: open a Spellbook ability → Logic tab shows the six aspect cards with real state; each button dispatches an aspect-scoped CLI session into the rail.

## Out of scope
Other catalogs' rich Logic editors; Option-B data-model enrichment (effects[]/tagRules[] + write-back) for full in-app rich editors; in-app data mutation.
