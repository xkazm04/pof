/**
 * Sense profile of one enemy, for the bestiary's 'Give Them Brains' tab.
 *
 * Archetypes declare their senses as free text in `btSummary.Sense`
 * ('Proximity 8m', 'Visual 20m', 'Force omniscience 30m'). This module turns that
 * into a declared shape vocabulary — a 60-degree `cone` for line-of-sight kinds,
 * an omnidirectional `radius` for everything else — with the reach in cm, and
 * derives detection from geometry instead of hand-set flags.
 *
 * Resolution order: the declared Sense line, then the combat definition's
 * `aggroRange` (src/lib/combat/definitions.ts), then DEFAULT_SENSE — today's
 * generic 1500cm sight cone + 800cm hearing ring, labelled as not authored.
 * Pure.
 */
import { ENEMY_ARCHETYPES } from '@/lib/combat/definitions';

export type SenseShape = 'cone' | 'radius';
export type SenseSource = 'btSummary' | 'combat-definition' | 'default';

export interface SenseProfile {
  /** Sense kind as declared ('Visual', 'Proximity', 'Force sense'...). */
  kind: string;
  shape: SenseShape;
  /** Reach of the primary sense (the cone's length, or the radius). */
  radiusCm: number;
  /** Full cone angle; null for a radius sense. */
  coneDeg: number | null;
  /** Secondary omnidirectional hearing ring, if any. */
  hearingCm: number | null;
  source: SenseSource;
  /** Where the figure came from, in the designer's words. */
  detail: string;
}

/** Today's generic perception: the figures the cone diagram hard-coded. */
export const DEFAULT_SENSE: SenseProfile = Object.freeze({
  kind: 'Sight', shape: 'cone', radiusCm: 1500, coneDeg: 60, hearingCm: 800,
  source: 'default', detail: 'default — not authored',
}) as SenseProfile;

const CONE_DEG = 60;
/** Line-of-sight sense kinds; every other declared kind is omnidirectional. */
const CONE_KINDS = /^(visual|sensor|thermal|multi)/i;
const SENSE_LINE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*m$/i;

interface SensedArchetype { id: string; btSummary: Record<string, string> }

export function senseProfileFor(archetype: SensedArchetype): SenseProfile {
  const line = archetype.btSummary.Sense?.trim();
  const m = line ? SENSE_LINE.exec(line) : null;
  if (line && m) {
    const kind = m[1];
    const cone = CONE_KINDS.test(kind);
    return {
      kind, shape: cone ? 'cone' : 'radius', radiusCm: Math.round(Number(m[2]) * 100),
      coneDeg: cone ? CONE_DEG : null, hearingCm: null, source: 'btSummary', detail: line,
    };
  }
  const combat = ENEMY_ARCHETYPES.find(e => e.id === archetype.id);
  if (combat) {
    return {
      kind: 'Aggro', shape: 'cone', radiusCm: combat.aggroRange, coneDeg: CONE_DEG, hearingCm: null,
      source: 'combat-definition', detail: `aggroRange ${combat.aggroRange}cm`,
    };
  }
  return DEFAULT_SENSE;
}

/* ── Diagram geometry (130x130 viewBox, AI eye at the centre, facing up) ── */

export const SENSE_EYE = { x: 65, y: 65 } as const;
/** World scale of the diagram: the legacy cone draws 1500cm as 56.9 units. */
const LEGACY_CONE_R = 56.9;
const LEGACY_RING_R = 44.7;
const CM_PER_UNIT = 1500 / LEGACY_CONE_R;
/** Largest radius drawn; longer senses zoom the whole diagram out. */
const MAX_VIEW_R = 60;

export interface SenseGeometry {
  /** Cone reach in world diagram units (null: no cone). */
  coneR: number | null;
  /** Ring reach in world diagram units (null: no ring). */
  ringR: number | null;
  coneDeg: number;
  /** Draw scale applied to every radius and entity offset (<= 1). */
  zoom: number;
}

export function senseGeometry(profile: SenseProfile): SenseGeometry {
  // The default keeps today's hand-tuned drawing verbatim (its ring is not to
  // the cone's scale), so the generic view and its detection do not move.
  if (profile.source === 'default') {
    return { coneR: LEGACY_CONE_R, ringR: LEGACY_RING_R, coneDeg: profile.coneDeg ?? CONE_DEG, zoom: 1 };
  }
  const reach = profile.radiusCm / CM_PER_UNIT;
  const coneR = profile.shape === 'cone' ? reach : null;
  const ringR = profile.shape === 'radius' ? reach
    : profile.hearingCm != null ? profile.hearingCm / CM_PER_UNIT : null;
  const outer = Math.max(coneR ?? 0, ringR ?? 0);
  return { coneR, ringR, coneDeg: profile.coneDeg ?? CONE_DEG, zoom: outer > MAX_VIEW_R ? MAX_VIEW_R / outer : 1 };
}

interface SensedPoint { x: number; y: number; inCone: boolean; inHearing: boolean }

/** Recompute inCone / inHearing from each entity's position and the profile's reach. */
export function detectEntities<T extends SensedPoint>(entities: readonly T[], profile: SenseProfile): T[] {
  const g = senseGeometry(profile);
  return entities.map(e => {
    const dx = e.x - SENSE_EYE.x;
    const dy = e.y - SENSE_EYE.y;
    const dist = Math.hypot(dx, dy);
    // Angle off the cone axis (straight up, -y).
    const offAxisDeg = dist === 0 ? 0 : Math.acos(-dy / dist) * 180 / Math.PI;
    const inCone = g.coneR != null && dist <= g.coneR && offAxisDeg <= g.coneDeg / 2;
    const inHearing = g.ringR != null && dist <= g.ringR;
    return { ...e, inCone, inHearing };
  });
}

/**
 * Which enemy the brains tab shows: an explicit pick made on the tab (null =
 * cleared to the generic view), else the expanded archetype, else the first
 * compared one, else none.
 */
export function brainSubject(
  expandedId: string | null, compareIds: readonly string[], pick?: string | null,
): string | null {
  if (pick !== undefined) return pick;
  return expandedId ?? compareIds[0] ?? null;
}
