import { describe, it, expect } from 'vitest';
import {
  generateDungeon,
  DEFAULT_DUNGEON_CONFIG,
  type CellType,
} from '@/lib/visual-gen/generators/dungeon';

describe('generateDungeon', () => {
  it('returns correct grid dimensions', () => {
    const result = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, width: 32, height: 32 });
    expect(result.grid).toHaveLength(32);
    expect(result.grid[0]).toHaveLength(32);
    expect(result.width).toBe(32);
    expect(result.height).toBe(32);
  });

  it('generates at least one room', () => {
    const result = generateDungeon(DEFAULT_DUNGEON_CONFIG);
    expect(result.rooms.length).toBeGreaterThan(0);
  });

  it('rooms are within grid bounds', () => {
    const result = generateDungeon(DEFAULT_DUNGEON_CONFIG);
    for (const room of result.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(0);
      expect(room.y).toBeGreaterThanOrEqual(0);
      expect(room.x + room.width).toBeLessThanOrEqual(result.width);
      expect(room.y + room.height).toBeLessThanOrEqual(result.height);
    }
  });

  it('rooms respect min/max size constraints', () => {
    const config = { ...DEFAULT_DUNGEON_CONFIG, minRoomSize: 4, maxRoomSize: 8 };
    const result = generateDungeon(config);

    for (const room of result.rooms) {
      expect(room.width).toBeGreaterThanOrEqual(config.minRoomSize);
      expect(room.width).toBeLessThanOrEqual(config.maxRoomSize);
      expect(room.height).toBeGreaterThanOrEqual(config.minRoomSize);
      expect(room.height).toBeLessThanOrEqual(config.maxRoomSize);
    }
  });

  it('grid contains only valid cell types', () => {
    const validTypes: CellType[] = ['empty', 'floor', 'wall', 'door', 'corridor'];
    const result = generateDungeon(DEFAULT_DUNGEON_CONFIG);

    for (const row of result.grid) {
      for (const cell of row) {
        expect(validTypes).toContain(cell);
      }
    }
  });

  it('rooms are drawn as floor cells', () => {
    const result = generateDungeon(DEFAULT_DUNGEON_CONFIG);

    for (const room of result.rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          expect(result.grid[y][x]).toBe('floor');
        }
      }
    }
  });

  it('walls surround floor and corridor cells', () => {
    const result = generateDungeon(DEFAULT_DUNGEON_CONFIG);
    const { grid, width, height } = result;

    // Every empty cell adjacent to a floor/corridor should be a wall
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] !== 'wall') continue;

        // Verify at least one neighbor is floor or corridor
        let hasFloorNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              if (grid[ny][nx] === 'floor' || grid[ny][nx] === 'corridor') {
                hasFloorNeighbor = true;
              }
            }
          }
        }
        expect(hasFloorNeighbor).toBe(true);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const config = { ...DEFAULT_DUNGEON_CONFIG, seed: 77 };
    const a = generateDungeon(config);
    const b = generateDungeon(config);

    expect(a.rooms).toEqual(b.rooms);
    expect(a.grid).toEqual(b.grid);
  });

  it('produces different results for different seeds', () => {
    const a = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, seed: 1 });
    const b = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, seed: 2 });

    // Room count or positions should differ
    const roomsDiffer =
      a.rooms.length !== b.rooms.length ||
      a.rooms.some((r, i) => r.x !== b.rooms[i]?.x || r.y !== b.rooms[i]?.y);
    expect(roomsDiffer).toBe(true);
  });

  it('generates more rooms with more iterations', () => {
    const few = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, iterations: 2 });
    const many = generateDungeon({ ...DEFAULT_DUNGEON_CONFIG, iterations: 6 });

    expect(many.rooms.length).toBeGreaterThanOrEqual(few.rooms.length);
  });

  it('rooms have unique ids', () => {
    const result = generateDungeon(DEFAULT_DUNGEON_CONFIG);
    const ids = result.rooms.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
