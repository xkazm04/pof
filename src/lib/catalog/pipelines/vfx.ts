import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount, withinPercent } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'vfx',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief: `${e.name} is a Niagara-based VFX asset for PoF ARPG. ` +
            `It delivers a visually restrained, gameplay-readable burst keyed to an anim notify. ` +
            `Class GPU budget: 0.8 ms (at 60% headroom = ~0.48 ms target per emit). ` +
            `The effect communicates hit/ability impact clearly without obscuring gameplay. `.repeat(4),
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Behavior',
      view: {
        kind: 'table', field: 'behavior',
        columns: [{ key: 'emitters' }, { key: 'lifetime', unit: 's' }, { key: 'spawnRate', unit: '/s' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          behavior: {
            emitters: `${slug(e.name)}_burst, ${slug(e.name)}_smoke`,
            lifetime: 0.6,
            spawnRate: 80,
          },
        },
      }),
      accept: fieldsPopulated('behavior', 'Emitters + lifetime + spawn rate defined', ['emitters', 'lifetime', 'spawnRate']),
    },
    {
      archetype: 'gallery', label: 'Mesh / Sprite',
      view: { kind: 'gallery', field: 'selectedAsset', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selectedAsset: 0 },
        ueAssets: [`/Game/VFX/${slug(e.name)}/SM_${slug(e.name)}_Sprite`],
      }),
      accept: selected('selectedAsset', 'A mesh/sprite candidate is selected'),
    },
    {
      archetype: 'gallery', label: 'Material',
      view: { kind: 'gallery', field: 'selectedMaterial', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selectedMaterial: 0 },
        ueAssets: [`/Game/VFX/${slug(e.name)}/MI_${slug(e.name)}`],
      }),
      accept: selected('selectedMaterial', 'A material instance is selected'),
    },
    {
      archetype: 'rules', label: 'Sound Hook',
      view: {
        kind: 'table', field: 'soundHook',
        columns: [{ key: 'cues' }, { key: 'audioLink' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          soundHook: {
            cues: `SC_${slug(e.name)}_Impact`,
            audioLink: `audio::${slug(e.name)}_impact`,
          },
          links: [{ catalogId: 'audio', entityId: `${slug(e.name)}_impact`, role: 'impact-cue' }],
        },
      }),
      accept: minCount('cues', 'At least one audio cue linked', 1),
    },
    {
      archetype: 'balance', label: 'GPU / LOD Budget',
      view: {
        kind: 'table', field: 'gpuBudget',
        columns: [{ key: 'gpuPct', unit: '%' }, { key: 'lodCount' }, { key: 'particlesCap' }],
      },
      produce: () => ({
        data: {
          gpuBudget: { gpuPct: 60, lodCount: 3, particlesCap: 200 },
          gpuPct: 60,
        },
      }),
      accept: withinPercent('gpuPct', 'GPU cost within ±15% of class budget (60% of 0.8ms)', 60, 15),
    },
    {
      archetype: 'gallery', label: 'Variants',
      view: { kind: 'gallery', field: 'selectedVariant', candidates: 3 },
      produce: (e: LabEntity) => ({
        data: { selectedVariant: 0 },
        ueAssets: [
          `/Game/VFX/${slug(e.name)}/NS_${slug(e.name)}_Small`,
          `/Game/VFX/${slug(e.name)}/NS_${slug(e.name)}_Med`,
          `/Game/VFX/${slug(e.name)}/NS_${slug(e.name)}_Large`,
        ],
      }),
      accept: selected('selectedVariant', 'A variant candidate is selected'),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selectedIcon', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selectedIcon: 0 },
        ueAssets: [`/Game/UI/Icons/VFX/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selectedIcon', 'An icon candidate is selected'),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'NS spawns under GPU budget at peak emit',
            'renders correctly under RHI (Gemini visual check)',
            'anim notify fires the effect at correct bone',
          ],
        },
      }),
      accept: runtimeDeferred('VSVFXPerfTest', 'Niagara system under GPU budget + renders (RHI+Gemini)'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [`NS_${s}`, `MI_${s}`, `SM_${s}_Sprite`, `DT_VFX :: ${s}`];
        return {
          data: { assets },
          ueAssets: assets.map((a) => `/Game/VFX/${s}/${a}`),
        };
      },
      accept: minCount('assets', 'All assets packaged', 2),
    },
  ],
});
