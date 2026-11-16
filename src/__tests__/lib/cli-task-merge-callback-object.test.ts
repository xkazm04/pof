import { describe, it, expect } from 'vitest';
import { mergeCallbackBody } from '@/lib/cli-task';

/**
 * The callback contract asks Claude for a JSON OBJECT between the markers. A body
 * that parses but is not an object (null, an array, a string, a number) used to be
 * spread into the static fields, so `null` posted the static fields alone (enough
 * for /api/checklist/complete to mark an item done) and an array posted `{"0":..}`.
 */
describe('mergeCallbackBody - payload must be a JSON object', () => {
  const statics = { moduleId: 'arpg-combat', itemId: 'ac-1' };

  it.each(['null', '[1,2]', '"done"', '42', 'true'])('refuses the non-object payload %s', (raw) => {
    const out = mergeCallbackBody(statics, raw);
    expect(out.ok).toBe(false);
  });

  it('still merges an object payload with static fields taking precedence', () => {
    const out = mergeCallbackBody(statics, '{"completed":true,"moduleId":"hijack"}');
    expect(out).toEqual({ ok: true, body: { completed: true, moduleId: 'arpg-combat', itemId: 'ac-1' } });
  });

  it('still reports malformed JSON as invalid', () => {
    const out = mergeCallbackBody(statics, '{nope');
    expect(out).toEqual({ ok: false, error: 'Invalid JSON in callback payload' });
  });
});
