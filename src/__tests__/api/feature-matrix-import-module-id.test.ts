/**
 * POST /api/feature-matrix/import — `moduleId` is a closed enum (`SUB_MODULE_IDS`).
 *
 * It was only checked for being a non-empty string. Two consequences, both pinned here:
 *  - disk mode joins it into a path (`<projectPath>/.pof/matrix/<moduleId>.json`), so
 *    `moduleId: "../../escape"` read `<projectPath>/escape.json` — outside the matrix dir;
 *  - a module with no definitions skips the hallucinated-name check, so an unknown id
 *    wrote feature rows under a module nothing in the app reads.
 * Now an id outside SUB_MODULE_IDS is a 400 naming it, before any file read or write.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.hoisted(() => {
  const dir = process.env.TEMP || process.env.TMPDIR || '/tmp';
  process.env.POF_DB_PATH = `${dir}/pof-test-fm-import-module-id-${process.pid}.db`;
});

import { POST } from '@/app/api/feature-matrix/import/route';
import { getFeaturesByModule } from '@/lib/feature-matrix-db';
import type { SubModuleId } from '@/types/modules';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/feature-matrix/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));

const report = {
  reviewedAt: '2026-11-08T00:00:00.000Z',
  features: [{ featureName: 'Escaped', category: 'x', status: 'implemented', description: '', filePaths: [], reviewNotes: '' }],
};

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('feature-matrix import moduleId', () => {
  it('refuses a path-traversal moduleId in disk mode without reading outside .pof/matrix', async () => {
    const project = mkdtempSync(join(tmpdir(), 'pof-import-escape-'));
    dirs.push(project);
    mkdirSync(join(project, '.pof', 'matrix'), { recursive: true });
    writeFileSync(join(project, 'escape.json'), JSON.stringify(report));
    const res = await post({ moduleId: '../../escape', projectPath: project });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('../../escape');
    expect(getFeaturesByModule('../../escape' as SubModuleId, '')).toHaveLength(0);
  });

  it('refuses an unknown moduleId in direct mode and writes nothing', async () => {
    const res = await post({ moduleId: 'not-a-module', ...report });
    expect(res.status).toBe(400);
    expect(getFeaturesByModule('not-a-module' as SubModuleId, '')).toHaveLength(0);
  });
});
