import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BestiaryRemixFacet } from '@/components/ecw/facets/bestiary/BestiaryRemixFacet';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { execute } = vi.hoisted(() => ({ execute: vi.fn((_t: unknown) => Promise.resolve()) }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned', data: { id: 'brute' },
};

describe('BestiaryRemixFacet', () => {
  beforeEach(() => execute.mockClear());
  afterEach(cleanup);

  it('renders the instruction textarea', () => {
    render(<BestiaryRemixFacet entity={entity} />);
    expect(screen.getByPlaceholderText(/make a fire-themed elite/i)).toBeTruthy();
  });

  it('disables dispatch when the instruction is empty', () => {
    render(<BestiaryRemixFacet entity={entity} />);
    const btn = screen.getByRole('button', { name: /remix with claude/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('dispatches a quick-action with the composed remix prompt', () => {
    render(<BestiaryRemixFacet entity={entity} />);
    fireEvent.change(screen.getByPlaceholderText(/make a fire-themed elite/i), {
      target: { value: 'give it a charge attack' },
    });
    fireEvent.click(screen.getByRole('button', { name: /remix with claude/i }));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as { type: string; prompt: string };
    expect(task.type).toBe('quick-action');
    expect(task.prompt).toContain('Brute');
    expect(task.prompt).toContain('give it a charge attack');
  });
});
