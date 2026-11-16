/**
 * withinPercent resolves its field through `pickField`, so a balance step can grade the exact nested
 * datum its chart renders (`gpuBudget.gpuMs`). withinAbsolute — its signed-value sibling — read
 * `data[field]` only, so the same dot-path graded "not set" forever.
 */
import { describe, it, expect } from 'vitest';
import { withinAbsolute, withinPercent } from '@/lib/catalog/acceptance/dataCheckers';

describe('withinAbsolute dot-path parity with withinPercent', () => {
  const data = { loudness: { integratedLUFS: -16.4 } };

  it('grades a nested field exactly as withinPercent does', () => {
    expect(withinPercent('gpuBudget.gpuMs', 'p', 0.48, 15)({ gpuBudget: { gpuMs: 0.5 } }).status).toBe('pass');
    const res = withinAbsolute('loudness.integratedLUFS', 'LUFS', -16, 2)(data);
    expect(res.status).toBe('pass');
    expect(withinAbsolute('loudness.integratedLUFS', 'LUFS', -10, 2)(data).status).toBe('fail');
  });

  it('keeps a plain top-level name unchanged', () => {
    expect(withinAbsolute('integratedLUFS', 'LUFS', -16, 2)({ integratedLUFS: -15 }).status).toBe('pass');
    expect(withinAbsolute('integratedLUFS', 'LUFS', -16, 2)({}).status).toBe('pending');
  });
});
