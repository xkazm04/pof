/**
 * A stored room blob written by a CLI run or an older schema may omit the array
 * fields (spawnEntries / linkedFiles / tags). Every consumer indexes them
 * unguarded, so the read path (rowToDoc) must default them to [].
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ComponentProps } from 'react';

vi.mock('@/lib/db', () => ({
  getDb: () => ({ exec: () => {}, prepare: () => ({ all: () => [], get: () => undefined, run: () => ({ changes: 0, lastInsertRowid: 1 }) }) }),
}));

const { rowToDoc } = await import('@/lib/level-design-db');
const { RoomNodeGraphic } = await import('@/components/modules/content/level-design/LevelFlowEditor/RoomNodeGraphic');

afterEach(cleanup);

const THIN = [{ id: 'r1', name: 'Hall', type: 'combat', x: 10, y: 20 }];

function thinDoc() {
  return rowToDoc({
    id: 1, name: 'L', description: '', design_narrative: '', rooms: JSON.stringify(THIN),
    connections: '[]', difficulty_arc: '[]', pacing_notes: '', sync_status: 'unlinked', sync_report: '[]',
    last_generated_at: null, last_code_hash: null, created_at: '', updated_at: '',
  });
}

describe('rowToDoc normalises thin room blobs', () => {
  it('defaults spawnEntries, linkedFiles and tags to []', () => {
    const room = thinDoc().rooms[0];
    expect(room.spawnEntries).toEqual([]);
    expect(room.linkedFiles).toEqual([]);
    expect(room.tags).toEqual([]);
    expect(room.name).toBe('Hall');
  });

  it('the room node renders a room read from a thin blob without throwing', () => {
    const room = thinDoc().rooms[0];
    const props = {
      room, selectedRoomId: null, connectingFrom: null, accentColor: 'currentColor', dragState: null,
      findingsByRoom: new Map(), readOnly: false, isTabStop: false,
      handleMouseDown: () => {}, completeConnection: () => {}, startConnection: () => {},
      requestDeleteRoom: () => {}, selectRoom: () => {}, nudgeRoom: () => {}, cancelConnecting: () => {},
    } as unknown as ComponentProps<typeof RoomNodeGraphic>;
    expect(() => render(<svg><RoomNodeGraphic {...props} /></svg>)).not.toThrow();
  });
});
