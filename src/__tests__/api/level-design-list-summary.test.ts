/**
 * GET /api/level-design (list) must not run the server-side summary scan: the only
 * client (useDesignDocument) derives the summary itself. `?summary=1` opts back in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const db = vi.hoisted(() => ({
  getAllDocs: vi.fn(() => []),
  getSummary: vi.fn(() => ({ totalDocs: 0 })),
  getDoc: vi.fn(),
  createDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));
vi.mock('@/lib/level-design-db', () => db);

import { GET } from '@/app/api/level-design/route';

const get = (qs = '') => GET(new NextRequest(`http://localhost/api/level-design${qs}`));

describe('GET /api/level-design list', () => {
  beforeEach(() => { db.getAllDocs.mockClear(); db.getSummary.mockClear(); });

  it('reads the table once and skips the summary scan', async () => {
    const res = await get();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.docs).toEqual([]);
    expect(db.getAllDocs).toHaveBeenCalledTimes(1);
    expect(db.getSummary).toHaveBeenCalledTimes(0);
  });

  it('still serves the summary on request', async () => {
    const body = await (await get('?summary=1')).json();
    expect(db.getSummary).toHaveBeenCalledTimes(1);
    expect(body.data.summary).toEqual({ totalDocs: 0 });
  });
});
