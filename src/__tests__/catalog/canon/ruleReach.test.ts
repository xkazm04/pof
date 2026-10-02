// Canon law REACH (scan-sweep --challenge catalog-seed-data/B): which produce prompts a law enters,
// computed from the SAME resolvers the prompt builder uses (rulesForProfile + selectRules +
// canonCategoriesForStep + stepsForProfile) — so the editor can show a law's blast radius before
// Save, and a scope that reaches nothing is refused instead of stored.
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import { stepsForProfile } from '@/lib/catalog/stepScope';
import { seedAllCatalogs } from '@/lib/catalog/sections';
import { labIdentityOf } from '@/lib/catalog/canon/profiles';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { ruleReach } from '@/lib/catalog/canon/ruleReach';
import { validateRuleDraft } from '@/lib/catalog/canon/validation';
import type { ProjectRule } from '@/lib/catalog/canon/types';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const pipelines = allCatalogPipelines();
const shipped = (id: string): ProjectRule => {
  const r = CANON_SEED.find((x) => x.id === id);
  if (!r) throw new Error(`no shipped rule ${id}`);
  return r;
};

describe('ruleReach', () => {
  it('a catalog-scoped art law reaches exactly its one art step', () => {
    const reach = ruleReach({ ...shipped('art-icon-family'), scope: 'icon-sets', category: 'art' }, pipelines);
    expect(reach.scopeKnown).toBe(true);
    expect(reach.stepCount).toBe(1);
    expect(reach.steps).toEqual(['icon-sets/Icon 2D Art']);
  });

  it('parity: the reach is exactly the set of steps whose built prompt carries the law', () => {
    const law = shipped('proj-economy');
    const seeds = seedAllCatalogs();
    const prompted: string[] = [];
    for (const p of pipelines) {
      const first = Object.values(seeds[p.catalogId] ?? {})[0];
      const entity: LabEntity = first
        ? { id: first.id, name: first.name, lifecycle: first.lifecycle, data: (first as { data?: unknown }).data, ...labIdentityOf(first) }
        : { id: 'x', name: 'X', lifecycle: 'planned', data: {} };
      for (const s of stepsForProfile(p, entity.canonProfile)) {
        const prompt = buildStepProducePrompt(s, entity, undefined, { catalogId: p.catalogId, rules: [law] });
        if (prompt.includes('Economy laws')) prompted.push(`${p.catalogId}/${s.label}`);
      }
    }
    const reach = ruleReach(law, pipelines);
    expect(reach.stepCount).toBe(5);
    expect([...reach.steps].sort()).toEqual([...prompted].sort());
  });

  it('moving a global law from game to art shrinks its reach from 253 to 77 prompts', () => {
    const genre = shipped('game-genre');
    expect(ruleReach({ ...genre, category: 'game' }, pipelines).stepCount).toBe(253);
    expect(ruleReach({ ...genre, category: 'art' }, pipelines).stepCount).toBe(77);
  });

  it('a mistyped scope is unknown, reaches nothing, and the draft validator names it', () => {
    const typo = { ...shipped('game-creature-design'), scope: 'bestiarys' };
    const reach = ruleReach(typo, pipelines);
    expect(reach.scopeKnown).toBe(false);
    expect(reach.stepCount).toBe(0);
    const v = validateRuleDraft(typo, pipelines);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('"bestiarys"');
  });

  it('validateRuleDraft accepts a registered catalog scope and global', () => {
    expect(validateRuleDraft({ ...shipped('proj-economy') }, pipelines).ok).toBe(true);
    expect(validateRuleDraft({ ...shipped('game-genre') }, pipelines).ok).toBe(true);
    const empty = validateRuleDraft({ ...shipped('game-genre'), title: '' }, pipelines);
    expect(empty.ok).toBe(false);
  });
});
