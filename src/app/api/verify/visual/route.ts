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
import { GoogleGenAI } from '@google/genai';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { recordVisualVerification } from '@/lib/visual-verification-db';
import { eventBus } from '@/lib/event-bus';

/* ── Gemini client (re-checks the key each call so the no-key path is reliable) ── */

let cachedClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/* ── Server-owned HUD-check prompt (load-bearing wording, see e2e hud-check.txt) ── */

const HUD_CHECK_PROMPT = `You are inspecting a screenshot of a video game taken right after a HUD/UI change.
List every on-screen HUD/UI element (health/mana bars, text labels, ability slots, numbers) and its screen position.
Critically determine whether ANY element reads as empty, blank, or zero-width — e.g. a progress bar with no visible fill, or an element that failed to render.
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "visibleElements": string[],
  "anyEmptyOrZeroWidth": boolean,
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if anyEmptyOrZeroWidth is true or if no HUD is visible at all.`;

/* ── Server-owned texture-quality prompt (folder-06 §6) ── */

const TEXTURE_CHECK_PROMPT = `You are inspecting a single texture image intended to tile seamlessly across a 3D surface.
Determine whether it is a genuinely SEAMLESS, TILEABLE texture: imagine it repeated edge-to-edge in a grid.
List any obvious defects — a visible SEAM at the edges, BAKED-IN lighting or shadow/highlight, a dominant feature that would visibly repeat, or anything that breaks the tile.
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "tileable": boolean,
  "issues": string[],
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if tileable is false or any seam / baked-in lighting is present.`;

/* ── Server-owned lighting-smoke prompt (folder-05 §5) ── */

const LIGHTING_CHECK_PROMPT = `You are inspecting a screenshot of a 3D game environment (an arena or level) taken right after an environment/lighting change.
Determine whether the scene is actually LIT and rendering — not a black / un-lit failure (the class of bug where static-mesh geometry renders black because lighting was never baked).
- Is the scene lit (surfaces and colour visible), or is it black / un-lit?
- Do surfaces show shading and shadows (graded lighting, depth), or are they flat-shaded / uniformly bright?
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "lit": boolean,
  "shadowed": boolean,
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if the scene reads as black / un-lit (lit is false).`;

/* ── Server-owned character-check prompt (folder-02 §6) ── */

const CHARACTER_CHECK_PROMPT = `You are inspecting a screenshot of a 3D game taken right after a character setup change.
Determine whether the on-screen character(s) render correctly:
- Is a HUMANOID character visible at all (not missing / invisible / a bare capsule)?
- Is it in a NATURAL pose (idle / standing / walking), or stuck in a default T-POSE / A-POSE (arms straight out to the sides = the Animation Blueprint never drove the mesh)?
- If two characters are present (player + enemy), are they clearly VISUALLY DISTINCT from each other (e.g. obviously different colours), or too similar to tell apart?
Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{
  "humanoidVisible": boolean,
  "tPosed": boolean,
  "distinct": boolean,
  "verdict": "pass" | "fail",
  "notes": string
}
Set "verdict" to "fail" if humanoidVisible is false or tPosed is true.`;

type CheckMode = 'hud' | 'texture' | 'lighting' | 'character';

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
  let body: { moduleId?: string; itemId?: string; screenshotPath?: string; projectPath?: string; mode?: string };
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
  const prompt =
    mode === 'texture'
      ? TEXTURE_CHECK_PROMPT
      : mode === 'lighting'
        ? LIGHTING_CHECK_PROMPT
        : mode === 'character'
          ? CHARACTER_CHECK_PROMPT
          : HUD_CHECK_PROMPT;

  if (!existsSync(screenshotPath)) {
    return apiError(`Screenshot not found: ${screenshotPath}`, 404);
  }

  const client = getClient();
  if (!client) {
    return apiError('Gemini API key not configured. Set GEMINI_API_KEY in .env.local.', 503);
  }

  let pngBase64: string;
  try {
    pngBase64 = readFileSync(screenshotPath).toString('base64');
  } catch (e) {
    return apiError(`Failed to read screenshot: ${e instanceof Error ? e.message : 'unknown'}`, 500);
  }

  let raw: AnyVerdict;
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: pngBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return apiError('Empty response from Gemini', 502);

    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    raw = JSON.parse(cleaned) as AnyVerdict;
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Gemini visual check failed', 502);
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

  return apiSuccess(raw);
}
