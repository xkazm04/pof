import { describe, it, expect } from 'vitest';
import {
  SPELLBOOK_RECIPE,
  ITEMS_RECIPE,
  STATE_GRAPH_RECIPE,
  PROMPT_VERSION,
} from '@/lib/catalog/recipe';
import { TaskFactory, buildTaskPrompt, getCallback, extractCallbackPayload } from '@/lib/cli-task';
import { STYLE_ANCHORS, DIMENSIONS } from '@/lib/judge/dimensions';
import type { ProjectContext } from '@/lib/prompt-context';
import type { AbilityEntry, ItemEntry, AnimationEntry, StoredCatalogEntity } from '@/lib/catalog/types';

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.7.2' };

const ability: AbilityEntry = {
  id: 'ab-fireball', catalogId: 'spellbook', name: 'Fireball',
  categoryPath: ['Offensive', 'Fire'], tags: ['basic'], lifecycle: 'planned',
  data: { tag: 'Ability.Fireball' } as AbilityEntry['data'],
};
const item: ItemEntry = {
  id: 'itm-sword', catalogId: 'items', name: 'Rusty Sword',
  categoryPath: ['Weapons'], tags: ['common'], lifecycle: 'planned',
  data: {} as ItemEntry['data'],
};
const anim: AnimationEntry = {
  id: 'an-slash', catalogId: 'state-graph', name: 'Slash',
  categoryPath: ['Combat'], tags: [], lifecycle: 'planned',
  data: { name: 'Slash', category: 'Combat' } as unknown as AnimationEntry['data'],
};

describe('recipe quality-pack composition (Direction 3)', () => {
  it('spellbook (text-config) composes the pack with the judge’s craft dimensions', () => {
    const prompt = SPELLBOOK_RECIPE.buildStepPrompt(ability, 'scaffold-cpp', CTX);
    expect(prompt).toContain(STYLE_ANCHORS['text-config']);
    for (const d of DIMENSIONS['text-config']) expect(prompt).toContain(d.key);
    expect(prompt).toContain('spellbook');
  });

  it('items (text-config) composes the pack on a producing step', () => {
    const prompt = ITEMS_RECIPE.buildStepPrompt(item, 'author-python', CTX);
    expect(prompt).toMatch(/senior systems designer/);
    expect(prompt).toContain(STYLE_ANCHORS['text-config']);
  });

  it('state-graph maps to the animation discipline (module-appropriate)', () => {
    const prompt = STATE_GRAPH_RECIPE.buildStepPrompt(anim, 'author-python', CTX);
    expect(prompt).toMatch(/senior gameplay animator/);
    expect(prompt).toContain(STYLE_ANCHORS['animation']);
  });

  it('the pack is composed ONCE per prompt (bounded token cost)', () => {
    const prompt = ITEMS_RECIPE.buildStepPrompt(item, 'author-python', CTX);
    const anchor = STYLE_ANCHORS['text-config'];
    expect(prompt.split(anchor).length - 1).toBe(1);
  });

  it('the verify step (runs a test, produces nothing) omits the pack', () => {
    const prompt = ITEMS_RECIPE.buildStepPrompt(item, 'verify', CTX);
    expect(prompt).not.toContain(STYLE_ANCHORS['text-config']);
  });

  it('the generate callback payload carries the prompt-version stamp', () => {
    const entity: StoredCatalogEntity = { ...item };
    const task = TaskFactory.generate('arpg-inventory', entity, 'author-python', 'http://localhost:3000', 'Items');
    const prompt = buildTaskPrompt(task, CTX);
    const marker = extractCallbackPayload(prompt);
    expect(marker).not.toBeNull();
    const cb = getCallback(marker!.callbackId);
    expect(cb?.staticFields.promptVersion).toBe(PROMPT_VERSION);
  });
});
