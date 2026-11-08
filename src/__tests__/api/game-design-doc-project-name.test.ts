/**
 * POST /api/game-design-doc {action:'generate'} used `body.projectName ?? 'Untitled
 * Project'` with no type check, so `projectName: {}` rendered "[object Object]" into
 * the title and the markdown / pitch exports. A non-string (or blank) name now falls
 * back to the default, exactly like an absent one.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-gdd-project-name-${process.pid}.db`;
});

import { POST } from '@/app/api/game-design-doc/route';

async function titleFor(projectName?: unknown): Promise<string> {
  const req = new NextRequest('http://localhost/api/game-design-doc', {
    method: 'POST',
    body: JSON.stringify({ action: 'generate', ...(projectName === undefined ? {} : { projectName }) }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  return (await res.json()).data.title as string;
}

describe('game-design-doc generate projectName', () => {
  it('falls back to the default title for an object, number or blank name', async () => {
    const dflt = await titleFor();
    expect(dflt).not.toContain('[object Object]');
    expect(await titleFor({})).toBe(dflt);
    expect(await titleFor(42)).toBe(dflt);
    expect(await titleFor('   ')).toBe(dflt);
  });
  it('keeps a real string name', async () => {
    expect(await titleFor('Pillars of Fortune')).toContain('Pillars of Fortune');
  });
});
