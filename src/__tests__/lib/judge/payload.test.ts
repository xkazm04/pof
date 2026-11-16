import { describe, it, expect } from 'vitest';
import { NON_CONTENT_KEYS, stripNonContent } from '@/lib/judge/payload';
import { CONTENT_HASH_SCHEME } from '@/lib/judge/contentHash';

describe('stripNonContent', () => {
  it('removes the generation prompt so the judge cannot grade its own instructions', () => {
    const out = stripNonContent({
      brief: 'real content',
      produceDirection: { direction: '', prompt: 'You are a senior systems designer…' },
    });
    expect(out).toEqual({ brief: 'real content' });
  });

  it('removes the heavy media and provenance keys', () => {
    const out = stripNonContent({
      keep: 1,
      genHistory: { batches: [] },
      audioAssets: [{ url: 'x' }],
      _provenance: { model: 'x' },
    });
    expect(out).toEqual({ keep: 1 });
  });

  it('keeps every other key verbatim, including nested content objects', () => {
    const data = { rules: { a: { b: 2 } }, rarity: 'Unique', n: 0, flag: false, nil: null };
    expect(stripNonContent(data)).toEqual(data);
  });

  it('does not mutate its input', () => {
    const data = { keep: 1, produceDirection: { prompt: 'x' } };
    stripNonContent(data);
    expect(Object.keys(data)).toContain('produceDirection');
  });

  it('pins the strip set so a future key cannot be added silently', () => {
    expect([...NON_CONTENT_KEYS].sort()).toEqual(
      ['_provenance', 'audioAssets', 'genHistory', 'produceDirection'],
    );
  });

  // contentHash.ts: "Bump CONTENT_HASH_SCHEME with ANY change to the excluded keys" - a stored hash
  // computed under another key set is not comparable, and comparing across it silently restales
  // every standing verdict. The key pin above cannot see the scheme, and the scheme pin cannot see
  // the keys, so editing the keys and their pin alone would pass. This table is the one place that
  // binds them: it is APPEND-ONLY. A key change means a NEW entry AND a scheme bump together; never
  // edit an existing entry to make this test pass (that is the failure it exists to stop).
  const SCHEME_KEYSETS: Record<string, string[]> = {
    v3: ['_provenance', 'audioAssets', 'genHistory', 'produceDirection'],
  };

  it('[guard] the excluded keys and CONTENT_HASH_SCHEME move together', () => {
    expect(Object.keys(SCHEME_KEYSETS)).toContain(CONTENT_HASH_SCHEME);
    expect([...NON_CONTENT_KEYS].sort()).toEqual(SCHEME_KEYSETS[CONTENT_HASH_SCHEME]);
  });

  it('[guard] no two recorded schemes share a key set (a bump with no key change is not a new rule)', () => {
    const sets = Object.values(SCHEME_KEYSETS).map((k) => k.join('|'));
    expect(new Set(sets).size).toBe(sets.length);
  });
});
