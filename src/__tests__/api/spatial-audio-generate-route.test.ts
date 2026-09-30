import { describe, it, expect, beforeAll, vi } from 'vitest';

// Own throwaway DB (the audio-gen-route.test.ts pattern): this suite writes
// level docs and audio scenes, which must never reach the shared floor DB.
vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-vitest/spatial-audio-generate-route-${process.pid}/pof.db`;
});
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/spatial-audio-generate/route';
import { createDoc, updateDoc } from '@/lib/level-design-db';
import { createAudioScene, getAudioScene, updateAudioScene } from '@/lib/audio-scene-db';
import type { RoomNode, RoomConnection } from '@/types/level-design';

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/spatial-audio-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ROOM_BASE = { encounterDesign: '', difficulty: 2 as const, pacing: 'falling' as const, y: 100, linkedFiles: [], spawnEntries: [], tags: [] };
const ROOMS: RoomNode[] = [
  { ...ROOM_BASE, id: 'r1', name: 'Entrance Hall', type: 'hub', description: 'torches and a waterfall', x: 0 },
  { ...ROOM_BASE, id: 'r2', name: 'Crypt', type: 'combat', description: 'skeletons', x: 300 },
  { ...ROOM_BASE, id: 'r3', name: 'Library', type: 'puzzle', description: 'dusty books', x: 600 },
];
const LINKS = [
  { id: 'c1', fromId: 'r1', toId: 'r2', bidirectional: true, condition: '' },
  { id: 'c2', fromId: 'r2', toId: 'r3', bidirectional: true, condition: '' },
] as RoomConnection[];

let levelDocId: number;

beforeAll(() => {
  const doc = createDoc({ name: `sync-level-${Date.now()}`, description: '' });
  updateDoc({ id: doc.id, rooms: ROOMS, connections: LINKS });
  levelDocId = doc.id;
});

function freshScene() {
  const s = createAudioScene({ name: `sync-scene-${Date.now()}` });
  return updateAudioScene({ id: s.id, globalReverbPreset: 'cave' })!;
}

describe('POST /api/spatial-audio-generate — preview then apply', () => {
  it('preview returns the plan and writes nothing', async () => {
    const scene = freshScene();
    const res = await POST(post({ action: 'preview', levelDocId, audioSceneId: scene.id }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.rows).toHaveLength(3);
    expect(json.data.rows.every((r: { status: string }) => r.status === 'new')).toBe(true);
    expect(json.data.ops.length).toBeGreaterThan(0);
    expect(json.data.summary.new).toBe(3);

    const after = getAudioScene(scene.id)!;
    expect(after.zones).toHaveLength(0);
    expect(after.emitters).toHaveLength(0);
    expect(after.updatedAt).toBe(scene.updatedAt);
    expect(after.globalReverbPreset).toBe('cave');
  });

  it('generate twice on the same scene: one zone per room, and the scene keeps its own global reverb', async () => {
    const scene = freshScene();
    const first = await POST(post({ action: 'generate', levelDocId, audioSceneId: scene.id }));
    expect(first.status).toBe(200);
    const second = await POST(post({ action: 'generate', levelDocId, audioSceneId: scene.id }));
    expect(second.status).toBe(200);

    const after = getAudioScene(scene.id)!;
    expect(after.zones).toHaveLength(ROOMS.length);
    expect(new Set(after.emitters.map((e) => e.id)).size).toBe(after.emitters.length);
    expect(after.globalReverbPreset).toBe('cave');
  });
});
