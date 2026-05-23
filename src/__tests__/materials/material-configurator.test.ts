import { describe, it, expect } from 'vitest';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { ProjectContext } from '@/lib/prompt-context';

const ctx: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:/Users/kazda/Documents/Unreal Projects/PoF',
  ueVersion: '5.7',
};

const config: MaterialConfiguratorConfig = {
  surfaceType: 'stone',
  features: [],
  outputType: 'instance',
  params: { Roughness: { name: 'Roughness', min: 0, max: 1, defaultValue: 0.8, step: 0.01 } },
};

describe('buildMaterialConfiguratorPrompt — TM gotchas', () => {
  it('carries the Constant3Vector empty-output-pin gotcha', () => {
    const prompt = buildMaterialConfiguratorPrompt(config, ctx);
    expect(prompt).toMatch(/Constant3Vector/);
    expect(prompt).toMatch(/output pin is\s*""/);
    expect(prompt).toMatch(/renders? black/i);
  });

  it('prefers emitting a MaterialInstanceConstant of a shared master', () => {
    const prompt = buildMaterialConfiguratorPrompt(config, ctx);
    expect(prompt).toMatch(/MaterialInstanceConstant/);
    expect(prompt).toMatch(/M_ARPG_Surface_Master/);
  });
});
