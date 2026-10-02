/**
 * Scene-decompose manifest → the set-dressing plan an operator reviews before a blockout.
 *
 * `POST /api/visual-gen/scene-decompose` returns three parallel lists (the VLM's props, the
 * sized composition assets, the solver's placed/unplaced instances) plus a crop gate keyed
 * by ASSET. Nothing joined them, so a placed instance could not say how big it is, what it
 * is made of, what it weighs or whether its crop passed. This is that join, pure.
 *
 * Honesty rules the join keeps:
 * - material and mass are READ from the instance's own `phys_` / `mass_kg_` UE tags — the
 *   same tags a spawn script reads — never recomputed from size, so the table cannot
 *   disagree with what gets spawned; a missing tag is `null`, not a default;
 * - a gate row that did not run is `not run` with its note; an asset with no gate row at
 *   all is `not gated`. Neither is ever shown as a pass;
 * - unplaced instances keep the solver's reason: the plan never silently shrinks.
 */
import type { DecomposedProp } from '@/lib/visual-gen/generators/scene-decompose';
import type {
  CompositionAsset,
  PlacedProp,
  UnplacedProp,
} from '@/lib/visual-gen/generators/composition';

/** One asset's Tier-0 crop gate, as the route reports it. */
export interface SceneDecomposeCropGate {
  id: string;
  ran: boolean;
  verdict?: 'pass' | 'warn' | 'fail';
  score?: number;
  reasons?: string[];
  /** Set when the gate could not run (a throw), as opposed to never being asked. */
  unavailable?: boolean;
  note: string;
}

/** The route's `data`. */
export interface SceneDecomposeData {
  props: DecomposedProp[];
  skipped?: number;
  assets: CompositionAsset[];
  composition: {
    props: Array<PlacedProp & { ueActorTags: string[] }>;
    unplaced: UnplacedProp[];
  };
  gate: SceneDecomposeCropGate[];
  /** Present on an honest empty answer (the model looked and found nothing movable). */
  note?: string;
}

export type DressGateLabel = 'pass' | 'warn' | 'fail' | 'not run' | 'not gated';

export interface DressGate {
  label: DressGateLabel;
  score?: number;
  note?: string;
}

export interface DressRow {
  instanceId: string;
  assetId: string;
  name: string;
  /** Composition-local cm; `z` is the prop's BASE. */
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  stackIndex: number;
  supportedBy: string | null;
  /** Bounding extents in cm, [x, y, z]. */
  sizeCm: readonly [number, number, number];
  material: string | null;
  massKg: number | null;
  ueActorTags: string[];
  gate: DressGate;
}

export interface DressUnplacedRow {
  assetId: string;
  name: string;
  reason: string;
  gate: DressGate;
}

export interface DressGateSummary {
  pass: number;
  warn: number;
  fail: number;
  notRun: number;
  notGated: number;
}

export interface DressPlan {
  placed: DressRow[];
  unplaced: DressUnplacedRow[];
  /** Counted per ASSET — the route runs one gate call per asset, not per instance. */
  gateSummary: DressGateSummary;
  note: string | null;
}

const NOT_GATED: DressGate = { label: 'not gated' };
const FALLBACK_SIZE: readonly [number, number, number] = [100, 100, 100];

function gateOf(row: SceneDecomposeCropGate | undefined): DressGate {
  if (!row) return NOT_GATED;
  if (!row.ran || !row.verdict) return { label: 'not run', note: row.note };
  return { label: row.verdict, score: row.score, note: row.note };
}

function tagValue(tags: readonly string[], prefix: string): string | null {
  const hit = tags.find((t) => t.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function massOf(tags: readonly string[]): number | null {
  const raw = tagValue(tags, 'mass_kg_');
  const n = raw === null ? NaN : Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function toDressPlan(data: SceneDecomposeData): DressPlan {
  const assetById = new Map(data.assets.map((a) => [a.id, a] as const));
  const propById = new Map(data.props.map((p) => [p.id, p] as const));
  const gateById = new Map(data.gate.map((g) => [g.id, g] as const));
  const nameOf = (assetId: string) =>
    assetById.get(assetId)?.name ?? propById.get(assetId)?.name ?? assetId;

  const placed: DressRow[] = data.composition.props.map((p) => ({
    instanceId: p.id,
    assetId: p.assetId,
    name: nameOf(p.assetId),
    x: p.x,
    y: p.y,
    z: p.z,
    yawDeg: p.yaw,
    stackIndex: p.stackIndex,
    supportedBy: p.supportedBy,
    sizeCm: assetById.get(p.assetId)?.size ?? FALLBACK_SIZE,
    material: tagValue(p.ueActorTags, 'phys_'),
    massKg: massOf(p.ueActorTags),
    ueActorTags: p.ueActorTags,
    gate: gateOf(gateById.get(p.assetId)),
  }));

  const unplaced: DressUnplacedRow[] = data.composition.unplaced.map((u) => ({
    assetId: u.assetId,
    name: nameOf(u.assetId),
    reason: u.reason,
    gate: gateOf(gateById.get(u.assetId)),
  }));

  const gateSummary: DressGateSummary = { pass: 0, warn: 0, fail: 0, notRun: 0, notGated: 0 };
  const assetIds = data.assets.length ? data.assets.map((a) => a.id) : data.props.map((p) => p.id);
  for (const id of assetIds) {
    const { label } = gateOf(gateById.get(id));
    if (label === 'not run') gateSummary.notRun++;
    else if (label === 'not gated') gateSummary.notGated++;
    else gateSummary[label]++;
  }

  return { placed, unplaced, gateSummary, note: data.note ?? null };
}
