import { describe, it, expect } from 'vitest';
import { buildZonePrompt } from '@/lib/world/zone-prompt';

describe('buildZonePrompt', () => {
  it('names the zone and the trimmed instruction', () => {
    const p = buildZonePrompt('Crystal Caves', '  add a hidden path  ');
    expect(p).toContain('Crystal Caves');
    expect(p).toContain('add a hidden path');
    expect(p).not.toContain('  add a hidden');
  });

  it('instructs reuse of world/level-streaming rather than inventing a system', () => {
    const p = buildZonePrompt('X', 'bigger');
    expect(p).toMatch(/World Partition|level-streaming|streaming levels/i);
  });

  it('works with an empty instruction', () => {
    expect(buildZonePrompt('Y', '').length).toBeGreaterThan(0);
  });
});
