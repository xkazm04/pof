import { describe, it, expect } from 'vitest';
import { NON_CONTENT_KEYS, stripNonContent } from '@/lib/judge/payload';

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
});
