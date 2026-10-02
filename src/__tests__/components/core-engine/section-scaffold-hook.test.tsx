import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, renderHook, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { useProjectStore } from '@/stores/projectStore';
import { getFeatureInitPrompt } from '@/components/modules/core-engine/unique-tabs/feature-init-prompts';
import type { CLITask } from '@/lib/cli-task';

/**
 * Scaffolding a Feature Map section (scan-sweep --challenge core-engine-genre-tabs/B):
 * one click dispatches the section's init prompt as a task; when the run ends the
 * project is rescanned (forced past the cache) and the section is re-graded from the
 * headers — never marked done on the CLI's success flag. Mounting the map dispatches
 * and scans nothing, and a finished run never auto-dispatches the next queued section.
 */

const h = vi.hoisted(() => ({
  execute: null as null | ((task: unknown) => Promise<void>),
  onComplete: undefined as undefined | ((success: boolean) => void),
}));

// Mirrors useModuleCLI's contract: completion reads the LATEST render's onComplete.
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { onComplete?: (s: boolean) => void }) => {
    h.onComplete = opts.onComplete;
    return { isRunning: false, sendPrompt: vi.fn(), execute: h.execute! };
  },
}));

import { useSectionScaffold } from '@/components/modules/core-engine/unique-tabs/useSectionScaffold';
import FeatureMapTab from '@/components/modules/core-engine/unique-tabs/FeatureMapTab';

const execute = vi.fn<(task: unknown) => Promise<void>>(async () => {});
const scanProject = vi.fn<(opts?: { force?: boolean }) => Promise<void>>(async () => {});

function ctx(...classNames: string[]) {
  return {
    scannedAt: new Date().toISOString(),
    projectType: 'ue5' as const,
    classes: classNames.map((name) => ({ name, prefix: name[0], headerPath: `${name}.h` })),
    plugins: [],
    buildDependencies: [],
    sourceFileCount: classNames.length,
  };
}

beforeEach(() => {
  localStorage.clear();
  execute.mockClear();
  scanProject.mockReset();
  scanProject.mockImplementation(async () => {});
  h.execute = execute;
  h.onComplete = undefined;
  useProjectStore.setState({
    projectName: 'Did',
    projectPath: 'C:/UE/Did',
    isScanning: false,
    dynamicContext: ctx(),
    scanProject,
  });
});
afterEach(cleanup);

describe('useSectionScaffold', () => {
  it('scaffold(traces) dispatches the init prompt once; a finished run whose rescan lacks the class reads absent', async () => {
    // The rescan the run triggers still finds no hit detection component.
    scanProject.mockImplementation(async () => {
      useProjectStore.setState({ dynamicContext: ctx('UARPGSomethingElse') });
    });
    const { result } = renderHook(() => useSectionScaffold('arpg-combat'));

    act(() => result.current.scaffold('traces'));
    expect(execute).toHaveBeenCalledTimes(1);
    const task = execute.mock.calls[0][0] as CLITask;
    expect(task.label).toBe('Scaffold: traces');
    expect(task.prompt).toBe(getFeatureInitPrompt('arpg-combat', 'traces')!.prompt);
    expect(scanProject).not.toHaveBeenCalled();

    await act(async () => { h.onComplete!(true); });
    expect(scanProject).toHaveBeenCalledWith({ force: true });
    await waitFor(() =>
      expect(result.current.stateOf('traces')).toMatchObject({
        state: 'absent',
        missing: ['UARPGHitDetectionComponent'],
        reason: 'run finished, class not found',
      }),
    );
  });

  it('a run whose rescan finds the class reads scaffolded with no failure reason', async () => {
    scanProject.mockImplementation(async () => {
      useProjectStore.setState({ dynamicContext: ctx('UARPGHitDetectionComponent') });
    });
    const { result } = renderHook(() => useSectionScaffold('arpg-combat'));
    act(() => result.current.scaffold('traces'));
    await act(async () => { h.onComplete!(true); });
    await waitFor(() => expect(result.current.stateOf('traces').state).toBe('scaffolded'));
    expect(result.current.stateOf('traces').reason).toBeUndefined();
  });
});

describe('[guard] FeatureMapTab never dispatches or scans on its own', () => {
  it('enemy-ai with only the archetype scanned: 0 execute / 0 scan on mount; one click = one run, never auto-chained', async () => {
    useProjectStore.setState({ dynamicContext: ctx('UARPGEnemyArchetype') });
    render(<FeatureMapTab moduleId="arpg-enemy-ai" />);
    expect(execute).not.toHaveBeenCalled();
    expect(scanProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Scaffold next/ }));
    expect(execute).toHaveBeenCalledTimes(1);
    expect((execute.mock.calls[0][0] as CLITask).label).toBe('Scaffold: modifiers');

    await act(async () => { h.onComplete!(true); });
    await waitFor(() => expect(scanProject).toHaveBeenCalledWith({ force: true }));
    // behavior-tree is next in the queue, but only a click dispatches it.
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('no scan yet: 0 execute / 0 scan on mount; Scan project is the only way to scan', () => {
    useProjectStore.setState({ dynamicContext: null });
    render(<FeatureMapTab moduleId="arpg-enemy-ai" />);
    expect(execute).not.toHaveBeenCalled();
    expect(scanProject).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Scaffold/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Scan project/ }));
    expect(scanProject).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });
});
