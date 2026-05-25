import { describe, it, expect } from 'vitest';
import { summarizeEntityData } from '@/lib/ecw/entity-summary';

describe('summarizeEntityData', () => {
  it('picks top-level primitive fields, skipping noise + non-primitives', () => {
    const f = summarizeEntityData({ id: 'x', color: '#fff', icon: 'I', tag: 't', category: 'Offensive', damage: 40, hasRootMotion: true, radar: [1, 2], nested: {} });
    const labels = f.map((x) => x.label);
    expect(labels).toContain('category');
    expect(labels).toContain('damage');
    expect(labels).toContain('hasRootMotion');
    expect(labels).not.toContain('id');
    expect(labels).not.toContain('color');
    expect(labels).not.toContain('radar');
    expect(labels).not.toContain('nested');
    expect(f.find((x) => x.label === 'hasRootMotion')!.value).toBe('yes');
    expect(f.find((x) => x.label === 'damage')!.value).toBe('40');
  });
  it('caps the field count', () => {
    const data: Record<string, number> = {};
    for (let i = 0; i < 20; i++) data[`f${i}`] = i;
    expect(summarizeEntityData(data, 5)).toHaveLength(5);
  });
  it('returns [] for a non-object', () => {
    expect(summarizeEntityData(null)).toEqual([]);
    expect(summarizeEntityData(42)).toEqual([]);
  });
});
