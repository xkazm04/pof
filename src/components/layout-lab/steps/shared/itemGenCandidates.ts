import type { GenCandidate } from './genHistory';

/**
 * Pure, deterministic candidate generators for the Items pipeline's generative steps
 * (Icon 2D, 3D mesh, Material). Each Produce run / re-roll asks for a fresh batch;
 * the swatch hue is derived from the direction text + the batch seq so re-rolls look
 * visibly different yet are reproducible (no Math.random — safe to call from event
 * handlers and stable under test). Each candidate carries the `payload` that selecting
 * it projects onto the step's top-level data (keeping derived Acceptance unchanged).
 */

type RawCandidate = Omit<GenCandidate, 'id'>;

/** FNV-1a string hash → non-negative int. Deterministic; pure. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 4 icon candidates (256px). Payload `{ selected: i }` satisfies the icon Acceptance. */
export function iconCandidates(direction: string, seq: number): RawCandidate[] {
  const base = (hashStr(direction) + seq * 47) % 360;
  return Array.from({ length: 4 }, (_, i) => {
    const h1 = (base + i * 41) % 360;
    const h2 = (h1 + 28) % 360;
    return {
      swatch: `linear-gradient(135deg, hsl(${h1} 46% 42%), hsl(${h2} 56% 64%))`,
      payload: { selected: i },
    };
  });
}

/** 3 mesh candidates at different tri budgets (all under the 6000 LOD0 cap). */
export function meshCandidates(direction: string, seq: number): RawCandidate[] {
  const base = hashStr(direction) + seq * 13;
  const cap = 6000;
  return [4200, 5200, 5900].map((tris, i) => {
    const h = (base + i * 23) % 360;
    return {
      swatch: `linear-gradient(135deg, hsl(${h} 12% 28%), hsl(${h} 10% 56%))`,
      caption: `${tris} tris`,
      payload: { tris, cap },
    };
  });
}

const MAT_LOOKS: { label: string; maps: string[] }[] = [
  { label: 'worn iron', maps: ['Albedo', 'Normal', 'ORM', 'Height'] },
  { label: 'polished steel', maps: ['Albedo', 'Normal', 'ORM'] },
  { label: 'blackened', maps: ['Albedo', 'Normal', 'ORM', 'Height'] },
];

/** 3 material looks; each carries the required PBR map set (Albedo/Normal/ORM). */
export function materialCandidates(direction: string, seq: number): RawCandidate[] {
  const base = hashStr(direction) + seq * 29;
  return MAT_LOOKS.map((m, i) => {
    const h = (base + i * 40) % 360;
    return {
      swatch: `radial-gradient(circle at 35% 30%, hsl(${h} 38% 72%), hsl(${h} 46% 34%))`,
      caption: m.label,
      payload: { maps: m.maps },
    };
  });
}
