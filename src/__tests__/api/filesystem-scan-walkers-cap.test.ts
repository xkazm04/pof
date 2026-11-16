/**
 * scan-project and scan-animbp say when their 500-file walk stopped at the cap: a capped
 * class list is otherwise indistinguishable from a complete one (scan-assets already does).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST as scanProject } from '@/app/api/filesystem/scan-project/route';
import { POST as scanAnimbp } from '@/app/api/filesystem/scan-animbp/route';

const roots: string[] = [];
function project(headerCount: number): string {
  const root = mkdtempSync(join(tmpdir(), 'pof-scan-cap-'));
  roots.push(root);
  writeFileSync(join(root, 'Game.uproject'), '{}');
  const src = join(root, 'Source', 'Game');
  mkdirSync(src, { recursive: true });
  for (let i = 0; i < headerCount; i++) writeFileSync(join(src, `H${i}.h`), '');
  return root;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

async function call(route: (req: NextRequest) => Promise<Response>, name: string, projectPath: string) {
  const res = await route(new NextRequest(`http://localhost/api/filesystem/${name}`, {
    method: 'POST',
    body: JSON.stringify({ projectPath, moduleName: 'Game' }),
  }));
  expect(res.status).toBe(200);
  return (await res.json()).data as { truncated: boolean };
}

describe.each([
  ['scan-project', scanProject],
  ['scan-animbp', scanAnimbp],
] as const)('%s cap disclosure', (name, route) => {
  it('reports truncated when one more file exists than the cap', async () => {
    expect((await call(route, name, project(501))).truncated).toBe(true);
  });

  it('[guard] exactly the cap is complete, not truncated', async () => {
    expect((await call(route, name, project(500))).truncated).toBe(false);
  });
});
