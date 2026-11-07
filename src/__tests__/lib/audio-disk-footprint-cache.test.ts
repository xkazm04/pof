import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  AUDIO_DIR,
  ensureAudioDir,
  getCachedDiskFootprint,
  invalidateDiskFootprint,
  removeAssetFile,
  DISK_FOOTPRINT_TTL_MS,
} from '@/lib/audio-asset-db';

/**
 * GET /api/audio-gen used to walk AUDIO_DIR (readdir + statSync per clip) on every
 * call. The footprint is now cached and invalidated by the module's own writers;
 * a TTL covers bytes changed outside the app.
 */

const setId = `fp-cache-${process.pid}-${Date.now()}`;
const dir = join(AUDIO_DIR, setId);

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  invalidateDiskFootprint();
});

describe('cached disk footprint', () => {
  it('serves the second read from cache (no walk) and re-walks after invalidation', () => {
    ensureAudioDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.mp3'), Buffer.alloc(10));
    invalidateDiskFootprint();
    const t = 1_000_000;
    const first = getCachedDiskFootprint(t);

    // A byte change the cache was not told about is not seen within the TTL — proof no walk ran.
    writeFileSync(join(dir, 'b.mp3'), Buffer.alloc(7));
    expect(getCachedDiskFootprint(t + 1)).toEqual(first);

    invalidateDiskFootprint();
    const after = getCachedDiskFootprint(t + 2);
    expect(after.files).toBe(first.files + 1);
    expect(after.bytes).toBe(first.bytes + 7);
  });

  it('re-walks once the TTL has passed', () => {
    ensureAudioDir();
    mkdirSync(dir, { recursive: true });
    invalidateDiskFootprint();
    const t = 2_000_000;
    const first = getCachedDiskFootprint(t);
    writeFileSync(join(dir, 'c.mp3'), Buffer.alloc(5));
    expect(getCachedDiskFootprint(t + DISK_FOOTPRINT_TTL_MS + 1).bytes).toBe(first.bytes + 5);
  });

  it('removeAssetFile invalidates the cache', () => {
    ensureAudioDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'd.mp3'), Buffer.alloc(9));
    invalidateDiskFootprint();
    const t = 3_000_000;
    const first = getCachedDiskFootprint(t);
    expect(removeAssetFile(`${setId}/d.mp3`).removed).toBe(1);
    expect(getCachedDiskFootprint(t + 1).bytes).toBe(first.bytes - 9);
  });

  it('the audio-gen route serves the cached footprint and invalidates after writing a clip', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/audio-gen/route.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).toContain('disk: getCachedDiskFootprint()');
    expect(src).not.toMatch(/getDiskFootprint\(/);
    expect(src.indexOf('invalidateDiskFootprint()')).toBeGreaterThan(src.indexOf('writeFileSync(join(setDir'));
  });
});
