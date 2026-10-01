/**
 * Combo link check — does pressing attack during hit N chain into hit N+1 in
 * THIS project? Pure; reads only the PoF bridge manifest (`AnimAssetEntry`).
 *
 * A chain is either a numbered montage series (AM_Combo1..N, grouped by stem,
 * ordered numerically) or one montage with 2+ sections (the same "chain" the
 * Feature Map tile counts in anim-metric-readings). The manifest carries
 * section NAMES but no section times, so in a sectioned montage the k-th combo
 * notify is attributed to link k and the link says so (`attribution: 'by-order'`).
 *
 * Window open = the first notify matching the shared combo/cancel rule
 * (`isComboWindowNotify`, the one timingsFromManifest uses); window close = the
 * montage end. Hit = the first hit/trace/damage notify (name or class — the
 * classes verification-rules.ts recognises). Target = DEFAULT_COMBAT.comboWindowMs.
 * A montage with no usable duration is never given seconds: its link is 'unread'.
 */

import type { AnimAssetEntry, AnimNotify } from '@/types/pof-bridge';
import { DEFAULT_COMBAT } from '@/lib/genome/defaults';
import { isComboWindowNotify } from '@/components/modules/core-engine/sub_animation/_shared/data';
import { buildMontagePrompt } from '@/lib/animation/montage-prompt';

export type ComboLinkVerdict = 'chains' | 'no-window' | 'opens-before-hit' | 'too-short' | 'unread';

export interface ComboLink {
  id: string;
  /** Node names: montage names in a series, section names in a sectioned montage. */
  from: string;
  to: string;
  /** The montage that owns this link's window (the from-side), and its asset path. */
  montage: string;
  montagePath: string;
  verdict: ComboLinkVerdict;
  /** Plain statement of what the verdict was derived from. */
  reason: string;
  attribution: 'montage' | 'by-order';
  durationSec?: number;
  windowOpenSec?: number;
  windowCloseSec?: number;
  windowSec?: number;
  hitSec?: number;
  /** The notify that opened the window, when one did. */
  notify?: string;
  targetSec: number;
}

export interface ComboChainNode { id: string; name: string; path: string; durationSec?: number }

export interface ComboChain {
  id: string;
  name: string;
  kind: 'series' | 'sections';
  nodes: ComboChainNode[];
  links: ComboLink[];
}

export interface SkippedMontage { name: string; path: string; reason: 'no duration' }

export interface ComboChainRead {
  chains: ComboChain[];
  /** How many `AnimMontage` entries the manifest carried. */
  montages: number;
  /** Chain members that could not be checked, never given a verdict. */
  skipped: SkippedMontage[];
}

/** The project's declared combo-window target, in seconds. */
export const COMBO_TARGET_SEC = DEFAULT_COMBAT.comboWindowMs / 1000;

const HIT_RE = /hit|trace|damage/i;
const SERIES_RE = /^(.*\D)(\d+)$/;
const EPS = 1e-9;

const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
const s2 = (sec: number) => `${sec.toFixed(2)}s`;
const isHitNotify = (n: AnimNotify) =>
  !isComboWindowNotify(n.name) && (HIT_RE.test(n.name) || HIT_RE.test(n.notifyClass ?? ''));

function usableDuration(a: AnimAssetEntry): number | undefined {
  const d = a.duration;
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : undefined;
}

/** Timed notifies of one kind inside the montage, earliest first. */
function timed(a: AnimAssetEntry, duration: number, pick: (n: AnimNotify) => boolean): AnimNotify[] {
  return (a.notifies ?? [])
    .filter((n) => pick(n) && n.time >= 0 && n.time <= duration)
    .sort((x, y) => x.time - y.time);
}

export interface LinkInput {
  id: string; from: string; to: string; asset: AnimAssetEntry;
  attribution: ComboLink['attribution'];
  open?: AnimNotify; hit?: AnimNotify; targetSec?: number;
}

/** Give one link its verdict, with the seconds and the basis it came from. */
export function checkLink(input: LinkInput): ComboLink {
  const { id, from, to, asset, attribution, open, hit } = input;
  const targetSec = input.targetSec ?? COMBO_TARGET_SEC;
  const montage = nameOf(asset.path);
  const durationSec = usableDuration(asset);
  const base = { id, from, to, montage, montagePath: asset.path, attribution, targetSec };
  const during = attribution === 'by-order' ? `section ${from} of ${montage}` : montage;

  if (durationSec === undefined) {
    return { ...base, verdict: 'unread', reason: `${montage} carries no usable duration in the manifest — nothing to check` };
  }
  const hitSec = hit?.time;
  if (!open) {
    const which = attribution === 'by-order' ? `has no combo notify for section ${from} (attributed by order)` : 'never opens a combo window';
    return { ...base, durationSec, hitSec, verdict: 'no-window', reason: `${montage} ${which}: attack pressed during ${during} cannot chain to ${to}` };
  }
  const windowOpenSec = open.time;
  const windowSec = durationSec - windowOpenSec;
  const seconds = { durationSec, hitSec, windowOpenSec, windowCloseSec: durationSec, windowSec, notify: open.name };
  if (hitSec !== undefined && windowOpenSec < hitSec) {
    return { ...base, ...seconds, verdict: 'opens-before-hit', reason: `${open.name} opens at ${s2(windowOpenSec)}, before the hit at ${s2(hitSec)}: the next attack can cut ${during} before it lands` };
  }
  if (windowSec + EPS < targetSec) {
    return { ...base, ...seconds, verdict: 'too-short', reason: `${open.name} at ${s2(windowOpenSec)} leaves ${s2(windowSec)} before ${montage} ends — under the ${s2(targetSec)} target` };
  }
  return { ...base, ...seconds, verdict: 'chains', reason: `${open.name} at ${s2(windowOpenSec)} keeps ${s2(windowSec)} open to the end of ${montage} (target ${s2(targetSec)})` };
}

