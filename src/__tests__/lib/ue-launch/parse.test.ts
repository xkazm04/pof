import { describe, it, expect } from 'vitest';
import { extractLogMarker } from '@/lib/ue-launch/parse';

describe('extractLogMarker', () => {
  it('extracts the value after KEY= from a log line', () => {
    const log = 'LogInit: boot\nLogPython: SPIKE=PoF toolset alive\nLogExit: done';
    expect(extractLogMarker(log, 'SPIKE')).toBe('PoF toolset alive');
  });

  it('returns null when the marker is absent', () => {
    expect(extractLogMarker('no marker here', 'SPIKE')).toBeNull();
  });

  it('trims a trailing CR (Windows CRLF logs)', () => {
    expect(extractLogMarker('LogPython: SPIKE=hi there\r\nnext', 'SPIKE')).toBe('hi there');
  });

  it('returns the first occurrence when the marker repeats', () => {
    expect(extractLogMarker('SPIKE=first\nSPIKE=second', 'SPIKE')).toBe('first');
  });

  it('treats the key literally (no regex injection)', () => {
    expect(extractLogMarker('a.b=value', 'a.b')).toBe('value');
    expect(extractLogMarker('axb=value', 'a.b')).toBeNull();
  });
});
