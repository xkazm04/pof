import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpellbookLogicWorkspace } from '@/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useAbilitySpecStore } from '@/stores/abilitySpecStore';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({ useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }) }));
vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
// GET /api/ability-spec returns no persisted row → the workspace seeds deriveDefaultSpec.
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: null }) })));

const fireball: StoredCatalogEntity = {
  id: 'off-fire-01', catalogId: 'spellbook', name: 'Fireball', categoryPath: ['Offensive', 'Fire'], tags: [], lifecycle: 'planned',
  data: { id: 'off-fire-01', name: 'Fireball', category: 'Offensive', element: 'Fire', tier: 'advanced', damage: 40, manaCost: 20, cooldown: 6, color: '#f87171', tag: 'Ability.Fire.Fireball' },
};

describe('SpellbookLogicWorkspace', () => {
  beforeEach(() => {
    usePipelineStore.setState({ tracksByEntity: {} });
    useAbilitySpecStore.setState({ specByEntity: {} });
    execute.mockClear();
    vi.mocked(fetch).mockClear();
  });
  afterEach(cleanup);

  it('shows the scalar cards and mounts the two rich editors populated from the spec', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    // Unchanged scalar cards (unique strings)
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('advanced')).toBeTruthy();
    // The two GAS cards now carry the rich editors
    expect(screen.getByRole('heading', { name: 'Effect Mapping' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /add effect/i })).toBeTruthy(); // EffectTimelineEditor
    expect(screen.getByRole('button', { name: /add rule/i })).toBeTruthy();    // TagRulesEditor
    // deriveDefaultSpec seeds two activation rules vs Dead/Stunned
    expect(screen.getAllByText('State.Dead').length).toBeGreaterThan(0);
  });

  it('dispatches an aspect-scoped CLI change when a scalar card button is clicked', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /tune damage/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Fireball');
    expect(task.prompt).toMatch(/damage/i);
  });

  it('dispatches a draft-ability-spec task from "Draft with AI"', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /draft with ai/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect((execute.mock.calls[0][0] as { type: string }).type).toBe('draft-ability-spec');
  });

  it('dispatches a generate-gas-effects task carrying entity scalars from "Generate C++"', () => {
    render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /generate c\+\+/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; scalars?: { manaCost?: number; cooldown?: number; damage?: number } };
    expect(task.type).toBe('generate-gas-effects');
    expect(task.scalars?.manaCost).toBe(20); // fireball fixture manaCost
    expect(task.scalars?.cooldown).toBe(6);  // fireball fixture cooldown
    expect(task.scalars?.damage).toBe(40);   // fireball fixture damage — the canonical-damage guard
  });

  it('persists an edit via debounced POST /api/ability-spec', async () => {
    vi.useFakeTimers();
    try {
      render(<SpellbookLogicWorkspace entity={fireball} trackId="logic" />);
      fireEvent.click(screen.getByRole('button', { name: /add effect/i }));
      // optimistic store update is synchronous: 1 seeded effect + 1 added = 2
      expect(useAbilitySpecStore.getState().getSpec('spellbook', 'off-fire-01')?.effects.length).toBe(2);
      await vi.advanceTimersByTimeAsync(UI_TIMEOUTS.specSaveDebounce + 50);
      const postCall = vi.mocked(fetch).mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
      expect(postCall).toBeTruthy();
      expect(String(postCall![0])).toContain('/api/ability-spec');
    } finally {
      vi.useRealTimers();
    }
  });
});
