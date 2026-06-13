import { describe, it, expect } from 'vitest';
import {
  listCatalogSummaries,
  listEntitySummaries,
  buildStepRecipe,
  submitStepArtifact,
  CatalogNotFoundError,
} from '@/lib/catalog/headless';
import type { ProjectRule } from '@/lib/catalog/canon/types';

/** A catalog known to be a fully data-backed reference with seeded entities + steps. */
const REF = 'items';

describe('listCatalogSummaries', () => {
  it('lists catalogs with ordered steps and entity counts', () => {
    const cats = listCatalogSummaries();
    expect(cats.length).toBeGreaterThan(0);
    const items = cats.find((c) => c.catalogId === REF);
    expect(items).toBeDefined();
    expect(items!.registered).toBe(true);
    expect(items!.steps.length).toBeGreaterThan(0);
    expect(items!.entityCount).toBeGreaterThan(0);
    expect(typeof items!.label).toBe('string');
  });
});

describe('listEntitySummaries', () => {
  it('returns seeded entities with a lifecycle for a known catalog', () => {
    const ents = listEntitySummaries(REF);
    expect(ents.length).toBeGreaterThan(0);
    for (const e of ents) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.name).toBe('string');
      expect(typeof e.lifecycle).toBe('string');
      expect(Array.isArray(e.ueAssets)).toBe(true);
    }
  });

  it('throws CatalogNotFoundError for an unknown catalog', () => {
    expect(() => listEntitySummaries('does-not-exist')).toThrow(CatalogNotFoundError);
  });
});

describe('buildStepRecipe', () => {
  const firstStep = () => {
    const items = listCatalogSummaries().find((c) => c.catalogId === REF)!;
    const entity = listEntitySummaries(REF)[0];
    return { step: items.steps[0], entityId: entity.id, entityName: entity.name };
  };

  it('builds a recipe with a Produce prompt, view, and derived acceptance', () => {
    const { step, entityId, entityName } = firstStep();
    const r = buildStepRecipe(REF, entityId, step, undefined, []);

    expect(r.catalogId).toBe(REF);
    expect(r.entityId).toBe(entityId);
    expect(r.step).toBe(step);
    expect(r.prompt).toContain(`Produce ${step} for ${entityName}`);
    expect(r.view).toBeDefined();
    expect(r.view.kind).toBeTruthy();
    // Acceptance is always present and carries a tier + a current status.
    expect(r.acceptance.tier).toMatch(/^L[0-4]$/);
    expect(['pass', 'pending', 'fail', 'deferred']).toContain(r.acceptance.currentStatus);
  });

  it('threads the caller direction into the prompt', () => {
    const { step, entityId } = firstStep();
    const r = buildStepRecipe(REF, entityId, step, 'make it frost-themed', []);
    expect(r.prompt).toContain('make it frost-themed');
  });

  it('throws CatalogNotFoundError for unknown catalog / step / entity', () => {
    const { step, entityId } = firstStep();
    expect(() => buildStepRecipe('nope', entityId, step, undefined, [])).toThrow(CatalogNotFoundError);
    expect(() => buildStepRecipe(REF, entityId, 'No Such Step', undefined, [])).toThrow(CatalogNotFoundError);
    expect(() => buildStepRecipe(REF, 'no-such-entity', step, undefined, [])).toThrow(CatalogNotFoundError);
  });

  it('prefixes project canon to the prompt when a rule is in scope', () => {
    // Find any (catalog, entity, step) whose archetype pulls in the 'game' canon category.
    let target: { catalogId: string; entityId: string; step: string } | null = null;
    for (const c of listCatalogSummaries()) {
      if (!c.registered || !c.entityCount) continue;
      const ents = listEntitySummaries(c.catalogId);
      if (!ents.length) continue;
      for (const step of c.steps) {
        const probe = buildStepRecipe(c.catalogId, ents[0].id, step, undefined, []);
        if (probe.canonCategories.includes('game')) {
          target = { catalogId: c.catalogId, entityId: ents[0].id, step };
          break;
        }
      }
      if (target) break;
    }
    expect(target).not.toBeNull();

    const rule: ProjectRule = {
      id: 'test-canon-1',
      category: 'game',
      scope: 'global',
      title: 'Frostbite theme',
      body: 'All assets follow the frost motif.',
    };
    const r = buildStepRecipe(target!.catalogId, target!.entityId, target!.step, undefined, [rule]);
    expect(r.prompt).toContain('PROJECT CANON');
    expect(r.prompt).toContain('Frostbite theme');
  });
});

describe('submitStepArtifact', () => {
  it('derives the acceptance verdict server-side and persists the artifact', () => {
    const items = listCatalogSummaries().find((c) => c.catalogId === REF)!;
    const step = items.steps[0];
    // Use an isolated test entity id so we never clobber a real seeded entity's state.
    const entityId = `test-headless-${step.replace(/\W+/g, '-').toLowerCase()}`;
    const res = submitStepArtifact(REF, entityId, step, { note: 'headless test submission' }, ['/Game/Test/Asset']);

    expect(res.artifact.catalogId).toBe(REF);
    expect(res.artifact.entityId).toBe(entityId);
    expect(res.artifact.step).toBe(step);
    expect(res.artifact.ueAssets).toContain('/Game/Test/Asset');
    // The verdict is derived from the step's own Checker — a valid status + tier.
    expect(['pass', 'pending', 'fail', 'deferred']).toContain(res.acceptance.status);
    expect(res.acceptance.tier).toMatch(/^L[0-4]$/);
  });

  it('throws CatalogNotFoundError for an unknown step', () => {
    expect(() => submitStepArtifact(REF, 'e', 'No Such Step', {}, [])).toThrow(CatalogNotFoundError);
  });
});
