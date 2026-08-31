import { describe, it, expect } from 'vitest';
import {
  routePromptShape,
  linearPropRefusal,
  linearPropOverridden,
  resolveLinearPropConfig,
  SCOPE_WORD_LIMIT,
} from '@/lib/visual-gen/linear-prop-routing';

describe('routePromptShape', () => {
  it('routes a prompt that IS a rope to the procedural generator', () => {
    const r = routePromptShape('a coiled rope');
    expect(r.route).toBe('procedural');
    expect(r.keyword).toBe('rope');
    expect(r.reason).toMatch(/anchors/);
  });

  it('catches the plural and the other linear subjects', () => {
    expect(routePromptShape('rusty chains').route).toBe('procedural');
    expect(routePromptShape('a thick cable').route).toBe('procedural');
  });

  it('only ADVISES when the rope is a detail of a larger subject', () => {
    // The false-positive mode that matters: refusing this would block a character
    // because of one word in its description.
    const r = routePromptShape('a grizzled pirate captain in a long coat holding a coiled rope');
    expect(r.route).toBe('advise');
    expect(r.keyword).toBe('rope');
    expect(r.reason).toMatch(/detail|larger/i);
  });

  it('leaves an unrelated subject alone', () => {
    const r = routePromptShape('a wooden treasure chest');
    expect(r.route).toBe('generate');
    expect(r.keyword).toBeUndefined();
  });

  it('treats a missing prompt as nothing to judge, never as a refusal', () => {
    expect(routePromptShape(undefined).route).toBe('generate');
    expect(routePromptShape('   ').route).toBe('generate');
  });

  it('draws the scope line at a stated word count rather than a guess', () => {
    const short = Array.from({ length: SCOPE_WORD_LIMIT }, (_, i) => (i === 0 ? 'rope' : `w${i}`)).join(' ');
    const long = `${short} w${SCOPE_WORD_LIMIT}`;
    expect(routePromptShape(short).route).toBe('procedural');
    expect(routePromptShape(long).route).toBe('advise');
  });

  it('does not fire on a word that merely contains a keyword', () => {
    // "europe" ends in "rope"; a substring match would refuse a landscape prompt.
    expect(routePromptShape('a map of europe').route).toBe('generate');
  });
});

describe('linearPropRefusal', () => {
  it('refuses a procedural route and names where to go instead', () => {
    const msg = linearPropRefusal(routePromptShape('a rope'))!;
    expect(msg).toContain('/api/visual-gen/linear-prop');
    expect(msg).toContain('overrideShapeRoute');
  });

  it('never refuses an advisory or a clean route', () => {
    expect(linearPropRefusal(routePromptShape('a pirate captain holding a coiled rope in one hand'))).toBeNull();
    expect(linearPropRefusal(routePromptShape('a treasure chest'))).toBeNull();
  });
});

describe('linearPropOverridden', () => {
  it('records that the caller generated through the refusal', () => {
    const r = linearPropOverridden(routePromptShape('a rope'));
    expect(r.overridden).toBe(true);
    expect(r.reason).toMatch(/OVERRIDDEN/);
  });

  it('leaves a route nobody overrode untouched', () => {
    const r = routePromptShape('a treasure chest');
    expect(linearPropOverridden(r)).toEqual(r);
  });
});

describe('resolveLinearPropConfig', () => {
  it('fills the shape parameters a caller did not state, and says nothing about the anchors', () => {
    const c = resolveLinearPropConfig({ from: { x: 0, y: 2, z: 0 }, to: { x: 4, y: 2, z: 0 } });
    expect(c.slack).toBeGreaterThan(0);
    expect(c.radius).toBeGreaterThan(0);
    expect(c.segments).toBeGreaterThanOrEqual(8);
    expect(c.sides).toBeGreaterThanOrEqual(6);
    // The anchors are the one thing that cannot be defaulted — they ARE the asset.
    expect(c.from).toEqual({ x: 0, y: 2, z: 0 });
  });

  it('keeps every value the caller did state', () => {
    const c = resolveLinearPropConfig({
      from: { x: 0, y: 0, z: 0 },
      to: { x: 1, y: 0, z: 0 },
      slack: 0.5,
      radius: 0.03,
      segments: 40,
      sides: 12,
    });
    expect(c).toEqual({
      from: { x: 0, y: 0, z: 0 },
      to: { x: 1, y: 0, z: 0 },
      slack: 0.5,
      radius: 0.03,
      segments: 40,
      sides: 12,
    });
  });
});
