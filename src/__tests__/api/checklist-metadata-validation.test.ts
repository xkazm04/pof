/**
 * PUT /api/checklist-metadata writes a row the RoadmapChecklist reads back typed as
 * `Priority`. An unknown moduleId, a priority outside the four-value vocabulary, or a
 * non-string itemId/notes is the caller's error (400) — never a stored row that the
 * GET then returns with a fabricated type.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-checklist-metadata-${process.pid}.db`;
});

import { PUT, GET } from '@/app/api/checklist-metadata/route';

const put = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/checklist-metadata', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

describe('PUT /api/checklist-metadata — field validation', () => {
  it.each([
    ['unknown moduleId', { moduleId: 'not-a-module', itemId: 'x1', priority: 'critical' }],
    ['unknown priority', { moduleId: 'arpg-combat', itemId: 'x1', priority: 'urgent' }],
    ['numeric priority', { moduleId: 'arpg-combat', itemId: 'x1', priority: 3 }],
    ['non-string notes', { moduleId: 'arpg-combat', itemId: 'x1', notes: { a: 1 } }],
    ['non-string itemId', { moduleId: 'arpg-combat', itemId: 42 }],
  ])('refuses %s with 400 and stores nothing', async (_label, body) => {
    const res = await put(body);
    expect(res.status).toBe(400);
    const read = await GET(new NextRequest(`http://localhost/api/checklist-metadata?moduleId=${(body as { moduleId: string }).moduleId}`));
    const rows = (await read.json()).data as Record<string, unknown>;
    expect(rows['x1']).toBeUndefined();
    expect(rows['42']).toBeUndefined();
  });

  it('accepts a known module, a real priority and string notes', async () => {
    const res = await put({ moduleId: 'arpg-combat', itemId: 'ok1', priority: 'important', notes: 'n' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.priority).toBe('important');
  });
});
