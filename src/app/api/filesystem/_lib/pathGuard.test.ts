/**
 * The shared /api/filesystem/* input guard, and the routes that have no test file of their
 * own under src/__tests__/ (scan-project, scan-animbp, scan-assets, watch): a UNC, device,
 * drive-relative or relative path is refused with 400 before the filesystem is touched.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import fsPromises from 'fs/promises';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'os';
import path from 'path';
import { checkLocalPath, checkModuleName, MAX_PATH_LENGTH } from '@/app/api/filesystem/_lib/pathGuard';
import { POST as scanProject } from '@/app/api/filesystem/scan-project/route';
import { POST as scanAnimbp } from '@/app/api/filesystem/scan-animbp/route';
import { POST as scanAssets } from '@/app/api/filesystem/scan-assets/route';
import { GET as watch, POST as watchPost } from '@/app/api/filesystem/watch/route';

const REFUSED = [
  '\\\\attacker.example\\share',
  '//attacker.example/share',
  '\\\\?\\C:\\Windows',
  '\\\\.\\PhysicalDrive0',
  'C:Windows',
  'relative/dir',
  './Source',
  '..\\..\\Windows',
];

const dirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A throwaway directory that reads as a UE project (one .uproject at its root). */
function ueProject(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pof-path-guard-'));
  dirs.push(root);
  writeFileSync(path.join(root, 'Game.uproject'), '{}');
  return root;
}

describe('checkLocalPath', () => {
  it.each(REFUSED)('refuses %s', (p) => {
    expect(checkLocalPath(p).ok).toBe(false);
  });

  it.each([undefined, null, 42, '', '   '])('refuses a missing or non-string path (%s)', (p) => {
    expect(checkLocalPath(p).ok).toBe(false);
  });

  it('refuses a NUL byte and an over-long path', () => {
    expect(checkLocalPath('C:\\Users\\me\0x').ok).toBe(false);
    expect(checkLocalPath('C:\\' + 'a'.repeat(MAX_PATH_LENGTH)).ok).toBe(false);
  });

  it('accepts a drive-absolute path and a platform-absolute path, normalized', () => {
    const drive = checkLocalPath('C:\\Users\\me\\Documents\\Unreal Projects');
    expect(drive.ok).toBe(true);
    const abs = path.resolve(os.tmpdir(), 'a', '..', 'b');
    const checked = checkLocalPath(abs);
    expect(checked).toEqual({ ok: true, data: path.normalize(abs) });
  });

  it('expands ~ to the home directory only when asked', () => {
    expect(checkLocalPath('~', 'path', { expandHome: true })).toEqual({ ok: true, data: path.normalize(os.homedir()) });
    expect(checkLocalPath('~').ok).toBe(false);
  });
});

describe('checkModuleName', () => {
  it.each(['MyGame', 'PoF', '_Core', 'Game_2'])('accepts %s', (m) => {
    expect(checkModuleName(m)).toEqual({ ok: true, data: m });
  });

  it.each(['..', '../..', '..\\..\\..', 'Game/..', 'C:', 'C:\\Windows', '/etc', '2Game', '', 7])(
    'refuses %s',
    (m) => {
      expect(checkModuleName(m).ok).toBe(false);
    },
  );
});

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('filesystem routes refuse a non-local path before touching the disk', () => {
  it.each([
    ['scan-project', scanProject],
    ['scan-animbp', scanAnimbp],
    ['scan-assets', scanAssets],
  ] as const)('%s answers 400 for a UNC projectPath', async (name, handler) => {
    const stat = vi.spyOn(fsPromises, 'stat');
    const res = await handler(post(`/api/filesystem/${name}`, { projectPath: '\\\\attacker.example\\x', moduleName: 'Game' }));
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
    expect(stat).not.toHaveBeenCalled();
  });

  it('watch answers 400 for a UNC projectPath and does not throw on a literal %', async () => {
    const unc = await watch(new NextRequest(`http://localhost/api/filesystem/watch?projectPath=${encodeURIComponent('\\\\h\\s')}`));
    expect(unc.status).toBe(400);
    const pct = await watch(new NextRequest(`http://localhost/api/filesystem/watch?projectPath=${encodeURIComponent('relative%zz')}`));
    expect(pct.status).toBe(400);
  });
});

describe('Source/<moduleName> cannot leave Source/', () => {
  it.each(['..', '../..', '..\\..\\..', 'Game/../..'])('scan-project and scan-animbp answer 400 for moduleName %s', async (moduleName) => {
    const projectPath = ueProject();
    const readdir = vi.spyOn(fsPromises, 'readdir');
    const project = await scanProject(post('/api/filesystem/scan-project', { projectPath, moduleName }));
    expect(project.status).toBe(400);
    const anim = await scanAnimbp(post('/api/filesystem/scan-animbp', { projectPath, moduleName }));
    expect(anim.status).toBe(400);
    // scan-project's type detection lists the project root; nothing below it is walked.
    for (const [dir] of readdir.mock.calls) expect(path.resolve(String(dir))).toBe(path.resolve(projectPath));
  });

  it('[guard] a real module name still scans', async () => {
    const projectPath = ueProject();
    const res = await scanProject(post('/api/filesystem/scan-project', { projectPath, moduleName: 'Game' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.projectType).toBe('ue5');
  });
});

describe('watch sits behind the operator guard', () => {
  const FOREIGN = { origin: 'https://evil.example', host: 'localhost' };

  it('refuses a foreign-Origin GET and stop with 403', async () => {
    const get = await watch(new NextRequest('http://localhost/api/filesystem/watch?projectPath=C%3A%5CGame', { headers: FOREIGN }));
    expect(get.status).toBe(403);
    const stop = await watchPost(new NextRequest('http://localhost/api/filesystem/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...FOREIGN },
      body: JSON.stringify({ action: 'stop' }),
    }));
    expect(stop.status).toBe(403);
  });

  it('[guard] a same-origin status call still answers', async () => {
    const res = await watchPost(new NextRequest('http://localhost/api/filesystem/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost', host: 'localhost' },
      body: JSON.stringify({ action: 'status' }),
    }));
    expect(res.status).toBe(200);
  });
});
