/**
 * The Min (3-8) and Max (6-20) room sliders overlap, so Min 8 / Max 6 was reachable and
 * `placeRooms` then rejects every leaf: "0 rooms generated", silently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useProceduralStore } from '@/components/modules/visual-gen/procedural-engine/useProceduralStore';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';

const store = () => useProceduralStore.getState();

beforeEach(() => {
  useProceduralStore.setState({ dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG } });
});

describe('dungeon room size bounds', () => {
  it('raising Min past Max drags Max up', () => {
    store().setDungeonConfig({ maxRoomSize: 6 });
    store().setDungeonConfig({ minRoomSize: 8 });
    expect(store().dungeonConfig).toMatchObject({ minRoomSize: 8, maxRoomSize: 8 });
  });

  it('lowering Max below Min drags Min down', () => {
    store().setDungeonConfig({ minRoomSize: 8 });
    store().setDungeonConfig({ maxRoomSize: 6 });
    expect(store().dungeonConfig).toMatchObject({ minRoomSize: 6, maxRoomSize: 6 });
  });

  it('the formerly inverted input now generates rooms', async () => {
    store().setDungeonConfig({ maxRoomSize: 6 });
    store().setDungeonConfig({ minRoomSize: 8 });
    await store().generate('dungeon');
    expect(store().dungeonResult?.rooms.length).toBeGreaterThan(0);
  });
});
