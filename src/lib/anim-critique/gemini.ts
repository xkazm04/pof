/**
 * Default vision-model seam for animation critique: Gemini multi-image. Sends the whole
 * filmstrip (every frame as an inlineData part) + the critique prompt in one call. This is
 * the I/O seam `critiqueAnimation` injects — not unit-tested (live API), same as
 * mesh-critique's spawn seam. Reuses the @google/genai client the visual-verify route uses.
 */
import { GoogleGenAI } from '@google/genai';
import type { VisionImage } from './critique';

export interface GeminiVisionOptions {
  apiKey?: string;
  /** Override the model; default gemini-2.5-flash (proven with this key), or $GEMINI_CRITIQUE_MODEL. */
  model?: string;
}

export function makeGeminiVision(opts: GeminiVisionOptions = {}) {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  const model = opts.model ?? process.env.GEMINI_CRITIQUE_MODEL ?? 'gemini-2.5-flash';

  return async (images: VisionImage[], prompt: string): Promise<string> => {
    if (!apiKey) throw new Error('GEMINI_API_KEY (or GOOGLE_AI_API_KEY) not set');
    const client = new GoogleGenAI({ apiKey });
    const parts = [
      ...images.map((img) => ({ inlineData: { mimeType: img.mime, data: img.base64 } })),
      { text: prompt },
    ];
    const res = await client.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('empty response from Gemini');
    return text;
  };
}
