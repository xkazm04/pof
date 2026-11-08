/** Two kit members sharing a name are measured separately, not pooled. */
import { describe, it, expect } from 'vitest';
import { gradeKitCoherence } from '@/lib/visual-gen/kit-coherence';

const grey = (v: number) => {
  const h = v.toString(16).padStart(2, '0');
  return [`#${h}${h}${h}`];
};

describe('gradeKitCoherence with duplicate member names', () => {
  it('names the genuinely furthest member even when its name is shared by a typical one', () => {
    // 'part' appears twice: one black like the rest of the kit, one white (the real outlier).
    // Pooled by name, 'part' averages the two and ranks below the mid-grey 'rail'.
    const grade = gradeKitCoherence([
      { name: 'part', palette: grey(0) },
      { name: 'part', palette: grey(255) },
      { name: 'a', palette: grey(0) },
      { name: 'b', palette: grey(0) },
      { name: 'c', palette: grey(0) },
      { name: 'rail', palette: grey(200) },
    ]);
    expect(grade.outlier).toBe('part');
  });

  it('unique names behave as before', () => {
    const grade = gradeKitCoherence([
      { name: 'a', palette: grey(0) },
      { name: 'b', palette: grey(0) },
      { name: 'c', palette: grey(255) },
    ]);
    expect(grade.outlier).toBe('c');
  });
});
