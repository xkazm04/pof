// Canon profiles (/diablo W01, operator decision D5). The canon is resolved PER ENTITY, so the
// load-bearing property is REACH at the one prompt chokepoint: an ingested Diablo entity's produce
// prompt carries Diablo's world and never PoF's, and a PoF entity's prompt is exactly what it was.
// Rules here are synthetic so the mechanism is tested independently of the drafted Diablo content.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { canonProfileOf, rulesForProfile, profileOfRule, CANON_PROFILES, DEFAULT_CANON_PROFILE } from '@/lib/catalog/canon/profiles';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const D1_WORLD: ProjectRule = {
  id: 'd1-test-world', category: 'game', scope: 'global', profile: 'diablo1',
  title: 'World', body: 'ZZ-DIABLO-MARKER Tristram sits above a cathedral whose depths reach Hell.',
};
const RULES: ProjectRule[] = [...CANON_SEED, D1_WORLD];

describe('rulesForProfile', () => {
  it('pof sees only PoF rules — a profile rule never leaks into PoF', () => {
    const pof = rulesForProfile(RULES, 'pof');
    expect(pof).toHaveLength(CANON_SEED.length);
    expect(pof.some((r) => r.id === D1_WORLD.id)).toBe(false);
  });

  it('diablo1 sees its own rules plus ONLY the PoF rules it inherits by id', () => {
    const d1 = rulesForProfile(RULES, 'diablo1');
    expect(d1).toContainEqual(D1_WORLD);
    const inherited = d1.filter((r) => profileOfRule(r) === 'pof').map((r) => r.id).sort();
    expect(inherited).toEqual([...CANON_PROFILES.diablo1.inheritsPof].sort());
    expect(d1.some((r) => r.id === 'game-setting')).toBe(false);
  });

  it('an unknown profile throws instead of silently resolving to some other world', () => {
    expect(() => rulesForProfile(RULES, 'diablo2')).toThrow(/Unknown canon profile "diablo2"/);
  });

  it('every inherited id names a rule PoF actually ships', () => {
    const ids = new Set(CANON_SEED.map((r) => r.id));
    for (const p of Object.values(CANON_PROFILES)) {
      expect(p.inheritsPof.filter((id) => !ids.has(id))).toEqual([]);
    }
  });
});

describe('canonProfileOf', () => {
  it('an entity without provenance is PoF’s; an ingested one names its profile', () => {
    expect(canonProfileOf(undefined)).toBe(DEFAULT_CANON_PROFILE);
    expect(canonProfileOf({})).toBe('pof');
    expect(canonProfileOf({ provenance: { canonProfile: 'diablo1' } })).toBe('diablo1');
  });
});

describe('reach at the prompt chokepoint (buildStepProducePrompt)', () => {
  const spec = getCatalogPipeline('bestiary')!.steps.find((s) => s.label === 'Concept & Role')!;
  const base = { id: 'x', name: 'Zombie', lifecycle: 'planned' as const, data: {} };

  it('a Diablo entity’s prompt carries Diablo’s world and not PoF’s', () => {
    const p = buildStepProducePrompt(spec, { ...base, canonProfile: 'diablo1' }, undefined, { catalogId: 'bestiary', rules: RULES });
    expect(p).toContain('ZZ-DIABLO-MARKER');
    expect(p).not.toContain('Post-Sundering');
  });

  it('a PoF entity’s prompt is byte-identical to one built without any profile rules present', () => {
    const withProfiles = buildStepProducePrompt(spec, base, undefined, { catalogId: 'bestiary', rules: RULES });
    const pofOnly = buildStepProducePrompt(spec, base, undefined, { catalogId: 'bestiary', rules: CANON_SEED });
    expect(withProfiles).toBe(pofOnly);
    expect(withProfiles).not.toContain('ZZ-DIABLO-MARKER');
    expect(withProfiles).toContain('Post-Sundering');
  });
});
