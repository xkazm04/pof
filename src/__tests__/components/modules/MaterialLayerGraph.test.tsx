/**
 * The materials Hierarchy graph drew `mt-1`/`mt-2`/`mt-3` — the module's
 * QUICK-ACTION ids, which belong to no checklist item. On a fresh install both
 * child nodes were locked forever ("DEP_MISSING: mt-3") because the root's
 * completion could never appear under a key the graph reads.
 *
 * RED before this change: the fresh-install unlock walk below could not pass, and
 * the dispatched prompt was a one-line copy rather than the registry's.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { MaterialLayerGraph } from '@/components/modules/content/materials/MaterialLayerGraph';
import { useModuleStore } from '@/stores/moduleStore';
import { getModuleChecklist } from '@/lib/module-registry';

const CHECKLIST = getModuleChecklist('materials');
const itemOf = (id: string) => CHECKLIST.find((i) => i.id === id)!;

function setProgress(progress: Record<string, boolean>) {
  useModuleStore.setState({ checklistProgress: { materials: progress } } as never);
}

beforeEach(() => setProgress({}));

afterEach(() => {
  cleanup();
  setProgress({});
});

describe('MaterialLayerGraph', () => {
  it('draws only ids the materials checklist actually declares', () => {
    render(<MaterialLayerGraph onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);

    // Every node's label comes from the registry item — a drifted id would render
    // the loud REGISTRY_DRIFT marker instead.
    for (const id of ['mat-1', 'mat-2', 'mat-3']) {
      expect(screen.getAllByText(itemOf(id).label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/REGISTRY_DRIFT/)).toBeNull();
  });

  it('can unlock from a fresh install: completing the root frees both children', () => {
    const { rerender } = render(
      <MaterialLayerGraph onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />,
    );

    // Fresh install: children locked, and the banner names the REAL prerequisite.
    expect(screen.getAllByText(/DEP_MISSING/)).toHaveLength(2);
    expect(screen.getAllByText(new RegExp(itemOf('mat-1').label, 'i')).length).toBeGreaterThan(0);
    expect(screen.getByText(/GRAPH_STATUS: 0\/3/)).toBeTruthy();

    // The root's completion lands under the id the graph dispatches — mat-1.
    setProgress({ 'mat-1': true });
    rerender(<MaterialLayerGraph onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);

    expect(screen.queryByText(/DEP_MISSING/)).toBeNull();
    expect(screen.getByText(/GRAPH_STATUS: 1\/3/)).toBeTruthy();
  });

  it('dispatches the registry prompt under the registry id, not a parallel copy', () => {
    const onRunPrompt = vi.fn();
    render(<MaterialLayerGraph onRunPrompt={onRunPrompt} isRunning={false} activeItemId={null} />);

    // Buttons render root-first, then the two children.
    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(onRunPrompt).toHaveBeenCalledWith('mat-1', itemOf('mat-1').prompt);
  });

  it('does not dispatch a locked child', () => {
    const onRunPrompt = vi.fn();
    render(<MaterialLayerGraph onRunPrompt={onRunPrompt} isRunning={false} activeItemId={null} />);

    fireEvent.click(screen.getAllByRole('button')[1]);

    expect(onRunPrompt).not.toHaveBeenCalled();
  });
});
