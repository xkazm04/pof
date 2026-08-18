import { describe, it, expect } from 'vitest';
import {
  AUDIO_IMPORT_SCRIPT_REL,
  checkAudioImportPreflight,
  type PreflightDeps,
} from '@/lib/audio-import-preflight';

const join = (...p: string[]) => p.join('/');

function deps(over: Partial<PreflightDeps>): PreflightDeps {
  return { resolveUeRoot: () => '/ue/PoF', exists: () => true, join, ...over };
}

describe('audio import preflight — the UE dependency is checked, never assumed', () => {
  it('reports the missing importer script and does NOT report ok', () => {
    const pf = checkAudioImportPreflight(deps({ exists: () => false }));
    expect(pf.ok).toBe(false);
    expect(pf.scriptPresent).toBe(false);
    expect(pf.scriptAbsPath).toBe(`/ue/PoF/${AUDIO_IMPORT_SCRIPT_REL}`);
    expect(pf.reason).toMatch(/Missing UE dependency/);
    expect(pf.reason).toMatch(/does not exist/);
    expect(pf.reason).toMatch(/Import not dispatched/);
  });

  it('an unresolvable UE root is "cannot verify" — a block, not a pass', () => {
    const pf = checkAudioImportPreflight(deps({ resolveUeRoot: () => null }));
    expect(pf.ok).toBe(false);
    expect(pf.ueRoot).toBeNull();
    expect(pf.scriptAbsPath).toBeNull();
    expect(pf.reason).toMatch(/cannot be verified/);
  });

  it('only a script actually on disk yields ok, and names the path it found', () => {
    const seen: string[] = [];
    const pf = checkAudioImportPreflight(deps({ exists: (p) => { seen.push(p); return true; } }));
    expect(pf.ok).toBe(true);
    expect(seen).toEqual([`/ue/PoF/${AUDIO_IMPORT_SCRIPT_REL}`]);
    expect(pf.reason).toContain(`/ue/PoF/${AUDIO_IMPORT_SCRIPT_REL}`);
  });
});
