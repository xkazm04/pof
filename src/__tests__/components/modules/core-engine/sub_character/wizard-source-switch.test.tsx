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

describe('CharacterSourceWizard - switching source mid-dispatch', () => {
  it('keeps the running step attributed so its completion is reported', async () => {
    const view = render(<CharacterSourceWizard moduleId={'arpg-character' as SubModuleId} />);
    cli.execute.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByText('Prepare Source')); });
    expect(view.container.textContent).toContain('Preparing source');
    // Picking another source while the step runs must not reset the rail.
    await act(async () => { fireEvent.click(screen.getByText('Mixamo')); });
    expect(view.container.textContent).toContain('Preparing source');
    await act(async () => { cli.onComplete?.(true); });
    expect(view.container.textContent).toContain('Completed');
  });

  it('re-enables the picker once the step has completed', async () => {
    const view = render(<CharacterSourceWizard moduleId={'arpg-character' as SubModuleId} />);
    cli.execute.mockResolvedValueOnce(true);
    await act(async () => { fireEvent.click(screen.getByText('Prepare Source')); });
    await act(async () => { cli.onComplete?.(true); });
    await act(async () => { fireEvent.click(screen.getByText('Mixamo')); });
    const mixamo = screen.getByText('Mixamo').closest('button');
    expect(mixamo?.getAttribute('aria-pressed')).toBe('true');
    expect(view.container.textContent).not.toContain('Completed');
  });
});
