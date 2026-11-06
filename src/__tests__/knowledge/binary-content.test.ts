import { describe, it, expect } from 'vitest';
import { BINARY_CONTENT_TRIPWIRE, formatBinaryContentTripwire } from '@/lib/knowledge/binary-content';

describe('binary content tripwire', () => {
  it('names all six asset categories', () => {
    const t = BINARY_CONTENT_TRIPWIRE.toLowerCase();
    expect(t).toContain('widget blueprint');
    expect(t).toContain('animation blueprint');
    expect(t).toContain('.umap');
    expect(t).toContain('behavior tree');
    expect(t).toContain('material function');
    expect(t).toContain('skeletal mesh');
  });

  it('keeps five categories on the wall and routes Level through the script channel', () => {
    const bullets = BINARY_CONTENT_TRIPWIRE.split('\n').filter((l) => l.startsWith('- '));
    expect(bullets).toHaveLength(5);
    expect(bullets.join('\n')).not.toContain('.umap');
    expect(BINARY_CONTENT_TRIPWIRE).toContain('Level (.umap) is NOT on the wall');
    expect(BINARY_CONTENT_TRIPWIRE).toContain('-ExecutePythonScript');
  });

  it('asks the test per channel and does not call a live-channel replay proven', () => {
    expect(BINARY_CONTENT_TRIPWIRE).toContain('fails on every channel you hold');
    expect(BINARY_CONTENT_TRIPWIRE).toContain('unproven until it has rebuilt the level from empty');
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
