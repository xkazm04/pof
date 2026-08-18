import { describe, it, expect } from 'vitest';
import { describeImport, importedAtLabel } from '@/lib/audio-import-status';
import type { AudioImportResult } from '@/types/audio-import';

function rec(over: Partial<AudioImportResult> = {}): AudioImportResult {
  return {
    id: 1, setName: 'footstep-stone', eventKey: 'AnimNotify_FootstepEffect', surface: 'stone',
    assetsImported: 3, cuePath: '/Game/Audio/footstep-stone/SC_footstep_stone',
    wiredEvent: 'AnimNotify_FootstepEffect|stone', createdAt: Date.UTC(2026, 7, 18, 9, 30),
    ...over,
  };
}

describe('describeImport — an unrecorded import is never read as success', () => {
  it('no record at all → never, and says nothing in UE is claimed', () => {
    const v = describeImport(null);
    expect(v.state).toBe('never');
    expect(v.headline).toBe('Never imported');
    expect(v.detail).toMatch(/No import result recorded/);
    expect(v.cuePath).toBeNull();
  });

  it('a run that reported NO cue path → unverified (not imported)', () => {
    const v = describeImport(rec({ cuePath: null }));
    expect(v.state).toBe('unverified');
    expect(v.headline).toBe('Import not verified');
    expect(v.detail).toMatch(/no cue path/);
    expect(v.detail).toMatch(/nothing confirms a USoundCue exists/);
  });

  it('a run that imported ZERO clips → unverified even with a cue path', () => {
    const v = describeImport(rec({ assetsImported: 0 }));
    expect(v.state).toBe('unverified');
    expect(v.detail).toMatch(/0 clip\(s\)/);
  });

  it('a complete run → imported, naming the cue and the wiring', () => {
    const v = describeImport(rec());
    expect(v.state).toBe('imported');
    expect(v.detail).toContain('/Game/Audio/footstep-stone/SC_footstep_stone');
    expect(v.detail).toContain('wired to AnimNotify_FootstepEffect|stone');
  });

  it('an import with no AnimNotify wiring SAYS so rather than implying it', () => {
    const v = describeImport(rec({ wiredEvent: null }));
    expect(v.state).toBe('imported');
    expect(v.detail).toContain('no AnimNotify wiring reported');
  });

  it('the timestamp label is deterministic UTC (no locale, no Date.now in render)', () => {
    expect(importedAtLabel(Date.UTC(2026, 7, 18, 9, 30))).toBe('2026-08-18 09:30Z');
  });
});
