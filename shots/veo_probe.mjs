import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'node:fs';
function envKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const f of ['.env.local', '.env']) {
    try {
      const t = readFileSync(f, 'utf8');
      const m = t.match(/^\s*(?:GEMINI_API_KEY|GOOGLE_AI_API_KEY)\s*=\s*["']?([^"'\r\n]+)/m);
      if (m) return m[1].trim();
    } catch {}
  }
  return null;
}
const key = envKey();
if (!key) { console.log('NO KEY FOUND'); process.exit(0); }
console.log('key length:', key.length);
const ai = new GoogleGenAI({ apiKey: key });
for (const m of ['veo-3.0-fast-generate-001','veo-3.0-generate-001','veo-2.0-generate-001']) {
  try {
    const op = await ai.models.generateVideos({ model: m, prompt: 'a person performing a single overhead two-handed sword swing, full body, plain background', config: { numberOfVideos: 1 } });
    console.log(`VEO_OK ${m} -> ${op?.name ?? 'op'}`);
    process.exit(0);
  } catch (e) {
    console.log(`VEO_ERR ${m}: ${(e?.message || String(e)).slice(0,200)}`);
  }
}
