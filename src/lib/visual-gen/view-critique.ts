/**
 * The unseen-side gate — a vision tier over `mesh-views.ts`.
 *
 * Single-image→3D reconstructs the side it was shown and invents the rest. The pro
 * workflow states the symptom plainly: *"the other side of the coin is completely
 * broken"* (Stefan 3D AI, `wknRD5g-vvk` [07:59]). PoF's Tier-1 gate cannot see it —
 * `mesh-critique.ts` measures verts, faces, watertightness, components, euler and bbox,
 * and a smeared back face is watertight, single-component and zero-degenerate. It
 * **passes**, and then costs a retopo, a bake and an import before anyone looks.
 *
 * Three rules carry this module:
 *
 * 1. **The worst view decides — for severe damage.** A mean lets three clean views
 *    average away a broken back, which is precisely the defect the gate exists for.
 * 2. **Moderate damage needs corroboration.** The first live control failed a known-good
 *    mesh on every view, so the gate was condemning everything, which is as useless as
 *    passing everything. Two causes, both ours: the prompt listed "flat untextured areas"
 *    as a defect (most generator output IS untextured) and asked whether the asset read
 *    as its subject FROM THIS ANGLE (the back of a chair never does). With those removed
 *    the control scored [2, 0, 0] — one angle foreshortening it into apparent fused
 *    parts — while real defects showed a severe view or a repeated one. So one moderate
 *    view warns; two condemn. See `scoreViewGate`.
 * 3. **A view that could not be judged is not a clean view.** An unparseable reply or a
 *    thrown vision call yields `unmeasured`, never `pass` — the project's dominant
 *    honesty rule, the same one `world-scale.ts` and `face-budget.ts` follow. The one
 *    exception is deliberate: a defect that WAS seen outranks a gap in coverage, because
 *    the mesh is already condemned and more looking cannot acquit it.
 *
 * Pure cores (prompt / parse / score) over the vision seam `style-dna.ts` already uses,
 * so every decision is testable without a model or a network.
 */
import { readFile } from 'node:fs/promises';
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeQwenVision } from '@/lib/anim-critique/qwen';
import type { RenderedView } from './mesh-views';

/** Top of the severity scale the prompt defines. */
export const SEVERITY_MAX = 3;

/** Severity at which a view condemns the mesh. */
export const FAIL_SEVERITY = 2;

export interface ViewPromptOptions {
  viewIndex: number;
  yawDeg: number;
  totalViews: number;
  /** What the asset is meant to be, when known — lets "wrong shape" be judgeable. */
  subject?: string;
}

/** Plain-language name for a yaw, so the model knows it is looking at a back. */
function sideName(yawDeg: number): string {
  const y = ((yawDeg % 360) + 360) % 360;
  if (y < 45 || y >= 315) return 'the FRONT';
  if (y < 135) return 'the RIGHT side';
  if (y < 225) return 'the BACK';
  return 'the LEFT side';
}

/** Build the per-view critique prompt. Pure. */
export function buildViewCritiquePrompt(opts: ViewPromptOptions): string {
  return [
    `This is a render of a generated 3D game asset, seen from ${sideName(opts.yawDeg)} ` +
      `(camera yaw ${opts.yawDeg}°, view ${opts.viewIndex + 1} of ${opts.totalViews}).`,
    opts.subject ? `The asset is meant to be: ${opts.subject}.` : '',
    'Judge ONLY whether the SURFACE AND GEOMETRY are intact. Report a defect only for: ' +
      'holes or gaps in a surface that should be closed; torn or ragged geometry; ' +
      'distinct parts fused or melted into each other; floating disconnected fragments; ' +
      'a texture visibly smeared or stretched across the surface.',
    'Four things are NOT defects, and reporting them is an error:',
    '(1) An untextured, single-colour or flat-coloured surface is NORMAL — most assets arrive ' +
      'untextured, and a plain surface must not be reported as blank, missing or defective. ' +
      'Judge texture only if the surface visibly HAS one.',
    '(2) This is one view of several. A back or side view legitimately shows less detail than the ' +
      'front, and the asset does not need to be identifiable from this angle. Do NOT report that you ' +
      'cannot tell what it is, or that it looks unlike the subject from here — judge only whether ' +
      'the surface you can see is damaged.',
    '(3) Smooth, featureless areas are fine where the subject is genuinely smooth. Report them only ' +
      'where structure has clearly collapsed into a blob that should have had separate parts.',
    '(4) Nothing about the render itself — lighting, shadows, background, camera angle, resolution ' +
      'and the missing ground plane are all deliberate.',
    `Rate the WORST defect on this view: 0 = clean or merely plain, 1 = a small blemish a player ` +
      `would not notice, 2 = clearly damaged geometry at normal viewing distance, ` +
      `${SEVERITY_MAX} = broken and unusable as shipped. If you are unsure, score LOWER — a false ` +
      `alarm costs more here than a missed blemish.`,
    'Reply on ONE line EXACTLY as: ' +
      "DEFECTS=<comma-separated defects, or 'none'>; SEVERITY=<0-3>",
  ]
    .filter(Boolean)
    .join('\n');
}

