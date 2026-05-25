import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FindingList, type Finding } from '@/components/ecw/infra/FindingList';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';

const findings: Finding[] = [
  { severity: 'ok', rule: 'a', message: 'All good' },
  { severity: 'warn', rule: 'b', message: 'Heads up' },
  { severity: 'error', rule: 'c', message: 'Broken' },
];

describe('FindingList', () => {
  afterEach(cleanup);

  it('renders one row per finding with its message', () => {
    render(<FindingList findings={findings} />);
    expect(screen.getByText('All good')).toBeTruthy();
    expect(screen.getByText('Heads up')).toBeTruthy();
    expect(screen.getByText('Broken')).toBeTruthy();
  });

  it('colors icons by severity via inline token style (no hardcoded color classes)', () => {
    const { container } = render(<FindingList findings={findings} />);
    const icons = Array.from(container.querySelectorAll('svg'));
    // each severity gets its own token color, set inline (not via a text-*-500 class)
    const colors = icons.map((i) => i.getAttribute('style'));
    expect(colors.every((c) => c && c.includes('color:'))).toBe(true);
    expect(new Set(colors).size).toBe(3); // ok / warn / error are visually distinct
    expect(icons.every((i) => !/text-(emerald|amber|red)-500/.test(i.getAttribute('class') ?? ''))).toBe(true);
    // sanity: positive token differs from critical token
    expect(SEVERITY_TOKENS.positive.color).not.toBe(SEVERITY_TOKENS.critical.color);
  });

  it('provides a screen-reader severity label per row', () => {
    render(<FindingList findings={[{ severity: 'error', rule: 'x', message: 'Bad' }]} />);
    expect(screen.getByText('Error:')).toBeTruthy();
  });
});
