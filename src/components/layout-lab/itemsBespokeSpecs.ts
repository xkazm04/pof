import {
  ITEMS_BESPOKE_CHECKERS, ITEM_ATTR_SCHEMA, MIN_ANIM_CLIPS, MIN_SFX_CUES, DEFAULT_VFX_MS_CAP,
} from '@/lib/catalog/acceptance/itemsBespokeCheckers';
import { itemDeclaredAssets } from '@/lib/catalog/itemAssetPaths';
import {
  ITEM_STEP_SPECS, DEFAULT_ANIM_CLIPS, DEFAULT_VFX_VARIANTS, DEFAULT_SFX_CUES,
} from '@/components/layout-lab/steps/itemsSteps'; // call-time only (import cycle via itemsLabelOwner is benign)
import type { ArchetypeId, StepSpec, ViewDescriptor } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import type { StepOutput } from '@/components/layout-lab/labPipelineStore';

/**
 * THE 7 BESPOKE-OWNED ITEMS LABELS AS STEP SPECS.
 *
 * `Attributes`, `3D Generation`, `Material / Texture`, `Animations`, `VFX`, `SFX` and
 * `Inventory UI Integration` predate the registered items pipeline and are declared only by
 * `ITEM_STEP_SPECS`, which is not a `StepSpec`. So the generic produce door could not reach them:
 * the one-shot route 404'd on them and their Produce panels had no live mode. This adapter
 * presents each one as a `StepSpec` WITHOUT renaming a label (Rule 4b) or moving its UI (the
 * bespoke components still render it):
 *
 *  - `archetype` names the deliverable honestly (`catalog-pipeline-authoring#step-archetype-taxonomy`):
 *    the four TEXT deliverables are `rules` (a CLI session can author them, `cliEligibility.ts`);
 *    the attribute table is `schema` and the two generative steps are `gallery` (stub/generator).
 *  - `accept` IS the server's checker (`ITEMS_BESPOKE_CHECKERS`, template-guarded), so the route,
 *    the lab and `serverCheckerFor` grade with one function.
 *  - `criteria` states the graded keys WORLD-NEUTRALLY: the bespoke checkers are untagged, so
 *    without it a live prompt would name no graded key at all (`contract-declarations-neutral.test.ts`).
 *  - `produce` is SERVER-SAFE: `ITEM_STEP_SPECS` bodies read the browser catalog store for slug
 *    siblings, which a route handler cannot call. The same constants and the one Items asset-path
 *    table (seed siblings, as the registered pipeline uses) write the same stub — pinned equal to
 *    `ITEM_STEP_SPECS[label].produce` for every seeded item (`items-bespoke-template.test.ts`).
 */

const ARCHETYPES: Readonly<Record<string, ArchetypeId>> = {
  'Attributes': 'schema',
  '3D Generation': 'gallery',
  'Material / Texture': 'gallery',
  'Animations': 'rules',
  'VFX': 'rules',
  'SFX': 'rules',
  'Inventory UI Integration': 'rules',
};

/** The bespoke-owned items labels, in pipeline order. */
export const ITEMS_BESPOKE_LABELS: readonly string[] = Object.keys(ARCHETYPES);

/** The archetype of a bespoke-owned items label, or undefined for any other label. */
export function itemsBespokeArchetype(label: string): ArchetypeId | undefined {
  return ARCHETYPES[label];
}

const assetsOf = (e: LabEntity, label: string): string[] => itemDeclaredAssets(e)[label] ?? [];

/** Server-safe produce bodies — each writes exactly its `ITEM_STEP_SPECS` stub (see header). */
const PRODUCE: Readonly<Record<string, (e: LabEntity) => StepOutput>> = {
  // Store-free already: delegate so the attribute stub has one home.
  'Attributes': (e) => ITEM_STEP_SPECS['Attributes'].produce(e),
  'Inventory UI Integration': (e) => ITEM_STEP_SPECS['Inventory UI Integration'].produce(e),
  '3D Generation': (e) => ({ data: { tris: 4200, cap: 6000 }, ueAssets: assetsOf(e, '3D Generation') }),
  'Material / Texture': (e) => ({ data: { maps: ['Albedo', 'Normal', 'ORM', 'Height'] }, ueAssets: assetsOf(e, 'Material / Texture') }),
  'Animations': (e) => ({ data: { clips: DEFAULT_ANIM_CLIPS }, ueAssets: assetsOf(e, 'Animations') }),
  'VFX': (e) => ({ data: { cost: 0.4, cap: 0.8, variants: DEFAULT_VFX_VARIANTS }, ueAssets: assetsOf(e, 'VFX') }),
  'SFX': (e) => ({ data: { cues: DEFAULT_SFX_CUES }, ueAssets: assetsOf(e, 'SFX') }),
};

/** Type-completeness only: the bespoke components render these labels, never `ArchetypeStep`. */
function viewOf(label: string): ViewDescriptor {
  switch (label) {
    case 'Attributes': return { kind: 'table', field: 'stats', columns: ITEM_ATTR_SCHEMA.map((a) => ({ key: a.key, unit: a.unit })) };
    case '3D Generation':
    case 'Material / Texture': return { kind: 'gallery', field: 'genHistory', candidates: 3 };
    case 'Animations': return { kind: 'manifest', field: 'clips' };
    case 'VFX': return { kind: 'manifest', field: 'variants' };
    case 'SFX': return { kind: 'manifest', field: 'cues' };
    default: return { kind: 'manifest', field: 'slot' };
  }
}

const SHAPE_ONLY = 'Write these as top-level artifact fields; they are graded as data shape only (tier L0).';

/**
 * The graded keys of the four text steps, world-neutral: they say WHAT to name for this item,
 * never another item's answer. Thresholds come from the checker's own constants.
 */
const CRITERIA: Readonly<Record<string, string[]>> = {
  'Animations': [
    `\`clips\`: a JSON array of [clip name, duration] pairs authored for this item — at least ${MIN_ANIM_CLIPS}, naming its pickup and equip clips.`,
    SHAPE_ONLY,
  ],
  'VFX': [
    '`variants`: a JSON array of [variant name, size] pairs — at least one variant bound to this item.',
    `\`cost\` (this item's VFX GPU cost, ms) must not exceed \`cap\` (its budget, ms; ${DEFAULT_VFX_MS_CAP} when unstated).`,
    SHAPE_ONLY,
  ],
  'SFX': [
    `\`cues\`: a JSON array of [cue name, loudness target] pairs — at least ${MIN_SFX_CUES}, covering pickup, equip and use.`,
    SHAPE_ONLY,
  ],
  'Inventory UI Integration': [
    '`slot`: the inventory slot category this item binds to (non-empty text, from its own type).',
    '`wired`: `true` once the item is registered with the inventory grid; the step never passes without it.',
    SHAPE_ONLY,
  ],
};

const built = new Map<string, StepSpec>();

/** The `StepSpec` for a bespoke-owned items label (one instance per label), or undefined. */
export function itemsBespokeStepSpec(label: string): StepSpec | undefined {
  const archetype = ARCHETYPES[label];
  if (!archetype) return undefined;
  let spec = built.get(label);
  if (!spec) {
    spec = {
      archetype,
      label,
      view: viewOf(label),
      produce: PRODUCE[label],
      accept: ITEMS_BESPOKE_CHECKERS[label],
      ...(CRITERIA[label] ? { criteria: CRITERIA[label] } : {}),
    };
    built.set(label, spec);
  }
  return spec;
}