export interface ViewCritiqueReply {
  ok: boolean;
  defects?: string[];
  severity?: number;
  error?: string;
}

/** Parse the one-line marker reply. Pure. */
export function parseViewCritiqueReply(raw: string): ViewCritiqueReply {
  const defectsMatch = raw.match(/DEFECTS\s*=\s*([^;\r\n]*)/i);
  const severityMatch = raw.match(/SEVERITY\s*=\s*(-?[\d.]+)/i);
  if (!defectsMatch || !severityMatch) {
    return {
      ok: false,
      error: `reply carried no DEFECTS/SEVERITY marker — refusing to read "${raw.slice(0, 80).replace(/\s+/g, ' ')}" as a verdict`,
    };
  }
  const severityRaw = Number(severityMatch[1]);
  if (!Number.isFinite(severityRaw)) {
    return { ok: false, error: `SEVERITY was not a number ("${severityMatch[1]}")` };
  }
  const body = defectsMatch[1].trim();
  const defects = /^none$/i.test(body)
    ? []
    : body.split(',').map((d) => d.trim()).filter(Boolean);
  return { ok: true, defects, severity: Math.max(0, Math.min(SEVERITY_MAX, Math.round(severityRaw))) };
}

export interface ViewVerdict {
  index: number;
  yawDeg: number;
  imagePath: string;
  defects: string[];
  severity: number;
}

export interface ViewGateResult {
  verdict: 'pass' | 'warn' | 'fail' | 'unmeasured';
  /** The view that decided the verdict, when one did. */
  worst?: ViewVerdict;
  /** Every view that was successfully judged. */
  views: ViewVerdict[];
  /** Views that could not be judged, with the reason each failed. */
  unjudged?: Array<{ index: number; reason: string }>;
  reason?: string;
}

/**
 * Score judged views.
 *
 * The worst view decides for SEVERE damage — three clean views must never average away a
 * broken back. Moderate damage needs corroboration: a live control on 2026-08-31 scored a
 * known-good mesh [2, 0, 0] purely because one orbit angle foreshortened it into what read
 * as fused parts, while the genuinely broken meshes showed either a severe view
 * (chair.glb [2, 3, 0]) or the same moderate defect on every view (saber_hilt.glb
 * [2, 2, 2]). So one moderate view WARNS and names itself; two condemn.
 *
 * Calibrated on three meshes (one good, two bad). That is enough to fix the observed
 * false-positive mode and not enough to call the thresholds settled — widen the control
 * set before trusting this to gate a pipeline unattended.
 */
