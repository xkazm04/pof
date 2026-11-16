import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cppSymbolExists, seedRowPresent } from '@/lib/catalog/acceptance/ueStaticCheckers';

// Both checkers built a RegExp from an unescaped name: a row name with a regex metacharacter
// threw a SyntaxError (aborting the whole verify-static sweep) or matched the wrong text.

let root = '';
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pof-uestatic-'));
  mkdirSync(join(root, 'Source', 'PoF'), { recursive: true });
  mkdirSync(join(root, 'Content', 'Python'), { recursive: true });
  writeFileSync(join(root, 'Source', 'PoF', 'A.h'), 'class UFooBar;\n');
  writeFileSync(join(root, 'Content', 'Python', 'seed.py'), 'ROWS = ["sword(rusty)", "axe"]\n');
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

describe('UE static checkers match names literally', () => {
  it('seedRowPresent does not throw on a metacharacter row name', () => {
    expect(() => seedRowPresent('seed.py', 'sword(rusty', 'L')(root)).not.toThrow();
    expect(seedRowPresent('seed.py', 'sword(rusty)', 'L')(root).status).toBe('pass');
  });
  it('seedRowPresent does not treat "." as a wildcard', () => {
    expect(seedRowPresent('seed.py', 'a.e', 'L')(root).status).toBe('deferred');
  });
  it('cppSymbolExists matches the symbol literally', () => {
    expect(cppSymbolExists('UFooBar', 'L')(root).status).toBe('pass');
    expect(cppSymbolExists('UF.oBar', 'L')(root).status).toBe('deferred');
    expect(() => cppSymbolExists('UFoo(', 'L')(root)).not.toThrow();
  });
});
