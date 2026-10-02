/**
 * POST /api/visual-gen/style-dna/fork — save a corrected Style DNA as a copy, synchronously,
 * with NO vision call and NO distillation job. Throwaway DB in a per-file mkdtemp dir.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';

const { mockStart, mockVision, dbBox } = vi.hoisted(() => ({
  mockStart: vi.fn(),
  mockVision: vi.fn(),
  dbBox: {} as { dir?: string; db?: import('better-sqlite3').Database },
}));

vi.mock('@/lib/visual-gen/style-dna-job-store', () => ({ startStyleDnaJob: mockStart, getStyleDnaJob: vi.fn() }));
vi.mock('@/lib/vision/seam', () => ({ makeRoutedVisionText: () => mockVision }));
vi.mock('@/lib/db', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { default: Database } = await import('better-sqlite3');
  dbBox.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-style-dna-fork-'));
  dbBox.db = new Database(path.join(dbBox.dir, 'style.db'));
  return { getDb: () => dbBox.db };
});

const { POST } = await import('@/app/api/visual-gen/style-dna/fork/route');
const { getDb } = await import('@/lib/db');
const { saveStyleDna, listStyleDna, getActiveStyleDna, getStyleDna } = await import('@/lib/visual-gen/style-dna-db');

afterAll(async () => {
  dbBox.db?.close();
  const fs = await import('node:fs');
  if (dbBox.dir) fs.rmSync(dbBox.dir, { recursive: true, force: true });
});

const DNA = { palette: ['ash gray'], materials: ['cracked stone'], mood: ['grim'], render: ['painterly'], motifs: [] };

async function post(body: unknown) {
  const res = await POST(new NextRequest('http://localhost/api/visual-gen/style-dna/fork', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: res.status, json: (await res.json()) as { success: boolean; data?: { profile: { id: string; name: string; active: boolean } }; error?: string } };
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/visual-gen/style-dna/fork (case 7)', () => {
  it('201 { profile } for an unbound parent — 0 distillation jobs, 0 vision calls', async () => {
    const parent = saveStyleDna(getDb(), { name: 'Ashen', dna: { ...DNA, mood: ['grim', 'neon'] }, sourceImageCount: 4 });
    const { status, json } = await post({ fromId: parent.id, name: 'Ashen (edited)', dna: DNA });
    expect(status).toBe(201);
    expect(json.data?.profile).toMatchObject({ name: 'Ashen (edited)', active: true });
    expect(getActiveStyleDna(getDb())?.id).toBe(json.data!.profile.id);
    expect(getStyleDna(getDb(), parent.id)?.dna.mood).toEqual(['grim', 'neon']);
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockVision).not.toHaveBeenCalled();
  });

  it('refuses an unknown parent (404), an empty style (400) and a shipped canon style (400)', async () => {
    const parent = saveStyleDna(getDb(), { name: 'Base', dna: DNA, sourceImageCount: 1 });
    const count = listStyleDna(getDb()).length;

    expect((await post({ fromId: 'dna-nope', name: 'x', dna: DNA })).status).toBe(404);
    const empty = await post({ fromId: parent.id, dna: { palette: [], materials: [], mood: [], render: [], motifs: [] } });
    expect(empty.status).toBe(400);
    const shipped = await post({ fromId: 'shipped:diablo1', name: 'x', dna: DNA });
    expect(shipped.status).toBe(400);
    expect(shipped.json.error).toContain('shipped canon styles are edited in code');

    expect(listStyleDna(getDb())).toHaveLength(count);
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockVision).not.toHaveBeenCalled();
  });

  it('409 for a canon-bound parent — a fork never displaces a canon binding', async () => {
    const bound = saveStyleDna(getDb(), { name: 'Diablo board', dna: DNA, sourceImageCount: 2, canonProfile: 'diablo1' });
    const active = getActiveStyleDna(getDb())?.id;
    const count = listStyleDna(getDb()).length;
    const res = await post({ fromId: bound.id, name: 'Diablo (edited)', dna: DNA });
    expect(res.status).toBe(409);
    expect(res.json.error).toContain('bound styles are edited in the canon');
    expect(listStyleDna(getDb())).toHaveLength(count);
    expect(getActiveStyleDna(getDb())?.id).toBe(active);
  });
});
