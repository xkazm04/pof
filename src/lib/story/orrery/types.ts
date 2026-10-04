/**
 * Orrery — the wire contract between the pure model/layout core and the React surface.
 *
 * Ported from the winning prototype of the `storymap` design contest (variant A/3, "Orrery"),
 * chosen by the owner for its compactness and the smoothness of its navigation. The prototype's
 * `model.js` was already a pure function of the data; this file is its type contract.
 *
 * Nothing here is hard-coded to a node id, and nothing here touches the DOM.
 *
 * The input is a `pof.storygraph/1` document — see `docs/architecture/storygraph-standard.md`.
 */

import type { StoryEdgeKind, StoryGraph, StoryNode, StoryNodeKind } from '@/lib/story/types';

/** Index into `OrreryModel.R`. `-1` means "none"; the virtual dataset root sits at index `N`. */
export type NodeIx = number;

/** How a choice's options compare, once its writes and destinations are known. */
export type ChoiceClass =
  | 'ending-shaping' // some option moves a variable an ending condition reads
  | 'consequential' // some option moves a variable a guard reads
  | 'routing' // options land in different places but write nothing read later
  | 'decoration' // options write state nothing reads
  | 'false' // every option writes the same state AND lands in the same place
  | 'single'; // fewer than two wired options

export interface ChoiceFacts {
  cls: ChoiceClass;
  /**
   * How far apart this choice's options pull the world, as the SUM over variables of each
   * variable's option spread expressed as a share of its domain width, plus a small bonus when the
   * options also land in different places.
   *
   * This is the winner's definition, not a max. An earlier draft of this contract said "max across
   * any one variable"; the prototype sums, and the owner chose the prototype partly for how its
   * impact rim reads, so the rim's ranking is part of what was chosen. A choice that nudges six
   * variables should out-rank one that moves a single variable slightly harder.
   */
  spread: number;
  /** True when at least two options land on different nodes. */
  diverges: boolean;
  optionCount: number;
  wiredCount: number;
}

/** Reach for one node, by the producer's own cohort names. `null` = unmeasured, which is NOT zero. */
export type ReachRow = Readonly<Record<string, number>> | null;

export interface OrreryEdge {
  /** Index into the source document's `edges` array. */
  k: number;
  id: string;
  from: NodeIx;
  to: NodeIx;
  kind: StoryEdgeKind;
  raw: StoryGraph['edges'][number];
}

/**
 * One node, with everything the layout and the panel need precomputed.
 *
 * Polar fields (`u0`, `u1`, `depth`, `maxd`) are in *unit* space: `u` runs 0..1 around the wheel
 * and `depth` is the containment ring. The camera converts to screen; nothing else may.
 */
export interface OrreryNode {
  i: NodeIx;
  id: string;
  kind: StoryNodeKind;
  /** The profile's `nodeClasses` id, or '' when the node declares none. */
  cls: string;
  title: string;
  /** Position on the declared axis, or `null` when the document declares no axis. */
  axis: number | null;
  par: NodeIx;
  kids: NodeIx[];
  /** Non-containment children pinned to the hub (endings, templates, the entry). */
  docks: NodeIx[] | null;
  depth: number;
  /** Subtree weight — the share of the wheel this node's sector occupies. */
  w: number;
  u0: number;
  u1: number;
  /** Deepest descendant ring below this node. */
  maxd: number;
  text: string;
  lanes: readonly string[];
  reach: ReachRow;
  /**
   * Reach for a CONTAINER, derived post-order as the mean over its MEASURED descendants only.
   *
   * This is the one authority for the derived tint, and it exists so the surface never recomputes
   * it. It is what lets the wheel tell three states apart that look alike if you conflate them:
   * `reach === null && reachMean === null` is UNMEASURED (hatched), `reach` present with a 0 value
   * is MEASURED ZERO (drawn, dark), and `reach === null && reachMean !== null` is DERIVED from
   * measured children (tinted, and labelled as derived). Unmeasured is never zero.
   */
  reachMean: ReachRow;
  /** How many descendants of this node carry a real reach row. 0 means nothing below was measured. */
  reachMeasured: number;
  ch: ChoiceFacts | null;
  dock: boolean;
  virtual?: boolean;
  raw: StoryNode;
  nChoice: number;
  nFalse: number;
  nCos: number;
  impSum: number;
  impMax: number;
  nFlag: number;
  /** Audit reasons attached to this node, or `null` when it is clean. */
  flags: string[] | null;
  sib: number;
  cnt: OrreryCounts | null;
}

export interface OrreryCounts {
  nodes: number;
  choices: number;
  endings: number;
  lines: number;
}

export interface AuditGroup {
  id: string;
  title: string;
  /** Why this group exists, in the words a user would use. */
  why: string;
  severity: 'error' | 'warn' | 'info';
  items: { i: NodeIx; text: string }[];
}

