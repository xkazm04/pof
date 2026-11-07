/**
 * One role -> colour vocabulary for the bestiary (data-viz encoding-vocabulary: series
 * identity is stable across every chart on the surface).
 *
 * Before: CardsMetric kept its own 3-entry map (melee/ranged/tank), so the 28 of 94
 * archetypes that are swarm/healer/caster all painted STATUS_NEUTRAL - 6 roles, 4 fills -
 * and its cyan meant "ranged" while the spawn formation's cyan meant "caster".
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CardsMetric } from '@/components/modules/core-engine/sub_bestiary/metrics/CardsMetric';
import * as data from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);

const ROLES = ['melee', 'ranged', 'tank', 'healer', 'caster', 'swarm'] as const;

function roleColors(): Record<string, string> {
  const map = (data as Record<string, unknown>).ENEMY_ROLE_COLORS as Record<string, string> | undefined;
  expect(map, 'data.ts exports ENEMY_ROLE_COLORS').toBeTruthy();
  return map!;
}

describe('bestiary role colour authority', () => {
  it('gives every EnemyRole its own colour', () => {
    const map = roleColors();
    expect(Object.keys(map).sort()).toEqual([...data.ALL_ROLES].sort());
    expect(new Set(ROLES.map(r => map[r])).size).toBe(ROLES.length);
  });

  it('CardsMetric paints one distinct fill per role present in the roster', () => {
    const map = roleColors();
    const present = new Set(data.ARCHETYPES.map(a => a.role));
    const { container } = render(<CardsMetric />);
    const fills = Array.from(container.querySelectorAll('path')).map(p => p.getAttribute('fill'));
    expect(new Set(fills).size).toBe(present.size);
    expect(new Set(fills)).toEqual(new Set([...present].map(r => map[r])));
  });

  it('spawn points colour each role with the same authority', () => {
    const map = roleColors();
    const drift = data.SPAWN_POINTS.filter(sp => sp.role && sp.color !== map[sp.role]).map(sp => `${sp.id}:${sp.role}`);
    expect(drift).toEqual([]);
  });
});
