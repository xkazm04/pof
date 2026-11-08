/** An empty dungeon states why, instead of reading like a legitimate layout. */
import { describe, it, expect } from 'vitest';
import { generateDungeon, DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';

describe('generateDungeon empty result reason', () => {
  it('minRoomSize above maxRoomSize returns no rooms and says why', () => {
    const r = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, minRoomSize: 10, maxRoomSize: 5 });
    expect(r.rooms).toEqual([]);
    expect(r.reason).toBeTruthy();
    expect(r.reason).toContain('minRoomSize');
    expect(r.reason).toContain('maxRoomSize');
  });

  it('a layout that has rooms carries no reason', () => {
    const r = generateDungeon(DEFAULT_DUNGEON_CONFIG);
    expect(r.rooms.length).toBeGreaterThan(0);
    expect(r.reason).toBeUndefined();
  });

  it('a grid too small for any room states that instead', () => {
    const r = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, width: 4, height: 4 });
    expect(r.rooms).toEqual([]);
    expect(r.reason).toBeTruthy();
  });
});
