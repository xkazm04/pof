/** Byte ranges on the voice audio route: a media element seeks and reads an Ogg's true length with them. */
import { describe, expect, it } from 'vitest';
import { audioResponse, parseRange } from '@/lib/voice/audioResponse';

describe('parseRange', () => {
  it('reads open, closed, suffix and out-of-file ranges', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=20-10', 100)).toBe('unsatisfiable');
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull(); // multi-range: served whole
  });
});

describe('audioResponse', () => {
  const bytes = Buffer.from('0123456789');
  it('200 whole with Accept-Ranges; 206 slice with Content-Range; 416 past the end', async () => {
    const whole = audioResponse(bytes, 'audio/ogg', null, 'no-cache');
    expect(whole.status).toBe(200);
    expect(whole.headers.get('accept-ranges')).toBe('bytes');
    expect(await whole.text()).toBe('0123456789');
    const part = audioResponse(bytes, 'audio/ogg', 'bytes=-3', 'no-cache');
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(part.headers.get('content-length')).toBe('3');
    expect(await part.text()).toBe('789');
    const bad = audioResponse(bytes, 'audio/ogg', 'bytes=50-', 'no-cache');
    expect(bad.status).toBe(416);
    expect(bad.headers.get('content-range')).toBe('bytes */10');
  });
});
