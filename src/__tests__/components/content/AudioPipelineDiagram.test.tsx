/**
 * The audio pipeline diagram drew `au-1`/`au-2`/`au-3` — the audio module's
 * QUICK-ACTION ids, which belong to no checklist item. Every layer it completed
 * wrote a progress key the checklist, the feature matrix and the module views
 * can never read, and its unlock chain was computed from ids the module's
 * checklist never sets.
 *
 * RED before this change: the registry-label walk below found nothing (the
 * labels were one-line local copies), and the dispatched prompt was a one-liner
 * rather than the registry's.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { AudioPipelineDiagram } from '@/components/modules/content/audio/AudioPipelineDiagram';
import { useModuleStore } from '@/stores/moduleStore';
import { getModuleChecklist } from '@/lib/module-registry';

const CHECKLIST = getModuleChecklist('audio');
const itemOf = (id: string) => CHECKLIST.find((i) => i.id === id)!;

function setProgress(progress: Record<string, boolean>) {
  useModuleStore.setState({ checklistProgress: { audio: progress } } as never);
}

beforeEach(() => setProgress({}));

afterEach(() => {
  cleanup();
  setProgress({});
});

describe('AudioPipelineDiagram', () => {
  it('draws only ids the audio checklist actually declares', () => {
    render(<AudioPipelineDiagram onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);

    // Every layer's label and description come from the registry item — a drifted
    // id would render the loud REGISTRY_DRIFT marker instead.
    for (const id of ['aud-1', 'aud-2', 'aud-3']) {
      expect(screen.getAllByText(itemOf(id).label).length).toBeGreaterThan(0);
      expect(screen.getAllByText(itemOf(id).description).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/REGISTRY_DRIFT/)).toBeNull();
  });

  it('can unlock from a fresh install: completing the foundation frees the next layer', () => {
    const { rerender } = render(
      <AudioPipelineDiagram onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />,
    );

    // Fresh install: the two upper layers are locked, named by their REAL
    // prerequisite labels.
    expect(screen.getAllByText(/Build .* first/)).toHaveLength(2);
    expect(screen.getByText(/0\/3 layers built/)).toBeTruthy();

    // The foundation's completion lands under the id the diagram dispatches.
    setProgress({ 'aud-1': true });
    rerender(<AudioPipelineDiagram onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);

    expect(screen.getAllByText(/Build .* first/)).toHaveLength(1);
    expect(screen.getByText(/1\/3 layers built/)).toBeTruthy();

    setProgress({ 'aud-1': true, 'aud-2': true });
    rerender(<AudioPipelineDiagram onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);

    expect(screen.queryByText(/Build .* first/)).toBeNull();
    expect(screen.getByText(/2\/3 layers built/)).toBeTruthy();
  });

  it('dispatches the registry prompt under the registry id, not a parallel copy', () => {
    const onRunPrompt = vi.fn();
    render(<AudioPipelineDiagram onRunPrompt={onRunPrompt} isRunning={false} activeItemId={null} />);

    // Layers render most-advanced first, so the foundation is the last button.
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    expect(onRunPrompt).toHaveBeenCalledWith('aud-1', itemOf('aud-1').prompt);
  });

  it('does not dispatch a locked layer', () => {
    const onRunPrompt = vi.fn();
    render(<AudioPipelineDiagram onRunPrompt={onRunPrompt} isRunning={false} activeItemId={null} />);

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(onRunPrompt).not.toHaveBeenCalled();
  });

  it('an existing au-* completion no longer unlocks anything — the migration is what carries it', () => {
    // The old keys are dead to the UI on purpose: they are migrated at the write
    // boundary (see checklist-audio-key-migration.test.ts), never read here.
    setProgress({ 'au-1': true });
    render(<AudioPipelineDiagram onRunPrompt={vi.fn()} isRunning={false} activeItemId={null} />);

    expect(screen.getByText(/0\/3 layers built/)).toBeTruthy();
  });
});
