/**
 * POST /api/verify/visual
 *
 * Host-side half of the agentic visual-verification step (folder-04 §5 / 2a).
 * The dispatched Claude CLI launches the slice, takes a HighResShot, and POSTs
 * the screenshot path here. This route reads the PNG (same machine), runs a
 * routed vision check with a server-owned prompt, records the verdict, and
 * emits `eval.visual`. Advisory — the caller does not block on a fail.
 *
 * Returns the standard { success, data } envelope.
 */

import { NextRequest } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordVisualVerification } from '@/lib/visual-verification-db';
import { eventBus } from '@/lib/event-bus';
import { logger } from '@/lib/logger';
import { recognize } from '@/lib/vision/router';
import { EFFORT_ORDER, type VisionEffort } from '@/lib/vision/types';
import { CHECK_PROMPTS, type CheckMode } from '@/lib/vision/check-prompts';

/** Normalised verdict written to the (shared) visual_verifications record. */
interface NormalisedVerdict {
  verdict: 'pass' | 'fail';
  /** A flagged defect exists (empty HUD element, or a seam/non-tileable texture). */
  anyEmpty: boolean;
  elements: string[];
  notes: string;
}

interface HudVerdict {
  visibleElements?: string[];
  anyEmptyOrZeroWidth?: boolean;
  verdict: 'pass' | 'fail';
  notes?: string;
}

interface TextureVerdict {
  tileable?: boolean;
  issues?: string[];
  verdict: 'pass' | 'fail';
  notes?: string;
}

interface LightingVerdict {
  lit?: boolean;
  shadowed?: boolean;
  verdict: 'pass' | 'fail';
  notes?: string;
}

interface CharacterVerdict {
  humanoidVisible?: boolean;
  tPosed?: boolean;
  distinct?: boolean;
  verdict: 'pass' | 'fail';
  notes?: string;
}

type AnyVerdict = HudVerdict | TextureVerdict | LightingVerdict | CharacterVerdict;

