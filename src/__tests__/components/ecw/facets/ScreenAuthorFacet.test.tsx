import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScreenAuthorFacet } from '@/components/ecw/facets/screen-flow/ScreenAuthorFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({ useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }) }));

const entity: StoredCatalogEntity = {
  id: 'main-menu', catalogId: 'screen-flow', name: 'Main Menu',
  categoryPath: ['Screens'], tags: [], lifecycle: 'planned', data: { id: 'main-menu', label: 'Main Menu', group: 'Menu' },
};

describe('ScreenAuthorFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('renders the instruction textarea', () => {
    render(<ScreenAuthorFacet entity={entity} />);
    expect(screen.getByPlaceholderText(/branching dialogue/i)).toBeTruthy();
  });

  it('dispatches a quick-action carrying the screen name + instruction', () => {
    render(<ScreenAuthorFacet entity={entity} />);
    fireEvent.change(screen.getByPlaceholderText(/branching dialogue/i), { target: { value: 'add 3 choices gating a side-quest' } });
    fireEvent.click(screen.getByRole('button', { name: /author screen with claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Main Menu');
    expect(task.prompt).toContain('add 3 choices gating a side-quest');
  });
});
