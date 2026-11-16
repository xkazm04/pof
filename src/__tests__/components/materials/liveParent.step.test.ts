import { describe, it, expect } from 'vitest';
import {
  toParentRef, parentParamDefs,
} from '@/components/modules/content/materials/MaterialParameterConfigurator/liveParent';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import type { MaterialConfiguratorConfig, ParameterRange } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { MaterialEntry, MaterialParameter } from '@/types/pof-bridge';

/**
 * A live parent's slider step is (max - min) / 100. Raw, that division leaks
 * binary floating-point noise (2.2 / 100 = 0.022000000000000002) into the
 * dispatched prompt's `step=` line and the ClampMin/UI metadata it asks the
 * generated C++ to match. The step must be a clean decimal.
 */

function master(parameters: MaterialParameter[]): MaterialEntry {
  return {
    path: '/Game/M/M_Probe', parentMaterial: null, materialInstances: [], parameters,
    domain: 'Surface', blendMode: 'Opaque', shadingModel: 'DefaultLit',
    textureReferences: [], crossReferences: [], contentHash: 'h',
  };
}

// A run of 6+ zeros or nines after the decimal point followed by more digits is float noise.
const FLOAT_NOISE = /\.\d*(?:0{6,}|9{6,})\d/;

const RANGES: Array<[number, number]> = [[0, 1], [0, 2.2], [0, 0.7], [0, 0.3], [-1, 1], [0, 14], [0.1, 0.7], [0, 3], [0, 10000], [0, 0.07]];

describe('live parent slider step', () => {
  it('is a clean decimal for every sampled manifest range', () => {
    const ref = toParentRef(master(RANGES.map(([min, max], i) => ({
      name: `S${i}`, type: 'ScalarParameter', defaultValue: min, min, max,
    }))));
    const noisy = ref.scalars.filter((s) => FLOAT_NOISE.test(String(s.step))).map((s) => `${s.name}=${s.step}`);
    expect(noisy).toEqual([]);
    for (const s of ref.scalars) expect(s.step).toBeGreaterThan(0);
  });

  it('keeps the step at one hundredth of the range', () => {
    const ref = toParentRef(master([{ name: 'Wet', type: 'ScalarParameter', defaultValue: 1, min: 0, max: 2.2 }]));
    expect(ref.scalars[0].step).toBeCloseTo(0.022, 12);
  });

  it('dispatches no float noise in the parent prompt', () => {
    const ref = toParentRef(master([{ name: 'Wet', type: 'ScalarParameter', defaultValue: 1, min: 0, max: 2.2 }]));
    const params: Record<string, ParameterRange> = {};
    for (const p of parentParamDefs(ref)) params[p.name] = { name: p.name, min: p.min, max: p.max, defaultValue: p.defaultValue, step: p.step };
    const config: MaterialConfiguratorConfig = { surfaceType: 'stone', features: [], outputType: 'instance', params, parentMaterial: ref };
    const prompt = buildMaterialConfiguratorPrompt(config, { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' });
    const line = prompt.split('\n').find((l) => l.includes('Wet: default='));
    expect(line).toBeTruthy();
    expect(line).not.toMatch(FLOAT_NOISE);
  });
});
