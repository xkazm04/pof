/**
 * Scene decomposition — one scene image → the prop list the composition solver consumes.
 *
 * PoF has the placer and not the planner: `generateComposition` takes `assets` as INPUT,
 * and nothing produced that list. This is the producer half, with an IMAGE as the input
 * modality: a VLM enumerates the distinct extractable props in a concept/reference scene,
 * each with a normalized bounding box (so the region can be cropped for a per-prop Tier-0
 * gate) and an estimated real-world size (so the solver's footprint rules mean something).
 *
 * Pure cores (prompt / parse / map) over the established vision seam
 * `(images, prompt) => Promise<string>` — the same shape `input-gate.ts` uses, so the
 * DashScope Qwen-VL default is injectable and this file is testable without a key.
 *
 * What this deliberately does NOT do: generate anything. It plans. Sourcing each prop
 * (library hit, else the 2D→3D chain) is a separate step and stays that way.
 */
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeQwenVision } from '@/lib/anim-critique/qwen';
import type { CompositionAsset } from './composition';
import { affordanceForSize } from './placement-tags';
import { MATERIAL_DENSITIES, DEFAULT_PHYSICAL, type PhysicsMaterial } from './physical-tags';

/** Normalized image-space box, origin top-left, all components in 0..1. */
export interface NormalizedBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface DecomposedProp {
  /** Slug of the name; unique within one decomposition. */
  id: string;
  name: string;
  box: NormalizedBox;
  /** Estimated longest real-world dimension, cm. */
  longestCm: number;
  /** How many of this prop the scene shows. */
  count: number;
  /**
   * What the prop is made of, for the physical contract. Asking the VLM is the only way
   * this is ever anything but `default`: material cannot be inferred from a bounding box,
   * and without it the whole density table is inert in the wired path.
   */
  material: PhysicsMaterial;
}

export interface DecomposeReply {
  ok: boolean;
  props: DecomposedProp[];
  /** Rows that looked like a prop row but failed validation. */
  skipped: number;
  /**
   * Whether the vision call itself completed. This is the distinction `input-gate.ts`
   * already draws and it matters just as much here: a scene that HONESTLY contains no
   * movable props (terrain, architecture and foliage only) is a valid answer, not a
   * failure, and must not be reported as an outage. `ran: false` means we learned
   * nothing; `ran: true` with no props means we looked and there was nothing to take.
   */
  ran: boolean;
  error?: string;
}

const MATERIALS = Object.keys(MATERIAL_DENSITIES) as PhysicsMaterial[];

/** Beyond this a "count" is a texture, not a prop set worth spawning individually. */
const MAX_COUNT = 24;

