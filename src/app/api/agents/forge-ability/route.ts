/**
 * POST /api/agents/forge-ability
 *
 * Server-side proxy for the Ability Forge. Takes the fully-built prompt
 * from the client and sends it to Gemini to generate a ForgedAbility JSON.
 *
 * Returns the standard { success, data } envelope.
 */

import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { apiSuccess, apiError } from '@/lib/api-utils';
import type { ForgedAbility } from '@/lib/prompts/ability-forge';

/* ── Gemini client singleton ──────────────────────────────────────────── */

let cachedClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
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

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
      config: {
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return apiError('Empty response from Gemini', 502);
    }

    // Parse the JSON response — Gemini may wrap it in markdown fences
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    let forged: ForgedAbility;
    try {
      forged = JSON.parse(cleaned);
    } catch {
      return apiError('Failed to parse Gemini response as JSON', 502);
    }

    // Basic validation
    if (!forged.className || !forged.headerCode || !forged.cppCode) {
      return apiError('Incomplete ability generated — missing className, headerCode, or cppCode', 502);
    }

    return apiSuccess(forged);
  } catch (e) {
    return apiError(
      e instanceof Error ? e.message : 'Gemini API call failed',
      502,
    );
  }
}
