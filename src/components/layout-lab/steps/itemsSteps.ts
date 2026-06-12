import type { Acceptance } from './StepFrame';
import type { LabEntity } from '../useLabCatalogData';
import type { StepOutput } from '../labPipelineStore';

/** PascalCase, space-free asset slug for UE paths (Iron Longsword → IronLongsword). */
export function slug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '');
}

/** Root UE content path for all catalog item assets. */
const ITEMS_ROOT = '/Game/Items';

/** UE asset folder for one item: `/Game/Items/<slug>/`. The single source of
 *  truth for the Items asset-path layout — reused by the step specs and ItemArt. */
export function base(entity: LabEntity): string {
  return `${ITEMS_ROOT}/${slug(entity.name)}/`;
}

/** Full path for one item asset named `<prefix><slug><suffix>` — the convention
 *  every Items asset follows (e.g. `itemAsset(e, 'T_', '_Icon')` →
 *  `/Game/Items/<slug>/T_<slug>_Icon`). Computes the slug once. */
export function itemAsset(entity: LabEntity, prefix: string, suffix = ''): string {
  const s = slug(entity.name);
  return `${ITEMS_ROOT}/${s}/${prefix}${s}${suffix}`;
}

/**
 * The Weapon attribute schema — the single source of truth for the attribute key
 * list, display units, and Produce's default values. The Attributes View
 * (`ItemAttributes`) renders this table, and the spec's produce()/accept() derive
 * their key list + default stats from it, so the preview can't drift from what
 * Produce actually writes.
 */
export interface ItemAttr { key: string; unit: string; value: number }
export const ITEM_ATTR_SCHEMA: ItemAttr[] = [
  { key: 'Damage', unit: 'hp', value: 34 },
  { key: 'Attack Speed', unit: '/s', value: 1.1 },
  { key: 'Weight', unit: 'kg', value: 3.4 },
  { key: 'Durability', unit: 'pt', value: 180 },
  { key: 'Crit Chance', unit: '%', value: 5 },
  { key: 'Range', unit: 'm', value: 1.8 },
  { key: 'Stagger', unit: 'pt', value: 22 },
  { key: 'Value', unit: 'g', value: 120 },
];
/** Attribute key list — derived from the schema; drives accept() / copy completeness. */
const ATTR_KEYS = ITEM_ATTR_SCHEMA.map((a) => a.key);
const RARITY_MULT = 1.4; // expected gold per power point

/* ── Economy curve math ─────────────────────────────────────────────────────
 * The single source for the price/power formula. Both the Economy Acceptance
 * gate (below) and the Economy View (`ItemEconomy`) read these helpers, so the
 * in-band / OUTLIER badge can never disagree with the derived gate at a band
 * edge — previously the two sites rounded the expected price differently. */

/** Expected gold price for an item of the given power — the loot-curve baseline.
 *  Gold is whole, so the curve (and the ratio denominator) round to integer gold. */
export function expectedPrice(power: number): number {
  return Math.round(power * RARITY_MULT);
}

/** Actual cost as a multiple of the expected price. 1.0× sits exactly on the curve. */
export function priceRatio(cost: number, power: number): number {
  return cost / expectedPrice(power);
}

/** Price/power band: cost must sit within 0.8–1.2× of the expected curve. */
export const PRICE_RATIO_BAND = { lo: 0.8, hi: 1.2 } as const;
/** Power band: power must sit within ±10% of its tier target. */
export const POWER_BAND = { lo: 0.9, hi: 1.1 } as const;

/** True when the item's price sits inside the price/power band. */
export function priceInBand(cost: number, power: number): boolean {
  const ratio = priceRatio(cost, power);
  return ratio >= PRICE_RATIO_BAND.lo && ratio <= PRICE_RATIO_BAND.hi;
}

/** True when the item's power sits within ±10% of its tier target. */
export function powerInBand(power: number, target: number): boolean {
  return power >= target * POWER_BAND.lo && power <= target * POWER_BAND.hi;
}

