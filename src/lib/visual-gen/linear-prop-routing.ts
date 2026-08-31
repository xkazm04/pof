/**
 * Where a linear-prop request should go — the routing layer that gives
 * `generators/linear-prop.ts` a caller.
 *
 * `routeShape` decided, correctly, that a rope must never be sent to a 3D generator: its
 * geometry IS its two anchors, its slack and its radius, so a credit buys back a ~1 m blob
 * touching neither end. It then shipped with **no production importer**, so every rope
 * prompt still went to the paid path. This module is the half that was missing, and
 * `POST /api/visual-gen/generate` is where it now bites — the same place the Tier-0 input
 * gate cashes its own credit-saving claim.
 *
 * The hard part is not the keyword, it is the SCOPE. "a coiled rope" is a rope; "a pirate
 * captain holding a coiled rope" is a character who happens to be holding one, and
 * refusing it would block a legitimate generation over a single word. So the route has
 * three outcomes, not two: `procedural` (refuse, compute it instead), `advise` (generate,
 * but say the rope inside it is better computed and composed) and `generate`.
 *
 * The scope test is a word count, {@link SCOPE_WORD_LIMIT}, and that is a blunt
 * instrument stated as one rather than dressed up: a short prompt is about its subject,
 * a long one describes a scene. Its failure mode is knowable in both directions — a
 * terse scene ("pirate with rope") over-refuses, and a florid rope ("an ancient weathered
 * hemp rope, frayed and salt-stained, hanging heavy") under-refuses into an advisory.
 * Both are recoverable in one field (`overrideShapeRoute`), which is why a cheap rule is
 * the right one here: the expensive half is the credit, and only `procedural` spends
 * nothing.
 */
import { routeShape, LINEAR_PROP_SUBJECTS, type LinearPropConfig, type Vec3 } from './generators/linear-prop';

/**
 * Word count at or below which a prompt is taken to be ABOUT its subject rather than
 * describing a scene containing it. Four content words is a noun phrase; more is a
 * description. Not tuned on a corpus — see the header.
 */
export const SCOPE_WORD_LIMIT = 4;

export interface PromptShapeRoute {
  /**
   * `procedural` — refuse the generator, compute it.
   * `advise` — generate, but tell the caller the linear part is better computed.
   * `generate` — nothing linear about it.
   */
  route: 'procedural' | 'advise' | 'generate';
  /** The linear subject that was recognised, when one was. */
  keyword?: string;
  reason: string;
  /** Set only when a caller chose to generate through a `procedural` refusal. */
  overridden?: boolean;
}

/** Which linear subject a prompt names, on a whole-word match. Pure. */
function keywordIn(prompt: string): string | undefined {
  const s = prompt.toLowerCase();
  // Whole words only: a substring match refuses "a map of europe" for its final four
  // letters, which is the cheapest way to make a gate look broken.
  return LINEAR_PROP_SUBJECTS.find((k) => new RegExp(`\\b${k}s?\\b`).test(s));
}

/** Route one generation prompt. Pure — decided before a credit is spent. */
export function routePromptShape(prompt: string | undefined): PromptShapeRoute {
  const text = (prompt ?? '').trim();
  // No prompt is nothing to judge. An image-to-3d submit with no subject hint reaches
  // here, and silence must not become a refusal.
  if (!text) return { route: 'generate', reason: 'no prompt to route on' };

  const keyword = keywordIn(text);
  if (!keyword) return { route: 'generate', reason: routeShape(text).reason };

  const words = text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length > SCOPE_WORD_LIMIT) {
    return {
      route: 'advise',
      keyword,
      reason:
        `this prompt names a ${keyword}, but at ${words.length} words it describes a larger subject in ` +
        `which the ${keyword} is a detail — so it is generated as asked. Composing the scene from a ` +
        `generated subject plus a COMPUTED ${keyword} (POST /api/visual-gen/linear-prop) gives a ${keyword} ` +
        'that actually meets its anchors, which no generated one does',
    };
  }

  return { route: 'procedural', keyword, reason: routeShape(text).reason };
}

/**
 * The refusal text for a `procedural` route, or null. Mirrors `inputGateRefusal` — the
 * refusal names the alternative, so it is never a dead end.
 */
export function linearPropRefusal(route: PromptShapeRoute): string | null {
  if (route.route !== 'procedural') return null;
  return (
    `${route.reason}. Refused before any provider call, so no generation was spent. ` +
    'Compute it instead with POST /api/visual-gen/linear-prop (it needs the two anchors — ' +
    'the thing a prompt cannot carry and a generated mesh cannot honour), or resubmit with ' +
    'overrideShapeRoute: true to generate anyway.'
  );
}

/** Stamp a route the caller chose to generate through anyway. Pure. */
export function linearPropOverridden(route: PromptShapeRoute): PromptShapeRoute {
  if (route.route !== 'procedural') return route;
  return {
    ...route,
    overridden: true,
    reason: `${route.reason} — OVERRIDDEN by the caller; the generator ran anyway`,
  };
}

/**
 * Slack as a fraction of the chord — extra length beyond the straight line.
 *
 * Sag is not slack, and the difference surprises: `sagDepth` makes the hang
 * `chord · √(3·slack/8)`, so this 8% of extra length drops the middle by ~17% of the
 * chord. Measured on a real artifact through this route — a 6.7 m span sagged 1.17 m.
 * That reads as a hanging rope; a taut pier line wants ~0.01, and callers who care pass
 * their own.
 */
export const DEFAULT_SLACK = 0.08;
/** 2 cm radius — a hand-thick rope at real-world scale, matching `world-scale.ts` units. */
export const DEFAULT_RADIUS = 0.02;
export const DEFAULT_SEGMENTS = 32;
export const DEFAULT_SIDES = 8;

export interface LinearPropRequest {
  from: Vec3;
  to: Vec3;
  slack?: number;
  radius?: number;
  segments?: number;
  sides?: number;
}

/**
 * Fill the shape parameters a caller left out. Pure.
 *
 * The anchors are deliberately NOT defaultable: they are the entire reason this asset is
 * computed rather than generated, so inventing them would reintroduce the defect —
 * a rope that reaches nothing.
 */
export function resolveLinearPropConfig(req: LinearPropRequest): LinearPropConfig {
  return {
    from: req.from,
    to: req.to,
    slack: req.slack ?? DEFAULT_SLACK,
    radius: req.radius ?? DEFAULT_RADIUS,
    segments: req.segments ?? DEFAULT_SEGMENTS,
    sides: req.sides ?? DEFAULT_SIDES,
  };
}
