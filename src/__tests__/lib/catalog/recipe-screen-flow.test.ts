import { describe, it, expect } from 'vitest';
import { getRecipe } from '@/lib/catalog/recipe';
import type { ScreenEntry } from '@/lib/catalog/types';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = { projectName: 'PoF', projectPath: 'C:/p', ueVersion: '5.7', dynamicContext: undefined };

const sample: ScreenEntry = {
  id: 'screen-HUD', catalogId: 'screen-flow', name: 'HUD',
  categoryPath: ['Screens', 'Core'], tags: ['Core'], lifecycle: 'planned',
  data: { id: 'HUD', label: 'HUD', group: 'Core' },
};

describe('Screen Flow recipe', () => {
  it('exists with the 4 standard steps', () => {
    const r = getRecipe('screen-flow');
    expect(r).toBeDefined();
    expect(r!.steps).toEqual(['scaffold-cpp', 'author-python', 'wire', 'verify']);
  });
  it('scaffold prompt names UARPGCodeWidgetBase (pure-C++, no BindWidget)', () => {
    const p = getRecipe('screen-flow')!.buildStepPrompt(sample, 'scaffold-cpp', ctx);
    expect(p).toContain('UARPGCodeWidgetBase');
    expect(p).toContain('HUD');
  });
});
