import type { Acceptance } from './StepFrame';
import type { LabEntity } from '../useLabCatalogData';
import type { LabStepArtifact, StepOutput } from '../labPipelineStore';

/** PascalCase, space-free asset slug for UE paths (Iron Longsword → IronLongsword). */
export function slug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '');
}
function base(entity: LabEntity): string {
  return `/Game/Items/${slug(entity.name)}/`;
}

const ATTR_KEYS = ['Damage', 'Attack Speed', 'Weight', 'Durability', 'Crit Chance', 'Range', 'Stagger', 'Value'];
const RARITY_MULT = 1.4; // expected gold per power point

function brief(entity: LabEntity): string {
  return `${entity.name} is a mid-tier martial weapon forged for frontline duelists. It favors disciplined, rhythmic strikes over raw burst — rewarding players who weave light and heavy attacks rather than mashing a single button. Visually it reads as weathered steel with a leather-wrapped grip and a faint guild sigil etched near the crossguard. Intended player feeling: dependable and earned — a soldier's tool, not a hero's relic.`;
}

const d = (art: LabStepArtifact | undefined) => (art?.data ?? {}) as Record<string, unknown>;

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
  accept: (art: LabStepArtifact | undefined) => Acceptance;
}

/* ── Plain-language reasons ─────────────────────────────────────────────── */

function briefCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const len = String(d(art).brief ?? '').length;
  if (len === 0) {
    return { why: 'No concept brief has been written yet — downstream art and economy steps have no tone to reference.',
      suggestion: 'Run Produce to draft a brief.' };
  }
  return { why: `The brief is too short (${len} chars) — under 300 chars rarely conveys tone or constraints clearly.`,
    suggestion: 'Re-run Produce to lengthen it past 300 characters.' };
}

function attributesCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const stats = (d(art).stats ?? {}) as Record<string, unknown>;
  const missing = ATTR_KEYS.filter((k) => stats[k] == null);
  if (missing.length === ATTR_KEYS.length) {
    return { why: 'No attributes have been authored yet — UE5 has no row data to drive damage, weight, or value.',
      suggestion: 'Run Produce to fill the attribute set from the brief.' };
  }
  return { why: `${missing.length} attribute(s) are still missing (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}).`,
    suggestion: 'Re-run Produce to fill the remaining fields.' };
}

function economyCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const data = d(art);
  if (data.power == null) {
    return { why: 'Power and price are not tuned — without them the item has no place on the loot curve.',
      suggestion: 'Run Produce to tune cost / rarity onto the price/power curve.' };
  }
  const power = Number(data.power), target = Number(data.target), cost = Number(data.cost);
  const ratio = cost / (power * RARITY_MULT);
  const powerOk = power >= target * 0.9 && power <= target * 1.1;
  const ratioOk = ratio >= 0.8 && ratio <= 1.2;
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

function iconCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  return d(art).selected != null
    ? { why: 'An icon is selected.', suggestion: '' }
    : { why: 'No icon candidate has been picked yet — the item has nothing to render in the inventory grid.',
        suggestion: 'Click one of the gallery tiles, or run Produce to generate fresh candidates.' };
}

function meshCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const tris = Number(d(art).tris ?? 0), cap = Number(d(art).cap ?? 6000);
  if (tris === 0) {
    return { why: 'No mesh has been generated yet — the inventory preview will fall back to an icon-only state.',
      suggestion: 'Run Produce to generate a base mesh and auto-LODs.' };
  }
  return { why: `Mesh exceeds the LOD0 budget (${tris} > ${cap} tris) — load times and draw cost will suffer.`,
    suggestion: 'Re-run Produce with a tighter retopo target.', fixDirection: `retopo under ${cap} triangles for LOD0` };
}

function materialCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const maps = (d(art).maps ?? []) as string[];
  const need = ['Albedo', 'Normal', 'ORM'];
  const missing = need.filter((m) => !maps.includes(m));
  if (maps.length === 0) {
    return { why: 'No PBR maps yet — the mesh has no surface to render.',
      suggestion: 'Run Produce to author the Albedo / Normal / ORM set.' };
  }
  return { why: `${missing.length === 1 ? 'The' : ''} ${missing.join(', ')} map${missing.length === 1 ? ' is' : 's are'} missing.`,
    suggestion: 'Re-run Produce to fill the missing PBR channels.' };
}

function animationsCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const clips = (d(art).clips ?? []) as unknown[];
  return clips.length === 0
    ? { why: 'No clips retargeted yet — the item cannot be picked up, equipped, or idled.',
        suggestion: 'Run Produce to retarget pickup / equip / idle from SK_Mannequin.' }
    : { why: `Only ${clips.length} clip(s) present — pickup and equip are required at minimum.`,
        suggestion: 'Re-run Produce to add the missing clips.' };
}

function vfxCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const variants = (d(art).variants ?? []) as unknown[];
  const cost = Number(d(art).cost ?? 0), cap = Number(d(art).cap ?? 0.8);
  if (variants.length === 0) {
    return { why: 'No Niagara variants exist — the item has no visual reactions.',
      suggestion: 'Run Produce to author the idle / equip / use variants.' };
  }
  return { why: `GPU cost (${cost.toFixed(1)}ms) sits over the ${cap}ms frame budget — performance regressions on lower tiers.`,
    suggestion: 'Re-run Produce with cheaper modules.',
    fixDirection: `keep GPU cost under ${cap}ms by reducing emitter counts` };
}

function sfxCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const cues = (d(art).cues ?? []) as unknown[];
  return cues.length === 0
    ? { why: 'No SoundCues imported — the item is silent on pickup, equip, and use.',
        suggestion: 'Run Produce to import a randomizing SoundCue set.' }
    : { why: `Only ${cues.length} cue(s) bound — pickup / equip / use coverage requires three.`,
        suggestion: 'Re-run Produce to fill the missing cues.' };
}

function inventoryCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const data = d(art);
  return data.wired
    ? { why: 'Wired to the inventory widget.', suggestion: '' }
    : { why: 'The item is not yet registered with the inventory widget — it will not appear in the grid.',
        suggestion: 'Run Produce to register slot rules and stack size.' };
}

function tooltipCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const data = d(art);
  const fields = Number(data.fields ?? 0);
  if (fields === 0) {
    return { why: 'No tooltip layout has been authored — hovering the item shows nothing.',
      suggestion: 'Run Produce to lay out the stat tooltip.' };
  }
  return { why: `Tooltip shows only ${fields} field(s) — four are required and compare-vs-equipped is off.`,
    suggestion: 'Re-run Produce to add the missing rows and enable compare.' };
}

function gateCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  return d(art).pass === true
    ? { why: 'All gate checks pass in the UE project.', suggestion: '' }
    : { why: 'The functional test has not been run, or the last run did not pass.',
        suggestion: 'Run Produce to dispatch the UE functional test.' };
}

function packagingCopy(art: LabStepArtifact | undefined): AcceptanceCopy {
  const assets = (d(art).assets ?? []) as unknown[];
  return assets.length === 0
    ? { why: 'Nothing has been packaged yet — the DT_Items row and referenced assets are missing.',
        suggestion: 'Run Produce after the upstream steps finish.' }
    : { why: `Only ${assets.length} of 6 expected assets packaged — the row is incomplete.`,
        suggestion: 'Re-run Produce once the upstream steps have all produced.' };
}

