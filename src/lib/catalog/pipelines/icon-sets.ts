import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'icon-sets',
  steps: [
    {
      archetype: 'brief', label: 'Family Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({ data: { brief: `The ${e.name} icon family establishes one coherent visual language across its members. `.repeat(5) } }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },
    {
      archetype: 'rules', label: 'Taxonomy',
      view: { kind: 'table', field: 'taxonomy', columns: [{ key: 'members' }, { key: 'naming' }, { key: 'count' }] },
      produce: () => ({ data: { taxonomy: { members: 'items / abilities / statuses', naming: 'IconCategory_Name', count: 24 } } }),
      accept: fieldsPopulated('taxonomy', 'Members + naming + count defined', ['members', 'naming', 'count']),
    },
    {
      archetype: 'gallery', label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({ data: { selected: 0 }, ueAssets: [`/Game/UI/Icons/Sets/T_${slug(e.name)}_Atlas`] }),
      accept: selected('selected', 'A family style candidate is selected'),
    },
    {
      archetype: 'checklist', label: 'Accessibility',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['AA contrast on the dark HUD', 'colorblind-safe hue separation', 'legible at 32px'] } }),
      accept: minCount('checks', 'Accessibility checks covered', 3),
    },
    {
      archetype: 'rules', label: 'Atlas',
      view: { kind: 'table', field: 'atlas', columns: [{ key: 'texture' }, { key: 'packing' }, { key: 'slots' }] },
      produce: (e: LabEntity) => ({ data: { atlas: { texture: `T_${slug(e.name)}_Atlas`, packing: '4096 grid', slots: 24 } }, ueAssets: [`/Game/UI/Icons/Sets/T_${slug(e.name)}_Atlas`] }),
      accept: fieldsPopulated('atlas', 'Texture + packing + slots', ['texture', 'packing', 'slots']),
    },
    {
      archetype: 'checklist', label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({ data: { checks: ['atlas imports', 'all members present', 'contrast verified in editor'] } }),
      accept: runtimeDeferred('VSIconSetAtlasTest', 'Atlas import + visual check passes in UE'),
    },
    {
      archetype: 'manifest', label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [`T_${s}_Atlas`, `DT_IconSets :: ${s}`];
        return { data: { assets }, ueAssets: assets.map((a) => `/Game/UI/Icons/Sets/${a}`) };
      },
      accept: minCount('assets', 'All assets packaged', 2),
    },
  ],
});
