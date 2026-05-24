import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type {
  AbilityEntry, BestiaryEntry, CombatInteractionEntry, ScreenEntry, ZoneEntry, AnimationEntry,
} from '@/lib/catalog/types';

interface CapturedConfig { moduleId: string; sessionKey: string; label: string }
const { execute, lastConfig } = vi.hoisted(() => ({
  execute: vi.fn((_task: unknown) => Promise.resolve()),
  lastConfig: { value: null as CapturedConfig | null },
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (config: CapturedConfig) => {
    lastConfig.value = config;
    return { execute, sendPrompt: vi.fn(), isRunning: false };
  },
}));

import { useGeneration } from '@/hooks/useGeneration';

const fireball: AbilityEntry = {
  id: 'ga-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: {
    id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'basic',
    damage: 35, manaCost: 20, cooldown: 3, radar: [0.7, 0.85, 0.3, 0.5, 0.5],
    description: 'Hurl a ball of fire', color: '#f00', tag: 'Ability.Fire.Fireball',
  },
};

describe('useGeneration', () => {
  beforeEach(() => { execute.mockClear(); lastConfig.value = null; });

  it('dispatches a generate task for the requested step + entity', () => {
    const { result } = renderHook(() => useGeneration(fireball));
    act(() => result.current.generate('scaffold-cpp'));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; step: string; entity: { id: string } };
    expect(task.type).toBe('generate');
    expect(task.step).toBe('scaffold-cpp');
    expect(task.entity.id).toBe('ga-fireball');
  });

  it('exposes the running state from the underlying CLI session', () => {
    const { result } = renderHook(() => useGeneration(fireball));
    expect(result.current.isRunning).toBe(false);
  });
});

/** folder-09 R3: each catalog routes to its owning PoF sub-module. */
describe('useGeneration · CATALOG_MODULE routing', () => {
  beforeEach(() => { execute.mockClear(); lastConfig.value = null; });

  // Minimal entity shells — only the catalogId is meaningful for routing.
  const stub = <T,>(catalogId: string, data: T) => ({
    id: `e-${catalogId}`, catalogId, name: `n-${catalogId}`,
    categoryPath: ['x'], tags: [], lifecycle: 'planned' as const, data,
  });

  // Routing-only stubs: only catalogId is meaningful; data shape is unchecked.
  const bestiary = stub<BestiaryEntry['data']>('bestiary',
    { id: 'brute' } as unknown as BestiaryEntry['data']);
  const combat = stub<CombatInteractionEntry['data']>('combat-map',
    { id: 'c1' } as unknown as CombatInteractionEntry['data']);
  const screen = stub<ScreenEntry['data']>('screen-flow',
    { id: 's1' } as unknown as ScreenEntry['data']);
  const zone = stub<ZoneEntry['data']>('zone-map',
    { id: 'z1' } as unknown as ZoneEntry['data']);
  const montage = stub<AnimationEntry['data']>('state-graph',
    { id: 'm1' } as unknown as AnimationEntry['data']);

  it.each([
    ['bestiary',     bestiary, 'arpg-enemy-ai'],
    ['combat-map',   combat,   'arpg-combat'],
    ['screen-flow',  screen,   'arpg-ui'],
    ['zone-map',     zone,     'arpg-world'],
    ['state-graph',  montage,  'arpg-animation'],
  ] as const)('routes %s entities through %s', (_cid, entity, expectedModuleId) => {
    renderHook(() => useGeneration(entity));
    expect(lastConfig.value).not.toBeNull();
    expect(lastConfig.value!.moduleId).toBe(expectedModuleId);
  });
});