/** Public lookup so component code (or tests) can pull copy without a closure. */
export const ITEM_STEP_COPY: Record<string, (art: LabStepArtifact | undefined) => AcceptanceCopy> = {
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
function withCopy(step: string, art: LabStepArtifact | undefined, base: Acceptance): Acceptance {
  if (base.status === 'pass') return base;
  const copy = ITEM_STEP_COPY[step]?.(art);
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
    accept: (a) => {
      const len = String(d(a).brief ?? '').length;
      return withCopy('Concept Brief', a, { label: 'Brief is at least 300 characters', status: len >= 300 ? 'pass' : 'pending', detail: `${len} / 300 chars` });
    },
  },
  'Attributes': {
    produce: () => ({ data: { stats: { Damage: 34, 'Attack Speed': 1.1, Weight: 3.4, Durability: 180, 'Crit Chance': 5, Range: 1.8, Stagger: 22, Value: 120 } } }),
    accept: (a) => {
      const stats = (d(a).stats ?? {}) as Record<string, unknown>;
      const have = ATTR_KEYS.filter((k) => stats[k] != null).length;
      return withCopy('Attributes', a, { label: 'All attributes populated per schema (Weapon)', status: have === ATTR_KEYS.length ? 'pass' : 'pending', detail: `${have} / ${ATTR_KEYS.length} populated` });
    },
  },
  'Economy': {
    produce: () => ({ data: { power: 102, target: 100, cost: 143, rarity: 'Uncommon' } }),
    accept: (a) => {
      const data = d(a);
      if (data.power == null) return withCopy('Economy', a, { label: 'Power within ±10% of tier · price in curve', status: 'pending', detail: 'not tuned' });
      const power = Number(data.power), target = Number(data.target), cost = Number(data.cost);
      const ratio = cost / (power * RARITY_MULT);
      const ok = power >= target * 0.9 && power <= target * 1.1 && ratio >= 0.8 && ratio <= 1.2;
      return withCopy('Economy', a, { label: 'Power within ±10% of tier · price in curve · no outliers', status: ok ? 'pass' : 'fail', detail: `power ${power}% · price/power ${ratio.toFixed(2)}×` });
    },
  },
  'Icon 2D Art': {
    produce: (e) => ({ data: { selected: 0, prompt: 'weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon' }, ueAssets: [`${base(e)}T_${slug(e.name)}_Icon`] }),
    accept: (a) => {
      const sel = d(a).selected;
      return withCopy('Icon 2D Art', a, { label: 'A main icon is selected', status: sel != null ? 'pass' : 'pending', detail: sel != null ? 'candidate · 256px' : 'none selected' });
    },
  },
  '3D Generation': {
    produce: (e) => ({ data: { tris: 4200, cap: 6000 }, ueAssets: [`${base(e)}SM_${slug(e.name)}`] }),
    accept: (a) => {
      const tris = Number(d(a).tris ?? 0), cap = Number(d(a).cap ?? 6000);
      return withCopy('3D Generation', a, { label: 'Mesh generated · tri count under LOD0 budget', status: tris > 0 && tris <= cap ? 'pass' : 'pending', detail: tris > 0 ? `${tris} / ${cap} tris` : 'no mesh' });
    },
  },
  'Material / Texture': {
    produce: (e) => ({ data: { maps: ['Albedo', 'Normal', 'ORM', 'Height'] }, ueAssets: [`${base(e)}MI_${slug(e.name)}`] }),
    accept: (a) => {
      const maps = (d(a).maps ?? []) as string[];
      const need = ['Albedo', 'Normal', 'ORM'];
      const ok = need.every((m) => maps.includes(m));
      return withCopy('Material / Texture', a, { label: 'Required PBR maps present (Albedo · Normal · ORM)', status: ok ? 'pass' : 'pending', detail: maps.length ? `${maps.length} maps` : '0 maps' });
    },
  },
  'Animations': {
    produce: (e) => ({ data: { clips: [['Pickup', '0.6s'], ['Equip', '0.8s'], ['Idle Loop', '2.0s'], ['Inspect', '1.4s']] }, ueAssets: [`${base(e)}A_${slug(e.name)}_Equip`] }),
    accept: (a) => {
      const clips = (d(a).clips ?? []) as unknown[];
      return withCopy('Animations', a, { label: 'Required clips present (Pickup · Equip)', status: clips.length >= 2 ? 'pass' : 'pending', detail: clips.length ? `${clips.length} clips` : '0 clips' });
    },
  },
  'VFX': {
    produce: (e) => ({ data: { cost: 0.4, cap: 0.8, variants: [['Idle glow', 'small'], ['Equip flash', 'med'], ['Use trail', 'med']] }, ueAssets: [`${base(e)}NS_${slug(e.name)}_Use`] }),
    accept: (a) => {
      const variants = (d(a).variants ?? []) as unknown[];
      const cost = Number(d(a).cost ?? 0), cap = Number(d(a).cap ?? 0.8);
      return withCopy('VFX', a, { label: 'At least one VFX bound · GPU cost under budget', status: variants.length >= 1 && cost <= cap ? 'pass' : 'pending', detail: variants.length ? `${cost.toFixed(1)} / ${cap} ms` : 'no vfx' });
    },
  },
  'SFX': {
    produce: (e) => ({ data: { cues: [['Pickup', '-14 LUFS'], ['Equip', '-13 LUFS'], ['Swing', '-12 LUFS']] }, ueAssets: [`${base(e)}SC_${slug(e.name)}`] }),
    accept: (a) => {
      const cues = (d(a).cues ?? []) as unknown[];
      return withCopy('SFX', a, { label: 'Required SFX events covered (pickup · equip · use)', status: cues.length >= 3 ? 'pass' : 'pending', detail: cues.length ? `${cues.length} cues` : '0 cues' });
    },
  },
  'Inventory UI Integration': {
    produce: () => ({ data: { slot: 'Weapon', wired: true } }),
    accept: (a) => {
      const data = d(a);
      return withCopy('Inventory UI Integration', a, { label: 'Item renders in the inventory grid · slot category set', status: data.wired && data.slot ? 'pass' : 'pending', detail: data.wired ? `slot: ${data.slot}` : 'not wired' });
    },
  },
  'Tooltip / Compare': {
    produce: () => ({ data: { fields: 4, compare: true } }),
    accept: (a) => {
      const data = d(a);
      const fields = Number(data.fields ?? 0);
      return withCopy('Tooltip / Compare', a, { label: 'Tooltip shows all required fields · compare vs equipped works', status: fields >= 4 && data.compare ? 'pass' : 'pending', detail: fields ? `${fields} fields · compare on` : 'not laid out' });
    },
  },
  'Test Gate': {
    produce: () => ({ data: { checks: ['Stat/rules unit test', 'Equip + use in PIE', 'Visual QA (icon + mesh)', 'Performance budget'], pass: true } }),
    accept: (a) => {
      const data = d(a);
      const checks = (data.checks ?? []) as unknown[];
      const ok = data.pass === true;
      return withCopy('Test Gate', a, { label: 'All gate checks pass in the UE project', status: ok ? 'pass' : 'pending', detail: ok ? `${checks.length}/${checks.length} pass` : `0/${checks.length || 4}` });
    },
  },
  'UE Packaging': {
    produce: (e) => {
      const s = slug(e.name);
      const assets = [`DT_Items :: ${s}`, `T_${s}_Icon`, `SM_${s}`, `MI_${s}`, `A_${s}_Equip`, `NS_${s}_Use`];
      return { data: { assets }, ueAssets: assets.slice(1).map((x) => `${base(e)}${x}`) };
    },
    accept: (a) => {
      const assets = (d(a).assets ?? []) as unknown[];
      return withCopy('UE Packaging', a, { label: 'All produced assets packaged + committed to the UE project', status: assets.length >= 6 ? 'pass' : 'pending', detail: assets.length ? `${assets.length} assets` : 'not packaged' });
    },
  },
};

/** Ordered step names (matches the registry + pipeline). */
export const ITEM_STEP_NAMES = Object.keys(ITEM_STEP_SPECS);

/** Run every Items step for one entity — the worked "fully populated item" example. */
export function populateItemDemo(entity: LabEntity, produce: (entityId: string, step: string, out?: StepOutput) => void) {
  for (const step of ITEM_STEP_NAMES) produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity));
}
