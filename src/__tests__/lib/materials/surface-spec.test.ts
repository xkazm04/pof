import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  SURFACE_SPEC, SURFACE_TYPES, RENDER_FEATURES, resolveShadingModel, shadingModelLabel, refusalFor,
  type RenderFeature, type SurfaceType,
} from '@/lib/materials/surface-spec';
import { estimateMaterialBudget, SAMPLER_HARD_LIMIT } from '@/lib/material-cost-estimator';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import { materialConfiguratorVariantKey } from '@/lib/cli-task';
import { SURFACES } from '@/components/modules/content/materials/MaterialParameterConfigurator/constants';
import { getDefaultMetallic, getDefaultRoughness } from '@/components/modules/content/materials/MaterialParameterConfigurator/helpers';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';
import type { ProjectContext } from '@/lib/prompt-context';
import { GOLDEN_MATERIAL_CONFIG } from '@/__tests__/lib/prompts/builder-fixtures';

/**
 * One surface spec (scan-sweep --challenge, material-configurator/A).
 *
 * The Configure tab used to hold two independent theories of which UE shading
 * model a material compiles with: the cost estimator (rendered in the Shader
 * Budget bar) and the prompt builder (what actually dispatches). They disagreed
 * on 352 of the 512 surface x feature combinations the UI can produce. Every
 * consumer now reads `SURFACE_SPEC` + `resolveShadingModel`.
 */

const CTX: ProjectContext = { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion: '5.8.0' };

function config(surfaceType: SurfaceType, features: RenderFeature[]): MaterialConfiguratorConfig {
  return { surfaceType, features, outputType: 'master', params: {} };
}

