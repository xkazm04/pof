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
 * The contract for every Items pipeline step: what its Produce writes (`produce`)
 * and how its Acceptance is derived from the persisted artifact (`accept`). The live
 * CliProduce buttons and the "Populate demo" action both call `produce`, so the
 * worked example and the interactive flow stay identical.
 */
export interface ItemStepSpec {
  produce: (entity: LabEntity) => StepOutput;
  accept: (art: LabStepArtifact | undefined) => Acceptance;
}

export const ITEM_STEP_SPECS: Record<string, ItemStepSpec> = {
  'Concept Brief': {
    produce: (e) => ({ data: { brief: brief(e) } }),
    accept: (a) => {
      const len = String(d(a).brief ?? '').length;
      return { label: 'Brief is at least 300 characters', status: len >= 300 ? 'pass' : 'pending', detail: `${len} / 300 chars` };
    },
  },
  'Attributes': {
    produce: () => ({ data: { stats: { Damage: 34, 'Attack Speed': 1.1, Weight: 3.4, Durability: 180, 'Crit Chance': 5, Range: 1.8, Stagger: 22, Value: 120 } } }),
    accept: (a) => {
      const stats = (d(a).stats ?? {}) as Record<string, unknown>;
      const have = ATTR_KEYS.filter((k) => stats[k] != null).length;
      return { label: 'All attributes populated per schema (Weapon)', status: have === ATTR_KEYS.length ? 'pass' : 'pending', detail: `${have} / ${ATTR_KEYS.length} populated` };
    },
  },
  'Economy': {
    produce: () => ({ data: { power: 102, target: 100, cost: 143, rarity: 'Uncommon' } }),
    accept: (a) => {
      const data = d(a);
      if (data.power == null) return { label: 'Power within ±10% of tier · price in curve', status: 'pending', detail: 'not tuned' };
      const power = Number(data.power), target = Number(data.target), cost = Number(data.cost);
      const ratio = cost / (power * RARITY_MULT);
      const ok = power >= target * 0.9 && power <= target * 1.1 && ratio >= 0.8 && ratio <= 1.2;
      return { label: 'Power within ±10% of tier · price in curve · no outliers', status: ok ? 'pass' : 'fail', detail: `power ${power}% · price/power ${ratio.toFixed(2)}×` };
    },
  },
  'Icon 2D Art': {
    produce: (e) => ({ data: { selected: 0, prompt: 'weathered steel longsword, leather grip, guild sigil, 3/4 view, game icon' }, ueAssets: [`${base(e)}T_${slug(e.name)}_Icon`] }),
    accept: (a) => {
      const sel = d(a).selected;
      return { label: 'A main icon is selected', status: sel != null ? 'pass' : 'pending', detail: sel != null ? 'candidate · 256px' : 'none selected' };
    },
  },
  '3D Generation': {
    produce: (e) => ({ data: { tris: 4200, cap: 6000 }, ueAssets: [`${base(e)}SM_${slug(e.name)}`] }),
    accept: (a) => {
      const tris = Number(d(a).tris ?? 0), cap = Number(d(a).cap ?? 6000);
      return { label: 'Mesh generated · tri count under LOD0 budget', status: tris > 0 && tris <= cap ? 'pass' : 'pending', detail: tris > 0 ? `${tris} / ${cap} tris` : 'no mesh' };
    },
  },
  'Material / Texture': {
    produce: (e) => ({ data: { maps: ['Albedo', 'Normal', 'ORM', 'Height'] }, ueAssets: [`${base(e)}MI_${slug(e.name)}`] }),
    accept: (a) => {
      const maps = (d(a).maps ?? []) as string[];
      const need = ['Albedo', 'Normal', 'ORM'];
      const ok = need.every((m) => maps.includes(m));
      return { label: 'Required PBR maps present (Albedo · Normal · ORM)', status: ok ? 'pass' : 'pending', detail: maps.length ? `${maps.length} maps` : '0 maps' };
    },
  },
  'Animations': {
    produce: (e) => ({ data: { clips: [['Pickup', '0.6s'], ['Equip', '0.8s'], ['Idle Loop', '2.0s'], ['Inspect', '1.4s']] }, ueAssets: [`${base(e)}A_${slug(e.name)}_Equip`] }),
    accept: (a) => {
      const clips = (d(a).clips ?? []) as unknown[];
      return { label: 'Required clips present (Pickup · Equip)', status: clips.length >= 2 ? 'pass' : 'pending', detail: clips.length ? `${clips.length} clips` : '0 clips' };
    },
  },
  'VFX': {
    produce: (e) => ({ data: { cost: 0.4, cap: 0.8, variants: [['Idle glow', 'small'], ['Equip flash', 'med'], ['Use trail', 'med']] }, ueAssets: [`${base(e)}NS_${slug(e.name)}_Use`] }),
    accept: (a) => {
      const variants = (d(a).variants ?? []) as unknown[];
      const cost = Number(d(a).cost ?? 0), cap = Number(d(a).cap ?? 0.8);
      return { label: 'At least one VFX bound · GPU cost under budget', status: variants.length >= 1 && cost <= cap ? 'pass' : 'pending', detail: variants.length ? `${cost.toFixed(1)} / ${cap} ms` : 'no vfx' };
    },
  },
  'SFX': {
    produce: (e) => ({ data: { cues: [['Pickup', '-14 LUFS'], ['Equip', '-13 LUFS'], ['Swing', '-12 LUFS']] }, ueAssets: [`${base(e)}SC_${slug(e.name)}`] }),
    accept: (a) => {
      const cues = (d(a).cues ?? []) as unknown[];
      return { label: 'Required SFX events covered (pickup · equip · use)', status: cues.length >= 3 ? 'pass' : 'pending', detail: cues.length ? `${cues.length} cues` : '0 cues' };
    },
  },
  'Inventory UI Integration': {
    produce: () => ({ data: { slot: 'Weapon', wired: true } }),
    accept: (a) => {
      const data = d(a);
      return { label: 'Item renders in the inventory grid · slot category set', status: data.wired && data.slot ? 'pass' : 'pending', detail: data.wired ? `slot: ${data.slot}` : 'not wired' };
    },
  },
  'Tooltip / Compare': {
    produce: () => ({ data: { fields: 4, compare: true } }),
    accept: (a) => {
      const data = d(a);
      const fields = Number(data.fields ?? 0);
      return { label: 'Tooltip shows all required fields · compare vs equipped works', status: fields >= 4 && data.compare ? 'pass' : 'pending', detail: fields ? `${fields} fields · compare on` : 'not laid out' };
    },
  },
  'Test Gate': {
    produce: () => ({ data: { checks: ['Stat/rules unit test', 'Equip + use in PIE', 'Visual QA (icon + mesh)', 'Performance budget'], pass: true } }),
    accept: (a) => {
      const data = d(a);
      const checks = (data.checks ?? []) as unknown[];
      const ok = data.pass === true;
      return { label: 'All gate checks pass in the UE project', status: ok ? 'pass' : 'pending', detail: ok ? `${checks.length}/${checks.length} pass` : `0/${checks.length || 4}` };
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
      return { label: 'All produced assets packaged + committed to the UE project', status: assets.length >= 6 ? 'pass' : 'pending', detail: assets.length ? `${assets.length} assets` : 'not packaged' };
    },
  },
};

/** Ordered step names (matches the registry + pipeline). */
export const ITEM_STEP_NAMES = Object.keys(ITEM_STEP_SPECS);

/** Run every Items step for one entity — the worked "fully populated item" example. */
export function populateItemDemo(entity: LabEntity, produce: (entityId: string, step: string, out?: StepOutput) => void) {
  for (const step of ITEM_STEP_NAMES) produce(entity.id, step, ITEM_STEP_SPECS[step].produce(entity));
}
