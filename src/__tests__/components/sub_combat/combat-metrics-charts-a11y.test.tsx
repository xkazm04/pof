import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GroupedDpsBarChart } from '@/components/modules/core-engine/sub_combat/metrics/GroupedDpsBarChart';
import { ProportionalSankey } from '@/components/modules/core-engine/sub_combat/metrics/ProportionalSankey';
import { CumulativeDamageSvg } from '@/components/modules/core-engine/sub_combat/metrics/CumulativeDamageSvg';
import { WEAPON_ROSTER } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';

// Chart values are reachable without a mouse (scan-sweep 2026-11-08, accessibility-checker):
// every weapon bar carries its name and DPS as a <title>, every metrics svg is a named image.

afterEach(() => cleanup());

describe('combat metrics chart accessibility', () => {
  it('every grouped-chart bar has a <title> naming its weapon and DPS', () => {
    const { container } = render(<GroupedDpsBarChart />);
    const bars = Array.from(container.querySelectorAll('rect'));
    expect(bars).toHaveLength(WEAPON_ROSTER.rows.length);
    const untitled = bars.filter((r) => {
      const t = r.querySelector('title')?.textContent ?? '';
      return !/ DPS$/.test(t) || t.length < 8;
    });
    expect(untitled).toHaveLength(0);
    const first = WEAPON_ROSTER.rows[0];
    const titles = bars.map((r) => r.querySelector('title')?.textContent);
    expect(titles).toContain(`${first.name}: ${first.dps.toFixed(1)} DPS`);
  });

  it('each metrics svg is role=img with a non-empty aria-label', () => {
    const unnamed: string[] = [];
    for (const [name, Chart] of [['grouped', GroupedDpsBarChart], ['sankey', ProportionalSankey], ['cumulative', CumulativeDamageSvg]] as const) {
      const { container } = render(<Chart />);
      const svg = container.querySelector('svg')!;
      if (svg.getAttribute('role') !== 'img' || !(svg.getAttribute('aria-label') ?? '').trim()) unnamed.push(name);
      cleanup();
    }
    expect(unnamed).toEqual([]);
  });
});
