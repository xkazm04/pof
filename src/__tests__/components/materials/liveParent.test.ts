import { describe, it, expect } from 'vitest';
import {
  masterCandidates, toParentRef,
} from '@/components/modules/content/materials/MaterialParameterConfigurator/liveParent';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { MaterialEntry, MaterialParameter } from '@/types/pof-bridge';

/**
 * A live UE master becomes the parent of the instance the configurator
 * generates (scan-sweep --challenge, material-configurator/B): the bridge
 * manifest is the ground truth for which materials are masters and which
 * parameters they expose.
 */

function entry(path: string, parentMaterial: string | null, materialInstances: string[], parameters: MaterialParameter[] = []): MaterialEntry {
  return {
    path, parentMaterial, materialInstances, parameters,
    domain: 'Surface', blendMode: 'Opaque', shadingModel: 'DefaultLit',
    textureReferences: [], crossReferences: [], contentHash: 'h',
  };
}

describe('masterCandidates', () => {
  it('keeps masters only, most-instanced first', () => {
    const out = masterCandidates([
      entry('/Game/M/M_Rock', null, ['a', 'b']),
      entry('/Game/M/MI_Rock_Wet', '/Game/M/M_Rock', []),
      entry('/Game/M/M_Cloth', null, []),
    ]);
    expect(out).toEqual(['/Game/M/M_Rock', '/Game/M/M_Cloth']);
  });

  it('orders a later, more-instanced master ahead of an earlier one', () => {
    const out = masterCandidates([
      entry('/Game/M/M_Cloth', null, []),
      entry('/Game/M/M_Rock', null, ['a', 'b', 'c']),
    ]);
    expect(out).toEqual(['/Game/M/M_Rock', '/Game/M/M_Cloth']);
  });
});

describe('toParentRef', () => {
  it('sorts the parent parameters by kind; scalars carry the manifest range and default', () => {
    const ref = toParentRef(entry('/Game/M/M_Rock', null, [], [
      { name: 'Roughness', type: 'ScalarParameter', defaultValue: 0.3, min: 0, max: 1 },
      { name: 'TintColor', type: 'VectorParameter', defaultValue: [1, 1, 1, 1] },
      { name: 'BaseColor', type: 'TextureParameter', defaultTexture: '/Game/T/T_Rock_D' },
      { name: 'UseDetail', type: 'StaticSwitchParameter', defaultValue: false },
    ]));
    expect(ref.path).toBe('/Game/M/M_Rock');
    expect(ref.scalars).toHaveLength(1);
    expect(ref.scalars[0]).toMatchObject({ name: 'Roughness', min: 0, max: 1, defaultValue: 0.3 });
    expect(ref.vectors).toEqual(['TintColor']);
    expect(ref.textures).toEqual(['BaseColor']);
    expect(ref.switches).toEqual(['UseDetail']);
  });

  it('a scalar with no min/max gets a range that contains its default and a positive step', () => {
    const ref = toParentRef(entry('/Game/M/M_Lava', null, [], [
      { name: 'GlowStrength', type: 'ScalarParameter', defaultValue: 7 },
    ]));
    const s = ref.scalars[0];
    expect(s.name).toBe('GlowStrength');
    expect(s.defaultValue).toBe(7);
    expect(s.min).toBeLessThanOrEqual(7);
    expect(s.max).toBeGreaterThanOrEqual(7);
    expect(s.max).toBeGreaterThan(s.min);
    expect(s.step).toBeGreaterThan(0);
  });

  it('a non-numeric scalar default keeps the name and puts no invented default in the prompt', () => {
    const ref = toParentRef(entry('/Game/M/M_Rock', null, [], [
      { name: 'Roughness', type: 'ScalarParameter', defaultValue: 0.3, min: 0, max: 1 },
      { name: 'Wetness', type: 'ScalarParameter', defaultValue: 'curve:Wet' },
    ]));
    const wet = ref.scalars.find((s) => s.name === 'Wetness');
    expect(wet).toBeTruthy();
    expect(wet!.defaultValue).toBeNull();
    expect(wet!.max).toBeGreaterThan(wet!.min);

    const config: MaterialConfiguratorConfig = {
      surfaceType: 'stone',
      features: [],
      outputType: 'instance',
      params: { Roughness: { name: 'Roughness', min: 0, max: 1, defaultValue: 0.3, step: 0.01 } },
      parentMaterial: ref,
    };
    const prompt = buildMaterialConfiguratorPrompt(config, { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' });
    const wetLines = prompt.split('\n').filter((l) => l.includes('Wetness'));
    expect(wetLines.length).toBeGreaterThan(0);
    for (const l of wetLines) expect(l).not.toMatch(/Wetness[^,\n]*(default=|default \d)/);
  });
});
