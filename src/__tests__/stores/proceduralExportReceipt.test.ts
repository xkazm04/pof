/**
 * The procedural export reported green off a bare transport OK. Terrain and vegetation
 * scripts already print a receipt nobody read; the dungeon script printed none.
 * Every sibling Blender surface (scene export, armature, blockout) reads its receipt.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProceduralStore } from '@/components/modules/visual-gen/procedural-engine/useProceduralStore';
import { DEFAULT_TERRAIN_CONFIG } from '@/lib/visual-gen/generators/terrain';
import { DEFAULT_DUNGEON_CONFIG } from '@/lib/visual-gen/generators/dungeon';
import { RECEIPT_MARKER } from '@/lib/blender-mcp/receipt';

const store = () => useProceduralStore.getState();
let sent: string[];

function replyWith(output: string) {
  sent = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)).code as string);
    return { ok: true, status: 200, json: async () => ({ success: true, data: { output } }) };
  }));
}

beforeEach(() => {
  useProceduralStore.setState({
    terrainConfig: { ...DEFAULT_TERRAIN_CONFIG },
    dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG },
    terrainHeightmap: [[0, 0], [0, 0]],
    dungeonResult: { grid: [['floor']], rooms: [], width: 1, height: 1 },
    runs: { terrain: null, dungeon: null, vegetation: null },
    exports: { terrain: null, dungeon: null, vegetation: null },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('procedural export receipt', () => {
  it('does not report success when Blender printed no receipt', async () => {
    replyWith('Created terrain');
    await store().exportToBlender('terrain');
    expect(store().exports.terrain?.exportResult).toBeNull();
    expect(store().exports.terrain?.exportError).toMatch(/not confirmed/i);
  });

  it('reports the printed text, without the receipt line, when confirmed', async () => {
    replyWith(`Created terrain\n${RECEIPT_MARKER}{"kind": "terrain-mesh", "faces": 1, "verts": 4}\n`);
    await store().exportToBlender('terrain');
    expect(store().exports.terrain).toMatchObject({ exportResult: 'Created terrain', exportError: null });
  });

  it('the dungeon script prints a receipt, and it is required', async () => {
    replyWith('Created dungeon');
    await store().exportToBlender('dungeon');
    expect(sent[0]).toContain(RECEIPT_MARKER);
    expect(store().exports.dungeon?.exportError).toMatch(/not confirmed/i);

    replyWith(`${RECEIPT_MARKER}{"kind": "dungeon-geometry", "objects": 1}`);
    await store().exportToBlender('dungeon');
    expect(store().exports.dungeon?.exportError).toBeNull();
  });
});