/** Honesty flags read off the document itself, never assumed. */
export interface OrreryProvenance {
  /** No run pins a `graphHash`, so no reach figure is tied to a graph version. */
  unverified: boolean;
  /** The producer called its own numbers provisional. */
  provisional: boolean;
  /** The document says its prose is generated filler. */
  generated: boolean;
  runs: NonNullable<StoryGraph['evidence']>['runs'];
}

/**
 * Where one node sits on the lane x axis dial.
 *
 * `u`/`u1` are the node's START and END along the dial in unit space, so a container that spans six
 * days draws as an arc of six days rather than a one-day tick. `row`/`rows` are its packing slot
 * inside its lane track, so two items on the same day in one lane do not collide.
 */
export interface FlatItem {
  u: number;
  u1: number;
  lane: number;
  row: number;
  rows: number;
  /** Rim slot, for nodes that carry an impact spike. */
  slot?: number;
  slots?: number;
}

/** The lane x axis wheel, built only for documents that declare `profile.axis`. */
export interface FlatLayout {
  Rh: number;
  TH: number;
  outer: number;
  a0: number;
  per: number;
  /** The dial's CLOSING angle (`a0 + per * units`) — the one value a consumer cannot derive. */
  dayA: number;
  lanes: string[];
  items: Map<NodeIx, FlatItem>;
  RR: number;
}

/** Where a hub-docked node sits: its angle, its radius as a share of the hub, and its dot size. */
export interface DockPos {
  a: number;
  rad: number;
  size: number;
}

export interface OrreryModel {
  key: string;
  raw: StoryGraph;
  /** Node records, length N+1. The last entry is the virtual dataset root. */
  R: OrreryNode[];
  idx: Map<string, NodeIx>;
  /**
   * The display root — the node the wheel re-roots on at fit.
   *
   * Exposed because two consumers independently guessed it and disagreed: `order[0]` is correct,
   * `R.length - 1` is the UNUSED virtual record on any document with a single top-level node. One
   * authority, read by everyone.
   */
  root: NodeIx;
  /** Containment order, parents before children. */
  order: NodeIx[];
  /** Traversal edges only — `contains` and `influences` are excluded. */
  tr: OrreryEdge[];
  /** The impact layer. */
  infl: OrreryEdge[];
  out: OrreryEdge[][];
  inn: OrreryEdge[][];
  cohorts: string[];
  prov: OrreryProvenance;
  /** 98th-percentile choice spread, the reference the impact rim normalises against. */
  spreadRef: number;
  flat: FlatLayout | null;
  dockPos: Map<NodeIx, DockPos>;
  dockEnds: NodeIx[];
  dockTmpl: NodeIx[];
  dockEntry: NodeIx[];
  audit: AuditGroup[];
  auditTotal: number;
  topDecisions: NodeIx[];
  /** Guard: can this node be focused (does it have a sector)? */
  can: (i: NodeIx) => boolean;
}

/**
 * Build the whole model from a storygraph document. Pure: same input, same output, no DOM, no
 * globals, no clock. This is the one entry point the React surface calls.
 */
export declare function buildOrreryModel(raw: StoryGraph, key: string): OrreryModel;

/* ------------------------------------------------------------------ the camera */

/**
 * The ONE coordinate authority. Every screen<->world conversion in the surface passes through a
 * single instance; a second place doing its own trigonometry is the defect this type exists to
 * prevent.
 */
export interface OrreryCamera {
  cx: number;
  cy: number;
  scale: number;
  /** Which node the wheel is currently re-rooted on. */
  focus: NodeIx;
  rot: number;
}

export interface PolarPoint {
  r: number;
  a: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ the detail layer */

/**
 * The fourth level the owner asked for: on clicking a line, explain the situation it sits in,
 * what led here, and what it changes. Derived entirely from the model — never authored.
 */
export interface LineDetail {
  i: NodeIx;
  /** The containment chain from the dataset root down to this line. */
  situation: OrreryNode[];
  /** Immediate predecessors by traversal, with the edge that reaches this line. */
  predecessors: { node: OrreryNode; edge: OrreryEdge }[];
  /** Immediate successors by traversal. */
  successors: { node: OrreryNode; edge: OrreryEdge }[];
  /** What the edges into and out of this line write, and who later reads each variable. */
  impact: {
    variable: string;
    op: string;
    value: unknown;
    /** Nodes whose guards read this variable after this point; empty means nothing reads it. */
    readBy: NodeIx[];
    /** True when an ending condition reads this variable. */
    endingReads: boolean;
  }[];
  /** Influence edges touching this line. */
  influences: { node: OrreryNode; direction: 'in' | 'out' }[];
  reach: ReachRow;
  flags: string[] | null;
}

/** Pure. Builds the detail payload for one node; returns null when the index is out of range. */
export declare function buildLineDetail(model: OrreryModel, i: NodeIx): LineDetail | null;
