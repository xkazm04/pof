import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'bestiary',
  steps: [
    {
      archetype: 'brief', label: 'Concept & Role',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a tank-archetype enemy in PoF — a deliberate, telegraphed bruiser. `.repeat(6) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'brief', label: 'Lore / Codex',
      view: { kind: 'prose', field: 'lore', emptyText: 'No codex entry yet' },
      produce: (e: LabEntity) => ({ data: { lore: `${e.name}: a codex account rooted in the post-Sundering world. `.repeat(5) } }),
      accept: minLength('lore', 'Codex entry ≥ 200 characters', 200),
    },
    {
      archetype: 'schema', label: 'Stat Block',
      view: { kind: 'table', field: 'stats', columns: [{ key: 'health' }, { key: 'damage' }, { key: 'armor' }, { key: 'moveSpeed' }] },
      produce: () => ({ data: { stats: { health: 420, damage: 35, armor: 20, moveSpeed: 300 } } }),
      accept: fieldsPopulated('stats', 'Stat block populated', ['health', 'damage', 'armor', 'moveSpeed']),
      staticChecks: () => [cppSymbolExists('AARPGEnemyCharacter', 'Enemy actor class present in UE Source')],
    },
    {
      archetype: 'rules', label: 'Abilities',
      view: { kind: 'manifest', field: 'abilities' },
      produce: () => ({ data: { abilities: ['spellbook::force_push (primary)', 'spellbook::ground_slam (heavy)'], links: [{ catalogId: 'spellbook', entityId: 'force_push', role: 'primary' }, { catalogId: 'spellbook', entityId: 'ground_slam', role: 'heavy' }] } }),
      accept: minCount('abilities', '≥1 ability linked from the abilities catalog', 1),
    },
    {
      archetype: 'rules', label: 'AI Behavior',
      view: { kind: 'table', field: 'behavior', columns: [{ key: 'tree' }, { key: 'aggroRange' }, { key: 'archetype' }] },
      produce: (e: LabEntity) => ({ data: { behavior: { tree: `BT_${slug(e.name)}`, aggroRange: 1200, archetype: 'tank' } } }),
      accept: fieldsPopulated('behavior', 'BT + aggro range + archetype', ['tree', 'aggroRange', 'archetype']),
    },
    {
      archetype: 'balance', label: 'Encounter Balance',
      view: { kind: 'table', field: 'balance', columns: [{ key: 'threat' }] },
      produce: () => ({ data: { balance: { threat: 103 }, threat: 103 } }),
      accept: withinPercent('threat', 'Threat within ±10% of tier (100)', 100, 10),
    },
    {
      archetype: 'gallery', label: 'Concept 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { selected: 0 }, ueAssets: [`/Game/Bestiary/${slug(e.name)}/T_${slug(e.name)}_Concept`] }),
      accept: selected('selected', 'A concept is selected'),
    },
    {
      archetype: 'gallery', label: '3D & Rig',
      view: { kind: 'gallery', field: 'mesh', candidates: 3 },
      produce: (e: LabEntity) => ({ data: { mesh: 0 }, ueAssets: [`/Game/Bestiary/${slug(e.name)}/SK_${slug(e.name)}`] }),
      accept: selected('mesh', 'A rigged mesh candidate is selected'),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['spawns + possesses', 'ability fires', 'dies + drops loot'] } }),
      accept: runtimeDeferred('VSBestiarySpawnTest', 'Enemy spawn + combat test passes in UE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [`DT_Bestiary :: ${s}`, `BP_${s}`, `SK_${s}`, `BT_${s}`];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Bestiary/${s}/${a}`) };
      },
      accept: minCount('assets', 'All assets packaged', 3),
      staticChecks: () => [cppSymbolExists('AARPGEnemyCharacter', 'Enemy actor present')],
    },
  ],
});
