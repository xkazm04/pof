import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'status-effects',
  steps: [
    {
      archetype: 'brief', label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a damage-over-time status effect that ticks for several seconds and stacks with intensity. `.repeat(3) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Effect Logic',
      view: { kind: 'table', field: 'effect', columns: [{ key: 'magnitude' }, { key: 'period', unit: 's' }, { key: 'duration', unit: 's' }, { key: 'tag' }] },
      produce: (e) => ({ data: { effect: { magnitude: -5, period: 1, duration: 3, tag: `State.${slug(e.name)}` } }, ueAssets: [`/Game/Abilities/Generated/GE_Gen_${slug(e.name)}`] }),
      accept: fieldsPopulated('effect', 'Effect rules complete (magnitude/period/duration/tag)', ['magnitude', 'period', 'duration', 'tag']),
      staticChecks: (e) => [cppSymbolExists(`UGE_Gen_${slug(e.name)}`, 'Effect GameplayEffect C++ compiled')],
    },
    {
      archetype: 'balance', label: 'Balance',
      view: { kind: 'table', field: 'balance', columns: [{ key: 'dps' }] },
      produce: () => ({ data: { balance: { dps: 5 }, dps: 5 } }),
      accept: withinPercent('dps', 'DPS within ±20% of tier (5)', 5, 20),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e) => ({ data: { selected: 0 }, ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`] }),
      accept: selected('selected', 'A status icon is selected'),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['effect applies', 'ticks for duration', 'expires + removes tag'] } }),
      accept: runtimeDeferred('VSStatusBurningEffectTest', 'Functional test passes in UE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e) => {
        const s = slug(e.name);
        const assets = [`GE_Gen_${s}`, `T_${s}_Icon`, `DT_GeneratedAbilities :: ${s}`];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Abilities/Generated/${a}`) };
      },
      accept: minCount('assets', 'All produced assets packaged', 3),
      staticChecks: (e) => [seedRowPresent('seed_generated_abilities.py', slug(e.name), 'Row present in the generated-abilities seed')],
    },
  ],
});