/** The UE model name on the dispatched prompt's `Shading model:` line (before the Substrate hint). */
function promptShadingModel(prompt: string): string {
  const m = prompt.match(/Shading model: \*\*(.+?) \(/);
  return m ? m[1] : '';
}

const ALL_SUBSETS: RenderFeature[][] = Array.from({ length: 64 }, (_, mask) =>
  RENDER_FEATURES.filter((_, i) => mask & (1 << i)),
);

describe('budget bar and dispatched prompt agree on the shading model', () => {
  it('metal + subsurface: the prompt names the model the estimator reports (Subsurface)', () => {
    const report = estimateMaterialBudget({ surfaceType: 'metal', features: ['subsurface'] });
    expect(report.shadingModel).toBe('Subsurface');
    const prompt = buildMaterialConfiguratorPrompt(config('metal', ['subsurface']), CTX);
    expect(promptShadingModel(prompt)).toBe(shadingModelLabel(report.shadingModel));
    expect(promptShadingModel(prompt)).toBe('Subsurface');
  });

  it('glass + refraction: the prompt says Thin Translucent, as the bar does', () => {
    const report = estimateMaterialBudget({ surfaceType: 'glass', features: ['refraction'] });
    const prompt = buildMaterialConfiguratorPrompt(config('glass', ['refraction']), CTX);
    expect(promptShadingModel(prompt)).toBe(shadingModelLabel(report.shadingModel));
    expect(promptShadingModel(prompt)).toBe('Thin Translucent');
  });

  it('all 8 surfaces x 64 feature subsets: 0 of 512 disagree', () => {
    const disagree: string[] = [];
    for (const s of SURFACE_TYPES) {
      for (const features of ALL_SUBSETS) {
        const report = estimateMaterialBudget({ surfaceType: s, features });
        const line = promptShadingModel(buildMaterialConfiguratorPrompt(config(s, features), CTX));
        if (line !== shadingModelLabel(report.shadingModel)) disagree.push(`${s}[${features.join(',')}]`);
      }
    }
    expect(SURFACE_TYPES.length * ALL_SUBSETS.length).toBe(512);
    expect(disagree).toEqual([]);
  });

  it("cloth at its default features names UE's Cloth model on both the bar and the prompt", () => {
    const features = SURFACE_SPEC.cloth.defaultFeatures;
    expect(resolveShadingModel('cloth', features)).toBe('Cloth');
    expect(estimateMaterialBudget({ surfaceType: 'cloth', features }).shadingModel).toBe('Cloth');
    expect(promptShadingModel(buildMaterialConfiguratorPrompt(config('cloth', features), CTX))).toBe('Cloth');
  });

  it('the Substrate slab hint from engine facts survives on the unified line', () => {
    const prompt = buildMaterialConfiguratorPrompt(config('metal', []), CTX);
    expect(prompt).toMatch(/Shading model: \*\*Default Lit \(or Substrate Slab/);
  });
});

describe('the dispatched prompt carries the budget the designer tuned against', () => {
  it('metal + parallax + emissive: samplers "<n> of 16" and "x metal base" equal the estimator', () => {
    const features: RenderFeature[] = ['parallax', 'emissive'];
    const report = estimateMaterialBudget({ surfaceType: 'metal', features });
    const prompt = buildMaterialConfiguratorPrompt(config('metal', features), CTX);
    expect(prompt).toContain('### Shader Budget');
    expect(prompt).toContain(`${report.samplers} of ${SAMPLER_HARD_LIMIT}`);
    expect(prompt).toContain(`${report.instructionScore.toFixed(2)}× metal base`);
    // The estimator's cheaper swap rides along with its warning.
    expect(prompt).toMatch(/BumpOffset/);
  });
});

describe('forbidden feature combinations are refused, not dispatched', () => {
  it('tessellation + parallax has a refusal naming both features', () => {
    const reason = refusalFor(['tessellation', 'parallax']);
    expect(reason).toMatch(/Tessellation/);
    expect(reason).toMatch(/Parallax/);
    expect(refusalFor(['tessellation'])).toBeNull();
    expect(refusalFor(['parallax', 'emissive'])).toBeNull();
  });

  it('the estimator error and the refusal are the same rule (128 of 512 combos)', () => {
    let refused = 0;
    for (const s of SURFACE_TYPES) {
      for (const features of ALL_SUBSETS) {
        const over = estimateMaterialBudget({ surfaceType: s, features }).overBudget;
        expect(refusalFor(features) !== null).toBe(over);
        if (over) refused++;
      }
    }
    expect(refused).toBe(128);
  });
});

describe('one table, every consumer reads it', () => {
  it('SURFACES / getDefaultRoughness / getDefaultMetallic / estimator base read SURFACE_SPEC', () => {
    expect(SURFACES.map((s) => s.id)).toEqual([...SURFACE_TYPES]);
    for (const s of SURFACE_TYPES) {
      const spec = SURFACE_SPEC[s];
      expect(SURFACES.find((x) => x.id === s)!.defaultFeatures).toEqual(spec.defaultFeatures);
      expect(getDefaultRoughness(s)).toBe(spec.defaults.Roughness);
      expect(getDefaultMetallic(s)).toBe(spec.defaults.Metallic);
      const bare = estimateMaterialBudget({ surfaceType: s, features: [] });
      expect(bare.samplers).toBe(spec.base.samplers);
      expect(bare.samplerBreakdown[0]).toEqual({ source: `${s} base`, count: spec.base.samplers });
      expect(bare.instructionScore).toBeCloseTo(spec.base.instructions / SURFACE_SPEC.metal.base.instructions, 10);
    }
  });
});

/**
 * [guard] The estimator's numbers are unchanged: recorded at d900de37 for every
 * surface with no feature and with each single feature. Cloth's shading model is
 * exempt (it now names UE's Cloth model, per the coordinator revision).
 */
const HEAD_TABLE: [SurfaceType, RenderFeature | '', number, number, boolean, string][] = [
  ['metal', '', 3, 1, false, 'DefaultLit'],
  ['metal', 'subsurface', 4, 3, false, 'Subsurface'],
  ['metal', 'parallax', 4, 5.166666666666667, false, 'DefaultLit'],
  ['metal', 'emissive', 4, 1.3333333333333333, false, 'DefaultLit'],
  ['metal', 'refraction', 4, 2.5, false, 'ThinTranslucent'],
  ['metal', 'tessellation', 4, 4, false, 'DefaultLit'],
  ['metal', 'worldPositionOffset', 3, 2, false, 'DefaultLit'],
  ['cloth', '', 4, 1.3333333333333333, false, 'DefaultLit'],
  ['cloth', 'subsurface', 5, 3.3333333333333335, false, 'Subsurface'],
  ['cloth', 'parallax', 5, 5.5, false, 'DefaultLit'],
  ['cloth', 'emissive', 5, 1.6666666666666667, false, 'DefaultLit'],
  ['cloth', 'refraction', 5, 2.8333333333333335, false, 'ThinTranslucent'],
  ['cloth', 'tessellation', 5, 4.333333333333333, false, 'DefaultLit'],
  ['cloth', 'worldPositionOffset', 4, 2.3333333333333335, false, 'DefaultLit'],
  ['skin', '', 5, 1.8333333333333333, false, 'SubsurfaceProfile'],
  ['skin', 'subsurface', 6, 3.8333333333333335, false, 'SubsurfaceProfile'],
  ['skin', 'parallax', 6, 6, false, 'SubsurfaceProfile'],
  ['skin', 'emissive', 6, 2.1666666666666665, false, 'SubsurfaceProfile'],
  ['skin', 'refraction', 6, 3.3333333333333335, false, 'SubsurfaceProfile'],
  ['skin', 'tessellation', 6, 4.833333333333333, false, 'SubsurfaceProfile'],
  ['skin', 'worldPositionOffset', 5, 2.8333333333333335, false, 'SubsurfaceProfile'],
  ['glass', '', 3, 1.5, false, 'ThinTranslucent'],
  ['glass', 'subsurface', 4, 3.5, false, 'Subsurface'],
  ['glass', 'parallax', 4, 5.666666666666667, false, 'ThinTranslucent'],
  ['glass', 'emissive', 4, 1.8333333333333333, false, 'ThinTranslucent'],
  ['glass', 'refraction', 4, 3, false, 'ThinTranslucent'],
  ['glass', 'tessellation', 4, 4.5, false, 'ThinTranslucent'],
  ['glass', 'worldPositionOffset', 3, 2.5, false, 'ThinTranslucent'],
  ['water', '', 4, 2.1666666666666665, false, 'ThinTranslucent'],
  ['water', 'subsurface', 5, 4.166666666666667, false, 'Subsurface'],
  ['water', 'parallax', 5, 6.333333333333333, false, 'ThinTranslucent'],
  ['water', 'emissive', 5, 2.5, false, 'ThinTranslucent'],
  ['water', 'refraction', 5, 3.6666666666666665, false, 'ThinTranslucent'],
  ['water', 'tessellation', 5, 5.166666666666667, false, 'ThinTranslucent'],
  ['water', 'worldPositionOffset', 4, 3.1666666666666665, false, 'ThinTranslucent'],
  ['emissive', '', 3, 0.8333333333333334, false, 'DefaultLit'],
  ['emissive', 'subsurface', 4, 2.8333333333333335, false, 'Subsurface'],
  ['emissive', 'parallax', 4, 5, false, 'DefaultLit'],
  ['emissive', 'emissive', 4, 1.1666666666666667, false, 'DefaultLit'],
  ['emissive', 'refraction', 4, 2.3333333333333335, false, 'ThinTranslucent'],
  ['emissive', 'tessellation', 4, 3.8333333333333335, false, 'DefaultLit'],
  ['emissive', 'worldPositionOffset', 3, 1.8333333333333333, false, 'DefaultLit'],
  ['foliage', '', 4, 1.5833333333333333, false, 'TwoSidedFoliage'],
  ['foliage', 'subsurface', 5, 3.5833333333333335, false, 'TwoSidedFoliage'],
  ['foliage', 'parallax', 5, 5.75, false, 'TwoSidedFoliage'],
  ['foliage', 'emissive', 5, 1.9166666666666667, false, 'TwoSidedFoliage'],
  ['foliage', 'refraction', 5, 3.0833333333333335, false, 'TwoSidedFoliage'],
  ['foliage', 'tessellation', 5, 4.583333333333333, false, 'TwoSidedFoliage'],
  ['foliage', 'worldPositionOffset', 4, 2.5833333333333335, false, 'TwoSidedFoliage'],
  ['stone', '', 4, 1.3333333333333333, false, 'DefaultLit'],
  ['stone', 'subsurface', 5, 3.3333333333333335, false, 'Subsurface'],
  ['stone', 'parallax', 5, 5.5, false, 'DefaultLit'],
  ['stone', 'emissive', 5, 1.6666666666666667, false, 'DefaultLit'],
  ['stone', 'refraction', 5, 2.8333333333333335, false, 'ThinTranslucent'],
  ['stone', 'tessellation', 5, 4.333333333333333, false, 'DefaultLit'],
  ['stone', 'worldPositionOffset', 4, 2.3333333333333335, false, 'DefaultLit'],
];

describe('[guard] estimator numbers unchanged', () => {
  it('samplers / instructionScore / overBudget / shadingModel per surface x single feature', () => {
    expect(HEAD_TABLE).toHaveLength(56);
    for (const [s, f, samplers, score, over, model] of HEAD_TABLE) {
      const r = estimateMaterialBudget({ surfaceType: s, features: f ? [f] : [] });
      expect([s, f, r.samplers, r.instructionScore, r.overBudget]).toEqual([s, f, samplers, score, over]);
      if (s !== 'cloth') expect([s, f, r.shadingModel]).toEqual([s, f, model]);
    }
  });
});

describe('[guard] the rail stays byte-identical', () => {
  it('the golden config keeps its variant key; task golden == builder golden', () => {
    expect(materialConfiguratorVariantKey(GOLDEN_MATERIAL_CONFIG)).toBe('material-configurator::master::metal::7613c37c');
    const dir = path.join(process.cwd(), 'src', '__tests__', 'lib', 'prompts', '__golden__');
    const task = fs.readFileSync(path.join(dir, 'task-material-configurator.md'), 'utf8');
    const builder = fs.readFileSync(path.join(dir, 'builder-material-configurator.md'), 'utf8');
    expect(task).toBe(builder);
  });
});
