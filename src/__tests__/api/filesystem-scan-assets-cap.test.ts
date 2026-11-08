/**
 * POST /api/filesystem/scan-assets says when it stopped at its file cap: a capped walk is
 * otherwise indistinguishable from a complete one.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/filesystem/scan-assets/route';

const roots: string[] = [];
function project(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'pof-scan-assets-'));
  roots.push(root);
  for (const rel of files) {
    const full = join(root, 'Content', rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, '');
  }
  return root;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

async function scan(projectPath: string) {
  const res = await POST(new NextRequest('http://localhost/api/filesystem/scan-assets', {
    method: 'POST',
    body: JSON.stringify({ projectPath }),
  }));
  expect(res.status).toBe(200);
  return (await res.json()).data as {
    assets: { name: string; type: string }[];
    truncated: boolean;
  };
}

describe('scan-assets cap disclosure', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => `A/F${i}.uasset`);

  it('reports truncated when more files exist than the cap', async () => {
    const data = await scan(project(many(2001)));
    expect(data.assets).toHaveLength(2000);
    expect(data.truncated).toBe(true);
  }, 30_000);

  it('[guard] exactly the cap is complete, not truncated', async () => {
    const data = await scan(project(many(2000)));
    expect(data.assets).toHaveLength(2000);
    expect(data.truncated).toBe(false);
  }, 30_000);

  it('[guard] a project with no Content/ is complete', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pof-scan-assets-'));
    roots.push(root);
    expect((await scan(root)).truncated).toBe(false);
  });
});
