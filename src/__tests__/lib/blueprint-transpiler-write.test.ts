import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { resolveTargetPaths, planWrite, applyWrite } from '@/lib/blueprint-transpiler-write';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'pof-write-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

const base = (over = {}) => ({
  projectPath: root, moduleName: 'PoF', className: 'AARPGFireball',
  header: '#pragma once\nclass AARPGFireball {};\n',
  source: '#include "AARPGFireball.h"\n',
  ...over,
});

describe('resolveTargetPaths', () => {
  it('rejects non-identifier module/class names', () => {
    expect(() => resolveTargetPaths(base({ className: '../evil' }))).toThrow();
    expect(() => resolveTargetPaths(base({ moduleName: 'a/b' }))).toThrow();
  });
  it('builds Source/<Module>/<Class>.h|.cpp under the project', () => {
    const r = resolveTargetPaths(base());
    expect(r.headerPath).toBe(path.join(root, 'Source', 'PoF', 'AARPGFireball.h'));
    expect(r.sourcePath).toBe(path.join(root, 'Source', 'PoF', 'AARPGFireball.cpp'));
    expect(r.relHeader).toBe('Source/PoF/AARPGFireball.h');
  });
});

describe('planWrite (dry-run)', () => {
  it('reports both files absent with an all-insertion diff and writes nothing', async () => {
    const plan = await planWrite(base());
    expect(plan.files).toHaveLength(2);
    for (const f of plan.files) {
      expect(f.exists).toBe(false);
      expect(f.diff.summary.added).toBeGreaterThan(0);
      expect(f.diff.summary.removed).toBe(0);
    }
    await expect(fs.access(plan.files[0].path)).rejects.toBeTruthy(); // nothing written
  });
});

describe('applyWrite', () => {
  it('writes header + source and returns their paths', async () => {
    const res = await applyWrite(base());
    expect(res.written).toHaveLength(2);
    const h = await fs.readFile(path.join(root, 'Source', 'PoF', 'AARPGFireball.h'), 'utf8');
    expect(h).toContain('class AARPGFireball');
  });

  it('a later planWrite against changed content shows a real before/after diff', async () => {
    await applyWrite(base());
    const plan = await planWrite(base({ header: '#pragma once\nclass AARPGFireball { int hp; };\n' }));
    const header = plan.files.find((f) => f.relPath.endsWith('.h'))!;
    expect(header.exists).toBe(true);
    expect(header.diff.summary.added).toBeGreaterThan(0);
    expect(header.diff.summary.removed).toBeGreaterThan(0);
  });
});
