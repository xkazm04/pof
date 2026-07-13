import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

// Stub the presentational shell (CodeBlock uses the async Shiki highlighter, which
// jsdom can't run) — this test targets the RUN-PATH logic: same ctx assembly, same
// composeTaskDispatch pipeline as useModuleCLI.execute, knowledge summary derived
// from the composed string.
vi.mock('@/components/modules/shared/PromptInspector', () => ({
  PromptInspector: ({ prompt, knowledge }: { prompt: string | null; knowledge?: string[] }) => (
    <div>
      <pre data-testid="stub-prompt">{prompt}</pre>
      <div data-testid="stub-knowledge">{(knowledge ?? []).join('|')}</div>
    </div>
  ),
}));

import { TaskPromptInspector } from '@/components/modules/shared/TaskPromptInspector';
import { composeTaskDispatch } from '@/lib/prompt-evolution/dispatch-resolve';
import { TaskFactory } from '@/lib/cli-task';
import { getAppOrigin } from '@/lib/constants';
import { useProjectStore } from '@/stores/projectStore';
import type { SubModuleId } from '@/types/modules';

const MOD = 'arpg-combat' as SubModuleId;
const ITEM = 'combat-hit-detect';
const RAW = 'Implement melee hit detection with a TSet dedup.';

// Per-dispatch callback ids differ by design; normalize them for parity checks.
const norm = (s: string) => s.replace(/@@CALLBACK:[\w-]+/g, '@@CALLBACK:X');

beforeEach(() => {
  // No adopted variant → resolver falls back to the static prompt.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, data: null }),
  }) as unknown as Response));
  useProjectStore.setState({
    projectName: 'PoF',
    projectPath: 'C:\\proj\\PoF',
    ueVersion: '5.7.2',
    dynamicContext: undefined,
    scanProject: async () => {},
  } as never);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TaskPromptInspector — run-path preview parity', () => {
  it('renders collapsed as a single low-friction toggle', () => {
    render(<TaskPromptInspector moduleId={MOD} itemId={ITEM} prompt={RAW} />);
    const toggle = screen.getByTestId('task-prompt-preview-toggle');
    expect(toggle.textContent).toContain('Preview prompt');
    expect(screen.queryByTestId('task-prompt-inspector')).toBeNull();
  });

  it('composes the EXACT string the dispatch path would send (same builder, same ctx)', async () => {
    render(<TaskPromptInspector moduleId={MOD} itemId={ITEM} prompt={RAW} label="Combat" />);
    fireEvent.click(screen.getByTestId('task-prompt-preview-toggle'));

    await waitFor(() => {
      expect(screen.queryByTestId('task-prompt-inspector')).not.toBeNull();
    });

    // Expected: the same pipeline useModuleCLI.execute runs — TaskFactory task,
    // store ctx, composeTaskDispatch (variant resolution + buildTaskPrompt).
    const { projectName, projectPath, ueVersion, dynamicContext } = useProjectStore.getState();
    const task = TaskFactory.checklist(MOD, ITEM, RAW, 'Combat', getAppOrigin());
    const { prompt: expected } = await composeTaskDispatch(task, {
      projectName, projectPath, ueVersion, dynamicContext,
    });

    const shown = screen.getByTestId('stub-prompt').textContent ?? '';
    expect(norm(shown)).toBe(norm(expected));
    // The knowledge summary is derived from that same composed string.
    expect(screen.getByTestId('stub-knowledge').textContent).toContain('static prompt');
  });

  it('surfaces a compose failure inline with a retry affordance (never a silent dead end)', async () => {
    useProjectStore.setState({
      scanProject: async () => { throw new Error('scan exploded'); },
    } as never);
    render(<TaskPromptInspector moduleId={MOD} itemId={ITEM} prompt={RAW} />);
    fireEvent.click(screen.getByTestId('task-prompt-preview-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('task-prompt-preview-toggle').textContent).toContain('Preview failed: scan exploded');
    });
  });
});
