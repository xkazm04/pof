'use client';

import { useMemo } from 'react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_NEUTRAL } from '@/lib/chart-colors';
import { useManifest } from '@/hooks/useManifest';
import {
  deriveComboChains, COMBO_TARGET_SEC,
  type ComboChain, type ComboLink, type ComboLinkVerdict, type SkippedMontage,
} from '@/lib/animation/combo-links';
import { COMBO_CHAIN_NODES, COMBO_CHAIN_EDGES } from '../_shared/data';

/** One drawn node: a montage, a section, or (template) a fixture attack. */
export interface ComboGraphNode {
  id: string;
  name: string;
  /** Second SVG line. */
  sub: string;
  /** Third SVG line (template damage only — the manifest carries no damage). */
  badge?: string;
  /** Lines for the selected-node card. */
  detail: string[];
}

export interface ComboGraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  /** The derived link; absent on the template, which has no verdicts. */
  link?: ComboLink;
}

export interface ComboGraph { id: string; title: string; nodes: ComboGraphNode[]; edges: ComboGraphEdge[] }

export type ComboChainsView =
  | {
    source: 'bridge'; graphs: ComboGraph[]; skipped: SkippedMontage[]; montages: number;
    projectName?: string; byOrder: boolean; targetSec: number;
  }
  | { source: 'template'; graphs: ComboGraph[]; reason: string };

export const VERDICT_COLOR: Record<ComboLinkVerdict, string> = {
  'chains': STATUS_SUCCESS,
  'no-window': STATUS_ERROR,
  'opens-before-hit': STATUS_WARNING,
  'too-short': STATUS_WARNING,
  'unread': STATUS_NEUTRAL,
};

const s2 = (sec: number) => sec.toFixed(2);

/** The edge label: the derived window in seconds, or what stands in its place. */
export function windowLabel(link: ComboLink): string {
  if (link.windowOpenSec !== undefined && link.windowCloseSec !== undefined) {
    return `${s2(link.windowOpenSec)}–${s2(link.windowCloseSec)}s`;
  }
  return link.verdict === 'unread' ? 'no duration' : 'no window';
}

function graphOf(chain: ComboChain): ComboGraph {
  const total = chain.nodes.length;
  const nodes = chain.nodes.map((node, i): ComboGraphNode => {
    const dur = node.durationSec !== undefined ? `${s2(node.durationSec)}s` : 'no duration';
    return chain.kind === 'series'
      ? { id: node.id, name: node.name, sub: dur, detail: [`Path: ${node.path}`, `Duration: ${dur}`] }
      : { id: node.id, name: node.name, sub: chain.name, detail: [`Montage: ${node.path}`, `Section ${i + 1} of ${total}`] };
  });
  const idOf = (name: string) => chain.nodes.find((n) => n.name === name)?.id ?? name;
  const edges = chain.links.map((link) => ({
    id: link.id, from: idOf(link.from), to: idOf(link.to), label: windowLabel(link), link,
  }));
  const kind = chain.kind === 'series' ? 'montage series' : 'sections, windows attributed by order';
  return { id: chain.id, title: `${chain.name} — ${kind}`, nodes, edges };
}

const TEMPLATE_GRAPH: ComboGraph = {
  id: 'template',
  title: 'Template chain',
  nodes: COMBO_CHAIN_NODES.map((n) => ({
    id: n.id, name: n.name, sub: n.montage, badge: `${n.damage} dmg`,
    detail: [`Montage: ${n.montage}`, `Damage: ${n.damage}`],
  })),
  edges: COMBO_CHAIN_EDGES.map((e) => ({ id: `${e.from}->${e.to}`, from: e.from, to: e.to, label: e.window })),
};

/**
 * The Combos & Montages tab's one read model: the project's combo chains from
 * the bridge manifest, or the labelled template when no usable chain arrives.
 * Read only while connected — the rule ResponsivenessAnalyzer follows.
 */
export function useComboChains(): ComboChainsView {
  const { manifest, isConnected } = useManifest();
  return useMemo((): ComboChainsView => {
    if (!isConnected || !manifest) {
      return { source: 'template', graphs: [TEMPLATE_GRAPH], reason: isConnected ? 'manifest not loaded yet' : 'bridge not connected' };
    }
    const read = deriveComboChains(manifest.animAssets);
    if (read.chains.length === 0) {
      return {
        source: 'template', graphs: [TEMPLATE_GRAPH],
        reason: `no combo chain among the ${read.montages} montage${read.montages === 1 ? '' : 's'} in the manifest`,
      };
    }
    return {
      source: 'bridge',
      graphs: read.chains.map(graphOf),
      skipped: read.skipped,
      montages: read.montages,
      projectName: manifest.projectName,
      byOrder: read.chains.some((c) => c.kind === 'sections'),
      targetSec: COMBO_TARGET_SEC,
    };
  }, [isConnected, manifest]);
}

/** Every node the graph draws, in draw order — the tab's chips list exactly these. */
export function chainNodes(view: ComboChainsView): ComboGraphNode[] {
  return view.graphs.flatMap((g) => g.nodes);
}
