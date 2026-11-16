import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

afterEach(cleanup);

vi.mock('@/components/ui/CodeViewer', () => ({ CodeViewer: () => null }));
const STATE = {
  result: { config: { philosophy: 'balanced', maxLevel: 60, agentCount: 100 } },
  codeGenResult: {
    files: [{ filename: 'A.h', language: 'h', content: 'x', description: '' }],
    generatedAt: '2026-11-08T00:00:00Z',
    config: { philosophy: 'balanced', maxLevel: 60, agentCount: 100 },
  },
  isGenerating: false,
  generateCode: vi.fn(),
};
vi.mock('@/stores/economySimulatorStore', () => ({
  useEconomySimulatorStore: (selector: (s: typeof STATE) => unknown) => selector(STATE),
}));

import { AlertsSection } from '@/components/modules/evaluator/EconomySimulatorView/AlertsSection';
import { EconomyCodeGenPanel } from '@/components/modules/evaluator/EconomyCodeGenPanel';
import type { InflationAlert } from '@/types/economy-simulator';

const ALERTS = [{ type: 'inflation', severity: 'warning', level: 5, hour: 10, message: 'm' }] as unknown as InflationAlert[];

describe('economy disclosure toggles expose their state', () => {
  it('AlertsSection header reports aria-expanded and flips on click', () => {
    const { getByText } = render(<AlertsSection alerts={ALERTS} />);
    const btn = getByText('Inflation Alerts').closest('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('EconomyCodeGenPanel header reports aria-expanded once there is code to show', () => {
    const { getByText } = render(<EconomyCodeGenPanel />);
    const btn = getByText('UE5 Code Generator').closest('button')!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });
});
