import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the DB + generator so the route is exercised without touching SQLite.
vi.mock('@/lib/level-design-db', () => ({
  getAllDocs: vi.fn(() => [{ id: 1, name: 'Crypt', rooms: [] }]),
  getDoc: vi.fn((id: number) => ({ id, name: `Doc ${id}`, rooms: [] })),
}));

vi.mock('@/lib/quest-generator', () => ({
  generateQuests: vi.fn(() => ({
    generatedAt: '2026-01-01T00:00:00.000Z',
    worldScan: { actors: [], enemyClasses: [], npcClasses: [], interactableClasses: [], itemClasses: [] },
    levelDocId: 1,
    levelDocName: 'Crypt',
    quests: [],
    coherenceNotes: [],
  })),
}));

import { POST, GET } from '@/app/api/quest-generation/route';
import { generateQuests } from '@/lib/quest-generator';

function makePost(body: unknown, raw = false): NextRequest {
  return new NextRequest('http://localhost/api/quest-generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/quest-generation — body validation', () => {
  it('rejects a non-JSON body with 400', async () => {
    const res = await POST(makePost('not json{', true));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/valid JSON/i);
  });

  it('rejects a wrongly-typed levelDocId with 400 + reason', async () => {
    const res = await POST(makePost({ levelDocId: 'abc' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/invalid request body/i);
    expect(Array.isArray(json.details)).toBe(true);
    expect(json.details.join(' ')).toMatch(/levelDocId/);
  });

  it('rejects a wrongly-typed projectPath with 400', async () => {
    const res = await POST(makePost({ projectPath: 123 }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details.join(' ')).toMatch(/projectPath/);
  });

  it('accepts an empty body and generates from the first doc', async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(generateQuests).toHaveBeenCalledWith([], expect.objectContaining({ id: 1 }));
  });
});

describe('POST /api/quest-generation — project scan handling', () => {
  it('uses scanned classes when the scan succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { classes: [{ name: 'AGoblin', prefix: 'A', headerPath: 'g.h' }] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = await POST(makePost({ projectPath: 'C:/proj' }));
    expect(res.status).toBe(200);
    expect(generateQuests).toHaveBeenCalledWith(
      [{ name: 'AGoblin', prefix: 'A', headerPath: 'g.h' }],
      expect.anything(),
    );
  });

  it('degrades gracefully (still 200) when the scan reports success:false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'moduleName is required for UE5 projects' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const res = await POST(makePost({ projectPath: 'C:/proj' }));
    expect(res.status).toBe(200);
    // Proceeds with empty classes rather than aborting.
    expect(generateQuests).toHaveBeenCalledWith([], expect.anything());
  });

  it('surfaces the reason in a 502 when the scan request throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await POST(makePost({ projectPath: 'C:/proj' }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/scan failed/i);
    expect(json.details).toMatch(/ECONNREFUSED/);
    expect(generateQuests).not.toHaveBeenCalled();
  });
});

describe('GET /api/quest-generation', () => {
  it('returns the level-doc list envelope', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.docs).toEqual([{ id: 1, name: 'Crypt', roomCount: 0 }]);
  });
});
