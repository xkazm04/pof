import { PRICE_RATIO, POWER_TOL_PCT } from '@/lib/catalog/acceptance/invariants';
import {
  ITEM_ATTR_SCHEMA,
  ITEM_ATTR_KEYS,
  ITEMS_BESPOKE_CHECKERS,
} from '@/lib/catalog/acceptance/itemsBespokeCheckers';
import { gradeGallerySelection } from '@/lib/catalog/acceptance/galleryArtifact';
import { readHistory } from './shared/genHistory';
import { useCatalogStore } from '@/stores/catalogStore';
import type { Acceptance } from './StepFrame';
import type { CheckerContext } from '@/lib/catalog/acceptance/types';
import type { LabEntity } from '../useLabCatalogData';
import type { StepOutput } from '../labPipelineStore';

/** PascalCase, space-free asset slug for UE paths (Iron Longsword → IronLongsword).
 *  Readable but LOSSY — every non-alnum char is dropped, so "Iron Sword",
 *  "Iron-Sword" and "Iron_Sword" all collapse to "IronSword". Use {@link entitySlug}
 *  for any real asset PATH so distinct entities can't collide onto one folder. */
export function slug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '');
}

/** Short, stable, path-safe token derived from an entity id — the disambiguator
 *  appended to a slug when a DISTINCT sibling entity would otherwise share the same
 *  (lossy) readable slug, and hence the same UE asset path. */