/**
 * Default produce outputs that the matching View previews also render as their
 * empty-state fallback. Exported so each View imports the exact array Produce
 * writes — a renamed clip, an added cue, or a reworded gate check updates the
 * spec and the preview in one place and can never silently diverge.
 */
export const DEFAULT_ANIM_CLIPS: [string, string][] = [['Pickup', '0.6s'], ['Equip', '0.8s'], ['Idle Loop', '2.0s'], ['Inspect', '1.4s']];
export const DEFAULT_VFX_VARIANTS: [string, string][] = [['Idle glow', 'small'], ['Equip flash', 'med'], ['Use trail', 'med']];
export const DEFAULT_SFX_CUES: [string, string][] = [['Pickup', '-14 LUFS'], ['Equip', '-13 LUFS'], ['Swing', '-12 LUFS']];
export const DEFAULT_GATE_CHECKS: string[] = ['Stat/rules unit test', 'Equip + use in PIE', 'Visual QA (icon + mesh)', 'Performance budget'];

function brief(entity: LabEntity): string {
  return `${entity.name} is a mid-tier martial weapon forged for frontline duelists. It favors disciplined, rhythmic strikes over raw burst — rewarding players who weave light and heavy attacks rather than mashing a single button. Visually it reads as weathered steel with a leather-wrapped grip and a faint guild sigil etched near the crossguard. Intended player feeling: dependable and earned — a soldier's tool, not a hero's relic.`;
}

/**
 * Plain-language acceptance copy — authored per step alongside `accept()` so the
 * human-readable cause and suggested fix live with the gate logic. Strings are
 * centralized here (no inlined English in component JSX) so a future i18n pass
 * can swap the object out without touching the gate or UI code.
 */
export interface AcceptanceCopy {
  why: string;
  suggestion: string;
  /** Optional preset direction text to seed a one-click fix dispatch. */
  fixDirection?: string;
}

/**
 * The contract for every Items pipeline step: what its Produce writes (`produce`)
 * and how its Acceptance is derived from the persisted artifact (`accept`). The live
 * CliProduce buttons and the "Populate demo" action both call `produce`, so the
 * worked example and the interactive flow stay identical.
 */
export interface ItemStepSpec {
  produce: (entity: LabEntity) => StepOutput;
  accept: (data: Record<string, unknown>) => Acceptance;
}

/* ── Plain-language reasons ─────────────────────────────────────────────── */

function briefCopy(data: Record<string, unknown>): AcceptanceCopy {
  const len = String(data.brief ?? '').length;
  if (len === 0) {
    return { why: 'No concept brief has been written yet — downstream art and economy steps have no tone to reference.',
      suggestion: 'Run Produce to draft a brief.' };
  }
  return { why: `The brief is too short (${len} chars) — under 300 chars rarely conveys tone or constraints clearly.`,
    suggestion: 'Re-run Produce to lengthen it past 300 characters.' };
}

function attributesCopy(data: Record<string, unknown>): AcceptanceCopy {
  const stats = (data.stats ?? {}) as Record<string, unknown>;
  const missing = ATTR_KEYS.filter((k) => stats[k] == null);
  if (missing.length === ATTR_KEYS.length) {
    return { why: 'No attributes have been authored yet — UE5 has no row data to drive damage, weight, or value.',
      suggestion: 'Run Produce to fill the attribute set from the brief.' };
  }
  return { why: `${missing.length} attribute(s) are still missing (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}).`,
    suggestion: 'Re-run Produce to fill the remaining fields.' };
}

