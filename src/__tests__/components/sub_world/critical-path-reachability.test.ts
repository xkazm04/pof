import { describe, it, expect } from 'vitest';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';

function unreachableCriticalSources(): string[] {
  const crit = STATIC_WORLD.edges.filter((e) => e.criticalPath);
  const seen = new Set(STATIC_WORLD.zones.filter((z) => z.type === 'hub').map((z) => z.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of crit) {
      if (seen.has(e.fromId) && !seen.has(e.toId)) { seen.add(e.toId); grew = true; }
    }
  }
  return crit.filter((e) => !seen.has(e.fromId)).map((e) => `${e.fromId}->${e.toId}`);
}

describe('STATIC_WORLD critical path', () => {
  it('every critical edge source is reachable from a hub along critical edges', () => {
    expect(unreachableCriticalSources()).toEqual([]);
  });
});
