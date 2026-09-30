import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderHook, render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import { deriveDefaultSpec } from '@/lib/ability/spec';
import type { EditorAttribute, EditorEffect } from '@/lib/gas-codegen';
import type { EditorState } from '@/components/modules/core-engine/sub_ability/blueprint/types';

const execute = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { useAbilitySpecBinding, type SpecBinding } from '@/components/modules/core-engine/sub_ability/blueprint/useAbilitySpecBinding';
import { SpecEntityBar } from '@/components/modules/core-engine/sub_ability/blueprint/SpecEntityBar';
import { SEED_ATTRIBUTES } from '@/components/modules/core-engine/sub_ability/blueprint/data';
import { SPELLBOOK_ABILITIES } from '@/components/modules/core-engine/sub_ability/_shared/data';
import { useAbilitySpecStore } from '@/stores/abilitySpecStore';

function envelope<T>(data: T) {
  return { json: async () => ({ success: true, data }) } as Response;
}

/** damage-override fixture: GE_X authors Health -50 against Fireball's catalog 35. */
const GE_X: EditorEffect = {
  id: 'e-x', name: 'GE_X', duration: 'instant', durationSec: 0, cooldownSec: 0, color: 'var(--x)',
  modifiers: [
    { attribute: 'Health', operation: 'add', magnitude: -50 },
    { attribute: 'Mana', operation: 'add', magnitude: -5 },
  ],
  grantedTags: ['State.Burning'],
};
const GE_Y: EditorEffect = {
  id: 'e-y', name: 'GE_Y', duration: 'duration', durationSec: 2, cooldownSec: 0, color: 'var(--y)',
  modifiers: [{ attribute: 'Mana', operation: 'add', magnitude: 10 }], grantedTags: [],
};
const VITALS: EditorAttribute[] = [
  { id: 'a-hp', name: 'Health', category: 'vital', defaultValue: 100 },
  { id: 'a-mp', name: 'Mana', category: 'vital', defaultValue: 50 },
];

function state(effects: EditorEffect[], attributes: EditorAttribute[]): EditorState {
  return { attributes, relationships: [], effects, tagRules: [], loadout: [] };
}

const onHydrate = vi.fn();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  execute.mockReset();
  onHydrate.mockReset();
  useAbilitySpecStore.setState({ specByEntity: {} });
});

async function mount(s: EditorState) {
  vi.stubGlobal('fetch', vi.fn(async () => envelope<EnrichedAbilitySpec | null>(null)));
  const hook = renderHook(() => useAbilitySpecBinding({ moduleId: 'arpg-gas', state: s, onHydrate }));
  await waitFor(() => expect(hook.result.current.hydrating).toBe(false));
  return hook;
}

describe('useAbilitySpecBinding — generate preflight', () => {
  it('case 7: findings hold the dispatch; Fix all & generate patches the editor AND dispatches the fixed spec', async () => {
    const { result } = await mount(state([GE_X, GE_Y], VITALS));

    act(() => result.current.reviewGenerate());
    expect(execute).not.toHaveBeenCalled();
    expect(result.current.preflight).not.toBeNull();
    expect(result.current.preflight!.findings.length).toBeGreaterThanOrEqual(1);

    const hydratesBefore = onHydrate.mock.calls.length;
    act(() => result.current.confirmGenerate({ applyFixes: true }));

    expect(onHydrate.mock.calls.length).toBe(hydratesBefore + 1);
    const patched = onHydrate.mock.calls.at(-1)![0] as Partial<EditorState>;
    const expectedX = { ...GE_X, modifiers: [{ ...GE_X.modifiers[0], magnitude: -35 }, GE_X.modifiers[1]] };
    expect(patched.effects).toEqual([expectedX, GE_Y]);

    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0];
    expect(task.type).toBe('generate-gas-effects');
    expect(task.effects).toEqual([expectedX, GE_Y]);
    expect(task.scalars).toMatchObject({ damage: 35, manaCost: 20, cooldown: 3 });
    expect(result.current.preflight).toBeNull();
  });

  it('case 7b: Generate anyway dispatches the spec unchanged; a blocked spec never dispatches', async () => {
    const { result } = await mount(state([GE_X, GE_Y], VITALS));
    act(() => result.current.reviewGenerate());
    const hydrates = onHydrate.mock.calls.length;
    act(() => result.current.confirmGenerate({ applyFixes: false }));
    expect(onHydrate.mock.calls.length).toBe(hydrates);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].effects).toEqual([GE_X, GE_Y]);

    execute.mockReset();
    const empty = await mount(state([], VITALS));
    act(() => empty.result.current.reviewGenerate());
    expect(empty.result.current.preflight!.canGenerate).toBe(false);
    act(() => empty.result.current.confirmGenerate({ applyFixes: true }));
    expect(execute).not.toHaveBeenCalled();
  });

  it('case 8 [guard]: a clean spec dispatches on the first click; generateEffects stays immediate', async () => {
    const fireball = SPELLBOOK_ABILITIES.find((a) => a.id === 'off-fire-01')!;
    const { effects } = deriveDefaultSpec('spellbook', fireball);
    const { result } = await mount(state(effects, SEED_ATTRIBUTES));

    act(() => result.current.reviewGenerate());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].effects).toEqual(effects);
    expect(result.current.preflight).toBeNull();

    execute.mockReset();
    const dirty = await mount(state([GE_X], VITALS));
    act(() => dirty.result.current.generateEffects());
    expect(execute).toHaveBeenCalledTimes(1);
    expect(dirty.result.current.preflight).toBeNull();
  });
});

describe('SpecEntityBar — Generate goes through the preflight', () => {
  function binding(over: Partial<SpecBinding>): SpecBinding {
    return {
      entityId: 'off-fire-01', setEntityId: vi.fn(), ability: undefined, hydrating: false, saveState: 'idle', error: null,
      save: vi.fn(async () => {}), draftSpec: vi.fn(), generateEffects: vi.fn(), isRunning: false,
      codegen: { state: 'idle' } as SpecBinding['codegen'],
      preflight: null, reviewGenerate: vi.fn(), confirmGenerate: vi.fn(), dismissPreflight: vi.fn(), applyFix: vi.fn(),
      ...over,
    };
  }

  it('the button reviews; findings render with Fix all & generate / Generate anyway', () => {
    const b = binding({});
    const { rerender } = render(createElement(SpecEntityBar, { binding: b }));
    fireEvent.click(screen.getByRole('button', { name: /Generate GAS effects/ }));
    expect(b.reviewGenerate).toHaveBeenCalledTimes(1);
    expect(b.generateEffects).not.toHaveBeenCalled();

    const withFindings = binding({
      preflight: {
        canGenerate: true,
        findings: [{
          kind: 'damage-override', severity: 'override', effectName: 'GE_X', authored: -50, catalog: -35,
          message: 'GE_X authors Health -50; the run pins it to -35 (catalog damage 35).',
          fix: { kind: 'set-magnitude', effectId: 'e-x', modifierIndex: 0, magnitude: -35 },
        }],
      },
    });
    rerender(createElement(SpecEntityBar, { binding: withFindings }));
    expect(screen.getByText(/GE_X authors Health -50/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Fix all & generate/ }));
    expect(withFindings.confirmGenerate).toHaveBeenCalledWith({ applyFixes: true });
    fireEvent.click(screen.getByRole('button', { name: /Generate anyway/ }));
    expect(withFindings.confirmGenerate).toHaveBeenCalledWith({ applyFixes: false });
  });
});