function economyCopy(data: Record<string, unknown>): AcceptanceCopy {
  if (data.power == null) {
    return { why: 'Power and price are not tuned — without them the item has no place on the loot curve.',
      suggestion: 'Run Produce to tune cost / rarity onto the price/power curve.' };
  }
  const power = Number(data.power), target = Number(data.target), cost = Number(data.cost);
  const ratio = priceRatio(cost, power);
  const powerOk = powerInBand(power, target);
  const ratioOk = priceInBand(cost, power);
  if (!powerOk) {
    const pct = Math.round(((power - target) / target) * 100);
    return { why: `Power is ${pct > 0 ? `~${pct}% above` : `~${Math.abs(pct)}% below`} its tier target — out of the ±10% band.`,
      suggestion: pct > 0 ? 'Lower one of the offensive stats.' : 'Raise one of the offensive stats.',
      fixDirection: pct > 0 ? 'lower offensive stats slightly to land within tier ±10%' : 'raise offensive stats slightly to land within tier ±10%' };
  }
  if (!ratioOk) {
    const pct = Math.round((ratio - 1) * 100);
    return { why: `This item is priced ~${Math.abs(pct)}% ${pct > 0 ? 'too high' : 'too low'} for its power.`,
      suggestion: pct > 0 ? 'Lower its gold cost.' : 'Raise its gold cost.',
      fixDirection: pct > 0 ? 'lower gold cost to land inside 0.8–1.2× the power curve' : 'raise gold cost to land inside 0.8–1.2× the power curve' };
  }
  return { why: 'Power and price both land in their bands — this item fits the loot curve.', suggestion: '' };
}

function iconCopy(data: Record<string, unknown>): AcceptanceCopy {
  return data.selected != null
    ? { why: 'An icon is selected.', suggestion: '' }
    : { why: 'No icon candidate has been picked yet — the item has nothing to render in the inventory grid.',
        suggestion: 'Click one of the gallery tiles, or run Produce to generate fresh candidates.' };
}

function meshCopy(data: Record<string, unknown>): AcceptanceCopy {
  const tris = Number(data.tris ?? 0), cap = Number(data.cap ?? 6000);
  if (tris === 0) {
    return { why: 'No mesh has been generated yet — the inventory preview will fall back to an icon-only state.',
      suggestion: 'Run Produce to generate a base mesh and auto-LODs.' };
  }
  return { why: `Mesh exceeds the LOD0 budget (${tris} > ${cap} tris) — load times and draw cost will suffer.`,
    suggestion: 'Re-run Produce with a tighter retopo target.', fixDirection: `retopo under ${cap} triangles for LOD0` };
}

function materialCopy(data: Record<string, unknown>): AcceptanceCopy {
  const maps = (data.maps ?? []) as string[];
  const need = ['Albedo', 'Normal', 'ORM'];
  const missing = need.filter((m) => !maps.includes(m));
  if (maps.length === 0) {
    return { why: 'No PBR maps yet — the mesh has no surface to render.',
      suggestion: 'Run Produce to author the Albedo / Normal / ORM set.' };
  }
  return { why: `${missing.length === 1 ? 'The' : ''} ${missing.join(', ')} map${missing.length === 1 ? ' is' : 's are'} missing.`,
    suggestion: 'Re-run Produce to fill the missing PBR channels.' };
}

function animationsCopy(data: Record<string, unknown>): AcceptanceCopy {
  const clips = (data.clips ?? []) as unknown[];
  return clips.length === 0
    ? { why: 'No clips retargeted yet — the item cannot be picked up, equipped, or idled.',
        suggestion: 'Run Produce to retarget pickup / equip / idle from SK_Mannequin.' }
    : { why: `Only ${clips.length} clip(s) present — pickup and equip are required at minimum.`,
        suggestion: 'Re-run Produce to add the missing clips.' };
}

function vfxCopy(data: Record<string, unknown>): AcceptanceCopy {
  const variants = (data.variants ?? []) as unknown[];
  const cost = Number(data.cost ?? 0), cap = Number(data.cap ?? 0.8);
  if (variants.length === 0) {
    return { why: 'No Niagara variants exist — the item has no visual reactions.',
      suggestion: 'Run Produce to author the idle / equip / use variants.' };
  }
  return { why: `GPU cost (${cost.toFixed(1)}ms) sits over the ${cap}ms frame budget — performance regressions on lower tiers.`,
    suggestion: 'Re-run Produce with cheaper modules.',
    fixDirection: `keep GPU cost under ${cap}ms by reducing emitter counts` };
}

