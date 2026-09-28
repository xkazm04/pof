/**
 * Acceptance: the orphaned EQS / squad tools are reachable from the AI Behavior
 * module, and the authored squad is built through the ai-5 checklist task on click.
 *
 * Card eqs-squad-combat-spatial/B (scan-sweep --challenge run challenge-2026-09-28b),
 * cases 4 (editor half), 5 and 6.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { CLITask } from '@/lib/cli-task';

/** Captured `execute(task)` calls — the proof a dispatch did (or did not) happen. */
const h = vi.hoisted(() => ({
  executed: [] as unknown[],
  sessionKeys: [] as string[],
  forceConfigError: false,
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string }) => {
    h.sessionKeys.push(opts.sessionKey);
    return {
      execute: async (task: unknown) => { h.executed.push(task); },
      sendPrompt: () => {},
      isRunning: false,
    };
  },
}));

// Lets case 4 put the editor into its configError state (no preset is invalid).
vi.mock('@/lib/ai-director/squad-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai-director/squad-engine')>();
  return {
    ...actual,
    runSquadSimulation: (config: Parameters<typeof actual.runSquadSimulation>[0]) =>
      h.forceConfigError
        ? { ok: false as const, error: { code: 'empty-formation' as const, message: 'Formation has no roles to allocate.', field: 'formation' } }
        : actual.runSquadSimulation(config),
  };
});

const { AIBehaviorView } = await import('@/components/modules/game-systems/AIBehaviorView');
const { SquadChoreographyEditor } = await import('@/components/modules/game-systems/SquadChoreographyEditor');

beforeEach(() => {
  h.executed.length = 0;
  h.sessionKeys.length = 0;
  h.forceConfigError = false;
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  }) as unknown as Response));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function openEqsTab() {
  render(<AIBehaviorView />);
  fireEvent.click(screen.getByRole('tab', { name: 'EQS & Squad Tactics' }));
}

const TOOLS: { label: string; testId: string }[] = [
  { label: 'Squad Choreography', testId: 'squad-choreography-editor' },
  { label: 'Attack Ring', testId: 'attack-ring-visualizer' },
  { label: 'Flank Heatmap', testId: 'flank-angle-heatmap' },
  { label: 'Cover Analysis', testId: 'tactical-cover-analysis' },
  { label: 'Patrol Points', testId: 'patrol-points-distribution' },
  { label: 'EQS Pipelines', testId: 'eqs-pipeline-diagram' },
  { label: 'EQS Inventory', testId: 'eqs-component-inventory' },
];

describe('AIBehaviorView — EQS & Squad Tactics tab', () => {
  it('case 5: exposes 4 tabs, one of them "EQS & Squad Tactics", which opens on the squad editor', () => {
    render(<AIBehaviorView />);
    const moduleTabs = within(screen.getByRole('tablist', { name: /sections$/ })).getAllByRole('tab');
    expect(moduleTabs).toHaveLength(4);
    expect(moduleTabs.map((t) => t.textContent)).toContain('EQS & Squad Tactics');

    fireEvent.click(screen.getByRole('tab', { name: 'EQS & Squad Tactics' }));
    expect(screen.getByTestId('squad-choreography-editor')).toBeTruthy();

    const toolNav = within(screen.getByRole('tablist', { name: 'EQS & squad tools' })).getAllByRole('tab');
    expect(toolNav.map((t) => t.textContent)).toEqual(TOOLS.map((t) => t.label));
  });

  // One test per tool: each mounts only its own host (keeps every case well under the timeout).
  it.each(TOOLS)('case 5b: the "$label" tool mounts its host component', ({ label, testId }) => {
    openEqsTab();
    const nav = screen.getByRole('tablist', { name: 'EQS & squad tools' });
    fireEvent.click(within(nav).getByRole('tab', { name: label }));
    expect(screen.getByTestId(testId)).toBeTruthy();
  });

  it('case 6: Build dispatches the ai-5 checklist task with the selected formation, once, on click only', () => {
    openEqsTab();
    expect(h.sessionKeys).toContain('ai-squad-build');
    expect(h.executed).toHaveLength(0);

    fireEvent.click(screen.getByTestId('squad-formation-ambush'));
    expect(h.executed).toHaveLength(0);

    fireEvent.click(screen.getByTestId('squad-build-btn'));
    expect(h.executed).toHaveLength(1);
    const task = h.executed[0] as CLITask & { itemId?: string };
    expect(task.type).toBe('checklist');
    expect(task.moduleId).toBe('ai-behavior');
    expect(task.itemId).toBe('ai-5');
    expect(task.prompt).toContain('Ambush');
    expect(task.prompt).toContain('Aggressor x1 → Flanker x1 → Ambusher x2');
    expect(task.prompt).toContain('RESERVATION system owned by each target');
  });
});

describe('SquadChoreographyEditor — build button', () => {
  it('case 4: the build button renders disabled while configError is set', () => {
    h.forceConfigError = true;
    const onBuild = vi.fn();
    render(<SquadChoreographyEditor onBuild={onBuild} />);
    expect(screen.getByTestId('squad-config-error')).toBeTruthy();
    const btn = screen.getByTestId('squad-build-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onBuild).not.toHaveBeenCalled();
  });

  it('case 4b: enabled on a valid config and hands the current config to onBuild', () => {
    const onBuild = vi.fn();
    render(<SquadChoreographyEditor onBuild={onBuild} />);
    const btn = screen.getByTestId('squad-build-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('Build this squad in UE5');
    fireEvent.click(btn);
    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onBuild.mock.calls[0][0].formation.id).toBe('pincer');
  });

  it('no onBuild prop -> no build button (today\'s behaviour)', () => {
    render(<SquadChoreographyEditor />);
    expect(screen.queryByTestId('squad-build-btn')).toBeNull();
  });
});
