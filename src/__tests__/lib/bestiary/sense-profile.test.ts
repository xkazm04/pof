import { describe, it, expect } from 'vitest';
import {
  senseProfileFor, detectEntities, brainSubject, DEFAULT_SENSE,
} from '@/lib/bestiary/sense-profile';
import { ARCHETYPES, DETECTED_ENTITIES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

/**
 * 'Give Them Brains' follows the picked enemy (scan-sweep --challenge,
 * bestiary-archetypes-ai/B). The perception cone is drawn from the enemy's own
 * declared sense, and detection is derived from geometry, not hand-set flags.
 */

function arch(id: string) {
  const a = ARCHETYPES.find(x => x.id === id);
  if (!a) throw new Error(`no archetype ${id}`);
  return a;
}

const byLabel = <T extends { label: string }>(rows: T[], label: string) => rows.find(r => r.label === label)!;

describe('senseProfileFor', () => {
  it('parses a proximity sense into an omnidirectional radius (Rakghoul, Proximity 8m)', () => {
    expect(senseProfileFor(arch('rakghoul'))).toMatchObject({
      shape: 'radius', radiusCm: 800, kind: 'Proximity', source: 'btSummary', coneDeg: null,
    });
  });

  it('parses a visual sense into a 60-degree cone (Mandalorian Warrior, Visual 20m)', () => {
    expect(senseProfileFor(arch('mandalorian-warrior'))).toMatchObject({
      shape: 'cone', coneDeg: 60, radiusCm: 2000, kind: 'Visual', source: 'btSummary',
    });
  });

  it('falls back to the combat definition aggroRange when no Sense is declared (melee-grunt)', () => {
    const p = senseProfileFor(arch('melee-grunt'));
    expect(arch('melee-grunt').btSummary.Sense).toBeUndefined();
    expect(p).toMatchObject({ shape: 'cone', radiusCm: 600, source: 'combat-definition' });
  });

  it('[guard] an archetype with neither a Sense nor a combat definition gets DEFAULT_SENSE, today\'s 1500/800 figures', () => {
    const p = senseProfileFor({ id: 'x', btSummary: { Attack: 'swing' } });
    expect(p).toBe(DEFAULT_SENSE);
    // The card's `sightCm` is this profile's `radiusCm`: one reach field across every profile.
    expect(DEFAULT_SENSE).toMatchObject({ radiusCm: 1500, coneDeg: 60, hearingCm: 800, source: 'default' });
  });

  it('resolves a sourced profile for every archetype: 0 fall through to the default', () => {
    const sources = ARCHETYPES.map(a => senseProfileFor(a).source);
    expect(sources.filter(s => s === 'default')).toHaveLength(0);
    expect(sources.filter(s => s === 'combat-definition').length).toBeGreaterThan(0);
  });
});

describe('detectEntities', () => {
  it('[guard, visible output] the default sense reproduces today\'s legend and pulses', () => {
    const d = detectEntities(DETECTED_ENTITIES, DEFAULT_SENSE);
    expect(byLabel(d, 'Player').inCone).toBe(true);
    expect(byLabel(d, 'NPC')).toMatchObject({ inCone: false, inHearing: true });
    expect(byLabel(d, 'Distant')).toMatchObject({ inCone: false, inHearing: false });
    // The hand-set flag claims the Player is also heard; geometry says it is outside the ring.
    expect(byLabel(DETECTED_ENTITIES, 'Player').inHearing).toBe(true);
    expect(byLabel(d, 'Player').inHearing).toBe(false);
  });

  it('Rakghoul\'s 800cm proximity radius detects none of the three entities', () => {
    const d = detectEntities(DETECTED_ENTITIES, senseProfileFor(arch('rakghoul')));
    expect(d.filter(e => e.inCone || e.inHearing)).toHaveLength(0);
  });
});

describe('brainSubject', () => {
  it('prefers the expanded archetype, then the first compared one, else none', () => {
    expect(brainSubject('rakghoul', [])).toBe('rakghoul');
    expect(brainSubject(null, ['brute', 'kinrath'])).toBe('brute');
    expect(brainSubject(null, [])).toBeNull();
  });

  it('an explicit pick from the brains tab overrides the selection, including an explicit clear', () => {
    expect(brainSubject('rakghoul', ['brute'], 'kinrath')).toBe('kinrath');
    expect(brainSubject('rakghoul', ['brute'], null)).toBeNull();
  });
});
