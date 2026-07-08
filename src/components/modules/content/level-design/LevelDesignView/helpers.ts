import type { RoomNode } from '@/types/level-design';

export function countRoomTypes(rooms: RoomNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const room of rooms) {
    counts[room.type] = (counts[room.type] ?? 0) + 1;
  }
  return counts;
}
