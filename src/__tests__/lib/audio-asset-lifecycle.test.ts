import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUDIO_DIR,
  getDiskFootprint,
  removeAssetFile,
  removeSetDirectory,
  resolveAudioPath,
} from '@/lib/audio-asset-db';

/** Unique per-test set root under the module's OWN audio dir (real files, real unlinks). */
const roots: string[] = [];
function makeSetDir(): string {
  const id = `test-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const dir = join(AUDIO_DIR, id);
  mkdirSync(dir, { recursive: true });
  roots.push(dir);
  return id;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('audio file lifecycle — delete removes what it owns', () => {
  it('deletes a real variation file', () => {
    const setId = makeSetDir();
    const rel = `${setId}/clip.mp3`;
    const abs = join(AUDIO_DIR, setId, 'clip.mp3');
    writeFileSync(abs, Buffer.from([1, 2, 3, 4]));
    expect(existsSync(abs)).toBe(true);

    const r = removeAssetFile(rel);

    expect(r.ok).toBe(true);
    expect(r.removed).toBe(1);
    expect(existsSync(abs)).toBe(false);
  });

  it('deletes a real set directory with every clip inside it', () => {
    const setId = makeSetDir();
    writeFileSync(join(AUDIO_DIR, setId, 'a.mp3'), Buffer.from([1]));
    writeFileSync(join(AUDIO_DIR, setId, 'b.mp3'), Buffer.from([2]));

    const r = removeSetDirectory(setId);

    expect(r.ok).toBe(true);
    expect(r.removed).toBe(2);
    expect(existsSync(join(AUDIO_DIR, setId))).toBe(false);
  });

  it('an already-absent file is success (the goal state is "gone")', () => {
    const setId = makeSetDir();
    const r = removeAssetFile(`${setId}/never-existed.mp3`);
    expect(r.ok).toBe(true);
    expect(r.removed).toBe(0);
  });

  it('reports a FAILED unlink with its reason instead of claiming success', () => {
    const setId = makeSetDir();
    // A directory where a file is expected: unlink() on a directory fails on
    // every platform. A real forced failure, not a mocked one.
    const rel = `${setId}/not-a-file`;
    mkdirSync(join(AUDIO_DIR, setId, 'not-a-file'), { recursive: true });

    const r = removeAssetFile(rel);

    expect(r.ok).toBe(false);
    expect(r.removed).toBe(0);
    expect(r.path).toContain('not-a-file');
    expect(typeof r.reason).toBe('string');
    expect(r.reason!.length).toBeGreaterThan(0);
    // The bytes are still there — which is exactly what the caller must report.
    expect(existsSync(join(AUDIO_DIR, setId, 'not-a-file'))).toBe(true);
  });
});

describe('audio file lifecycle — containment guard (never a caller-supplied path)', () => {
  it.each([
    ['..'],
    ['../escape.mp3'],
    ['set/../../escape.mp3'],
    [''],
  ])('refuses %j', (bad) => {
    expect(resolveAudioPath(bad)).toBeNull();
    const r = removeAssetFile(bad);
    expect(r.ok).toBe(false);
    expect(r.path).toBeNull();
    expect(r.reason).toMatch(/does not resolve inside/);
  });

  it('refuses a set id that escapes the audio root', () => {
    const r = removeSetDirectory('../../Documents');
    expect(r.ok).toBe(false);
    expect(r.path).toBeNull();
    expect(r.reason).toMatch(/does not resolve inside/);
  });

  it('accepts a path that genuinely sits inside the root', () => {
    expect(resolveAudioPath('s1/clip.mp3')).toContain('s1');
  });
});

describe('audio disk footprint', () => {
  it('measures real bytes and file counts, and drops after a delete', () => {
    const setId = makeSetDir();
    writeFileSync(join(AUDIO_DIR, setId, 'a.mp3'), Buffer.alloc(1024));
    writeFileSync(join(AUDIO_DIR, setId, 'b.mp3'), Buffer.alloc(2048));

    const before = getDiskFootprint(join(AUDIO_DIR, setId));
    expect(before.files).toBe(2);
    expect(before.bytes).toBe(3072);

    removeSetDirectory(setId);
    expect(getDiskFootprint(join(AUDIO_DIR, setId))).toEqual({ bytes: 0, files: 0 });
  });
});
