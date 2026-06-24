#!/usr/bin/env node
/**
 * Leonardo video generation for the animation pipeline (the Gemini-free replacement
 * for shots/veo_gen.mjs). Generates a combat clip via Hailuo 2.3 and saves the mp4,
 * then DELETES the Leonardo generation (download-then-delete — never leave a mess in
 * the Studio).
 *
 * Modes (project policy):
 *   - t2v (default): text-to-video via `hailuo-2_3`        (~180 credits / 6s)
 *   - i2v:           image-to-video via `hailuo-2_3-fast`  (~128 credits / 6s, more control)
 *                    seeds from a start frame (generated here, or --image <id>).
 *
 * Usage:
 *   node shots/leo_video_gen.mjs --prompt "..." --out shots/leo.mp4
 *   node shots/leo_video_gen.mjs --mode i2v --prompt "..." --out shots/leo.mp4 \
 *        [--image <leonardoImageId> --image-type GENERATED|UPLOADED] \
 *        [--frame-prompt "ready stance ..."] [--duration 6] [--width 1376 --height 768]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv;
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

function loadKey(name) {
  for (const f of ['.env.local', '.env']) {
    try {
      const m = readFileSync(f, 'utf8').match(new RegExp('^' + name + '=(.*)$', 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch {}
  }
  return null;
}

const KEY = loadKey('LEONARDO_API_KEY');
if (!KEY) { console.error('LEONARDO_API_KEY not set'); process.exit(1); }
const B = 'https://cloud.leonardo.ai/api/rest';
const H = (json) => ({ Authorization: `Bearer ${KEY}`, Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mode = arg('mode', 't2v');
const prompt = arg('prompt');
const out = arg('out', `shots/leo_${mode}.mp4`);
const duration = Number(arg('duration', '6'));
const width = Number(arg('width', '1376'));
const height = Number(arg('height', '768'));
const startImageModel = arg('frame-model', 'gpt-image-2'); // GPT Image 2 (v2 /generations)
if (!prompt) { console.error('--prompt is required'); process.exit(2); }

async function del(id) { if (!id) return; const d = await fetch(`${B}/v1/generations/${id}`, { method: 'DELETE', headers: H() }); console.log(`  delete ${id} -> ${d.status}`); }

// Poll a generation to COMPLETE and return its mp4 url.
async function pollVideo(id) {
  for (let i = 0; i < 90; i++) {
    await sleep(4000);
    const p = await (await fetch(`${B}/v1/generations/${id}`, { headers: H() })).json();
    const g = p?.generations_by_pk;
    const m = JSON.stringify(g || {}).match(/https?:\/\/[^"']+\.mp4[^"']*/);
    process.stdout.write(`  poll ${i + 1} status=${g?.status || '?'}${m ? ' MP4!' : ''}   \r`);
    if (m) { console.log(); return m[0]; }
    if (g?.status === 'FAILED') throw new Error('generation FAILED');
  }
  throw new Error('poll timeout');
}

const created = { img: null, vid: null };
try {
  let imageId = arg('image');
  const imageType = arg('image-type', 'GENERATED');

  // I2V: generate a start frame (GPT Image 2, v2) unless one was supplied. Match the
  // video dimensions so the frame fills the clip.
  if (mode === 'i2v' && !imageId) {
    const fp = arg('frame-prompt', `${prompt} — single full-body figure, plain neutral grey studio background, even lighting, head to feet`);
    console.log(`1) generating start frame (${startImageModel})...`);
    const r = await fetch(`${B}/v2/generations`, { method: 'POST', headers: H(true), body: JSON.stringify({ model: startImageModel, public: false, parameters: { prompt: fp.slice(0, 1490), quantity: 1, width, height, prompt_enhance: 'OFF' } }) });
    created.img = (await r.json())?.generate?.generationId;
    for (let i = 0; i < 40; i++) {
      await sleep(2500);
      const g = (await (await fetch(`${B}/v1/generations/${created.img}`, { headers: H() })).json())?.generations_by_pk;
      if (g?.status === 'COMPLETE' && g.generated_images?.length) { imageId = g.generated_images[0].id; break; }
      if (g?.status === 'FAILED') throw new Error('start frame FAILED');
    }
    console.log('   start frame imageId =', imageId);
  }

  // Build the Hailuo v2 request.
  const parameters = { prompt, duration, prompt_enhance: 'OFF', quantity: 1, width, height, audio: false };
  let model = 'hailuo-2_3';
  if (mode === 'i2v') {
    model = 'hailuo-2_3-fast';
    parameters.guidances = { start_frame: [{ image: { id: imageId, type: imageType } }] };
  }
  console.log(`2) ${mode} generate (${model})...`);
  const cr = await fetch(`${B}/v2/generations`, { method: 'POST', headers: H(true), body: JSON.stringify({ model, public: false, parameters }) });
  const ct = await cr.text();
  if (!cr.ok) throw new Error(`create failed (${cr.status}): ${ct.slice(0, 300)}`);
  const cj = JSON.parse(ct);
  created.vid = cj?.generate?.generationId;
  console.log('   generationId =', created.vid, 'cost =', cj?.generate?.cost?.amount, 'credits');
  if (!created.vid) throw new Error('no generationId in create response');

  const url = await pollVideo(created.vid);
  console.log('3) downloading...');
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(out, buf);
  console.log(`   saved ${out} (${(buf.length / 1024).toFixed(0)} KB)`);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  // download-then-delete: never leave generations in the Studio.
  console.log('4) cleanup:');
  await del(created.vid);
  await del(created.img);
}
