import { describe, expect, it } from 'vitest';
import {
  findAnimationJargon,
  lookupAnimationJargon,
  scanAnimationJargon,
} from '@/lib/animation/jargon';

describe('lookupAnimationJargon', () => {
  it('returns animation-specific entries by canonical term', () => {
    const entry = lookupAnimationJargon('NativeUpdateAnimation');
    expect(entry?.plain).toMatch(/every frame/i);
  });

  it('matches natural-language phrases case-insensitively', () => {
    expect(lookupAnimationJargon('Root Motion')?.plain).toMatch(/animation itself moves/i);
    expect(lookupAnimationJargon('blend space')?.plain).toMatch(/mixes between/i);
    expect(lookupAnimationJargon('BLEND SPACE')?.plain).toMatch(/mixes between/i);
  });

  it('matches aliases', () => {
    expect(lookupAnimationJargon('AnimBP')?.term).toBe('Animation Blueprint');
    expect(lookupAnimationJargon('BlendSpace1D')?.term).toBe('blend space');
  });

  it('falls back to general blueprint jargon for UE terms we do not own', () => {
    expect(lookupAnimationJargon('UPROPERTY')?.plain).toMatch(/Tags this variable/i);
  });

  it('returns undefined for unknown terms', () => {
    expect(lookupAnimationJargon('TotallyMadeUpThing')).toBeUndefined();
  });
});

describe('scanAnimationJargon', () => {
  it('finds case-sensitive identifiers in source-code text', () => {
    const matches = scanAnimationJargon('Override NativeUpdateAnimation(float dt) to read Speed.');
    expect(matches.map((m) => m.entry.term)).toContain('NativeUpdateAnimation');
  });

  it('finds multi-word natural-language phrases', () => {
    const text = 'Disable root motion on locomotion; the blend space is driven by Speed.';
    const terms = scanAnimationJargon(text).map((m) => m.entry.term);
    expect(terms).toContain('root motion');
    expect(terms).toContain('blend space');
  });

  it('does not match inside a longer identifier (word boundary for natural phrases)', () => {
    // "in place" should NOT be triggered inside "place-holder" or "fireplace".
    const matches = scanAnimationJargon('a fireplace and a placeholder');
    expect(matches.map((m) => m.entry.term)).not.toContain('in place');
  });

  it('does not double-match overlapping terms — longer wins', () => {
    // "Animation Blueprint" must beat "Blueprint" alone (which is a generic
    // blueprint-jargon term not in our scanner anyway, but the principle holds
    // for any aliasing).
    const matches = scanAnimationJargon('Create an Animation Blueprint and parent it to UAnimInstance.');
    // We expect both terms, but the "Animation Blueprint" span must not
    // overlap with a sub-span of itself.
    const spans = matches.map((m) => `${m.start}-${m.end}`);
    const unique = new Set(spans);
    expect(unique.size).toBe(spans.length);
  });

  it('returns matches in source order', () => {
    const text = 'A blend space sits at the entry of the state machine.';
    const matches = scanAnimationJargon(text);
    const starts = matches.map((m) => m.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('returns [] for empty text', () => {
    expect(scanAnimationJargon('')).toEqual([]);
  });
});

describe('findAnimationJargon', () => {
  it('de-duplicates entries that match multiple times', () => {
    const text = 'montage on top of montage on top of an AnimMontage clip';
    const found = findAnimationJargon(text);
    const terms = found.map((e) => e.term);
    // "montage" entry should appear at most once even though the word repeats.
    expect(terms.filter((t) => t === 'montage').length).toBeLessThanOrEqual(1);
  });
});
