import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AlertsSection } from '@/components/modules/evaluator/CombatSimulatorView/AlertsSection';
import type { BalanceAlert } from '@/types/combat-simulator';

afterEach(() => cleanup());

const alert = (severity: BalanceAlert['severity'], message: string): BalanceAlert => ({
  severity, type: 'one-shot', message, metric: 'oneShotRate', value: 0.08, threshold: 0.05,
} as BalanceAlert);

// Every row used the same icon, so severity rode on hue alone (WCAG 1.4.1).
describe('Balance alerts — severity readable without colour', () => {
  it('each alert row carries its severity as text', () => {
    const { container } = render(
      <AlertsSection alerts={[alert('critical', 'A'), alert('warning', 'B'), alert('info', 'C')]} />,
    );
    const rows = Array.from(container.querySelectorAll('[data-severity]'));
    expect(rows).toHaveLength(3);
    const words = rows.map((r) => r.textContent ?? '');
    expect(words[0]).toMatch(/critical/i);
    expect(words[1]).toMatch(/warning/i);
    expect(words[2]).toMatch(/info/i);
  });
});