export function buildSceneDecomposePrompt(hint?: string): string {
  return (
    'This image is a reference for a game scene' +
    (hint ? ` (${hint})` : '') +
    '. List every distinct EXTRACTABLE PROP — a discrete movable object a level artist ' +
    'would place as its own mesh (crates, barrels, tables, bottles, lanterns, crates, tools). ' +
    'EXCLUDE the background and anything that is not a placeable object: the ground, terrain, ' +
    'the sky, walls, ceilings, water, characters, creatures, and lighting effects. ' +
    // Added from a live run that returned "stairs" and "bush" as props and then stacked the
    // bush on the stairs: architecture is built, not placed, and foliage belongs to the
    // vegetation scatter generator, which has its own density and clustering rules.
    'Also EXCLUDE built ARCHITECTURE that is part of the structure rather than dressed onto ' +
    'it (stairs, steps, columns, arches, doorways, railings, platforms, roofs) and all ' +
    'VEGETATION (bushes, grass, trees, vines) — those are handled by other generators. ' +
    'If nothing in the image is a movable prop, return no rows at all rather than ' +
    'reclassifying scenery as props. ' +
    'Group identical repeated objects into ONE row and give the number seen as COUNT. ' +
    'For each prop give a normalized bounding box (x0,y0,x1,y1 as fractions of image width ' +
    'and height, origin at the TOP-LEFT, x0<x1 and y0<y1) tightly around one representative ' +
    'instance, and estimate its longest real-world dimension in centimetres. ' +
    'Reply with ONE LINE PER PROP and nothing else, EXACTLY as: ' +
    'PROP=<short name>; BOX=<x0>,<y0>,<x1>,<y1>; SIZE_CM=<integer>; COUNT=<integer>; ' +
    `MATERIAL=<one of: ${MATERIALS.join(', ')}>`
  );
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function validBox(b: NormalizedBox): boolean {
  const parts = [b.x0, b.y0, b.x1, b.y1];
  if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return false;
  return b.x1 > b.x0 && b.y1 > b.y0;
}

const ROW =
  /PROP\s*=\s*([^;]+);\s*BOX\s*=\s*([\d.,\s-]+);\s*SIZE_CM\s*=\s*([\d.]+)\s*;\s*COUNT\s*=\s*(\d+)(?:\s*;\s*MATERIAL\s*=\s*([A-Za-z]+))?/i;

/**
 * Map the VLM's material word onto the known set. An unrecognised word becomes `default`
 * rather than a guessed density — a wrong density is a wrong mass is a wrong settle, and
 * `default` is the one reading that is honestly "unclassified".
 */
function readMaterial(raw: string | undefined): PhysicsMaterial {
  if (!raw) return DEFAULT_PHYSICAL.material;
  const word = raw.trim().toLowerCase();
  // Exact match FIRST: depluralizing eagerly turns 'glass' into 'glas' and loses it.
  const exact = MATERIALS.find((m) => m === word);
  if (exact) return exact;
  const singular = word.replace(/s$/, '');
  return MATERIALS.find((m) => m === singular) ?? DEFAULT_PHYSICAL.material;
}

/**
 * Parse the one-line-per-prop protocol out of a (possibly fenced and chatty) reply. Pure.
 *
 * A row that parses but carries an impossible box, size or count is SKIPPED and counted,
 * never repaired: a hallucinated box would crop the wrong pixels and a hallucinated size
 * would put a table on a bottle, and both failures are silent downstream.
 */
export function parseSceneDecomposeReply(text: string): DecomposeReply {
  const props: DecomposedProp[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;
  let sawRow = false;

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ROW);
    if (!m) continue;
    sawRow = true;

    const nums = m[2].split(',').map((n) => Number(n.trim()));
    const box: NormalizedBox = { x0: nums[0], y0: nums[1], x1: nums[2], y1: nums[3] };
    const longestCm = Number(m[3]);
    const count = Number(m[4]);
    const name = m[1].trim();

    if (nums.length !== 4 || !validBox(box) || !(longestCm > 0) || count < 1 || count > MAX_COUNT || !name) {
      skipped++;
      continue;
    }

    const base = slug(name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    props.push({
      id: n === 1 ? base : `${base}-${n}`,
      name,
      box,
      longestCm,
      count,
      material: readMaterial(m[5]),
    });
  }

  if (!props.length) {
    return {
      ok: false,
      props: [],
      skipped,
      ran: true,
      error: sawRow
        ? `no PROP row survived validation (${skipped} rejected as out-of-range)`
        : 'the model returned no prop rows — the scene may contain no movable props',
    };
  }
  return { ok: true, props, skipped, ran: true };
}

/**
 * Turn planned props into the solver's input. Pure.
 *
 * The extents heuristic, stated because it IS a heuristic: a 2D box gives width and height
 * but no depth, so the longest estimated dimension is laid on whichever image axis is
 * longer, the other image axis is scaled by the box aspect, and DEPTH is taken equal to
 * width. That is right for the roughly-radially-symmetric props this targets (barrels,
 * bottles, crates) and wrong for long thin ones (a bench read side-on); it is deliberately
 * a documented approximation rather than an invented third measurement.
 */
export function toCompositionAssets(props: readonly DecomposedProp[]): CompositionAsset[] {
  return props.map((p) => {
    const bw = p.box.x1 - p.box.x0;
    const bh = p.box.y1 - p.box.y0;
    const wide = bw >= bh;
    const width = wide ? p.longestCm : p.longestCm * (bw / bh);
    const height = wide ? p.longestCm * (bh / bw) : p.longestCm;
    const size: [number, number, number] = [width, width, height];

    // Size class picks the placement semantics; the VLM's own count overrides `copies`,
    // because how many the scene shows beats a per-class default.
    const affordance = { ...affordanceForSize(size), copies: p.count };
    return { id: p.id, name: p.name, size, affordance };
  });
}

export interface DecomposeDeps {
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
  hint?: string;
}

/** Decompose one scene image. A transport failure is ok:false with the reason — never an empty list. */
export async function decomposeScene(
  image: VisionImage,
  deps: DecomposeDeps = {},
): Promise<DecomposeReply> {
  const vision = deps.vision ?? makeQwenVision();
  let raw: string;
  try {
    raw = await vision([image], buildSceneDecomposePrompt(deps.hint));
  } catch (e) {
    return { ok: false, props: [], skipped: 0, ran: false, error: e instanceof Error ? e.message : String(e) };
  }
  return parseSceneDecomposeReply(raw);
}
