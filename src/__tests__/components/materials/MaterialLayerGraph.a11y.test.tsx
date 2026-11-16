import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import { MaterialLayerGraph } from '@/components/modules/content/materials/MaterialLayerGraph';
import { useModuleStore } from '@/stores/moduleStore';

/**
 * A locked node (its prerequisite not done) swallows clicks, but its button was
 * neither disabled nor aria-disabled: assistive tech announced an actionable
 * button that does nothing. Nodes also carried no focus-visible ring.
 */

function setProgress(progress: Record<string, boolean>) {
  useModuleStore.setState({ checklistProgress: { materials: progress } } as never);
}

beforeEach(() => setProgress({}));
afterEach(() => {
  cleanup();
  setProgress({});
});

function nodeButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

describe('MaterialLayerGraph accessibility', () => {
  it('marks locked nodes aria-disabled and leaves the unlocked root actionable', () => {
    const { container } = render(<MaterialLayerGraph onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);
    const [root, ...children] = nodeButtons(container);
    expect(root.getAttribute('aria-disabled')).not.toBe('true');
    expect(children).toHaveLength(2);
    for (const c of children) expect(c.getAttribute('aria-disabled')).toBe('true');
  });

  it('unlocks children once the root is complete', () => {
    setProgress({ 'mat-1': true });
    const { container } = render(<MaterialLayerGraph onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);
    for (const b of nodeButtons(container).slice(1)) expect(b.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('gives every node a focus-visible ring', () => {
    const { container } = render(<MaterialLayerGraph onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);
    const missing = nodeButtons(container).filter((b) => !/\bfocus-ring/.test(b.className));
    expect(missing).toHaveLength(0);
  });
});
