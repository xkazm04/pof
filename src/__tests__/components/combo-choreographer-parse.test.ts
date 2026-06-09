import { describe, it, expect } from 'vitest';
import {
  parseComboInput,
  generateCombo,
} from '@/components/modules/content/animations/AIComboChoreographer';

describe('parseComboInput', () => {
  it('flags unrecognized input and falls back to a default 3-hit combo', () => {
    const p = parseComboInput('please make something cool and awesome');
    expect(p.typesRecognized).toBe(false);
    expect(p.matchedKeywords).toEqual([]);
    expect(p.count).toBe(3);
    expect(p.countExplicit).toBe(false);
    expect(p.hitTypes).toEqual(['light', 'medium', 'heavy']);
  });

  it('reports the keywords that actually matched, de-duplicated in order', () => {
    const p = parseComboInput('wide sweeping opener, quick jab, then a heavy overhead');
    expect(p.typesRecognized).toBe(true);
    // wide→sweep, sweeping→sweep, quick→light, jab→light, heavy→heavy, overhead→heavy
    expect(p.matchedKeywords.map((m) => m.word)).toEqual(['wide', 'sweeping', 'quick', 'jab', 'heavy', 'overhead']);
    expect(p.matchedKeywords[0]).toEqual({ word: 'wide', type: 'sweep' });
    // Distinct types collected in first-seen order.
    expect(p.hitTypes.slice(0, 3)).toEqual(['sweep', 'light', 'heavy']);
  });

  it('honors an explicit hit count and pads the type sequence to length', () => {
    const p = parseComboInput('5-hit combo: thrust');
    expect(p.count).toBe(5);
    expect(p.countExplicit).toBe(true);
    expect(p.typesRecognized).toBe(true);
    expect(p.hitTypes).toHaveLength(5);
    // Single matched type padded by repeating the last.
    expect(p.hitTypes).toEqual(['thrust', 'thrust', 'thrust', 'thrust', 'thrust']);
  });

  it('clamps explicit counts to the 1–8 range', () => {
    expect(parseComboInput('12-hit slam').count).toBe(8);
    expect(parseComboInput('0-hit slam').count).toBe(1);
  });

  it('parses spelled-out counts', () => {
    const p = parseComboInput('four hit combo with a sweep');
    expect(p.count).toBe(4);
    expect(p.countExplicit).toBe(true);
  });
});

describe('generateCombo', () => {
  it('attaches parseInfo to the generated combo', () => {
    const combo = generateCombo('three hit combo, light then heavy');
    expect(combo.parseInfo).toBeDefined();
    expect(combo.parseInfo.typesRecognized).toBe(true);
    expect(combo.sections).toHaveLength(combo.parseInfo.count);
  });

  it('still produces the default light/medium/heavy combo for unrecognized input (no behavior change)', () => {
    const combo = generateCombo('xyz nonsense words here');
    expect(combo.parseInfo.typesRecognized).toBe(false);
    expect(combo.sections).toHaveLength(3);
    expect(combo.name).toBe('AI Combo (3-Hit)');
  });

  it('is deterministic for the same prompt', () => {
    const a = generateCombo('quick sweep heavy finisher');
    const b = generateCombo('quick sweep heavy finisher');
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});
