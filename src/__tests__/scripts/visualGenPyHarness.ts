/**
 * Runs scripts/visual-gen Python with `python -I` against FAKE heavy packages, so nothing
 * loads a model, touches a GPU or needs Blender. Not a test file.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const PYTHON = process.env.POF_TEST_PYTHON ?? 'python';
export const pythonAvailable = spawnSync(PYTHON, ['-I', '-c', 'pass']).status === 0;

export const scriptPath = (name: string) => join(process.cwd(), 'scripts', 'visual-gen', name);

export function tempTree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'pof-py-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return dir;
}

export interface PyRun { stdout: string; stderr: string; status: number | null }

export function runPy(args: string[]): PyRun {
  const res = spawnSync(PYTHON, ['-I', ...args], { encoding: 'utf8', timeout: 60_000 });
  return { stdout: res.stdout ?? '', stderr: res.stderr ?? '', status: res.status };
}

/**
 * Preamble for a `python -I -c` driver: fakes bpy, bmesh and mathutils, and defines
 * load(name, argv), which executes a script and returns its namespace. A script that ends
 * in sys.exit (the Blender scripts' fail()) still hands back what it defined.
 */
export const BLENDER_FAKES = [
  'import sys, types, unittest.mock as m',
  'bpy = m.MagicMock(); sys.modules["bpy"] = bpy',
  'sys.modules["bmesh"] = m.MagicMock()',
  'mu = types.ModuleType("mathutils"); mu.Vector = m.MagicMock(); sys.modules["mathutils"] = mu',
  'def load(path, argv, name="not_main"):',
  '    sys.argv = ["blender", "--"] + argv',
  '    ns = {"__name__": name, "__file__": path}',
  '    src = open(path, encoding="utf-8").read()',
  '    try:',
  '        exec(compile(src, path, "exec"), ns)',
  '    except SystemExit:',
  '        pass',
  '    return ns',
  '',
].join('\n');
