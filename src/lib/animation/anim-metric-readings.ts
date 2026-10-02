/**
 * Animation Feature Map tiles — one pure projection of the PoF bridge manifest.
 *
 * Every tile beside a feature card is a READING of the project, a DECLARED
 * target, or a stated UNREAD with its reason — never a fixture constant. The
 * tiles used to print module-load counts of invented arrays ('10 montages',
 * '4 notifies', '29 states'), which could sit next to an Auto-Verify status
 * computed from this same manifest and contradict it.
 *
 * What the manifest carries (`AnimAssetEntry`): assetType, duration, notifies,
 * sections, stateMachines. What it does not: transition frequency, a root
 * motion flag, play rate, asset size, bone count — those tiles stay unread.
 */

import type { AssetManifest, AnimAssetEntry } from '@/types/pof-bridge';
import { BUDGET_LIMITS } from '@/components/modules/core-engine/sub_animation/_shared/data';

/** The animation Feature Map section ids that carry a tile (feature-map-config order). */
export const ANIM_METRIC_IDS = [
  'states', 'transitions', 'heatmap', 'chain', 'montages',
  'scrubber', 'skeleton', 'trajectories', 'assets', 'playrate',
] as const;

export type AnimMetricId = (typeof ANIM_METRIC_IDS)[number];

export type AnimMetricReading =
  | { kind: 'measured'; value: string; detail?: string; source: 'bridge'; projectName?: string }
  | { kind: 'target'; value: string; detail: string }
  | { kind: 'unread'; reason: string };

export type AnimMetricReadings = Record<AnimMetricId, AnimMetricReading>;

export function isAnimMetricId(id: string): id is AnimMetricId {
  return (ANIM_METRIC_IDS as readonly string[]).includes(id);
}

const unread = (reason: string): AnimMetricReading => ({ kind: 'unread', reason });

/** The manifest never carries these facts, connected or not. */
const NEVER_IN_MANIFEST = {
  heatmap: 'manifest carries no transition frequency',
  trajectories: 'manifest carries no root motion flag',
  playrate: 'manifest carries no play rate',
} as const;

function skeletonTarget(): AnimMetricReading {
  const bones = BUDGET_LIMITS.find((l) => l.label === 'Bone Count');
  return bones
    ? { kind: 'target', value: `≤${bones.target}`, detail: 'bone budget · usage unread' }
    : unread('no bone budget declared');
}

function readConnected(assets: AnimAssetEntry[], projectName: string | undefined): AnimMetricReadings {
  const measured = (value: number, detail?: string): AnimMetricReading => ({
    kind: 'measured', value: String(value), ...(detail ? { detail } : {}), source: 'bridge', projectName,
  });

  const montages = assets.filter((a) => a.assetType === 'AnimMontage');
  const notifies = assets.flatMap((a) => a.notifies ?? []);
  const classes = new Set(notifies.map((n) => n.notifyClass)).size;
  const chains = montages.filter((m) => (m.sections?.length ?? 0) >= 2);
  const depth = chains.reduce((max, m) => Math.max(max, m.sections?.length ?? 0), 0);
  const machines = assets
    .filter((a) => a.assetType === 'AnimBlueprint')
    .flatMap((a) => a.stateMachines ?? []);
  const noMachine = unread('no state machine in the manifest');

  return {
    states: machines.length
      ? measured(machines.reduce((n, m) => n + m.states.length, 0), `${machines.length} ${machines.length === 1 ? 'machine' : 'machines'}`)
      : noMachine,
    transitions: machines.length ? measured(machines.reduce((n, m) => n + m.transitions.length, 0)) : noMachine,
    heatmap: unread(NEVER_IN_MANIFEST.heatmap),
    chain: measured(chains.length, chains.length ? `depth ${depth}` : 'no montage has 2+ sections'),
    montages: measured(montages.length),
    scrubber: measured(notifies.length, `${classes} ${classes === 1 ? 'class' : 'classes'}`),
    skeleton: skeletonTarget(),
    trajectories: unread(NEVER_IN_MANIFEST.trajectories),
    assets: measured(assets.length, 'size unread'),
    playrate: unread(NEVER_IN_MANIFEST.playrate),
  };
}

/**
 * Project the manifest onto the 10 tiles. A manifest is read only while the
 * bridge is connected (the same rule the Responsiveness Analyzer follows).
 */
export function readAnimMetrics(manifest: AssetManifest | null, isConnected: boolean): AnimMetricReadings {
  if (isConnected && manifest) return readConnected(manifest.animAssets ?? [], manifest.projectName);
  const reason = isConnected ? 'manifest not loaded yet' : 'bridge not connected';
  const out = {} as AnimMetricReadings;
  for (const id of ANIM_METRIC_IDS) out[id] = unread(reason);
  out.skeleton = skeletonTarget();
  return out;
}
