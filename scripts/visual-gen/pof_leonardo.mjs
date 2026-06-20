#!/usr/bin/env node
/**
 * PoF Leonardo generator — text->image via Leonardo's GPT Image 2 (v2 endpoint) as the
 * 2D step before TripoSR. Submit (v2 /generations, autoregressive gpt-image-2 + a preset
 * style like RENDER_3D), poll (v1 GET /generations/:id), download, then ALWAYS delete the
 * cloud generation (download-then-delete — never leave assets on the account). Same
 * mechanism + cleanup discipline as the personas `leonardo` skill, parameterized for model
 * + preset. Emits POF_LEO_* markers. Needs LEONARDO_API_KEY in env.
 *
 *   node pof_leonardo.mjs --prompt "..." --output out.png --style RENDER_3D \
 *     --quality HIGH --width 1024 --height 1536 [--model gpt-image-2] [--no-cleanup]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const API_KEY = process.env.LEONARDO_API_KEY;
const V2 = 'https://cloud.leonardo.ai/api/rest/v2';
const V1 = 'https://cloud.leonardo.ai/api/rest/v1';

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2), n = argv[i + 1];
      if (n && !n.startsWith('--')) { o[k] = n; i++; } else o[k] = true;
    }
  }
  return o;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, url, body) {
  const opts = { method, headers: { accept: 'application/json', authorization: `Bearer ${API_KEY}` } };
  if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${txt.slice(0, 300)}`);
  try { return JSON.parse(txt); } catch { return txt; }
}

async function main() {
  const a = parseArgs(process.argv);
  if (!API_KEY) { console.log('POF_LEO_ERROR=no LEONARDO_API_KEY'); process.exit(1); }
  if (!a.prompt || !a.output) { console.log('POF_LEO_ERROR=need --prompt --output'); process.exit(1); }

  const params = {
    quality: a.quality || 'HIGH',
    prompt: a.prompt,
    quantity: 1,
    width: parseInt(a.width || '1024', 10),
    height: parseInt(a.height || '1536', 10),
    prompt_enhance: 'OFF',
  };
  if (a.style) params.style = a.style;

  let genId;
  try {
    const sub = await req('POST', `${V2}/generations`, { public: false, model: a.model || 'gpt-image-2', parameters: params });
    genId = sub.generate?.generationId;
    if (!genId) throw new Error('no generationId: ' + JSON.stringify(sub).slice(0, 200));
    console.log(`POF_LEO_GENID=${genId} cost=${sub.generate?.apiCreditCost}`);

    let gen;
    for (let i = 0; i < 80; i++) {
      const d = await req('GET', `${V1}/generations/${genId}`);
      gen = d.generations_by_pk;
      if (gen?.status === 'COMPLETE') break;
      if (gen?.status === 'FAILED') throw new Error('generation FAILED');
      await sleep(3000);
    }
    const img = (gen.generated_images || [])[0];
    if (!img) throw new Error('no images (timed out?)');
    const r = await fetch(img.url);
    const buf = Buffer.from(await r.arrayBuffer());
    const p = resolve(a.output);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buf);
    console.log(`POF_LEO_DONE=${p.replace(/\\/g, '/')} bytes=${buf.length}`);
  } catch (e) {
    console.log('POF_LEO_ERROR=' + String(e.message || e).slice(0, 300));
  } finally {
    if (genId && !a['no-cleanup']) {
      try { await req('DELETE', `${V1}/generations/${genId}`); console.log('POF_LEO_CLEANED=' + genId); }
      catch { console.log('POF_LEO_CLEANUP_FAILED=' + genId); }
    }
  }
}
main();
