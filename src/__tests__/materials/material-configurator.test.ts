import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import { TaskFactory, buildTaskPrompt, materialConfiguratorVariantKey } from '@/lib/cli-task';
import { GOLDEN_MATERIAL_CONFIG } from '@/__tests__/lib/prompts/builder-fixtures';
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

/**
 * A live UE master as the named parent (scan-sweep --challenge,
 * material-configurator/B). With no parent the prompt and key are pinned.
 */
const ROCK_PARENT = {
  path: '/Game/M/M_Rock',
  scalars: [{ name: 'Roughness', min: 0, max: 1, defaultValue: 0.3, step: 0.01 }],
  vectors: ['TintColor'],
  textures: ['BaseColor'],
  switches: [],
};

const GOLDEN_CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

describe('buildMaterialConfiguratorPrompt — a live parent master', () => {
  it('names the parent and its exact parameter set, overriding only those', () => {
    const prompt = buildMaterialConfiguratorPrompt({ ...config, parentMaterial: ROCK_PARENT }, ctx);
    expect(prompt).toContain('/Game/M/M_Rock');
    expect(prompt).toContain('TintColor');
    expect(prompt).toContain('BaseColor');
    expect(prompt).toMatch(/override only/i);
    expect(prompt).not.toContain('from an existing master material');
  });

  it('the variant key separates one parent from another', () => {
    const stone = { ...ROCK_PARENT, path: '/Game/M/M_Stone' };
    expect(materialConfiguratorVariantKey({ ...config, parentMaterial: ROCK_PARENT }))
      .not.toBe(materialConfiguratorVariantKey({ ...config, parentMaterial: stone }));
  });

  it('[guard] no parent: the task prompt is byte-identical to the recorded golden and the key is unchanged', () => {
    const golden = fs.readFileSync(
      path.join(process.cwd(), 'src', '__tests__', 'lib', 'prompts', '__golden__', 'task-material-configurator.md'), 'utf8',
    ).replace(/\r\n/g, '\n');
    const task = TaskFactory.materialConfigurator('materials', GOLDEN_MATERIAL_CONFIG, 'Material Config');
    expect(buildTaskPrompt(task, GOLDEN_CTX).replace(/\r\n/g, '\n')).toBe(golden);
    expect(materialConfiguratorVariantKey(GOLDEN_MATERIAL_CONFIG)).toBe('material-configurator::master::metal::7613c37c');
  });

  it('[guard] no parent: the instance prompt and its key are the ones recorded at d13603cf', () => {
    expect(fnv(buildMaterialConfiguratorPrompt(config, GOLDEN_CTX))).toBe('cfb4dce4');
    expect(materialConfiguratorVariantKey(config)).toBe('material-configurator::instance::stone::fb8c90ae');
  });
});