function idToken(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Entities registered in the same catalog as `entity` (empty when the entity
 *  isn't in the store — e.g. ad-hoc test entities), read non-reactively so the
 *  pure path helpers can detect a slug collision. */
function catalogSiblings(entityId: string): { id: string; name: string }[] {
  const byCatalog = useCatalogStore.getState().entitiesByCatalog;
  for (const entities of Object.values(byCatalog)) {
    if (entities[entityId]) return Object.values(entities).map((e) => ({ id: e.id, name: e.name }));
  }
  return [];
}

/** The asset-path slug for one entity. Readable in the common case
 *  (`Iron Sword → IronSword`); when a DISTINCT sibling entity in the same catalog
 *  sanitizes to the same readable slug (`"Iron-Sword"` vs `"Iron Sword"`), a stable
 *  id-derived token is appended (`IronSword-<token>`) so the two entities never
 *  share a `/Game/Items/<slug>/` asset path and overwrite each other's UE assets. */
export function entitySlug(entity: LabEntity): string {
  const readable = slug(entity.name);
  const collides = catalogSiblings(entity.id).some((s) => s.id !== entity.id && slug(s.name) === readable);
  return collides ? `${readable}-${idToken(entity.id)}` : readable;
}

/** Root UE content path for all catalog item assets. */
const ITEMS_ROOT = '/Game/Items';

/** UE asset folder for one item: `/Game/Items/<slug>/`. The single source of
 *  truth for the Items asset-path layout — reused by the step specs and ItemArt. */
export function base(entity: LabEntity): string {
  return `${ITEMS_ROOT}/${entitySlug(entity)}/`;
}

/** Full path for one item asset named `<prefix><slug><suffix>` — the convention
 *  every Items asset follows (e.g. `itemAsset(e, 'T_', '_Icon')` →
 *  `/Game/Items/<slug>/T_<slug>_Icon`). Computes the (collision-safe) slug once. */
export function itemAsset(entity: LabEntity, prefix: string, suffix = ''): string {
  const s = entitySlug(entity);
  return `${ITEMS_ROOT}/${s}/${prefix}${s}${suffix}`;
}

/**
 * The Weapon attribute schema — the single source of truth for the attribute key
 * list, display units, and Produce's default values. The Attributes View
 * (`ItemAttributes`) renders this table, and the spec's produce()/accept() derive
 * their key list + default stats from it, so the preview can't drift from what
 * Produce actually writes.
 */
export type { ItemAttr } from '@/lib/catalog/acceptance/itemsBespokeCheckers';
export { ITEM_ATTR_SCHEMA };
/** Attribute key list — derived from the schema; drives accept() / copy completeness. */
const ATTR_KEYS = ITEM_ATTR_KEYS;
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

/** Price/power band: cost must sit within the canon 0.8–1.2× band of the expected curve.
 *  Sourced from `proj-balance` via invariants.ts — never hardcoded here. */
export const PRICE_RATIO_BAND = { lo: PRICE_RATIO.min, hi: PRICE_RATIO.max } as const;
/** Power band: power must sit within canon ±POWER_TOL_PCT% of its tier target (proj-balance). */
export const POWER_BAND = { lo: 1 - POWER_TOL_PCT / 100, hi: 1 + POWER_TOL_PCT / 100 } as const;

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

/* ── Test Gate derivation ───────────────────────────────────────────────────
 * The gate's verdict is DERIVED from upstream sibling acceptance, never
 * fabricated (scan 2026-07-16 finding: produce() hard-coded `pass: true`, so
 * the gate could never fail — success theater). Each named check maps to the
 * upstream steps whose acceptance it actually verifies. */
export const GATE_CHECK_DEPS: Record<string, string[]> = {
  'Stat/rules unit test': ['Attributes', 'Economy'],
  'Equip + use in PIE': ['Animations', 'Inventory UI Integration'],
  'Visual QA (icon + mesh)': ['Icon 2D Art', '3D Generation', 'Material / Texture'],
  'Performance budget': ['3D Generation', 'VFX'],
};

/** One upstream step standing between a gate check and PASS, and its verdict. */
export interface GateBlocker {
  step: string;
  /** The upstream step's resolved status, or `missing` when it has no artifact at all. */
  status: string;
}

export interface GateCheckResult {
  name: string;
  ok: boolean;
  /**
   * The check is blocked ONLY by upstream steps that are themselves `deferred` — a
   * generator or runtime that has not run, which no local edit can resolve. It is not a
   * failure, and the gate must not report one: a `deferred` upstream makes the gate's own
   * verdict unobservable, exactly the L3 reading `GATE_DEFERRED_COPY` describes.
   */
  deferred: boolean;
  /** Human-readable blockers (`"Icon 2D Art (deferred)"`), for the log + banner detail. */
  blockedBy: string[];
  blockers: GateBlocker[];
}

/** Render one blocker for the checklist row / log / banner detail. */
function blockerLabel(b: GateBlocker): string {
  return `${b.step} (${b.status === 'missing' ? 'not produced' : b.status})`;
}

/**
 * Evaluate every gate check against the entity's sibling step artifacts
 * (step label → persisted data). A check passes only when ALL of its upstream
 * steps have an artifact whose own acceptance is `pass`. Shared by the Test
 * Gate accept(), the ItemTestGate view, and the log rendering so the badge,
 * checklist rows, and log can never disagree.
 */
export function deriveGateChecks(siblings: Record<string, Record<string, unknown>>): GateCheckResult[] {
  return DEFAULT_GATE_CHECKS.map((name) => {
    const deps = GATE_CHECK_DEPS[name] ?? [];
    const blockers: GateBlocker[] = [];
    for (const step of deps) {
      const data = siblings[step];
      if (!data) { blockers.push({ step, status: 'missing' }); continue; }
      const status = ITEM_STEP_SPECS[step]?.accept(data).status ?? 'pending';
      if (status !== 'pass') blockers.push({ step, status });
    }
    return {
      name,
      ok: blockers.length === 0,
      deferred: blockers.length > 0 && blockers.every((b) => b.status === 'deferred'),
      blockedBy: blockers.map(blockerLabel),
      blockers,
    };
  });
}

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
  /** `direction` — the operator's typed art direction, forwarded by `useStaticStep`
   *  (mirrors `StepSpec.produce`); optional on both sides, existing bodies ignore it. */
  produce: (entity: LabEntity, direction?: string) => StepOutput;
  /** Optional `ctx` (second arg) mirrors the shared `Checker` signature so a bespoke
   *  Items step can read siblings / resolve links; existing single-arg bodies are unaffected. */
  accept: (data: Record<string, unknown>, ctx?: CheckerContext) => Acceptance;
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

/**
 * Copy for a generative step whose SHAPE is satisfied but which owns no generated asset —
 * the `deferred` reading {@link gradeGeneratedAsset} / {@link gradeGallerySelection} produce.
 *
 * It exists because the old per-step copy said "nothing has been picked yet", which is a
 * different (and now wrong) failure: a candidate IS selected, it is just a deterministic
 * swatch the app drew itself. Saying "pick one" for a state no click can fix sends the
 * operator in a circle.
 */
function generatedAssetCopy(data: Record<string, unknown>, noun: string, generator: string): AcceptanceCopy {
  if (readHistory(data).batches.length === 0) {
    return {
      why: `No generation history is recorded for this step — nothing proves ${noun} was ever generated for this item.`,
      suggestion: 'Run Produce so the batch and its candidates are recorded, then re-grade.',
    };
  }
  return {
    why: `The selected candidate is a deterministic swatch preview, not ${noun} — there is no generated asset here to verify.`,
    suggestion: `Run the ${generator} so this step owns real art, then re-roll the gallery and select the produced candidate.`,
    fixDirection: `generate ${noun} for this item with the real generator, then select the produced candidate`,
  };
}

function iconCopy(data: Record<string, unknown>): AcceptanceCopy {
  if (data.selected == null) {
    return { why: 'No icon candidate has been picked yet — the item has nothing to render in the inventory grid.',
      suggestion: 'Click one of the gallery tiles, or run Produce to generate fresh candidates.' };
  }
  return generatedAssetCopy(data, 'an icon image', 'icon generator (gap-loop / the 2D provider script)');
}

function meshCopy(data: Record<string, unknown>): AcceptanceCopy {
  const tris = Number(data.tris ?? 0), cap = Number(data.cap ?? 6000);
  if (tris === 0) {
    return { why: 'No mesh has been generated yet — the inventory preview will fall back to an icon-only state.',
      suggestion: 'Run Produce to generate a base mesh and auto-LODs.' };
  }
  if (tris > cap) {
    return { why: `Mesh exceeds the LOD0 budget (${tris} > ${cap} tris) — load times and draw cost will suffer.`,
      suggestion: 'Re-run Produce with a tighter retopo target.', fixDirection: `retopo under ${cap} triangles for LOD0` };
  }
  return generatedAssetCopy(data, 'a mesh', 'mesh generator (Tripo / gap-loop)');
}

function materialCopy(data: Record<string, unknown>): AcceptanceCopy {
  const maps = (data.maps ?? []) as string[];
  const need = ['Albedo', 'Normal', 'ORM'];
  const missing = need.filter((m) => !maps.includes(m));
  if (maps.length === 0) {
    return { why: 'No PBR maps yet — the mesh has no surface to render.',
      suggestion: 'Run Produce to author the Albedo / Normal / ORM set.' };
  }
  if (missing.length > 0) {
    return { why: `${missing.length === 1 ? 'The' : ''} ${missing.join(', ')} map${missing.length === 1 ? ' is' : 's are'} missing.`,
      suggestion: 'Re-run Produce to fill the missing PBR channels.' };
  }
  return generatedAssetCopy(data, 'a texture set', 'texture generator (gap-loop / the material provider script)');
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
  const ran = data.ran === true || data.pass === true;
  if (!ran) {
    return { why: 'The functional test has not been run yet.',
      suggestion: 'Run Produce to dispatch the UE functional test.' };
  }
  return { why: 'One or more upstream steps have not passed their own acceptance — the gate derives its verdict from them and cannot pass while they fail.',
    suggestion: 'Fix the failing upstream steps (see the Checks panel), then the gate re-derives automatically.' };
}

/**
 * Copy for the Test Gate's DEFERRED reading — the gate was dispatched but nothing in
 * scope can supply its verdict (no sibling artifacts to derive from, and no recorded
 * UE functional-test result). It is an L3 runtime gate, so `deferred` (with this
 * reason) is its config-complete terminal status — never a silent `pending`.
 * See {@link ITEMS_SPEC_DUALITY} for why this mirrors the registry Items Test Gate.
 */
export const GATE_DEFERRED_COPY: AcceptanceCopy = {
  why: 'The gate was dispatched, but its verdict cannot be observed here: VSItemsDefinitionsTest has not reported, and no sibling step artifacts are in scope to derive the checks from.',
  suggestion: 'Produce the upstream steps (the gate then derives from them), or run VSItemsDefinitionsTest in the UE project.',
};

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
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('Attributes', data, ITEMS_BESPOKE_CHECKERS['Attributes'](data, ctx)),
  },
  'Economy': {
    // Judge-fleet fix 2026-07-07: the artifact carried bare power/cost with no curve, so
    // cost/power read as a raw 1.40 "violation" of the 0.8–1.2 band. The canon band governs
    // cost vs the EXPECTED-PRICE CURVE (expectedPrice = power × RARITY_MULT); the data now
    // states the curve so the governed ratio is explicit and auditable.
    produce: () => ({
      data: {
        power: 102,
        target: 100,
        cost: 143,
        rarity: 'Uncommon',
        expectedPrice: expectedPrice(102), // 102 × 1.4 = 143 gold (the loot-curve baseline)
        pricePowerRatio: Number(priceRatio(143, 102).toFixed(3)), // 1.001× — ON the curve
        curve: `expectedPrice = power × ${RARITY_MULT} (RARITY_MULT, gold per power point); the canon 0.8–1.2× band governs cost / expectedPrice, not raw cost / power`,
      },
    }),
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
    // Grades the SELECTED CANDIDATE, not the existence of an integer. The old gate was
    // `sel != null ? 'pass' : 'pending'` with the detail `"candidate · 256px"` — a resolution
    // claim about an image that need not exist; it is the exact integer-not-asset checker the
    // fleet deleted from all 47 registered gallery steps (see galleryArtifact.ts). This is
    // byte-identical to the REGISTERED `Icon 2D Art` checker (`selected('selected', …)`), so
    // the bespoke banner and the server re-grade can no longer disagree.
    accept: (data) => withCopy('Icon 2D Art', data, gradeGallerySelection(data, 'selected', 'A main icon is selected')),
  },
  '3D Generation': {
    produce: (e) => ({ data: { tris: 4200, cap: 6000 }, ueAssets: [itemAsset(e, 'SM_')] }),
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('3D Generation', data, ITEMS_BESPOKE_CHECKERS['3D Generation'](data, ctx)),
  },
  'Material / Texture': {
    produce: (e) => ({ data: { maps: ['Albedo', 'Normal', 'ORM', 'Height'] }, ueAssets: [itemAsset(e, 'MI_')] }),
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('Material / Texture', data, ITEMS_BESPOKE_CHECKERS['Material / Texture'](data, ctx)),
  },
  'Animations': {
    produce: (e) => ({ data: { clips: DEFAULT_ANIM_CLIPS }, ueAssets: [itemAsset(e, 'A_', '_Equip')] }),
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('Animations', data, ITEMS_BESPOKE_CHECKERS['Animations'](data, ctx)),
  },
  'VFX': {
    produce: (e) => ({ data: { cost: 0.4, cap: 0.8, variants: DEFAULT_VFX_VARIANTS }, ueAssets: [itemAsset(e, 'NS_', '_Use')] }),
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('VFX', data, ITEMS_BESPOKE_CHECKERS['VFX'](data, ctx)),
  },
  'SFX': {
    produce: (e) => ({ data: { cues: DEFAULT_SFX_CUES }, ueAssets: [itemAsset(e, 'SC_')] }),
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('SFX', data, ITEMS_BESPOKE_CHECKERS['SFX'](data, ctx)),
  },
  'Inventory UI Integration': {
    produce: () => ({ data: { slot: 'Weapon', wired: true } }),
    // Gate logic lives in the SERVER-IMPORTABLE checker so the on-screen verdict and the
    // produce-POST re-grade are the same function (see itemsBespokeCheckers.ts).
    accept: (data, ctx) => withCopy('Inventory UI Integration', data, ITEMS_BESPOKE_CHECKERS['Inventory UI Integration'](data, ctx)),
  },
  'Tooltip / Compare': {
    // Judge-fleet fix 2026-07-07: the old {fields:4, compare:true} stub carried nothing a
    // UI could render — the tooltip now ships real, entity-derived copy + affix lines.
    produce: (e) => ({
      data: {
        fields: 4,
        compare: true,
        tooltip: {
          displayName: e.name,
          typeLine: 'One-Handed Sword · Tier 2',
          statBlock: ['Damage 18–27 Physical', 'Attack Speed 1.25/s', 'DPS 28.1'],
          affixLines: ['+12 to Strength (prefix T3)', '+9% Attack Speed (suffix T3)', 'Gains +4 flat damage vs Burning enemies (implicit)'],
          flavor: 'Standard issue of the Ashen Order — the nicks along its spine were earned, not etched.',
          compareRule: 'hold SHIFT: green/red deltas vs the equipped weapon per stat row (DPS, EHP contribution, affix-by-affix)',
        },
      },
    }),
    accept: (data) => {
      const t = (data.tooltip ?? {}) as { displayName?: string; statBlock?: unknown[]; affixLines?: unknown[] };
      const ok = !!t.displayName && (t.statBlock?.length ?? 0) >= 3 && (t.affixLines?.length ?? 0) >= 1 && !!data.compare;
      return withCopy('Tooltip / Compare', data, { label: 'Tooltip carries renderable copy (name · stats · affixes) · compare vs equipped works', status: ok ? 'pass' : 'pending', detail: ok ? `${t.statBlock!.length} stat rows · ${t.affixLines!.length} affix lines · compare on` : 'tooltip copy missing' });
    },
  },
  'Test Gate': {
    // Produce records THAT the test ran — never the verdict. The verdict is
    // derived at accept time from sibling-step acceptance, so a badly-tuned or
    // incomplete item can actually fail the gate (previously `pass: true` was
    // hard-coded and the gate was pure success theater).
    produce: () => ({ data: { checks: DEFAULT_GATE_CHECKS, ran: true } }),
    accept: (data, ctx) => {
      const ran = data.ran === true || data.pass === true; // `pass` = legacy artifacts
      if (!ran) {
        return withCopy('Test Gate', data, { label: 'All gate checks pass in the UE project', status: 'pending', detail: `0/${DEFAULT_GATE_CHECKS.length}` });
      }
      // Derive the verdict from sibling acceptance when context is available.
      // Without ctx (or with an empty siblings map) fall back to the legacy
      // data-only reading — per CheckerContext's contract, a satisfied step is
      // never regressed purely because context wasn't provided.
      if (ctx && Object.keys(ctx.siblings).length > 0) {
        const results = deriveGateChecks(ctx.siblings);
        const passing = results.filter((r) => r.ok).length;
        const blocked = [...new Set(results.flatMap((r) => r.blockedBy))];
        const ok = passing === results.length;
        const blockedList = `${blocked.slice(0, 3).join(', ')}${blocked.length > 3 ? '…' : ''}`;
        if (ok) {
          return withCopy('Test Gate', data, {
            label: 'All gate checks pass in the UE project', status: 'pass', detail: `${passing}/${results.length} pass`,
          });
        }
        // Every remaining blocker is itself DEFERRED — a generator/runtime that has not run.
        // Nothing here failed, and nothing local can make it pass, so the gate's own verdict
        // is unobservable: `deferred` (L3) with a reason, not a `fail` the operator can't act
        // on. Rule 5 keeps holding — this is still a config-complete terminal status.
        if (results.every((r) => r.ok || r.deferred)) {
          return {
            label: 'All gate checks pass in the UE project',
            status: 'deferred',
            tier: 'L3',
            detail: `${passing}/${results.length} pass · awaiting ${blockedList}`,
            reason:
              `${results.length - passing} gate check(s) cannot be observed: every upstream step still ` +
              `blocking them is itself deferred (${blockedList}). Nothing failed — a generator or a ` +
              'runtime gate has to run before this gate can report.',
            ...GATE_DEFERRED_COPY,
          };
        }
        return withCopy('Test Gate', data, {
          label: 'All gate checks pass in the UE project',
          status: 'fail',
          detail: `${passing}/${results.length} pass · blocked by ${blockedList}`,
        });
      }
      const checks = (data.checks ?? DEFAULT_GATE_CHECKS) as unknown[];
      if (data.pass === true) {
        // Legacy artifacts recorded the verdict itself.
        return { label: 'All gate checks pass in the UE project', status: 'pass', detail: `${checks.length}/${checks.length} pass` };
      }
      // Rule 5: the gate RAN, so it must reach a terminal status. Without siblings to
      // derive from it is an L3 runtime gate with no observed verdict — `deferred` with a
      // reason, exactly like the registry Items Test Gate (`entityRuntimeDeferred`).
      // A silent `pending` here was the reference pipeline's one Rule-5 violation.
      return {
        label: 'All gate checks pass in the UE project',
        status: 'deferred',
        tier: 'L3',
        detail: `${checks.length} checks dispatched · verdict not observed`,
        reason: 'VSItemsDefinitionsTest has not reported and no sibling artifacts are in scope to derive the checks from',
        ...GATE_DEFERRED_COPY,
      };
    },
  },
  'UE Packaging': {
    produce: (e) => {
      const s = entitySlug(e);
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
