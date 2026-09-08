/**
 * POST /api/verify/visual
 *
 * Host-side half of the agentic visual-verification step (folder-04 §5 / 2a).
 * The dispatched Claude CLI launches the slice, takes a HighResShot, and POSTs
 * the screenshot path here. This route reads the PNG (same machine), runs a
 * Gemini vision check with a server-owned HUD prompt, records the verdict, and
 * emits `eval.visual`. Advisory — the caller does not block on a fail.
 *
 * Returns the standard { success, data } envelope.
 */

import { NextRequest } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordVisualVerification } from '@/lib/visual-verification-db';
import { eventBus } from '@/lib/event-bus';
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

function normaliseVerdict(mode: CheckMode, raw: AnyVerdict): NormalisedVerdict {
  if (mode === 'texture') {
    const t = raw as TextureVerdict;
    return {
      verdict: t.verdict,
      anyEmpty: t.tileable === false || (t.issues?.length ?? 0) > 0,
      elements: t.issues ?? [],
      notes: t.notes ?? '',
    };
  }
  if (mode === 'lighting') {
    const l = raw as LightingVerdict;
    return {
      verdict: l.verdict,
      // A black / un-lit scene is the flagged defect (mirrors anyEmpty for HUD).
      anyEmpty: l.lit === false,
      elements: [],
      notes: l.notes ?? '',
    };
  }
  if (mode === 'character') {
    const c = raw as CharacterVerdict;
    return {
      verdict: c.verdict,
      // A missing humanoid or a T-posed mesh is the flagged defect.
      anyEmpty: c.humanoidVisible === false || c.tPosed === true,
      elements: [],
      notes: c.notes ?? '',
    };
  }
  const h = raw as HudVerdict;
  return {
    verdict: h.verdict,
    anyEmpty: !!h.anyEmptyOrZeroWidth,
    elements: h.visibleElements ?? [],
    notes: h.notes ?? '',
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

  const { moduleId, itemId, screenshotPath, projectPath } = body;
  if (!moduleId || !itemId || !screenshotPath) {
    return apiError('Missing "moduleId", "itemId", or "screenshotPath"', 400);
  }
  const mode: CheckMode =
    body.mode === 'texture'
      ? 'texture'
      : body.mode === 'lighting'
        ? 'lighting'
        : body.mode === 'character'
          ? 'character'
          : 'hud';
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
  try {
    pngBase64 = readFileSync(screenshotPath).toString('base64');
  } catch (e) {
    return apiError(`Failed to read screenshot: ${e instanceof Error ? e.message : 'unknown'}`, 500);
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

  if (raw.verdict !== 'pass' && raw.verdict !== 'fail') {
    return apiError('Gemini returned an invalid verdict shape', 502);
  }

  const norm = normaliseVerdict(mode, raw);

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
