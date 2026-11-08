import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveUeRoot } from '@/lib/catalog/acceptance/ueStaticCheckers';

// resolveUeRoot fell back to one developer's literal Documents path, so on any other
// machine every L2 static check deferred as "UE root not found" even with the project
// in the Unreal Launcher's default folder.
const SAVED = { POF_UE_ROOT: process.env.POF_UE_ROOT, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME };
const made: string[] = [];
afterEach(() => {
  for (const [k, v] of Object.entries(SAVED)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function home(withProject: boolean): string {
  const h = mkdtempSync(join(tmpdir(), 'pof-home-'));
  made.push(h);
  if (withProject) mkdirSync(join(h, 'Documents', 'Unreal Projects', 'PoF'), { recursive: true });
  process.env.USERPROFILE = h;
  process.env.HOME = h;
  delete process.env.POF_UE_ROOT;
  return h;
}

describe('resolveUeRoot', () => {
  it('finds the project under the current user home, not a fixed user path', () => {
    const h = home(true);
    expect(resolveUeRoot()).toBe(join(h, 'Documents', 'Unreal Projects', 'PoF'));
  });
  it('is null (so callers defer with a reason) when the home has no project and no env root', () => {
    home(false);
    expect(resolveUeRoot()).toBeNull();
  });
  it('POF_UE_ROOT still wins', () => {
    const h = home(true);
    process.env.POF_UE_ROOT = h;
    expect(resolveUeRoot()).toBe(h);
  });
  it('the source carries no per-user path literal', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'catalog', 'acceptance', 'ueStaticCheckers.ts'), 'utf8');
    expect(src).not.toMatch(/Users[\\/]+kazda/i);
  });
});
