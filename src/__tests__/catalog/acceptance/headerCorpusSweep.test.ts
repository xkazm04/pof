import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs, { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cppSymbolExists, withHeaderCorpus } from '@/lib/catalog/acceptance/ueStaticCheckers';
import { verifyStaticAll } from '@/lib/catalog/acceptance/staticVerify';

// Each cppSymbolExists call re-walked Source/ and re-read every header; a sweep paid
// headers x checks reads. Inside one sweep the corpus is read once.
const HEADERS = 12;
const CHECKS = 20;
let root = '';
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pof-corpus-'));
  mkdirSync(join(root, 'Source', 'PoF'), { recursive: true });
  for (let i = 0; i < HEADERS; i++) writeFileSync(join(root, 'Source', 'PoF', `H${i}.h`), `class UThing${i};\n`);
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); });
afterEach(() => { vi.restoreAllMocks(); });

const runChecks = (): string[] =>
  Array.from({ length: CHECKS }, (_, i) => cppSymbolExists(i === 0 ? 'UThing11' : `UMissing${i}`, 'L')(root).status);

describe('header corpus per sweep', () => {
  it('reads each header once across all checks of a sweep, with unchanged verdicts', () => {
    const spy = vi.spyOn(fs, 'readFileSync');
    const statuses = withHeaderCorpus(runChecks);
    const headerReads = spy.mock.calls.filter(([p]) => String(p).endsWith('.h')).length;
    expect(headerReads).toBe(HEADERS);
    expect(statuses[0]).toBe('pass');
    expect(statuses.slice(1).every((s) => s === 'deferred')).toBe(true);
  });

  it('verifyStaticAll scopes the corpus to its own sweep and drops it afterwards', () => {
    const spy = vi.spyOn(fs, 'readFileSync');
    const rows = Array.from({ length: CHECKS }, (_, i) => ({ catalogId: 'c', entityId: `e${i}`, step: 's', status: 'pass' }));
    verifyStaticAll({}, {
      resolveUeRoot: () => root,
      listArtifacts: () => rows,
      getStaticChecks: (_c, e) => [cppSymbolExists(`UMissing_${e}`, 'L')],
      upsertStatus: () => {},
    }, { apply: false });
    expect(spy.mock.calls.filter(([p]) => String(p).endsWith('.h')).length).toBe(HEADERS);
    spy.mockClear();
    runChecks(); // outside a sweep: no cache survives, a header edit is always seen
    expect(spy.mock.calls.filter(([p]) => String(p).endsWith('.h')).length).toBeGreaterThanOrEqual(HEADERS * (CHECKS - 1));
  });
});
