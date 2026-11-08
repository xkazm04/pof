import { describe, it, expect } from 'vitest';
import { referencedNames } from '@/lib/visual-gen/generated-tree';

describe('referencedNames survives one stray percent', () => {
  const onDisk = new Set(['a.glb']);

  it('still decodes the escaped path beside a literal percent', () => {
    expect(referencedNames('100% done, url=generated%2Ftripo3d%2Fa.glb', onDisk)).toEqual(['a.glb']);
  });

  it('a fully valid encoding still decodes', () => {
    expect(referencedNames('generated%2Fa.glb', onDisk)).toEqual(['a.glb']);
  });

  it('a malformed escape run is left as it was', () => {
    expect(referencedNames('%E0%A4 then a.glb', onDisk)).toEqual(['a.glb']);
  });
});
