import { describe, it, expect } from 'vitest';
import { BINARY_CONTENT_TRIPWIRE, formatBinaryContentTripwire } from '@/lib/knowledge/binary-content';

describe('binary content tripwire', () => {
  it('names the six asset categories that cannot be authored from text', () => {
    const t = BINARY_CONTENT_TRIPWIRE.toLowerCase();
    expect(t).toContain('widget blueprint');
    expect(t).toContain('animation blueprint');
    expect(t).toContain('.umap');
    expect(t).toContain('behavior tree');
    expect(t).toContain('material function');
    expect(t).toContain('skeletal mesh');
  });

  it('tells the model to declare the dependency in Wiring Requirements', () => {
    expect(BINARY_CONTENT_TRIPWIRE).toContain('Wiring Requirements');
  });

  it('returns the tripwire for every UE kind', () => {
    expect(formatBinaryContentTripwire('ue-cpp')).toBe(BINARY_CONTENT_TRIPWIRE);
    expect(formatBinaryContentTripwire('ue-python')).toBe(BINARY_CONTENT_TRIPWIRE);
    expect(formatBinaryContentTripwire('packaging')).toBe(BINARY_CONTENT_TRIPWIRE);
  });

  it('returns an empty string for web', () => {
    expect(formatBinaryContentTripwire('web')).toBe('');
  });
});
