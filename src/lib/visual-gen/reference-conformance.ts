/**
 * The conformance gate — does the asset we produced depict the thing we asked for?
 *
 * `view-critique.ts` looks at a generated mesh and grades DAMAGE: holes, tears, fused
 * parts, floaters, smeared texture. It is deliberately blind to identity — its prompt
 * says in as many words that "the asset does not need to be identifiable from this
 * angle", because a back view of a chair never is, and asking the question there made
 * the gate condemn everything. That blindness is correct for damage and leaves a hole:
 * **nothing in PoF ever compares the produced asset against the reference image it was
 * generated FROM.** A mesh can be watertight, single-component, undamaged from every
 * yaw, pass the render gate, cost a retopo, a bake and an import — and simply not be
 * the object in the concept art. The observed symptom is not subtle once looked for:
 * *"when you start looking into details it's not exactly the same car, there are a lot
 * of discrepancies"* (Stefan 3D AI, `8MUk-tQTiwE` [08:01]) about output that reads as a
 * complete success at a glance.
 *
 * Three decisions carry this module.
 *
 * 1. **One call, on the view the reference actually showed.** Single-image→3D
 *    reconstructs the side it was shown and invents the rest — this codebase's own
 *    founding observation for the render gate. So conformance is judged on the FRONT
 *    view and nowhere else: the invented sides have no reference to be compared to, and
 *    grading them against one would condemn every asset for the thing the generator was
 *    never told. One yaw also means one vision call per member regardless of how many
 *    yaws were rendered, against the same quota `qwen.ts`'s fallback chain nurses.
 * 2. **Its own vocabulary — `match` / `drift` / `mismatch` — never pass/fail.** This is
 *    a different question from damage with a different failure profile, and a shared
 *    word invites a caller to fold the two verdicts into one number.
 * 3. **It reports; it does not yet condemn.** The view gate's first live control failed
 *    a known-good mesh on every view, and the causes were both in the prompt. The same
 *    trap is wide open here — a grey untextured render against a full-colour concept
 *    plate is the normal case, not a defect — and no known-good control has been run
 *    through this prompt yet. So the job store surfaces the verdict beside the damage
 *    verdict and does not fold it into pass/fail, exactly as `kit-coherence.ts` is held
 *    advisory until calibrated. Folding it in is a deliberate later step that needs a
 *    control run first, not a default.
 *
 * Pure cores (prompt / parse / pick / score) over the same injectable vision seam
 * `view-critique.ts` uses, so every decision here is testable without a model.
 */
import { readFile } from 'node:fs/promises';
import type { VisionImage } from '@/lib/anim-critique/critique';
import { makeRoutedVisionText } from '@/lib/vision/seam';
import type { RenderedView } from './mesh-views';

/** Top of the severity scale the prompt defines. */
export const SEVERITY_MAX = 3;

/** Severity at which the render is judged to be a different object. */
export const MISMATCH_SEVERITY = 2;

/**
 * What the comparison concluded.
 *
 * `not-requested` is deliberately distinct from `unmeasured`: no reference was supplied,
 * so nothing was asked and nothing failed. Collapsing the two would make every
 * reference-less job look like a gate that tried and could not see.
 */
export type ConformanceVerdict = 'match' | 'drift' | 'mismatch' | 'unmeasured' | 'not-requested';

export interface ConformancePromptOptions {
  /** What the asset is meant to be, when known — sharpens "different object entirely". */
  subject?: string;
}

/** Build the two-image comparison prompt. Pure. */
export function buildConformancePrompt(opts: ConformancePromptOptions): string {
  return [
    'You are given TWO images of the same intended object.',
    'The FIRST image is the REFERENCE the asset was designed from (concept art or a photo).',
    'The SECOND image is a render of the 3D asset that was actually produced from it.',
    opts.subject ? `The asset is meant to be: ${opts.subject}.` : '',
    'Judge ONE thing: does the produced asset depict the SAME OBJECT as the reference? ' +
      'Report only differences in the object itself — a part present in the reference and ' +
      'missing from the render (or added); a clearly different shape, silhouette or ' +
      'proportion; a different number of repeated elements (wheels, windows, spikes, ' +
      'columns); parts in a different arrangement; or plainly a different object.',
    'Five differences are EXPECTED and reporting them is an error:',
    '(1) The render is often UNTEXTURED, grey or flat-coloured while the reference is in ' +
      'full colour. Colour, material and surface finish are NOT part of this judgement.',
    '(2) Lighting, shadows, exposure and background differ by construction — the render ' +
      'is a neutral studio orbit, the reference is not.',
    '(3) Camera distance, framing and lens differ; so does resolution and render sharpness.',
    '(4) The reference may be stylised, painted or show the object in a scene; the render ' +
      'is the bare asset. Judge the OBJECT, not the presentation around it.',
    '(5) Fine surface detail visible in the reference may be carried by textures that are ' +
      'not applied yet. Report a missing PART, never missing detail.',
    `Rate the WORST divergence: 0 = the same object, 1 = a small difference a player would ` +
      `not notice, ${MISMATCH_SEVERITY} = clearly not the same object as designed, ` +
      `${SEVERITY_MAX} = an unrelated object. If you are unsure, score LOWER — this ` +
      `judgement gates real work, and a false alarm costs more than a missed detail.`,
    'Reply on ONE line EXACTLY as: ' +
      "DIVERGENCES=<comma-separated differences, or 'none'>; SEVERITY=<0-3>",
  ]
    .filter(Boolean)
    .join('\n');
}

