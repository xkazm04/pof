import { describe, it, expect } from 'vitest';
import { TaskFactory, buildTaskPrompt } from '@/lib/cli-task';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityRef } from '@/lib/ability/logic-prompts';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
} as ProjectContext;

const ref: AbilityRef = {
  name: 'Fireball', element: 'Fire', tag: 'Ability.Fire.Fireball', category: 'Offensive', tier: 'advanced',
};

describe('draft-ability-spec task (ECW B2)', () => {
  it('TaskFactory.draftAbilitySpec builds a typed task', () => {
    const t = TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'spellbook', entityId: 'off-fire-01', ref, instruction: 'make it burn over time' },
      'http://localhost:3000',
      'Draft Fireball',
    );
    expect(t.type).toBe('draft-ability-spec');
    expect(t.catalogId).toBe('spellbook');
    expect(t.entityId).toBe('off-fire-01');
    expect(t.ref.name).toBe('Fireball');
    expect(t.instruction).toBe('make it burn over time');
    expect(t.appOrigin).toBe('http://localhost:3000');
  });

  it('buildTaskPrompt names the ability and folds in designer intent', () => {
    const t = TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'spellbook', entityId: 'off-fire-01', ref, instruction: 'make it burn over time' },
      'http://localhost:3000',
      'Draft',
    );
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toContain('Fireball');
    expect(prompt).toContain('make it burn over time');
    expect(prompt).toMatch(/GameplayEffect/i);
  });

  it('buildTaskPrompt embeds a @@CALLBACK with the effects/tagRules schema + entity static fields', () => {
    const t = TaskFactory.draftAbilitySpec(
      'arpg-gas',
      { catalogId: 'spellbook', entityId: 'off-fire-01', ref },
      'http://localhost:3000',
      'Draft',
    );
    const prompt = buildTaskPrompt(t, ctx);
    expect(prompt).toMatch(/@@CALLBACK:cb-/);
    expect(prompt).toContain('"effects"');
    expect(prompt).toContain('"tagRules"');
    // The callback's static fields (printed in the submission section) carry the entity identity.
    expect(prompt).toContain('catalogId');
    expect(prompt).toContain('off-fire-01');
  });
});
