import { describe, expect, it } from 'vitest';
import { buildCreateTaskBody, imageTypeFromPath, viewFileEntry } from '@/lib/visual-gen/tripo-runner';

describe('Tripo image type derivation', () => {
  it.each([
    ['https://cdn.x/a.JPG?sig=1#frag', 'jpg'],
    ['https://cdn.x/a.webp?sig=a.b', 'webp'],
    ['https://cdn.x/noext', 'png'],
    ['C:\\dir.v2\\file', 'png'],
    ['C:/tmp/in.jpeg', 'jpg'],
    ['', 'png'],
  ])('%s -> %s', (input, want) => {
    expect(imageTypeFromPath(input)).toBe(want);
  });

  it('a signed view URL sends a bare type', () => {
    expect(viewFileEntry({ url: 'https://cdn.x/a.png?sig=1' })).toEqual({ type: 'png', url: 'https://cdn.x/a.png?sig=1' });
  });

  it('image-to-3d derives the type from imageUrl the way a multiview slot does', () => {
    const body = buildCreateTaskBody({ mode: 'image-to-3d', outputPath: 'o.glb', imageUrl: 'https://cdn.x/a.webp?s=1' });
    expect(body.file).toEqual({ type: 'webp', url: 'https://cdn.x/a.webp?s=1' });
  });
});
