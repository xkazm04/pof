import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const cli = vi.hoisted(() => ({
  execute: vi.fn<(task: unknown) => Promise<boolean>>(),
  onComplete: null as null | ((success: boolean) => void),
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { onComplete: (success: boolean) => void }) => {
    cli.onComplete = opts.onComplete;
    return { execute: cli.execute, sendPrompt: vi.fn(), isRunning: false };
  },
}));

import { CharacterSourceWizard } from '@/components/modules/core-engine/sub_character/wizard/CharacterSourceWizard';
import type { SubModuleId } from '@/types/modules';

afterEach(() => { cleanup(); cli.execute.mockReset(); });

const MODULE = 'arpg-character' as SubModuleId;

describe('CharacterSourceWizard - a declined dispatch', () => {
  it('puts the wire step back to idle instead of leaving it running', async () => {
    const view = render(<CharacterSourceWizard moduleId={MODULE} />);
    // Step 1 dispatches and completes so step 2 is reachable.
    cli.execute.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByText('Prepare Source')); });
    await act(async () => { cli.onComplete?.(true); });
    // Step 2: the spend preflight is cancelled, execute resolves false.
    cli.execute.mockResolvedValueOnce(false);
    await act(async () => { fireEvent.click(screen.getByText('Wire Characters')); });
    expect(view.container.textContent).not.toContain('Wiring characters');
    expect(cli.execute).toHaveBeenCalledTimes(2);
  });

  it('keeps the step running when the dispatch went through', async () => {
    const view = render(<CharacterSourceWizard moduleId={MODULE} />);
    cli.execute.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByText('Prepare Source')); });
    expect(view.container.textContent).toContain('Preparing source');
  });
});
