import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DifficultyChart } from '@/components/modules/core-engine/sub_bestiary/encounters/DifficultyChart';

afterEach(cleanup);

const pts = (f: (l: number) => number) => Array.from({ length: 50 }, (_, i) => ({ level: i + 1, value: f(i + 1) }));
const SERIES = [
  { label: 'Grunt', data: pts(l => l), color: 'var(--a)' },
  { label: 'Caster', data: pts(l => 100 - l), color: 'var(--b)' },
  { label: 'Brute', data: pts(() => 55), color: 'var(--c)' },
];

describe('DifficultyChart keyboard / AT access', () => {
  it('names the svg and makes it focusable', () => {
    const { container } = render(<DifficultyChart series={SERIES} />);
    const svg = container.querySelector('svg[role="img"]') as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-label')).toContain('Grunt');
    expect(svg.getAttribute('tabindex')).toBe('0');
  });

  it('steps through all 50 levels with ArrowRight and announces values', () => {
    const { container, getByTestId } = render(<DifficultyChart series={SERIES} />);
    const svg = container.querySelector('svg[role="img"]') as SVGElement;
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      fireEvent.keyDown(svg, { key: 'ArrowRight' });
      seen.add(getByTestId('difficulty-live').textContent ?? '');
    }
    expect(seen.size).toBe(50);
    const last = getByTestId('difficulty-live').textContent ?? '';
    expect(last).toContain('Level 50');
    expect(last).toContain('Grunt 50 SWEET SPOT');
    expect(last).toContain('Caster 50 SWEET SPOT');
    expect(last).toContain('Brute 55 SWEET SPOT');
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(getByTestId('difficulty-live').textContent).toContain('Level 49');
  });

  it('gives each series a distinct dash pattern', () => {
    const { container } = render(<DifficultyChart series={SERIES} />);
    const dashes = Array.from(container.querySelectorAll('polyline')).map(p => p.getAttribute('stroke-dasharray'));
    expect(dashes.length).toBe(3);
    expect(new Set(dashes).size).toBe(3);
  });
});
