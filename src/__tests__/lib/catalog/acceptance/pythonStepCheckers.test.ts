import { describe, it, expect } from 'vitest';
import {
  pythonStepSuccess,
  pythonStepOk,
  humanConfirmed,
} from '@/lib/catalog/acceptance/pythonStepCheckers';

describe('pythonStepSuccess', () => {
  const checker = pythonStepSuccess('Test step', 3);

  it('reports pending when the step has not run yet', () => {
    const r = checker({});
    expect(r.status).toBe('pending');
    expect(r.detail).toContain('not yet run');
  });

  it('reports pass when failed is empty and total >= expectAtLeast', () => {
    const r = checker({ created: ['a', 'b', 'c'], skipped: [], failed: [] });
    expect(r.status).toBe('pass');
    expect(r.detail).toContain('+3 new');
  });

  it('reports pass when everything was already up-to-date', () => {
    const r = checker({ created: [], skipped: ['a', 'b', 'c', 'd'], failed: [] });
    expect(r.status).toBe('pass');
    expect(r.detail).toContain('4 already up to date');
  });

  it('reports fail with the failure reasons joined', () => {
    const r = checker({ created: ['a'], failed: ['boom: x', 'kaboom: y'] });
    expect(r.status).toBe('fail');
    expect(r.reason).toBe('boom: x · kaboom: y');
  });

  it('reports pending when fewer artifacts than expected', () => {
    const r = checker({ created: ['a'], skipped: [], failed: [] });
    expect(r.status).toBe('pending');
    expect(r.detail).toBe('1 / 3');
  });
});

describe('pythonStepOk', () => {
  const checker = pythonStepOk('Verify');

  it('pending when ok is unset', () => {
    expect(checker({}).status).toBe('pending');
  });

  it('pass when ok=true', () => {
    expect(checker({ ok: true }).status).toBe('pass');
  });

  it('fail with issues joined when ok=false', () => {
    const r = checker({ ok: false, issues: ['missing X', 'wrong Y'] });
    expect(r.status).toBe('fail');
    expect(r.reason).toBe('missing X · wrong Y');
  });
});

describe('humanConfirmed', () => {
  const checker = humanConfirmed('Files present', 'confirmed');

  it('pending when not confirmed', () => {
    expect(checker({}).status).toBe('pending');
    expect(checker({ confirmed: false }).status).toBe('pending');
  });

  it('pass when confirmed=true', () => {
    const r = checker({ confirmed: true });
    expect(r.status).toBe('pass');
    expect(r.tier).toBe('L1');
  });
});
