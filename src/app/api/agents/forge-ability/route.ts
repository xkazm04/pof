/**
 * POST /api/agents/forge-ability
 *
 * Server-side proxy for the Ability Forge. Takes the fully-built prompt
 * from the client and sends it to Gemini to generate a ForgedAbility JSON.
 *
 * Returns the standard { success, data } envelope. Every failure mode is
 * reported with a message the client classifier (`@/lib/forge-errors`) can
 * map to an honest card: a retired model reads as `config`, a cut-off reply
 * as `truncated`, a half-filled payload as `schema-mismatch` — never as a
 * generic "the AI returned gibberish".
 */

import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { isValidForgedAbility, missingForgedAbilityFields } from '@/lib/forge-errors';
import { logger } from '@/lib/logger';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

/* ── Model config ─────────────────────────────────────────────────────── */

/**
 * gemini-2.0-flash was decommissioned (404 NOT_FOUND) — 2.5-flash is the
 * current flash model, same as the visual-verify and anim-critique seams.
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

function forgeModel(): string {
  return process.env.GEMINI_FORGE_MODEL || DEFAULT_MODEL;
}

/**
 * The forge returns TWO complete C++ files inside one JSON string field, so
 * the old 4096 ceiling truncated all but trivial abilities.
 */
const MAX_OUTPUT_TOKENS = 32768;

/* ── Gemini client singleton ──────────────────────────────────────────── */

let cachedClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/** True when the upstream failure is a model/deployment config problem. */
function isModelConfigFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('404') || m.includes('not_found') || m.includes('not found') ||
    m.includes('decommissioned') || m.includes('deprecated') ||
    m.includes('is not supported')
  );
}

/* ── POST handler ────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const client = getClient();
  if (!client) {
    return apiError('Gemini API key not configured. Set GEMINI_API_KEY in .env.local.', 503);
  }

  let body: { prompt: string };
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    return apiError('Missing "prompt" field', 400);
  }

  const model = forgeModel();

  try {
    const response = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
      config: {
        temperature: 0.4,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    });

    const candidate = response.candidates?.[0];
    const finishReason = String(candidate?.finishReason ?? '');
    const text = candidate?.content?.parts?.[0]?.text;

    // Truncation is reported before parsing: a cut-off reply is unparseable
    // too, but "hit the output token limit" is the honest cause.
    if (finishReason.toUpperCase().includes('MAX_TOKENS')) {
      return apiError(
        `Generation was truncated — the model hit the ${MAX_OUTPUT_TOKENS}-token output limit before the ability was complete. Try a simpler ability, or raise the limit.`,
        502,
      );
    }

    if (!text) {
      return apiError('Empty response from Gemini', 502);
    }

    // Parse the JSON response — Gemini may wrap it in markdown fences
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    let forged: unknown;
    try {
      forged = JSON.parse(cleaned);
    } catch {
      return apiError('Failed to parse Gemini response as JSON', 502);
    }

    // Full-shape validation — ForgeResult deep-dereferences tags / stats /
    // comboEntry / radarValues, so a partial payload must never reach it.
    if (!isValidForgedAbility(forged)) {
      const missing = missingForgedAbilityFields(forged);
      return apiError(
        `Incomplete ability generated — missing or malformed: ${missing.join(', ')}`,
        502,
      );
    }

    const ability: ForgedAbility = forged;
    return apiSuccess(ability);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gemini API call failed';
    if (isModelConfigFailure(message)) {
      logger.error('[forge-ability] model unavailable', model, message);
      return apiError(
        `Ability Forge model "${model}" is unavailable (model not found — it may have been decommissioned). Set GEMINI_FORGE_MODEL to a current model. Upstream: ${message}`,
        503,
      );
    }
    return apiError(message, 502);
  }
}