export function scoreViewGate(
  verdicts: ViewVerdict[],
  unjudged: Array<{ index: number; reason: string }> = [],
  totalViews?: number,
): ViewGateResult {
  const total = totalViews ?? verdicts.length + unjudged.length;
  const worst = verdicts.reduce<ViewVerdict | undefined>(
    (acc, v) => (acc === undefined || v.severity > acc.severity ? v : acc),
    undefined,
  );

  const flagged = verdicts.filter((v) => v.severity >= FAIL_SEVERITY);
  const severe = verdicts.some((v) => v.severity >= SEVERITY_MAX);
  const condemned = severe || flagged.length >= 2;

  if (worst && condemned) {
    // A seen defect outranks a coverage gap — more looking cannot acquit this mesh.
    return {
      verdict: 'fail',
      worst,
      views: verdicts,
      unjudged: unjudged.length ? unjudged : undefined,
      reason:
        `view ${worst.index} (yaw ${worst.yawDeg}°) scored severity ${worst.severity}: ` +
        `${worst.defects.join(', ') || 'unspecified defect'}` +
        (severe
          ? ' — a mesh is as good as its worst side.'
          : ` — moderate damage on ${flagged.length} of ${verdicts.length} views, so it is the mesh and not the angle.`) +
        ` See ${worst.imagePath}`,
    };
  }

  if (worst && flagged.length === 1) {
    return {
      verdict: 'warn',
      worst,
      views: verdicts,
      unjudged: unjudged.length ? unjudged : undefined,
      reason:
        `one view of ${verdicts.length} (view ${worst.index}, yaw ${worst.yawDeg}°) reported ` +
        `${worst.defects.join(', ') || 'a defect'} at severity ${worst.severity}, and no other view ` +
        `corroborates it — a single moderate view is the known false-positive mode (an angle that ` +
        `foreshortens the shape), so this is flagged for a look rather than condemned. See ${worst.imagePath}`,
    };
  }

  if (verdicts.length === 0) {
    return {
      verdict: 'unmeasured',
      views: verdicts,
      unjudged: unjudged.length ? unjudged : undefined,
      reason:
        unjudged.length > 0
          ? `none of the ${total} views could be judged (first: ${unjudged[0].reason}) — silence is not a pass`
          : 'no views were rendered — there is nothing to look at, which is not the same as nothing being wrong',
    };
  }

  if (unjudged.length > 0) {
    return {
      verdict: 'unmeasured',
      worst,
      views: verdicts,
      unjudged,
      reason:
        `${unjudged.length} of ${total} views could not be judged (first: view ${unjudged[0].index} — ` +
        `${unjudged[0].reason}); the judged views were clean, but an unseen side is exactly what this gate exists to catch`,
    };
  }

  return { verdict: 'pass', worst, views: verdicts };
}

export interface ViewCritiqueDeps {
  /** Vision seam (images, prompt) => reply text; defaults to DashScope Qwen-VL. */
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
  /** Image loader seam, so scoring is testable without files. */
  readImage?: (path: string) => Promise<VisionImage>;
  /** What the asset is meant to be, passed to every view prompt. */
  subject?: string;
}

const defaultReadImage = async (path: string): Promise<VisionImage> => ({
  base64: (await readFile(path)).toString('base64'),
  mime: 'image/png',
});

/** Judge every rendered view and score the set. One VLM call per view. */
export async function critiqueMeshViews(
  views: RenderedView[],
  deps: ViewCritiqueDeps = {},
): Promise<ViewGateResult> {
  if (views.length === 0) return scoreViewGate([], [], 0);
  const vision = deps.vision ?? makeQwenVision();
  const readImage = deps.readImage ?? defaultReadImage;

  const verdicts: ViewVerdict[] = [];
  const unjudged: Array<{ index: number; reason: string }> = [];

  for (const v of views) {
    try {
      const img = await readImage(v.imagePath);
      const raw = await vision(
        [img],
        buildViewCritiquePrompt({
          viewIndex: v.index,
          yawDeg: v.yawDeg,
          totalViews: views.length,
          subject: deps.subject,
        }),
      );
      const parsed = parseViewCritiqueReply(raw);
      if (!parsed.ok) {
        unjudged.push({ index: v.index, reason: parsed.error ?? 'unparseable reply' });
        continue;
      }
      verdicts.push({
        index: v.index,
        yawDeg: v.yawDeg,
        imagePath: v.imagePath,
        defects: parsed.defects ?? [],
        severity: parsed.severity ?? 0,
      });
    } catch (e) {
      unjudged.push({ index: v.index, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  return scoreViewGate(verdicts, unjudged, views.length);
}
