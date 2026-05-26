import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'characters',
  steps: [
    {
      archetype: 'brief', label: 'Concept & Role',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `${e.name} is a named NPC character in PoF — a plate-armored human officer who anchors the early-game hub. `.repeat(5) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'gallery', label: 'Concept 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { selected: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/T_${slug(e.name)}_Concept`] }),
      accept: selected('selected', 'A concept is selected'),
    },
    {
      archetype: 'schema', label: 'Stat Block',
      view: { kind: 'table', field: 'stats', columns: [{ key: 'health' }, { key: 'damage' }, { key: 'armor' }, { key: 'moveSpeed' }] },
      produce: () => ({ data: { stats: { health: 250, damage: 28, armor: 18, moveSpeed: 350 } } }),
      accept: fieldsPopulated('stats', 'Stat block populated', ['health', 'damage', 'armor', 'moveSpeed']),
      staticChecks: () => [cppSymbolExists('FARPGAttributeInitRow', 'Attribute init row struct present')],
    },
    {
      archetype: 'gallery', label: '3D & Rig',
      view: { kind: 'gallery', field: 'mesh', candidates: 3 },
      produce: (e: LabEntity) => ({ data: { mesh: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/SK_${slug(e.name)}`] }),
      accept: selected('mesh', 'A rigged mesh candidate is selected'),
    },
    {
      archetype: 'gallery', label: 'Material / Outfit',
      view: { kind: 'gallery', field: 'material', candidates: 3 },
      produce: (e: LabEntity) => ({ data: { material: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/MI_${slug(e.name)}_Outfit`] }),
      accept: selected('material', 'A material candidate is selected'),
    },
    {
      archetype: 'checklist', label: 'Locomotion Anim',
      view: { kind: 'checklist', field: 'clips' },
      produce: () => ({ data: { clips: ['Idle', 'Walk', 'Run'] } }),
      accept: minCount('clips', '≥3 locomotion clips', 3),
    },
    {
      archetype: 'checklist', label: 'Combat Anim',
      view: { kind: 'checklist', field: 'clips' },
      produce: () => ({ data: { clips: ['MeleeAttack_Montage', 'HeavyAttack_Montage'] } }),
      accept: minCount('clips', '≥2 combat animation clips', 2),
    },
    {
      archetype: 'checklist', label: 'VO',
      view: { kind: 'checklist', field: 'lines' },
      produce: () => ({ data: { lines: ['Greeting: "Halt, traveler — I need your help."'] } }),
      accept: minCount('lines', '≥1 VO line authored', 1),
    },
    {
      archetype: 'rules', label: 'Behavior (NPC)',
      view: { kind: 'table', field: 'behavior', columns: [{ key: 'role' }, { key: 'npcId' }, { key: 'dialogueBinding' }] },
      produce: (e: LabEntity) => ({
        data: {
          behavior: { role: 'QuestGiver', npcId: `${slug(e.name)}`, dialogueBinding: `dialog-captain-vael` },
          links: [
            { catalogId: 'dialog-trees', entityId: 'dialog-captain-vael', role: 'host' },
            { catalogId: 'quests', entityId: 'quest-vael-intro', role: 'giver' },
          ],
        },
      }),
      accept: fieldsPopulated('behavior', 'Role + npcId + dialogueBinding', ['role', 'npcId', 'dialogueBinding']),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art (portrait)',
      view: { kind: 'gallery', field: 'portrait', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { portrait: 0 }, ueAssets: [`/Game/Characters/${slug(e.name)}/T_${slug(e.name)}_Portrait`] }),
      accept: selected('portrait', 'A portrait is selected'),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['NPC spawns in PIE', 'dialogue interaction fires', 'quest objective granted'] } }),
      accept: runtimeDeferred('VSCharacterVaelTest', 'NPC spawns + talks + gives quest in PIE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [`BP_${s}`, `SK_${s}`, `DT_AttributeDefaults :: ${s}`, `DT_Characters :: ${s}`];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/Characters/${s}/${a}`) };
      },
      accept: minCount('assets', 'All assets packaged', 4),
      staticChecks: () => [cppSymbolExists('AARPGNPCActor', 'NPC actor class present')],
    },
  ],
});
