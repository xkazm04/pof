import { describe, it, expect } from 'vitest';
import { dangerGlyph } from '@/components/modules/core-engine/sub_world/travel/HazardMap';
import { ENV_HAZARDS, ZONE_DANGER_SCORES } from '@/components/modules/core-engine/sub_world/_shared/data';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

const scoreOf = (zone: string) => ZONE_DANGER_SCORES.find((z) => z.zone === zone)!.score;

describe('HazardMap danger glyph', () => {
  it('never reads a zone holding a hazard as safe', () => {
    const hazardous = [...new Set(ENV_HAZARDS.map((h) => h.zone))];
    expect(hazardous.length).toBeGreaterThan(0);
    for (const zone of hazardous) expect(dangerGlyph(scoreOf(zone)).color, zone).not.toBe(STATUS_SUCCESS);
  });

  it('[control] a zone without hazards reads as safe', () => {
    expect(dangerGlyph(0).color).toBe(STATUS_SUCCESS);
  });
});
