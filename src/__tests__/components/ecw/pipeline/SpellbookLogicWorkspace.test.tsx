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
    expect(screen.getByText('Offensive')).toBeTruthy();
    expect(screen.getByText('Fire')).toBeTruthy();
    expect(screen.getByText('advanced')).toBeTruthy();
    expect(screen.getByText('Ability.Fire.Fireball')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText(/6s/)).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Effect Mapping' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeTruthy();
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
