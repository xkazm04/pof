import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs, { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cppSymbolExists, runChecker } from '@/lib/catalog/acceptance/ueStaticCheckers';
import { verifyStaticAll } from '@/lib/catalog/acceptance/staticVerify';

// A dangling link / locked file under Source/ threw out of walk() and, because the static
// checkers run outside safeAccept, out of verifyStaticAll: no row was graded and the route 500'd.
let root = '';
const BAD = () => join(root, 'Source', 'PoF', 'Locked.h');
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pof-unreadable-'));
  mkdirSync(join(root, 'Source', 'PoF'), { recursive: true });
  writeFileSync(join(root, 'Source', 'PoF', 'Good.h'), 'class UGoodThing;\n');
  writeFileSync(BAD(), 'class ULockedThing;\n');
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); });
afterEach(() => { vi.restoreAllMocks(); });

/** Simulate EACCES on one header (a privileged dangling symlink is not creatable here). */
function lockOneHeader(): void {
  const real = fs.readFileSync;
  vi.spyOn(fs, 'readFileSync').mockImplementation(((p: fs.PathOrFileDescriptor, o?: unknown) => {
    if (String(p).endsWith('Locked.h')) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    return (real as (...a: unknown[]) => unknown)(p, o);
  }) as typeof fs.readFileSync);
}

describe('static sweep survives an unreadable file', () => {
  it('verifyStaticAll grades every row; the unreadable header only costs the check that needed it', () => {
    lockOneHeader();
    const rows = ['UGoodThing', 'ULockedThing'].map((sym, i) => ({ catalogId: 'c', entityId: `e${i}`, step: 's', status: 'pass', sym }));
    const out = verifyStaticAll({}, {
      resolveUeRoot: () => root,
      listArtifacts: () => rows,
      getStaticChecks: (_c, e) => [cppSymbolExists(rows[Number(e.slice(1))].sym, 'L')],
      upsertStatus: () => {},
    }, { apply: false });
    expect(out.verified).toBe(2);
    const byEntity = Object.fromEntries(out.results.map((r) => [r.entityId, r.to]));
    expect(byEntity).toEqual({ e0: 'pass', e1: 'deferred' });
    expect(JSON.stringify(out.results)).toMatch(/unreadable entr/);
  });

  it('a checker that throws becomes a deferred result naming the error, never a pass', () => {
    const r = runChecker(() => { throw new Error('boom'); }, root);
    expect(r.status).toBe('deferred');
    expect(r.reason).toMatch(/boom/);
  });
});
