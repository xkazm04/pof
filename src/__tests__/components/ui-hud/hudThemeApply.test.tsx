import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';

// The editor's preview runs a rAF clock; a frozen clock keeps renders deterministic.
vi.mock('@/components/modules/content/ui-hud/HudThemeEditor/useAnimationLoop', () => ({
  useAnimationLoop: () => 0,
}));

// The apply bar dispatches through useModuleCLI; the test owns the CLI (no real terminal).
const sendPrompt = vi.fn();
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ sendPrompt, execute: vi.fn(), isRunning: false }),
}));

import { HudThemeEditor } from '@/components/modules/content/ui-hud/HudThemeEditor';
import { InventoryGridDesigner } from '@/components/modules/content/ui-hud/InventoryGridDesigner';
import { DEFAULT_THEME } from '@/components/modules/content/ui-hud/HudThemeEditor/constants';
import { diffThemeExport, applyStatus } from '@/components/modules/content/ui-hud/HudThemeEditor/themeDiff';
import { THEME_APPLY_SESSION_KEY } from '@/components/modules/content/ui-hud/HudThemeEditor/ApplyToProjectBar';
import { buildHudThemeApplyPrompt } from '@/lib/prompts/hud-theme';
import { buildProjectContextHeader, type ProjectContext } from '@/lib/prompt-context';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';

/**
 * HUD designs survive tab switches and apply to the project: only changed values.
 * ReviewableModuleView renders an extra tab only while it is active, so a tab
 * switch is an unmount + remount — exactly what these cases do.
 */

const P1 = 'C:/P1';
const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };
const FADE_ONE = diffThemeExport(DEFAULT_THEME, { ...DEFAULT_THEME, fadeOutDelay: 4.5 });

function openEnemySection() {
  fireEvent.click(screen.getByRole('tab', { name: 'Enemy HP Bar' }));
  return document.getElementById('hud-theme-panel-enemy')!;
}
function fadeOutDelayControl() {
  const panel = openEnemySection();
  const label = within(panel).getByText('FadeOutDelay');
  const row = label.parentElement!.parentElement!;
  return { input: row.querySelector('input[type="range"]') as HTMLInputElement, shown: label.nextElementSibling!.textContent };
}
function moveFadeOutDelay(v: string) {
  fireEvent.change(fadeOutDelayControl().input, { target: { value: v } });
}

beforeEach(() => {
  localStorage.clear();
  sendPrompt.mockReset();
  useHudDesignStore.setState({ byProject: {} });
  useProjectStore.setState({ projectPath: P1, projectName: 'PoF', ueVersion: '5.8.0' });
  useCLIPanelStore.setState({ sessions: {}, tabOrder: [], activeTabId: null });
});
afterEach(() => cleanup());

describe('drafts survive a tab switch (unmount + remount)', () => {
  it('HudThemeEditor keeps a moved FadeOutDelay', () => {
    const first = render(<HudThemeEditor />);
    expect(fadeOutDelayControl().shown).toBe('3.0s');
    moveFadeOutDelay('4.5');
    expect(fadeOutDelayControl().shown).toBe('4.5s');
    first.unmount();

    render(<HudThemeEditor />);
    expect(fadeOutDelayControl().shown).toBe('4.5s');
  });

  it('InventoryGridDesigner keeps its Columns count', () => {
    const columnsPlus = () => {
      const label = screen.getByText('Columns');
      return label.parentElement!.querySelectorAll('button')[1];
    };
    const first = render(<InventoryGridDesigner onGenerate={vi.fn()} isGenerating={false} />);
    for (let i = 0; i < 4; i += 1) fireEvent.click(columnsPlus());
    first.unmount();

    render(<InventoryGridDesigner onGenerate={vi.fn()} isGenerating={false} />);
    expect(within(screen.getByText('Columns').parentElement!).getByText('10')).toBeTruthy();
    expect(screen.getByText(/GRID:/).textContent).toMatch(/GRID:\s*10\D{1,3}4 \(40\)/);
  });
});

