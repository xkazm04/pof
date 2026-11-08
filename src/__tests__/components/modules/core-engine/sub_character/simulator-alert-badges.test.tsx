import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AlertBadges } from '@/components/modules/core-engine/sub_character/simulator/predictive/AlertBadges';
import type { BalanceReport } from '@/components/modules/core-engine/sub_character/simulator/predictive/data';

afterEach(cleanup);

type Alert = BalanceReport['alerts'][number];

/** The engine pushes alerts encounter-major, so a late encounter's critical lands after many warnings. */
const warnings: Alert[] = Array.from({ length: 10 }, (_, i) => ({
  severity: 'warning',
  message: `Lv.${i + 1} vs 3x Grunt: 100% survival — trivially easy`,
}));
const critical: Alert = { severity: 'critical', message: 'Lv.4 vs 1x Brute: 12% survival — early game too hard' };

describe('AlertBadges — the capped list never hides a critical alert or the overflow', () => {
  it('shows a critical alert that arrives after more than the cap of warnings', () => {
    const { container } = render(<AlertBadges alerts={[...warnings, critical]} />);
    expect(container.textContent).toContain(critical.message);
  });

  it('lists critical alerts first', () => {
    const { container } = render(<AlertBadges alerts={[...warnings, critical]} />);
    const rows = container.querySelectorAll('[data-alert-severity]');
    expect(rows[0]?.getAttribute('data-alert-severity')).toBe('critical');
  });

  it('says how many alerts the cap left out', () => {
    const { container } = render(<AlertBadges alerts={[...warnings, critical]} />);
    // 11 unique alerts, 8 shown
    expect(container.textContent).toContain('+3 more');
  });

  it('shows no overflow line when everything fits', () => {
    const { container } = render(<AlertBadges alerts={[critical]} />);
    expect(container.textContent).not.toContain('more');
  });
});
