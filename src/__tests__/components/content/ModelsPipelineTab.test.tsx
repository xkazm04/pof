/**
 * The Models "Asset Pipeline" tab is a projection of the `mod-*` checklist.
 *
 * Before this change the tab read completion from `pipeline-<stage>` keys the
 * completion route refuses (so it read "0 of 6" forever), dispatched raw prompts
 * through a hand-rolled `pof-cli-prompt` door on the module view (no item id, so
 * no run could complete a stage), and passed `isRunning={false}` hard-coded (a
 * second run could always be dispatched).
 *
 * RED before this change: `models/tabs/PipelineTab.tsx` did not exist.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cliState = vi.hoisted(() => ({
  sendPrompt: vi.fn(),
  isRunning: false,
  activeItemId: null as string | null,
  unconfirmedItemId: null as string | null,
  retryUnconfirmed: vi.fn(),
  dismissUnconfirmed: vi.fn(),
}));

vi.mock('@/hooks/useChecklistCLI', () => ({
  useChecklistCLI: () => cliState,
}));

import { PipelineTab } from '@/components/modules/content/models/tabs/PipelineTab';
import { ModelsView } from '@/components/modules/content/models/ModelsView';
import { useModuleStore } from '@/stores/moduleStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { getModuleChecklist } from '@/lib/module-registry';

const CHECKLIST = getModuleChecklist('models');
const itemOf = (id: string) => CHECKLIST.find((i) => i.id === id)!;

function setProgress(progress: Record<string, boolean>) {
  useModuleStore.setState({ checklistProgress: { models: progress } } as never);
}

/** The disclosure triggers are the buttons whose accessible name is a stage label. */
function stageTrigger(id: string) {
  const label = itemOf(id).label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return screen.getByRole('button', { name: new RegExp('^' + label) });
}

beforeEach(() => {
  setProgress({});
  cliState.sendPrompt.mockReset();
  cliState.isRunning = false;
  cliState.activeItemId = null;
});

afterEach(() => {
  cleanup();
  setProgress({});
});

describe('Models PipelineTab', () => {
  it('reads completion from the registry ids: mod-2 ticked -> LOD Complete, 1 of 6', () => {
    setProgress({ 'mod-2': true });
    render(<PipelineTab />);

    expect(within(stageTrigger('mod-2')).getByText('Complete')).toBeTruthy();
    expect(screen.getAllByText(/1 of 6 stages complete/).length).toBeGreaterThan(0);
  });

  it('Run dispatches the registry prompt under the registry id, never a raw window event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<PipelineTab />);

    fireEvent.click(stageTrigger('mod-1'));
    fireEvent.click(screen.getByRole('button', { name: /^Run / }));

    expect(cliState.sendPrompt).toHaveBeenCalledTimes(1);
    expect(cliState.sendPrompt).toHaveBeenCalledWith('mod-1', itemOf('mod-1').prompt);
    const cliEvents = dispatchSpy.mock.calls.filter(([e]) => e.type === 'pof-cli-prompt');
    expect(cliEvents).toHaveLength(0);
    dispatchSpy.mockRestore();

    const modelsSrc = readFileSync(
      join(process.cwd(), 'src/components/modules/content/models/ModelsView.tsx'),
      'utf8',
    );
    expect(modelsSrc).not.toMatch(/pof-cli-prompt/);
  });

  it('while a run is in flight every Run button is disabled', () => {
    cliState.isRunning = true;
    cliState.activeItemId = 'mod-1';
    setProgress({ 'mod-1': true, 'mod-4': true, 'mod-5': true, 'mod-2': true, 'mod-3': true });
    render(<PipelineTab />);

    for (const item of CHECKLIST) {
      fireEvent.click(stageTrigger(item.id));
      const panel = document.getElementById(stageTrigger(item.id).getAttribute('aria-controls')!)!;
      const run = within(panel).getByRole('button');
      expect(run).toHaveProperty('disabled', true);
    }
  });

  it('[guard] mounting ModelsView creates no CLI session', () => {
    const before = Object.keys(useCLIPanelStore.getState().sessions).length;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
    }) as unknown as Response));
    render(<ModelsView />);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(Object.keys(useCLIPanelStore.getState().sessions).length).toBe(before);
    vi.unstubAllGlobals();
  });
});
