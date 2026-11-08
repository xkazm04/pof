import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const cli = vi.hoisted(() => ({ running: false }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({
    execute: () => new Promise<void>(() => {}),
    sendPrompt: vi.fn(),
    isRunning: cli.running,
  }),
}));

import { CharacterSourceWizard } from '@/components/modules/core-engine/sub_character/wizard/CharacterSourceWizard';
import type { SubModuleId } from '@/types/modules';

const MODULE = 'arpg-character' as SubModuleId;

afterEach(() => {
  cleanup();
  cli.running = false;
});

const spinningButtons = (root: HTMLElement) =>
  [...root.querySelectorAll('button')].filter((b) => b.querySelector('.animate-spin'));

describe('CharacterSourceWizard — step state is per step', () => {
  it('only the dispatching step button spins while the shared session runs', () => {
    const view = render(<CharacterSourceWizard moduleId={MODULE} />);
    fireEvent.click(screen.getByText('Prepare Source'));
    cli.running = true;
    view.rerender(<CharacterSourceWizard moduleId={MODULE} />);
    const spinning = spinningButtons(view.container);
    expect(spinning).toHaveLength(1);
    expect(spinning[0].textContent).toContain('Prepare Source');
  });
});

describe('CharacterSourceWizard — locked steps are out of reach for keyboard too', () => {
  it('a locked step is inert, so its inputs cannot be tabbed into or edited', () => {
    render(<CharacterSourceWizard moduleId={MODULE} />);
    const locked = screen.getByLabelText('Player skeletal mesh').closest('[inert]');
    expect(locked).not.toBeNull();
    expect(locked!.querySelectorAll('input')).toHaveLength(4);
    // Step 1 is reachable, so it must stay interactive.
    expect(screen.getByText('Prepare Source').closest('[inert]')).toBeNull();
  });
});
