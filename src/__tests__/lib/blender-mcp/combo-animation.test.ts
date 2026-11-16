/**
 * The combo preview keys bones by name. armature_add only creates "Bone", so every
 * bone the script poses must be created by the script itself. Blender is never run:
 * the contract is read off the emitted Python.
 */
import { describe, it, expect } from 'vitest';
import { comboAnimationScript } from '@/lib/blender-mcp/scripts/combo-animation';
import { readReceipt } from '@/lib/blender-mcp/receipt';
import { printedReceipt } from './printedReceipt';

const HIT = { time: 0.5, type: 'light', damage: 10, rootMotion: 0 };
const code = comboAnimationScript({ comboName: 'C', hits: [HIT, { ...HIT, time: 1 }], totalDuration: 2 });

function keyedBones(src: string): string[] {
  return [...new Set([...src.matchAll(/pose\.bones\["([^"]+)"\]/g)].map((m) => m[1]))];
}
function createdBones(src: string): string[] {
  return [...src.matchAll(/edit_bones\.new\("([^"]+)"\)/g)].map((m) => m[1]);
}

describe('comboAnimationScript bone contract', () => {
  it('keys at least one named bone per hit', () => {
    expect(keyedBones(code).length).toBeGreaterThan(0);
  });

  it('creates every bone it keys, in edit mode before pose mode', () => {
    const created = createdBones(code);
    const missing = keyedBones(code).filter((b) => !created.includes(b));
    expect(missing).toEqual([]);
    expect(code).toContain('armature_add(enter_editmode=True');
    expect(code.indexOf('edit_bones.new')).toBeLessThan(code.indexOf("mode_set(mode='POSE')"));
  });

  it('ends with a combo-preview receipt that confirms', () => {
    const last = code.trimEnd().split(/\r?\n/).pop() ?? '';
    expect(last).toContain('POF_RESULT=');
    const out = printedReceipt(code, { 'armature.name': 'C_Preview', 'len(amt.bones)': 2, '2': 2 });
    expect(readReceipt(out, 'combo-preview').state).toBe('confirmed');
  });
});
