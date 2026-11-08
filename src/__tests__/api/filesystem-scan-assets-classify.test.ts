/**
 * POST /api/filesystem/scan-assets classifies by folder as well as by prefix. A folder
 * directly under Content/ has no leading slash in its relative path.
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
  };
}

describe('scan-assets folder classification', () => {
  it.each([
    ['Meshes/Rock.uasset', 'mesh'],
    ['Textures/Rock.uasset', 'texture'],
    ['Materials/Rock.uasset', 'material'],
    ['Animations/Rock.uasset', 'animation'],
    ['Blueprints/Rock.uasset', 'blueprint'],
    ['Audio/Rock.uasset', 'sound'],
  ])('a folder directly under Content/ classifies %s as %s', async (rel, type) => {
    const data = await scan(project([rel]));
    expect(data.assets.map((a) => a.type)).toEqual([type]);
  });

  it('[guard] a nested folder still classifies, and an unknown folder stays other', async () => {
    const data = await scan(project(['Env/Meshes/Rock.uasset', 'Misc/Thing.uasset']));
    const byName = Object.fromEntries(data.assets.map((a) => [a.name, a.type]));
    expect(byName).toEqual({ Rock: 'mesh', Thing: 'other' });
  });
});