function seriesChains(montages: AnimAssetEntry[]): ComboChain[] {
  const groups = new Map<string, { stem: string; members: { n: number; a: AnimAssetEntry }[] }>();
  for (const a of montages) {
    const m = SERIES_RE.exec(nameOf(a.path));
    if (!m) continue;
    const key = dirOf(a.path) + m[1];
    const g = groups.get(key) ?? { stem: m[1], members: [] };
    g.members.push({ n: Number(m[2]), a });
    groups.set(key, g);
  }
  const chains: ComboChain[] = [];
  for (const [key, g] of groups) {
    if (g.members.length < 2) continue;
    const ordered = g.members.sort((x, y) => x.n - y.n).map((x) => x.a);
    const links = ordered.slice(0, -1).map((a, i) => {
      const d = usableDuration(a);
      const from = nameOf(a.path);
      const to = nameOf(ordered[i + 1].path);
      return checkLink({
        id: `${from}->${to}`, from, to, asset: a, attribution: 'montage',
        open: d === undefined ? undefined : timed(a, d, (x) => isComboWindowNotify(x.name))[0],
        hit: d === undefined ? undefined : timed(a, d, isHitNotify)[0],
      });
    });
    const nodes = ordered.map((a) => ({ id: a.path, name: nameOf(a.path), path: a.path, durationSec: usableDuration(a) }));
    chains.push({ id: key, name: g.stem, kind: 'series', nodes, links });
  }
  return chains;
}

function sectionChain(a: AnimAssetEntry): ComboChain {
  const sections = a.sections ?? [];
  const d = usableDuration(a);
  const opens = d === undefined ? [] : timed(a, d, (x) => isComboWindowNotify(x.name));
  const hits = d === undefined ? [] : timed(a, d, isHitNotify);
  const montage = nameOf(a.path);
  const links = sections.slice(0, -1).map((from, k) => checkLink({
    id: `${montage}:${from}->${sections[k + 1]}`, from, to: sections[k + 1], asset: a,
    attribution: 'by-order', open: opens[k], hit: hits[k],
  }));
  const nodes = sections.map((s) => ({ id: `${a.path}#${s}`, name: s, path: a.path, durationSec: d }));
  return { id: a.path, name: montage, kind: 'sections', nodes, links };
}

/** Every combo chain the manifest's montages form, each link with its verdict. */
export function deriveComboChains(assets: AnimAssetEntry[] | null | undefined): ComboChainRead {
  const montages = (assets ?? []).filter((a) => a.assetType === 'AnimMontage');
  const chains = [
    ...seriesChains(montages),
    ...montages.filter((a) => (a.sections?.length ?? 0) >= 2).map(sectionChain),
  ];
  const skipped = new Map<string, SkippedMontage>();
  for (const c of chains) {
    for (const node of c.nodes) {
      if (node.durationSec === undefined && !skipped.has(node.path)) {
        skipped.set(node.path, { name: nameOf(node.path), path: node.path, reason: 'no duration' });
      }
    }
  }
  return { chains, montages: montages.length, skipped: [...skipped.values()] };
}

/**
 * The one CLI prompt that fixes a defective link, through the existing montage
 * contract (buildMontagePrompt). Names only the montage that owns the window.
 * A link that chains — or that could not be read — has nothing to fix: null.
 */
export function buildComboLinkFixPrompt(link: ComboLink): string | null {
  if (link.verdict === 'chains' || link.verdict === 'unread' || link.durationSec === undefined) return null;
  const target = s2(link.targetSec);
  const where = link.attribution === 'by-order' ? `the ${link.from} section of ${link.montage}` : link.montage;
  const latest = Math.max(0, link.durationSec - link.targetSec);
  const ask = {
    'no-window': `Add a ComboWindow AnimNotify to ${where} so attack input during it chains to ${link.to}.`,
    'opens-before-hit': `Move the ${link.notify ?? 'ComboWindow'} notify in ${where} from ${s2(link.windowOpenSec ?? 0)} to at or after the hit at ${s2(link.hitSec ?? 0)}.`,
    'too-short': `Move the ${link.notify ?? 'ComboWindow'} notify in ${where} earlier: it opens at ${s2(link.windowOpenSec ?? 0)} and leaves only ${s2(link.windowSec ?? 0)}.`,
  }[link.verdict];
  return buildMontagePrompt(link.montage, 'Attack', [
    `Combo link ${link.from} -> ${link.to} does not chain: ${link.reason}.`,
    ask,
    `Montage asset: ${link.montagePath} (duration ${s2(link.durationSec)}${link.hitSec !== undefined ? `, hit notify at ${s2(link.hitSec)}` : ''}).`,
    `The ComboWindow must open at or after the hit and stay open at least ${target} (DEFAULT_COMBAT.comboWindowMs) before the montage ends, i.e. open no later than ${s2(latest)}.`,
    link.attribution === 'by-order'
      ? 'Keep the section linking (CompositeSections + NextSectionName) as it is; PoF attributes the k-th ComboWindow notify to the k-th section link.'
      : '',
    `Edit only ${link.montagePath} and save it, so the PoF bridge manifest re-reads it and this link re-derives.`,
  ].filter(Boolean).join('\n'));
}
