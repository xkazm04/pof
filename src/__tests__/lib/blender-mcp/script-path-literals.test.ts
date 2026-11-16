/**
 * A path written into a generated script must reach Python as the SAME string.
 *
 * `export-scene` and `apply-texture` wrapped `py(path)` in a RAW literal (`r"..."`). `py`
 * already escapes every backslash, and a raw literal does not un-escape them, so Python saw
 * `C:\\Users\\me\\out.glb` for `C:\Users\me\out.glb` — doubled separators that Windows
 * happens to tolerate for a drive path, but that turn a UNC share `\\nas\share` into
 * `\\\\nas\\share`. The receipt's path (`pyStr`, a normal literal) was correct, so the
 * file Blender wrote and the path PoF believed it wrote could differ. This decodes each
 * path literal with Python's own rules for its prefix.
 */
import { describe, it, expect } from 'vitest';
import { exportSceneScript } from '@/lib/blender-mcp/scripts/export-scene';
import { applyTextureScript } from '@/lib/blender-mcp/scripts/apply-texture';

/** Decode the Python string literal that starts right after `anchor` (raw or normal). */
function pyLiteralAfter(src: string, anchor: string): string {
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error(`anchor not found: ${anchor}`);
  let i = at + anchor.length;
  const raw = src[i] === 'r';
  if (raw) i++;
  if (src[i] !== '"') throw new Error(`no string literal after ${anchor}`);
  let out = '';
  for (i++; i < src.length; i++) {
    const c = src[i];
    if (c === '"') return out;
    if (c === '\\') {
      const n = src[++i];
      // Raw literal: the backslash stays, and only stops a quote from terminating.
      if (raw) out += '\\' + n;
      else out += n === 'n' ? '\n' : n === 'r' ? '\r' : n;
    } else out += c;
  }
  throw new Error('unterminated literal');
}

const PATHS = ['C:\\Users\\me\\out.glb', '\\\\nas\\share\\scene.fbx', '/home/me/a "quoted" dir/x.glb'];

describe('generated scripts carry paths verbatim', () => {
  for (const p of PATHS) {
    it(`export-scene (gltf + fbx) passes ${JSON.stringify(p)} unchanged`, () => {
      for (const format of ['gltf', 'fbx'] as const) {
        const code = exportSceneScript({ outputPath: p, format });
        expect(pyLiteralAfter(code, 'filepath=')).toBe(p);
        expect(pyLiteralAfter(code, '_path = ')).toBe(p);
      }
    });

    it(`apply-texture loads ${JSON.stringify(p)} unchanged`, () => {
      const code = applyTextureScript({ materialName: 'M', textureSlot: 'base_color', texturePath: p });
      expect(pyLiteralAfter(code, 'images.load(')).toBe(p);
    });
  }
});