/** A model's JSON is untrusted: what is stored is what the record's types promise. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function normaliseVerdict(mode: CheckMode, raw: AnyVerdict): NormalisedVerdict {
  if (mode === 'texture') {
    const t = raw as TextureVerdict;
    return {
      verdict: t.verdict,
      anyEmpty: t.tileable === false || strings(t.issues).length > 0,
      elements: strings(t.issues),
      notes: text(t.notes),
    };
  }
  if (mode === 'lighting') {
    const l = raw as LightingVerdict;
    return {
      verdict: l.verdict,
      // A black / un-lit scene is the flagged defect (mirrors anyEmpty for HUD).
      anyEmpty: l.lit === false,
      elements: [],
      notes: text(l.notes),
    };
  }
  if (mode === 'character') {
    const c = raw as CharacterVerdict;
    return {
      verdict: c.verdict,
      // A missing humanoid or a T-posed mesh is the flagged defect.
      anyEmpty: c.humanoidVisible === false || c.tPosed === true,
      elements: [],
      notes: text(c.notes),
    };
  }
  const h = raw as HudVerdict;
  return {
    verdict: h.verdict,
    anyEmpty: !!h.anyEmptyOrZeroWidth,
    elements: strings(h.visibleElements),
    notes: text(h.notes),
  };
}

export async function POST(request: NextRequest) {
  let body: {
    moduleId?: string; itemId?: string; screenshotPath?: string; projectPath?: string;
    mode?: string; effort?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return apiError('Request body must be a JSON object', 400);
  }

  // Checked before anything is read or billed: these reach fs and a SQLite bind as given.
  for (const field of ['moduleId', 'itemId', 'screenshotPath', 'projectPath'] as const) {
    if (body[field] != null && typeof body[field] !== 'string') {
      return apiError(`"${field}" must be a string`, 400);
    }
  }

  const { moduleId, itemId, screenshotPath, projectPath } = body;
  if (!moduleId || !itemId || !screenshotPath) {
    return apiError('Missing "moduleId", "itemId", or "screenshotPath"', 400);
  }
  // Refused like `effort` below: an unknown mode used to run, and be billed as, the HUD check.
  if (body.mode !== undefined && !(typeof body.mode === 'string' && Object.hasOwn(CHECK_PROMPTS, body.mode))) {
    return apiError(`Invalid "mode": expected one of ${Object.keys(CHECK_PROMPTS).join(' | ')}`, 400);
  }
  const mode = (body.mode ?? 'hud') as CheckMode;
  const prompt = CHECK_PROMPTS[mode];

  // Effort is validated against the shared vocabulary rather than defaulted, because a
  // silently-corrected level is the caller believing they bought thinking they did not.
  if (body.effort !== undefined && !EFFORT_ORDER.includes(body.effort as VisionEffort)) {
    return apiError(`Invalid "effort": expected one of ${EFFORT_ORDER.join(' | ')}`, 400);
  }
  const effort = body.effort as VisionEffort | undefined;

  if (!existsSync(screenshotPath)) {
    return apiError(`Screenshot not found: ${screenshotPath}`, 404);
  }

  let pngBase64: string;
  let isPng = true;
  try {
    const bytes = readFileSync(screenshotPath);
    isPng = bytes.length === 0 || (bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE));
    pngBase64 = bytes.toString('base64');
  } catch (e) {
    return apiError(`Failed to read screenshot: ${e instanceof Error ? e.message : 'unknown'}`, 500);
  }
  // A frame the capture has not finished flushing: a verdict on it would be a billed "fail".
  if (pngBase64.length === 0) {
    return apiError(`Screenshot is empty (0 bytes), the capture may still be writing: ${screenshotPath}`, 422);
  }

  // The provider is told image/png: refuse a file that is not one before it leaves the machine.
  if (!isPng) {
    return apiError(`Screenshot is not a PNG (signature mismatch): ${screenshotPath}`, 422);
  }

  // THE CHOKEPOINT. This route no longer names an eye: it asks for the `recognize`
  // capability and `@/lib/vision`'s plan decides who answers. An empty answer is already
  // read as a refusal there, so the old "Empty response from Gemini" branch is unreachable
  // by construction rather than by convention.
  let routed;
  try {
    routed = await recognize(
      { images: [{ base64: pngBase64, mime: 'image/png' }], prompt, ...(effort ? { effort } : {}) },
      {},
    );
  } catch (e) {
    // Nothing in the plan could serve. The router's message carries the whole trail — every
    // eye that dropped out and why — which is what an operator needs in order to act, rather
    // than the name of one env var that may not even belong to the eye the plan wanted.
    return apiError(e instanceof Error ? e.message : 'visual check failed', 503);
  }

  let raw: AnyVerdict;
  try {
    const cleaned = routed.text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    raw = JSON.parse(cleaned) as AnyVerdict;
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'visual check returned unparseable JSON', 502);
  }

  // `null` parses fine and has no `.verdict`; a bare `raw.verdict` here was an unenveloped 500.
  const verdict = (raw as AnyVerdict | null)?.verdict;
  if (verdict !== 'pass' && verdict !== 'fail') {
    return apiError(`${routed.provider} returned an invalid verdict shape`, 502);
  }

  const norm = normaliseVerdict(mode, raw);

  // The judgement is already paid for: a storage failure must not discard it, and must not
  // pretend it was kept either.
  let recordError: string | undefined;
  try {
    recordVisualVerification({
      moduleId,
      itemId,
      projectPath: projectPath ?? null,
      screenshotPath,
      verdict: norm.verdict,
      anyEmpty: norm.anyEmpty,
      elements: norm.elements,
      notes: norm.notes,
    });
  } catch (e) {
    recordError = e instanceof Error ? e.message : 'unknown';
    logger.warn(`[verify/visual] verdict not recorded for ${moduleId}/${itemId}: ${recordError}`);
  }

  eventBus.emit(
    'eval.visual',
    {
      moduleId,
      itemId,
      verdict: norm.verdict,
      anyEmpty: norm.anyEmpty,
      notes: norm.notes,
      screenshotPath,
    },
    'verify-visual-route',
  );

  // Provenance travels WITH the verdict: which eye answered, at which effort, and whether
  // that effort was the one asked for. A judgement whose author is unrecorded is not
  // evidence, and an effort silently downgraded is a bill the caller thinks they paid.
  return apiSuccess({
    ...raw,
    ...(recordError ? { recorded: false, recordError } : {}),
    provenance: {
      provider: routed.provider,
      model: routed.model,
      effortRequested: effort,
      effortServed: routed.effortServed,
      effortDowngraded: routed.effortDowngraded,
      trail: routed.trail,
    },
  });
}
