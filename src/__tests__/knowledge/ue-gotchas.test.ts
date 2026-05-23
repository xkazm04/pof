import { describe, it, expect } from 'vitest';
import { UE_GOTCHAS, formatGotchas } from '@/lib/knowledge/ue-gotchas';
import type { PromptKind } from '@/lib/knowledge/types';

const VALID_KINDS: PromptKind[] = ['ue-cpp', 'ue-python', 'packaging', 'web'];

describe('UE_GOTCHAS data integrity', () => {
  it('has at least the seven seeded gotchas', () => {
    expect(UE_GOTCHAS.length).toBeGreaterThanOrEqual(7);
  });

  it('every gotcha has non-empty fields and a valid appliesTo', () => {
    for (const g of UE_GOTCHAS) {
      expect(g.id, 'id').toBeTruthy();
      expect(g.summary, `summary for ${g.id}`).toBeTruthy();
      expect(g.detail, `detail for ${g.id}`).toBeTruthy();
      expect(g.source, `source for ${g.id}`).toBeTruthy();
      expect(g.appliesTo.length, `appliesTo for ${g.id}`).toBeGreaterThan(0);
      for (const k of g.appliesTo) expect(VALID_KINDS).toContain(k);
    }
  });

  it('has unique ids', () => {
    const ids = UE_GOTCHAS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formatGotchas', () => {
  it('renders a Known UE Pitfalls block for ue-cpp including the cpp gotchas', () => {
    const out = formatGotchas('ue-cpp');
    expect(out).toContain('## Known UE Pitfalls');
    expect(out).toContain('RebuildWidget');
    expect(out).toContain('WITH_EDITOR');
  });

  it('excludes python-only gotchas from the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).not.toContain('Constant3Vector');
  });

  it('includes python gotchas for ue-python', () => {
    expect(formatGotchas('ue-python')).toContain('Constant3Vector');
  });

  it('returns an empty string for web', () => {
    expect(formatGotchas('web')).toBe('');
  });

  it('snapshot of the ue-cpp block', () => {
    expect(formatGotchas('ue-cpp')).toMatchSnapshot();
  });
});
