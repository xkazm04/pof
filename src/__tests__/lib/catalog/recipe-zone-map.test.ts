import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { ZoneEntry } from '@/lib/catalog/types';
import { ZONES } from '@/components/modules/core-engine/unique-tabs/ZoneMap/data';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const realZone = ZONES[0];
const sample: ZoneEntry = {
  id: `zone-${realZone.id}`, catalogId: 'zone-map', name: realZone.displayName,
  categoryPath: ['Zones', realZone.group, realZone.type], tags: [realZone.type, realZone.status], lifecycle: 'planned',
  data: realZone,
};

describe('Zone Map recipe', () => {
  it('exists with author-python + verify steps', () => {
    const r = getRecipe('zone-map');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['author-python', 'verify']);
  });
  it('author-python prompt references .umap + /Game/Maps/', () => {
    const p = getRecipe('zone-map')!.buildStepPrompt(sample, 'author-python', ctx);
    expect(p).toContain(realZone.displayName);
    expect(p).toContain('.umap');
    expect(p).toContain('/Game/Maps/');
  });
});