function sfxCopy(data: Record<string, unknown>): AcceptanceCopy {
  const cues = (data.cues ?? []) as unknown[];
  return cues.length === 0
    ? { why: 'No SoundCues imported — the item is silent on pickup, equip, and use.',
        suggestion: 'Run Produce to import a randomizing SoundCue set.' }
    : { why: `Only ${cues.length} cue(s) bound — pickup / equip / use coverage requires three.`,
        suggestion: 'Re-run Produce to fill the missing cues.' };
}

function inventoryCopy(data: Record<string, unknown>): AcceptanceCopy {
  return data.wired
    ? { why: 'Wired to the inventory widget.', suggestion: '' }
    : { why: 'The item is not yet registered with the inventory widget — it will not appear in the grid.',
        suggestion: 'Run Produce to register slot rules and stack size.' };
}

function tooltipCopy(data: Record<string, unknown>): AcceptanceCopy {
  const fields = Number(data.fields ?? 0);
  if (fields === 0) {
    return { why: 'No tooltip layout has been authored — hovering the item shows nothing.',
      suggestion: 'Run Produce to lay out the stat tooltip.' };
  }
  return { why: `Tooltip shows only ${fields} field(s) — four are required and compare-vs-equipped is off.`,
    suggestion: 'Re-run Produce to add the missing rows and enable compare.' };
}

function gateCopy(data: Record<string, unknown>): AcceptanceCopy {
  return data.pass === true
    ? { why: 'All gate checks pass in the UE project.', suggestion: '' }
    : { why: 'The functional test has not been run, or the last run did not pass.',
        suggestion: 'Run Produce to dispatch the UE functional test.' };
}

function packagingCopy(data: Record<string, unknown>): AcceptanceCopy {
  const assets = (data.assets ?? []) as unknown[];
  return assets.length === 0
    ? { why: 'Nothing has been packaged yet — the DT_Items row and referenced assets are missing.',
        suggestion: 'Run Produce after the upstream steps finish.' }
    : { why: `Only ${assets.length} of 6 expected assets packaged — the row is incomplete.`,
        suggestion: 'Re-run Produce once the upstream steps have all produced.' };
}

/** Public lookup so component code (or tests) can pull copy without a closure. */
export const ITEM_STEP_COPY: Record<string, (data: Record<string, unknown>) => AcceptanceCopy> = {
  'Concept Brief': briefCopy,
  'Attributes': attributesCopy,
  'Economy': economyCopy,
  'Icon 2D Art': iconCopy,
  '3D Generation': meshCopy,
  'Material / Texture': materialCopy,
  'Animations': animationsCopy,
  'VFX': vfxCopy,
  'SFX': sfxCopy,
  'Inventory UI Integration': inventoryCopy,
  'Tooltip / Compare': tooltipCopy,
  'Test Gate': gateCopy,
  'UE Packaging': packagingCopy,
};

/** Merge step-derived plain-language copy into an Acceptance. Only attaches the
 *  `why` / `suggestion` / `fixDirection` when the gate is not yet `pass`. */
function withCopy(step: string, data: Record<string, unknown>, base: Acceptance): Acceptance {
  if (base.status === 'pass') return base;
  const copy = ITEM_STEP_COPY[step]?.(data);
  if (!copy) return base;
  return {
    ...base,
    why: copy.why,
    suggestion: copy.suggestion || undefined,
    fixDirection: copy.fixDirection,
  };
}

