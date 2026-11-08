/**
 * GET /api/feature-matrix/progress used to answer a thrown read as the success
 * envelope { scanned: 0, total: 0 } - the same answer as "this module has no
 * definitions" - so a failing read silently reset the review progress bar. It now
 * answers an error; a missing or partial file and an empty module are unchanged.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/feature-matrix/progress/route';

vi.spyOn(console, 'error').mockImplementation(() => {});

const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function get(projectPath: string, moduleId = 'arpg-combat'): NextRequest {
  const q = new URLSearchParams({ moduleId, projectPath });
  return new NextRequest(`http://localhost/api/feature-matrix/progress?${q}`);
}
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-test-progress-'));
  dirs.push(d);
  return d;
}

describe('feature-matrix/progress failed reads', () => {
  it('answers an error (not success zeros) when the filesystem throws', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => { throw new Error('EACCES'); });
    const res = await GET(get('/p'));
    expect(res.status).toBe(500);
    expect((await res.json()).success).toBe(false);
  });

  it('answers an error when the matrix file path is a directory', async () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, '.pof', 'matrix', 'arpg-combat.json'), { recursive: true });
    const res = await GET(get(root));
    expect(res.status).toBe(500);
  });

  it('still counts a partially written file and reports a missing file as 0', async () => {
    const root = tmp();
    const res0 = await GET(get(root));
    expect((await res0.json()).data.scanned).toBe(0);
    fs.mkdirSync(path.join(root, '.pof', 'matrix'), { recursive: true });
    fs.writeFileSync(path.join(root, '.pof', 'matrix', 'arpg-combat.json'), '{"features":[{"featureName":"a"},{"featureName":"b"');
    const res = await GET(get(root));
    expect((await res.json()).data.scanned).toBe(2);
  });
});
