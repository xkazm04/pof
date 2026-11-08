/**
 * maxWordsPerEntry counted `String(entry)`: an object entry is "[object Object]" (2 words) and the
 * gap marker is 4 words, so a 30-word line written as `{ key, line }` — or no line at all — passed
 * the 10-word VO cap (dialog-trees "Every VO line ≤ 10 spoken words").
 */
import { describe, it, expect } from 'vitest';
import { maxWordsPerEntry } from '@/lib/catalog/acceptance/dataCheckers';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const check = maxWordsPerEntry('voLines', 'VO cap', 10);
const long = 'one two three four five six seven eight nine ten eleven twelve thirteen';

describe('maxWordsPerEntry entry shape', () => {
  it('fails an entry that is not a line of text instead of counting "[object Object]"', () => {
    const res = check({ voLines: ['VO_HI: "Hello there."', { key: 'VO_LONG', line: long }] });
    expect(res.status).toBe('fail');
    expect(res.reason).toContain('voLines"[1]');
  });

  it('grades a declared-gap entry pending — a gap is not a spoken line', () => {
    const res = check({ voLines: [REFERENCE_GAP] });
    expect(res.status).toBe('pending');
    expect(res.reason).toContain(REFERENCE_GAP);
  });

  it('keeps grading real text lines as before', () => {
    expect(check({ voLines: ['VO_HI: "Hello there."'] }).status).toBe('pass');
    expect(check({ voLines: [`VO_LONG: "${long}"`] }).status).toBe('fail');
  });
});
