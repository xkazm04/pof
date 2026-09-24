// /diablo W07: a declared gap ("not in the reference") must never read as a populated field, whatever
// SHAPE the producer wraps it in. Measured: the W02 zombie's AI Behavior passed with
// `tree: { sourceStatus: 'not in the reference', implementationConstraint: '<prose>' }` while the W07
// skeleton, saying the same thing as a bare string, graded pending. Same content, opposite verdicts.
import { describe, it, expect } from 'vitest';
import { isDeclaredGap, REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { fieldsPopulated } from '@/lib/catalog/acceptance/dataCheckers';

describe('isDeclaredGap', () => {
  it('reads the bare marker and a { value: marker } wrapper as a gap (unchanged)', () => {
    expect(isDeclaredGap(REFERENCE_GAP)).toBe(true);
    expect(isDeclaredGap('Not in the reference')).toBe(true);
    expect(isDeclaredGap({ value: REFERENCE_GAP })).toBe(true);
  });

  it('reads an object whose own property is the marker, with only prose beside it, as a gap', () => {
    expect(isDeclaredGap({ sourceStatus: REFERENCE_GAP, implementationConstraint: 'nothing is fabricated here' })).toBe(true);
  });

  it('still reads an object that carries a real number beside a gap note as populated', () => {
    expect(isDeclaredGap({ radius: 800, hearing: REFERENCE_GAP })).toBe(false);
  });

  it('does not read ordinary values as gaps', () => {
    expect(isDeclaredGap('patrol then chase')).toBe(false);
    expect(isDeclaredGap({ radius: 800 })).toBe(false);
    expect(isDeclaredGap(0)).toBe(false);
  });
});

describe('fieldsPopulated over a wrapped gap', () => {
  it('grades the W02 zombie shape pending, like the bare string', () => {
    const check = fieldsPopulated('behavior', 'AI populated', ['tree', 'aggroRange']);
    const wrapped = check({ behavior: { tree: { sourceStatus: REFERENCE_GAP, implementationConstraint: 'none stated' }, aggroRange: 600 } });
    const bare = check({ behavior: { tree: REFERENCE_GAP, aggroRange: 600 } });
    expect(wrapped.status).toBe('pending');
    expect(bare.status).toBe('pending');
    expect(wrapped.reason).toMatch(/tree/);
  });
});
