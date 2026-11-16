/**
 * RoomType's eight values live in ONE runtime list (`ROOM_TYPES` in
 * src/types/level-design.ts). A hand-typed copy elsewhere silently misses a new
 * type (the picker and the adopt-code validator would never learn it).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_ROOM_TYPES } from '@/components/modules/content/level-design/RoomDetailPanel/constants';
import { adoptCodeValue } from '@/lib/level-design/reconcile';
import type { LevelDesignDocument, RoomNode } from '@/types/level-design';

const SRC = path.resolve(__dirname, '../../..');
const EIGHT = ['combat', 'puzzle', 'exploration', 'boss', 'safe', 'transition', 'cutscene', 'hub'];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === '__tests__' || e.name === 'node_modules') return [];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

describe('RoomType single source', () => {
  it('only src/types/level-design.ts spells out the room-type values as a list', () => {
    // A list copy is 'combat' followed by 'puzzle' as the next list element (comma or union bar).
    const copy = /'combat'\s*[,|]\s*'puzzle'/;
    const hits = walk(SRC)
      .filter((f) => copy.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(hits).toEqual(['types/level-design.ts']);
  });

  it('the picker list holds exactly the eight values, in order', () => {
    expect([...ALL_ROOM_TYPES]).toEqual(EIGHT);
  });

  it('the adopt-code validator accepts every room type', () => {
    const room = { id: 'r1', name: 'R', type: 'combat', description: '', encounterDesign: '', difficulty: 1,
      pacing: 'rising', x: 0, y: 0, linkedFiles: [], spawnEntries: [], tags: [] } as RoomNode;
    const doc = { id: 1, rooms: [room], connections: [], syncReport: [] } as unknown as LevelDesignDocument;
    for (const t of EIGHT) {
      const res = adoptCodeValue(doc, { roomId: 'r1', roomName: 'R', field: 'type', docValue: 'combat', codeValue: t } as never);
      expect(res.ok, t).toBe(true);
    }
  });
});