export const ITEM_STEP_SPECS: Record<string, ItemStepSpec> = {
  'Concept Brief': {
    produce: (e) => ({ data: { brief: brief(e) } }),
    accept: (data) => {
      const len = String(data.brief ?? '').length;
      return withCopy('Concept Brief', data, { label: 'Brief is at least 300 characters', status: len >= 300 ? 'pass' : 'pending', detail: `${len} / 300 chars` });
    },
  },
  'Attributes': {
    produce: () => ({ data: { stats: Object.fromEntries(ITEM_ATTR_SCHEMA.map((a) => [a.key, a.value] as const)) } }),
    accept: (data) => {
      const stats = (data.stats ?? {}) as Record<string, unknown>;
      const have = ATTR_KEYS.filter((k) => stats[k] != null).length;
      return withCopy('Attributes', data, { label: 'All attributes populated per schema (Weapon)', status: have === ATTR_KEYS.length ? 'pass' : 'pending', detail: `${have} / ${ATTR_KEYS.length} populated` });
    },
  },
  'Economy': {
    produce: () => ({ data: { power: 102, target: 100, cost: 143, rarity: 'Uncommon' } }),
    accept: (data) => {
      if (data.power == null) return withCopy('Economy', data, { label: 'Power within ±10% of tier · price in curve', status: 'pending', detail: 'not tuned' });
      const power = Number(data.power), target = Number(data.target), cost = Number(data.cost);
      const ratio = priceRatio(cost, power);
      const ok = powerInBand(power, target) && priceInBand(cost, power);
      return withCopy('Economy', data, { label: 'Power within ±10% of tier · price in curve · no outliers', status: ok ? 'pass' : 'fail', detail: `power ${power}% · price/power ${ratio.toFixed(2)}×` });
    },
  },
  'Icon 2D Art': {
    produce: (e) => ({ data: { selected: 0, prompt: 'weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon' }, ueAssets: [itemAsset(e, 'T_', '_Icon')] }),
    accept: (data) => {
      const sel = data.selected;
      return withCopy('Icon 2D Art', data, { label: 'A main icon is selected', status: sel != null ? 'pass' : 'pending', detail: sel != null ? 'candidate · 256px' : 'none selected' });
    },
  },
  '3D Generation': {
    produce: (e) => ({ data: { tris: 4200, cap: 6000 }, ueAssets: [itemAsset(e, 'SM_')] }),
    accept: (data) => {
      const tris = Number(data.tris ?? 0), cap = Number(data.cap ?? 6000);
      return withCopy('3D Generation', data, { label: 'Mesh generated · tri count under LOD0 budget', status: tris > 0 && tris <= cap ? 'pass' : 'pending', detail: tris > 0 ? `${tris} / ${cap} tris` : 'no mesh' });
    },
  },
  'Material / Texture': {
    produce: (e) => ({ data: { maps: ['Albedo', 'Normal', 'ORM', 'Height'] }, ueAssets: [itemAsset(e, 'MI_')] }),
    accept: (data) => {
      const maps = (data.maps ?? []) as string[];
      const need = ['Albedo', 'Normal', 'ORM'];
      const ok = need.every((m) => maps.includes(m));
      return withCopy('Material / Texture', data, { label: 'Required PBR maps present (Albedo · Normal · ORM)', status: ok ? 'pass' : 'pending', detail: maps.length ? `${maps.length} maps` : '0 maps' });
    },
  },
  'Animations': {
    produce: (e) => ({ data: { clips: DEFAULT_ANIM_CLIPS }, ueAssets: [itemAsset(e, 'A_', '_Equip')] }),
    accept: (data) => {
      const clips = (data.clips ?? []) as unknown[];
      return withCopy('Animations', data, { label: 'Required clips present (Pickup · Equip)', status: clips.length >= 2 ? 'pass' : 'pending', detail: clips.length ? `${clips.length} clips` : '0 clips' });
    },
  },
  'VFX': {
    produce: (e) => ({ data: { cost: 0.4, cap: 0.8, variants: DEFAULT_VFX_VARIANTS }, ueAssets: [itemAsset(e, 'NS_', '_Use')] }),
    accept: (data) => {
      const variants = (data.variants ?? []) as unknown[];
      const cost = Number(data.cost ?? 0), cap = Number(data.cap ?? 0.8);
      return withCopy('VFX', data, { label: 'At least one VFX bound · GPU cost under budget', status: variants.length >= 1 && cost <= cap ? 'pass' : 'pending', detail: variants.length ? `${cost.toFixed(1)} / ${cap} ms` : 'no vfx' });
    },
  },
  'SFX': {
    produce: (e) => ({ data: { cues: DEFAULT_SFX_CUES }, ueAssets: [itemAsset(e, 'SC_')] }),
    accept: (data) => {
      const cues = (data.cues ?? []) as unknown[];
      return withCopy('SFX', data, { label: 'Required SFX events covered (pickup · equip · use)', status: cues.length >= 3 ? 'pass' : 'pending', detail: cues.length ? `${cues.length} cues` : '0 cues' });
    },
  },
  'Inventory UI Integration': {
    produce: () => ({ data: { slot: 'Weapon', wired: true } }),
    accept: (data) => {
      return withCopy('Inventory UI Integration', data, { label: 'Item renders in the inventory grid · slot category set', status: data.wired && data.slot ? 'pass' : 'pending', detail: data.wired ? `slot: ${data.slot}` : 'not wired' });
    },
  },
  'Tooltip / Compare': {
    produce: () => ({ data: { fields: 4, compare: true } }),
    accept: (data) => {
      const fields = Number(data.fields ?? 0);
      return withCopy('Tooltip / Compare', data, { label: 'Tooltip shows all required fields · compare vs equipped works', status: fields >= 4 && data.compare ? 'pass' : 'pending', detail: fields ? `${fields} fields · compare on` : 'not laid out' });
    },
  },
  'Test Gate': {
    produce: () => ({ data: { checks: DEFAULT_GATE_CHECKS, pass: true } }),
    accept: (data) => {
      const checks = (data.checks ?? []) as unknown[];
      const ok = data.pass === true;
      return withCopy('Test Gate', data, { label: 'All gate checks pass in the UE project', status: ok ? 'pass' : 'pending', detail: ok ? `${checks.length}/${checks.length} pass` : `0/${checks.length || 4}` });
    },
  },
  'UE Packaging': {
    produce: (e) => {
      const s = slug(e.name);
      const assets = [`DT_Items :: ${s}`, `T_${s}_Icon`, `SM_${s}`, `MI_${s}`, `A_${s}_Equip`, `NS_${s}_Use`];
      return { data: { assets }, ueAssets: assets.slice(1).map((x) => `${base(e)}${x}`) };
    },
    accept: (data) => {
      const assets = (data.assets ?? []) as unknown[];
      return withCopy('UE Packaging', data, { label: 'All produced assets packaged + committed to the UE project', status: assets.length >= 6 ? 'pass' : 'pending', detail: assets.length ? `${assets.length} assets` : 'not packaged' });
    },
  },
};

/** Ordered step names (matches the registry + pipeline). */
export const ITEM_STEP_NAMES = Object.keys(ITEM_STEP_SPECS);

/** Run every Items step for one entity — the worked "fully populated item" example.
 *  Steps that already have an artifact are SKIPPED: produce() is a
 *  whole-artifact replace, the generative steps keep their entire kept batch
 *  history inside data.genHistory, and the write-through sink persists the
 *  replacement to the server (hydrateEntity is add-only, so a wiped history
 *  is unrecoverable). Demo data must only fill gaps, never overwrite work. */
export function populateItemDemo(
  entity: LabEntity,
  produce: (entityId: string, step: string, out?: StepOutput) => void,
  hasArtifact?: (entityId: string, step: string) => boolean,
) {
  for (const step of ITEM_STEP_NAMES) {
    if (hasArtifact?.(entity.id, step)) continue;
    produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity));
  }
}