export interface ConformanceReply {
  ok: boolean;
  divergences?: string[];
  severity?: number;
  error?: string;
}

/** Parse the one-line marker reply. Pure. */
export function parseConformanceReply(raw: string): ConformanceReply {
  const listMatch = raw.match(/DIVERGENCES\s*=\s*([^;\r\n]*)/i);
  const severityMatch = raw.match(/SEVERITY\s*=\s*(-?[\d.]+)/i);
  if (!listMatch || !severityMatch) {
    return {
      ok: false,
      error: `reply carried no DIVERGENCES/SEVERITY marker — refusing to read "${raw.slice(0, 80).replace(/\s+/g, ' ')}" as a verdict`,
    };
  }
  const severityRaw = Number(severityMatch[1]);
  if (!Number.isFinite(severityRaw)) {
    return { ok: false, error: `SEVERITY was not a number ("${severityMatch[1]}")` };
  }
  const body = listMatch[1].trim();
  const divergences = /^none$/i.test(body)
    ? []
    : body.split(',').map((d) => d.trim()).filter(Boolean);
  return {
    ok: true,
    divergences,
    severity: Math.max(0, Math.min(SEVERITY_MAX, Math.round(severityRaw))),
  };
}

export interface PickedView {
  view?: RenderedView;
  /** Always set — names the yaw chosen, or why none was. */
  reason: string;
}

/** Angular distance from the front, in degrees (0-180). Pure. */
function offFront(yawDeg: number): number {
  const y = ((yawDeg % 360) + 360) % 360;
  return y > 180 ? 360 - y : y;
}

/**
 * The view to compare against the reference: the one nearest the FRONT. Pure.
 *
 * Distance is circular, so yaw 350 (10 deg off the front) beats yaw 60. The chosen yaw
 * is always named, because a reference plate drawn from three-quarters is being judged
 * against a straight-on render and the caller needs to be able to see that.
 */
export function pickReferenceView(views: RenderedView[]): PickedView {
  const candidates = (views ?? []).filter((v) => Number.isFinite(v.yawDeg));
  if (candidates.length === 0) return { reason: 'no views were rendered, so there is nothing to compare' };
  const best = candidates.reduce((a, b) => (offFront(b.yawDeg) < offFront(a.yawDeg) ? b : a));
  return {
    view: best,
    reason:
      `compared the reference against the view at yaw ${best.yawDeg}° — the side the reference showed; ` +
      'the other yaws are reconstructed by the generator and have no reference to be judged against',
  };
}

export interface ConformanceScore {
  verdict: ConformanceVerdict;
  divergences: string[];
  severity?: number;
  reason: string;
}

/** Turn a parsed reply into a verdict. Pure. */
export function scoreConformance(reply: ConformanceReply): ConformanceScore {
  if (!reply.ok) {
    return {
      verdict: 'unmeasured',
      divergences: [],
      reason: reply.error ?? 'the comparison produced no readable verdict',
    };
  }
  const severity = reply.severity ?? 0;
  const divergences = reply.divergences ?? [];
  if (severity >= MISMATCH_SEVERITY) {
    return {
      verdict: 'mismatch',
      divergences,
      severity,
      reason: `the render is not the object in the reference (severity ${severity}): ${divergences.join(', ') || 'no detail given'}`,
    };
  }
  if (severity >= 1 || divergences.length > 0) {
    return {
      verdict: 'drift',
      divergences,
      severity,
      reason: `minor divergence from the reference (severity ${severity}): ${divergences.join(', ') || 'no detail given'}`,
    };
  }
  return { verdict: 'match', divergences, severity, reason: 'the render depicts the object in the reference' };
}

export interface ConformanceResult extends ConformanceScore {
  /** The render that was actually judged — absent when none could be. */
  judgedView?: RenderedView;
  /** How that view was chosen, or why none was. */
  viewReason: string;
}

export interface ConformanceDeps {
  vision?: (images: VisionImage[], prompt: string) => Promise<string>;
  readImage?: (path: string) => Promise<VisionImage>;
  subject?: string;
}

const defaultReadImage = async (path: string): Promise<VisionImage> => ({
  base64: (await readFile(path)).toString('base64'),
  mime: path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
});

/**
 * Compare a rendered asset against the reference image it was generated from.
 *
 * Exactly one vision call, on the front-most view. Any failure — an unreadable file, a
 * thrown vision call, an unparseable reply — yields `unmeasured` carrying its reason;
 * none of them may become `match`.
 */
export async function critiqueReferenceConformance(
  referencePath: string,
  views: RenderedView[],
  deps: ConformanceDeps = {},
): Promise<ConformanceResult> {
  const picked = pickReferenceView(views);
  if (!picked.view) {
    return {
      verdict: 'unmeasured',
      divergences: [],
      reason: picked.reason,
      viewReason: picked.reason,
    };
  }

  const vision = deps.vision ?? makeRoutedVisionText();
  const readImage = deps.readImage ?? defaultReadImage;

  try {
    const reference = await readImage(referencePath);
    const render = await readImage(picked.view.imagePath);
    const raw = await vision(
      [reference, render],
      buildConformancePrompt(deps.subject ? { subject: deps.subject } : {}),
    );
    return {
      ...scoreConformance(parseConformanceReply(raw)),
      judgedView: picked.view,
      viewReason: picked.reason,
    };
  } catch (e) {
    return {
      verdict: 'unmeasured',
      divergences: [],
      reason: e instanceof Error ? e.message : String(e),
      judgedView: picked.view,
      viewReason: picked.reason,
    };
  }
}
