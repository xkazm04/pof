import { describe, it, expect } from 'vitest';
import { ARCHETYPES, KILL_DEATH_STATS, DIFFICULTY_SERIES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

const byId = (id: string) => ARCHETYPES.find(a => a.id === id);

describe('encounter chart identity comes from ARCHETYPES', () => {
  it('KILL_DEATH_STATS label and colour equal the ARCHETYPES entry', () => {
    expect(KILL_DEATH_STATS.length).toBe(4);
    for (const row of KILL_DEATH_STATS) {
      const a = byId(row.id);
      expect(a, row.id).toBeDefined();
      expect(row.label).toBe(a!.label);
      expect(row.color).toBe(a!.color);
    }
  });

  it('difficulty series label and colour equal the ARCHETYPES entry', () => {
    expect(DIFFICULTY_SERIES.length).toBe(3);
    for (const s of DIFFICULTY_SERIES) {
      const a = byId(s.id);
      expect(a, s.id).toBeDefined();
      expect(s.label).toBe(a!.label);
      expect(s.color).toBe(a!.color);
    }
  });
});