describe('diffThemeExport (rows of HUD_THEME_PARAMS, rendered by the export formatters)', () => {
  it('no applied baseline = the full set; identical themes = no changes', () => {
    expect(diffThemeExport(null, DEFAULT_THEME)).toHaveLength(20);
    expect(diffThemeExport(DEFAULT_THEME, DEFAULT_THEME)).toEqual([]);
  });

  it('one moved row yields one change carrying its widget, category and export lines', () => {
    expect(FADE_ONE).toEqual([{
      name: 'FadeOutDelay',
      widget: 'EnemyHealthBarWidget',
      category: 'EnemyHP|Fade',
      from: 'float FadeOutDelay = 3.0f;',
      to: 'float FadeOutDelay = 4.5f;',
    }]);
  });
});

describe('buildHudThemeApplyPrompt', () => {
  it('names only the changed UPROPERTY and carries the project build command', () => {
    const prompt = buildHudThemeApplyPrompt(FADE_ONE, CTX);
    expect(prompt).toContain('FadeOutDelay');
    expect(prompt).toContain('4.5f');
    expect(prompt).toContain('EnemyHealthBarWidget');
    const header = buildProjectContextHeader(CTX, moduleKnowledge('ui-hud'));
    const build = header.split('## Build Command\n')[1].split('\n')[0];
    expect(build).toContain('UnrealBuildTool');
    expect(prompt).toContain(build);
    expect(prompt).not.toContain('LowHealthThreshold');
  });
});

describe('applyStatus', () => {
  it('labels the button from pending count and run state', () => {
    expect(applyStatus({ pending: 0, running: false })).toEqual({ label: 'Up to date', disabled: true });
    expect(applyStatus({ pending: 3, running: false })).toEqual({ label: 'Apply 3 changes', disabled: false });
    expect(applyStatus({ pending: 3, running: true })).toEqual({ label: 'Applying...', disabled: true });
  });
});

describe('ApplyToProjectBar: explicit click, only changed values, baseline on success only', () => {
  function runEnds(success: boolean) {
    const cli = useCLIPanelStore.getState();
    const id = cli.findSessionByKey(THEME_APPLY_SESSION_KEY)!;
    act(() => {
      const seq = useCLIPanelStore.getState().beginRun(id);
      useCLIPanelStore.getState().endRun(id, seq, { success });
    });
  }

  beforeEach(() => {
    // An applied baseline at the defaults, and the session the apply dispatches into.
    useHudDesignStore.getState().beginApply(P1, DEFAULT_THEME);
    useHudDesignStore.getState().commitApply(P1, true);
    useCLIPanelStore.getState().createSession({ sessionKey: THEME_APPLY_SESSION_KEY, moduleId: 'ui-hud', projectPath: P1 });
  });

  it('dispatches on click only, sends only the changed row, and moves the baseline only on success', () => {
    render(<HudThemeEditor />);
    expect(screen.getByRole('button', { name: 'Up to date' })).toHaveProperty('disabled', true);
    moveFadeOutDelay('4.5');
    expect(sendPrompt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    expect(sendPrompt).toHaveBeenCalledTimes(1);
    const prompt = sendPrompt.mock.calls[0][0] as string;
    expect(prompt).toContain('float FadeOutDelay = 4.5f;');
    expect(prompt).not.toContain('LowHealthThreshold');

    runEnds(false);
    expect(useHudDesignStore.getState().getThemeApplied(P1)).toEqual(DEFAULT_THEME);
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/fail/i);

    fireEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    runEnds(true);
    expect(useHudDesignStore.getState().getThemeApplied(P1)?.fadeOutDelay).toBe(4.5);
    expect(screen.getByRole('button', { name: 'Up to date' })).toBeTruthy();
  });

  it('a run that ends while the tab is away still settles the baseline on return', () => {
    const first = render(<HudThemeEditor />);
    moveFadeOutDelay('4.5');
    fireEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }));
    first.unmount();
    runEnds(true);

    render(<HudThemeEditor />);
    expect(screen.getByRole('button', { name: 'Up to date' })).toBeTruthy();
    expect(useHudDesignStore.getState().getThemeApplied(P1)?.fadeOutDelay).toBe(4.5);
  });
});
