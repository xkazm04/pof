import { describe, it, expect } from 'vitest';
import {
  parseAllCallbackMarkers,
  extractAllCallbackPayloads,
  parseCallbackMarker,
} from '@/lib/cli-task';

describe('callback truth — multi-marker parsing', () => {
  it('lost-marker: no marker in output yields an empty list (→ missing)', () => {
    expect(parseAllCallbackMarkers('just some assistant text, no marker here')).toEqual([]);
    expect(extractAllCallbackPayloads('just some assistant text, no marker here')).toEqual([]);
  });

  it('multi-marker: resolves EVERY marker in one run, in document order', () => {
    const text = [
      'first I do a thing',
      '@@CALLBACK:cb-1\n{"completed": true}\n@@END_CALLBACK',
      'then another',
      '@@CALLBACK:cb-2\n{"reviewedAt": "now"}\n@@END_CALLBACK',
      'done',
    ].join('\n');

    const markers = parseAllCallbackMarkers(text);
    expect(markers).toHaveLength(2);
    expect(markers[0].callbackId).toBe('cb-1');
    expect(markers[0].data).toEqual({ completed: true });
    expect(markers[1].callbackId).toBe('cb-2');
    expect(markers[1].data).toEqual({ reviewedAt: 'now' });

    // The single-match parser (used server-side) still sees only the first —
    // the two must not have drifted apart.
    expect(parseCallbackMarker(text)!.callbackId).toBe('cb-1');
  });

  it('malformed-JSON: the marker is still returned, with data = null', () => {
    const text = '@@CALLBACK:cb-bad\n{ not valid json }\n@@END_CALLBACK';
    const markers = parseAllCallbackMarkers(text);
    expect(markers).toHaveLength(1);
    expect(markers[0].callbackId).toBe('cb-bad');
    expect(markers[0].data).toBeNull();
    // extractAllCallbackPayloads still surfaces the raw payload for resolveCallback
    // (which re-parses and reports the JSON error → a 'failed' callback status).
    expect(extractAllCallbackPayloads(text)).toEqual([
      { callbackId: 'cb-bad', payload: '{ not valid json }' },
    ]);
  });

  it('mixed valid + malformed markers all appear (order preserved)', () => {
    const text =
      '@@CALLBACK:cb-ok\n{"completed": true}\n@@END_CALLBACK\n' +
      '@@CALLBACK:cb-bad\noops\n@@END_CALLBACK';
    const markers = parseAllCallbackMarkers(text);
    expect(markers.map((m) => m.callbackId)).toEqual(['cb-ok', 'cb-bad']);
    expect(markers[0].data).toEqual({ completed: true });
    expect(markers[1].data).toBeNull();
  });
});
