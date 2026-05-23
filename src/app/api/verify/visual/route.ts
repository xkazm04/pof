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

interface VisualVerdict {
  visibleElements: string[];
  anyEmptyOrZeroWidth: boolean;
  verdict: 'pass' | 'fail';
  notes: string;
}

export async function POST(request: NextRequest) {
  let body: { moduleId?: string; itemId?: string; screenshotPath?: string; projectPath?: string };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const { moduleId, itemId, screenshotPath, projectPath } = body;
  if (!moduleId || !itemId || !screenshotPath) {
    return apiError('Missing "moduleId", "itemId", or "screenshotPath"', 400);
  }

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

  let verdict: VisualVerdict;
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: pngBase64 } },
            { text: HUD_CHECK_PROMPT },
          ],
        },
      ],
      config: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return apiError('Empty response from Gemini', 502);

    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    verdict = JSON.parse(cleaned) as VisualVerdict;
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Gemini visual check failed', 502);
  }

  if (verdict.verdict !== 'pass' && verdict.verdict !== 'fail') {
    return apiError('Gemini returned an invalid verdict shape', 502);
  }

  recordVisualVerification({
    moduleId,
    itemId,
    projectPath: projectPath ?? null,
    screenshotPath,
    verdict: verdict.verdict,
    anyEmpty: !!verdict.anyEmptyOrZeroWidth,
    elements: verdict.visibleElements ?? [],
    notes: verdict.notes ?? '',
  });

  eventBus.emit(
    'eval.visual',
    {
      moduleId,
      itemId,
      verdict: verdict.verdict,
      anyEmpty: !!verdict.anyEmptyOrZeroWidth,
      notes: verdict.notes ?? '',
      screenshotPath,
    },
    'verify-visual-route',
  );

  return apiSuccess(verdict);
}
