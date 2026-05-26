import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { cppSymbolExists, seedRowPresent } from '@/lib/catalog/acceptance/ueStaticCheckers';

const UE_ROOT = join(process.cwd(), 'src/__tests__/fixtures/ue');

describe('L2 UE static checkers', () => {
  it('cppSymbolExists passes when the class is declared in Source', () => {
    const r = cppSymbolExists('UGE_Gen_Sample', 'Sample GE compiled')(UE_ROOT);
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L2');
  });
  it('cppSymbolExists defers (not fail) when missing — could be generated later', () => {
    const r = cppSymbolExists('UGE_Gen_Missing', 'Missing GE')(UE_ROOT);
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('not found');
  });
  it('seedRowPresent finds a row name in a seed script', () => {
    expect(seedRowPresent('seed_sample.py', 'sample_row', 'Row seeded')(UE_ROOT).status).toBe('pass');
    expect(seedRowPresent('seed_sample.py', 'ghost_row', 'Row seeded')(UE_ROOT).status).toBe('deferred');
  });
  it('returns deferred when the UE root does not exist', () => {
    const r = cppSymbolExists('UAnything', 'x')('/no/such/root');
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('UE root');
  });
});
