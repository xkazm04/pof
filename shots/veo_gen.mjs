import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'node:fs';
function envKey(){ if(process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for(const f of ['.env.local','.env']){ try{ const m=readFileSync(f,'utf8').match(/^\s*(?:GEMINI_API_KEY|GOOGLE_AI_API_KEY)\s*=\s*["']?([^"'\r\n]+)/m); if(m) return m[1].trim(); }catch{} } return null; }
const key = envKey();
const ai = new GoogleGenAI({ apiKey: key });
const prompt = 'Full-body wide shot of a single warrior performing one clean, powerful overhead two-handed sword strike: clear anticipation windup, fast downward strike, follow-through. Plain neutral studio background, even lighting, static camera, the entire body visible from head to feet, no other people.';
let op = await ai.models.generateVideos({ model:'veo-3.0-fast-generate-001', prompt, config:{ numberOfVideos:1 } });
console.log('submitted:', op?.name);
const t0 = Date.now();
while (!op.done) {
  await new Promise(r=>setTimeout(r, 8000));
  op = await ai.operations.getVideosOperation({ operation: op });
  console.log('polling... done='+op.done+' ('+Math.round((Date.now()-t0)/1000)+'s)');
  if ((Date.now()-t0) > 240000) { console.log('TIMEOUT'); break; }
}
const vids = op?.response?.generatedVideos;
if (!vids?.length) { console.log('NO_VIDEO result keys: '+Object.keys(op?.response||{})); process.exit(0); }
const v = vids[0].video;
const out = 'shots/veo/strike.mp4';
try {
  await ai.files.download({ file: v, downloadPath: out });
  console.log('DOWNLOADED '+out);
} catch (e) {
  // fallback: bytes or uri
  if (v.videoBytes) { writeFileSync(out, Buffer.from(v.videoBytes,'base64')); console.log('WROTE bytes '+out); }
  else if (v.uri) {
    const res = await fetch(v.uri + (v.uri.includes('?')?'&':'?') + 'key='+key);
    writeFileSync(out, Buffer.from(await res.arrayBuffer())); console.log('FETCHED uri '+out);
  } else console.log('download failed: '+(e?.message||e)+' video keys: '+Object.keys(v||{}));
}
