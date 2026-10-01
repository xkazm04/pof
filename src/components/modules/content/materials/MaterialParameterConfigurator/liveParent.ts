import type { MaterialEntry, MaterialParameter } from '@/types/pof-bridge';
import type { ParamDef, ParentMaterialRef, ParentScalar } from './types';
import { BASE_PARAMS } from './constants';

/**
 * A live UE master as the parent of a generated Material Instance.
 *
 * The bridge manifest is the authority: which materials are masters
 * (`parentMaterial === null`) and which parameters each exposes (name, type,
 * default, range). Nothing here invents a parameter or a default the engine did
 * not report — a non-numeric scalar default stays `null`.
 */

type MasterLike = Pick<MaterialEntry, 'path' | 'parentMaterial' | 'materialInstances'>;

/** Paths of the masters in `materials`, most-instanced first (stable for ties). */
export function masterCandidates(materials: readonly MasterLike[]): string[] {
  return materials
    .filter((m) => m.parentMaterial === null)
    .map((m, i) => ({ path: m.path, n: m.materialInstances.length, i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((m) => m.path);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** A slider range that always contains the default and always has a positive width. */
function scalarOf(p: MaterialParameter): ParentScalar {
  const d = finite(p.defaultValue) ? p.defaultValue : null;
  let min = finite(p.min) ? p.min : Math.min(0, d ?? 0);
  let max = finite(p.max) ? p.max : (d === null || (d >= 0 && d <= 1) ? 1 : Math.max(1, Math.abs(d) * 2));
  if (d !== null) {
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  if (max <= min) max = min + 1;
  return { name: p.name, min, max, defaultValue: d, step: (max - min) / 100 };
}

function namesOf(entry: MaterialEntry, type: MaterialParameter['type']): string[] {
  return entry.parameters.filter((p) => p.type === type).map((p) => p.name);
}

/** The parent reference a generated instance carries: its path and exact parameter set. */
export function toParentRef(entry: MaterialEntry): ParentMaterialRef {
  return {
    path: entry.path,
    scalars: entry.parameters.filter((p) => p.type === 'ScalarParameter').map(scalarOf),
    vectors: namesOf(entry, 'VectorParameter'),
    textures: namesOf(entry, 'TextureParameter'),
    switches: namesOf(entry, 'StaticSwitchParameter'),
  };
}

/** The numeric defaults a freshly adopted parent's sliders start from. */
export function parentParamDefaults(parent: ParentMaterialRef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of parent.scalars) if (s.defaultValue !== null) out[s.name] = s.defaultValue;
  return out;
}

/**
 * The parent's scalars as sliders. A name the configurator already decodes
 * (Roughness, Metallic, …) keeps its plain-language decoder; any other gets a
 * generic one naming the parent. A slider without a manifest default rests at
 * its minimum but dispatches nothing until it is moved.
 */
export function parentParamDefs(parent: ParentMaterialRef): ParamDef[] {
  const asset = parent.path.split('/').pop() ?? parent.path;
  return parent.scalars.map((s) => {
    const known = BASE_PARAMS.find((p) => p.name === s.name);
    return {
      name: s.name,
      label: s.name,
      min: s.min,
      max: s.max,
      defaultValue: s.defaultValue ?? s.min,
      step: s.step,
      plain: known?.plain ?? {
        label: s.name,
        explanation: `A scalar the ${asset} master exposes; the instance overrides it.`,
        cue: 'level',
        lowLabel: 'Low',
        highLabel: 'High',
      },
    };
  });
}
