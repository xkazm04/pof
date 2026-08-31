/**
 * Kit colour coherence — does a set of generated props actually look like it belongs
 * together?
 *
 * The pro workflow names the defect: *"they are not consistent by colour"*
 * (`wknRD5g-vvk` [11:19]), and fixes it by hand with a gamma/contrast/RGB-curve node
 * before baking. PoF has the prevention (`kit-from-one-concept-split` in `ue-gotchas.ts`,
 * and `style-dna.ts` narrowing the prompts) but had no way to tell whether it WORKED:
 * Style DNA shapes what is ASKED for and never inspects what came back, which
 * `STYLE_DNA_REACH` says in as many words.
 *
 * Input is the per-member palette that `pof_mesh_views.py` measures from an unlit
 * Workbench pass — flat, so the number is colour rather than shadow.
 *
 * ── Calibration, stated plainly ───────────────────────────────────────────────────
 * Measured 2026-08-31 over four meshes already in `generated/`:
 *
 *   the same asset, re-rendered            ΔE 0.0 – 1.8
 *   independently generated assets         ΔE 8.0 – 21.5
 *   ONE asset's own four colours, internal  up to ΔE 15.1 (max pair)
 *
 * The first two bands separate cleanly, which is what {@link DRIFT_DELTA_E} sits between.
 * But that third number is the honest limit: a single prop's own palette spans more than
 * the gap between some asset pairs, so "these two props differ" is NOT the same claim as
 * "this kit is incoherent" — a crate and a barrel are allowed to be different colours.
 * Separating varied-but-coherent from drifting needs a known-good kit to calibrate
 * against, and PoF does not have one yet. So this module reports `advisory: true` and
 * carries {@link KIT_COHERENCE_CALIBRATION_CAVEAT} on every grade, the same discipline
 * `mesh-critique.ts` uses for its own uncalibrated thresholds. **Show the number; do not
 * gate a pipeline on the verdict until the threshold is calibrated on a real kit.**
 */

/** The distance unit — CIE76 ΔE in CIELAB. */
export const DELTA_E_UNIT = 'dE76' as const;

/**
 * Palette distance above which a kit is called drifting. Sits in the measured gap
 * between a re-render of the same asset (1.8) and the closest independently generated
 * pair (8.0) — a provisional threshold from real data, not a guess, and not yet
 * calibrated against a known-coherent kit. See {@link KIT_COHERENCE_CALIBRATION_CAVEAT}.
 */
export const DRIFT_DELTA_E = 6;

export const KIT_COHERENCE_CALIBRATION_CAVEAT =
  'the drift threshold is provisional: it separates a re-render of the same asset (dE 0-1.8) from ' +
  'independently generated assets (dE 8.0-21.5), but a single prop’s own palette spans up to dE 15.1 ' +
  'internally, so a large distance may be legitimate variety rather than drift. Calibrate on a ' +
  'known-coherent kit before gating a pipeline on this verdict — report the number, not a pass/fail';

export interface Lab {
  L: number;
  a: number;
  b: number;
}

const pivot = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/**
 * sRGB hex → CIELAB. Undefined for anything that is not a 6-digit hex colour — a
 * malformed value must not silently become black, which would read as a real dark colour.
 */
