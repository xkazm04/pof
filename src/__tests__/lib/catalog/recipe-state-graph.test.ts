import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { AnimationEntry } from '@/lib/catalog/types';
import { ALL_MONTAGES } from '@/components/modules/core-engine/unique-tabs/AnimationStateGraph/data';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const realMontage = ALL_MONTAGES[0];
const sample: AnimationEntry = {
  id: `anim-${realMontage.id}`, catalogId: 'state-graph', name: realMontage.name,
  categoryPath: ['Animations', realMontage.category],
  tags: [realMontage.hasRootMotion ? 'root-motion' : 'in-place'],
  lifecycle: 'planned',
  data: realMontage,
};

describe('State Graph recipe', () => {
  it('exists with author-python + verify steps', () => {
    const r = getRecipe('state-graph');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['author-python', 'verify']);
  });
  it('author prompt names Mixamo + the SK_Mannequin skeleton + content path', () => {
    const p = getRecipe('state-graph')!.buildStepPrompt(sample, 'author-python', ctx);
    expect(p).toContain(realMontage.name);
    expect(p).toContain('Mixamo');
    expect(p).toContain('SK_Mannequin');
    expect(p).toContain('/Game/Animations/');
  });
  it('LOUDLY flags the AnimBP graph as MANUAL (the binary wall)', () => {
    const p = getRecipe('state-graph')!.buildStepPrompt(sample, 'author-python', ctx);
    expect(p).toContain('MANUAL STEP REQUIRED');
    expect(p).toContain('AnimBP');
  });
});
