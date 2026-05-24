import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: mockExecute, sendPrompt: vi.fn(), isRunning: false }),
}));

import { WBPStarterPanel } from '@/components/modules/core-engine/sub_ui/wbp-starter/WBPStarterPanel';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('WBPStarterPanel', () => {
  it('dispatches a wbp-starter task for the default class on Scaffold', () => {
    render(<WBPStarterPanel moduleId="arpg-ui" />);
    fireEvent.click(screen.getByRole('button', { name: /scaffold wbp/i }));
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'wbp-starter', moduleId: 'arpg-ui', targetClass: 'UARPGHUDWidget' }),
    );
  });

  it('dispatches for the class the operator typed', () => {
    render(<WBPStarterPanel moduleId="arpg-ui" />);
    const input = screen.getByLabelText(/target widget class/i);
    fireEvent.change(input, { target: { value: 'UAbilityBarWidget' } });
    fireEvent.click(screen.getByRole('button', { name: /scaffold wbp/i }));
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'wbp-starter', targetClass: 'UAbilityBarWidget' }),
    );
  });

  it('renders the known HUD widget classes as suggestions', () => {
    render(<WBPStarterPanel moduleId="arpg-ui" />);
    const opts = document.querySelectorAll('#wbp-class-suggestions option');
    const values = Array.from(opts).map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain('UEnemyHealthBarWidget');
    expect(values).toContain('UCharacterStatsWidget');
  });
});
