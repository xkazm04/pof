import { describe, it, expect } from 'vitest';
import { parseSceneDecomposeReply } from '@/lib/visual-gen/generators/scene-decompose';

const row = (name: string) => `PROP=${name}; BOX=0.1,0.1,0.5,0.5; SIZE_CM=50; COUNT=1`;

describe('decomposed prop ids are unique and non-empty', () => {
  it('a name that spells a dedupe suffix does not collide with it', () => {
    const r = parseSceneDecomposeReply([row('Crate 2'), row('crate'), row('crate')].join('\n'));
    const ids = r.props.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });
  it('a non-latin name still gets an id', () => {
    const r = parseSceneDecomposeReply(row('木箱'));
    expect(r.props[0].id.length).toBeGreaterThan(0);
  });
  it('plain repeats keep their numbering', () => {
    const r = parseSceneDecomposeReply([row('barrel'), row('barrel')].join('\n'));
    expect(r.props.map((p) => p.id)).toEqual(['barrel', 'barrel-2']);
  });
});
