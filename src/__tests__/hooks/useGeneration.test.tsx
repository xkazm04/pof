import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AbilityEntry } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_task: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
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
  beforeEach(() => execute.mockClear());

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