export function hexToLab(hex: string): Lab | undefined {
  const h = (hex ?? '').trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  // sRGB D65 → XYZ, normalised to the D65 white point.
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const [fx, fy, fz] = [pivot(X), pivot(Y), pivot(Z)];
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * CIE76 ΔE. Chosen over CIEDE2000 deliberately: this compares quantised palette
 * summaries, not fine shade matches, and CIE76 keeps the number explainable — a
 * straight distance in Lab. The added accuracy of DE2000 would be spurious precision
 * on top of a 16-level-per-channel quantisation.
 */
export function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

/**
 * Distance between two palettes: the mean nearest-neighbour ΔE, averaged in both
 * directions so the result is symmetric. Undefined when either side has no usable
 * colour — an unmeasurable pair is not a distance of zero.
 */
export function paletteDistance(a: string[], b: string[]): number | undefined {
  const A = (a ?? []).map(hexToLab).filter((c): c is Lab => c !== undefined);
  const B = (b ?? []).map(hexToLab).filter((c): c is Lab => c !== undefined);
  if (A.length === 0 || B.length === 0) return undefined;
  const oneWay = (from: Lab[], to: Lab[]) =>
    from.reduce((s, c) => s + Math.min(...to.map((d) => deltaE76(c, d))), 0) / from.length;
  return (oneWay(A, B) + oneWay(B, A)) / 2;
}

export interface KitMemberPalette {
  name: string;
  /** Dominant colours as hex, from `pof_mesh_views.py`. Absent when the member failed. */
  palette?: string[];
}

export interface KitCoherenceGrade {
  verdict: 'coherent' | 'drifting' | 'unmeasured';
  /** The two members furthest apart — the actionable fact. */
  worstPair?: { a: string; b: string; deltaE: number };
  /** The single member furthest from all the others — the one to re-generate. */
  outlier?: string;
  /** Mean pairwise distance across the kit. */
  meanDeltaE?: number;
  /** Always true: this is a measurement to read, not a gate to fail a pipeline on. */
  advisory: true;
  caveat: string;
  /** Members with no usable palette — listed, never silently dropped. */
  unmeasuredMembers?: string[];
  reason?: string;
}

/** Grade a kit's colour coherence from its members' measured palettes. Pure. */
export function gradeKitCoherence(
  members: KitMemberPalette[],
  driftThreshold: number = DRIFT_DELTA_E,
): KitCoherenceGrade {
  const base = { advisory: true as const, caveat: KIT_COHERENCE_CALIBRATION_CAVEAT };
  const usable = (members ?? []).filter(
    (m) => (m.palette ?? []).some((c) => hexToLab(c) !== undefined),
  );
  const unmeasuredMembers = (members ?? [])
    .filter((m) => !usable.includes(m))
    .map((m) => m.name);
  const unmeasured = unmeasuredMembers.length ? unmeasuredMembers : undefined;

  if (usable.length < 2) {
    return {
      ...base,
      verdict: 'unmeasured',
      unmeasuredMembers: unmeasured,
      reason:
        `coherence is a relationship, and only ${usable.length} member(s) carried a usable palette` +
        (unmeasured ? ` (no palette for: ${unmeasured.join(', ')})` : '') +
        ' — nothing to compare',
    };
  }

  let worstPair: { a: string; b: string; deltaE: number } | undefined;
  let total = 0;
  let pairs = 0;
  const perMember = new Map<string, { sum: number; n: number }>();
  const bump = (name: string, d: number) => {
    const e = perMember.get(name) ?? { sum: 0, n: 0 };
    perMember.set(name, { sum: e.sum + d, n: e.n + 1 });
  };

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const d = paletteDistance(usable[i].palette!, usable[j].palette!);
      if (d === undefined) continue;
      total += d;
      pairs += 1;
      bump(usable[i].name, d);
      bump(usable[j].name, d);
      if (!worstPair || d > worstPair.deltaE) {
        worstPair = { a: usable[i].name, b: usable[j].name, deltaE: d };
      }
    }
  }

  const meanDeltaE = pairs > 0 ? total / pairs : undefined;
  const outlier = [...perMember.entries()]
    .map(([name, e]) => ({ name, mean: e.sum / e.n }))
    .sort((x, y) => y.mean - x.mean)[0]?.name;
  const drifting = worstPair !== undefined && worstPair.deltaE >= driftThreshold;
  const note = unmeasured ? ` Not compared (no palette): ${unmeasured.join(', ')}.` : '';

  return {
    ...base,
    verdict: drifting ? 'drifting' : 'coherent',
    worstPair,
    outlier,
    meanDeltaE,
    unmeasuredMembers: unmeasured,
    reason: drifting
      ? `${worstPair!.a} and ${worstPair!.b} are ${worstPair!.deltaE.toFixed(1)} ${DELTA_E_UNIT} apart ` +
        `(threshold ${driftThreshold}); ${outlier} sits furthest from the rest, so it is the one to ` +
        `re-generate from the kit's concept image or colour-correct before baking.${note}`
      : `worst pair ${worstPair!.deltaE.toFixed(1)} ${DELTA_E_UNIT}, below the ${driftThreshold} ` +
        `threshold — the kit reads as one palette.${note}`,
  };
}
