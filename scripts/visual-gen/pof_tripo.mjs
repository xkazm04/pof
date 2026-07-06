#!/usr/bin/env node
/**
 * PoF Tripo3D generator — the CLOUD 3D-gen smoke CLI (counterpart to the local
 * pof_triposr.py / pof_hunyuan.py). Drives Tripo's REST API: optional image upload →
 * create task → poll → download the .glb. Mirrors the server seam in
 * src/lib/visual-gen/tripo-runner.ts; this script is the quick live test that needs
 * no dev server. Emits POF_TRIPO_* markers. Needs TRIPO_API_KEY in env.
 *
 *   node pof_tripo.mjs --prompt "a stylized fantasy warrior, full body" --output out.glb
 *   node pof_tripo.mjs --image ref.png --output out.glb
 *   # optional: --model v2.5-20250123 --pbr --quad --face-limit 40000
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'fs';
import { dirname, resolve, basename } from 'path';

const API_KEY = process.env.TRIPO_API_KEY;
const BASE = 'https://api.tripo3d.ai/v2/openapi';

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
const auth = () => ({ authorization: `Bearer ${API_KEY}` });
const imgType = (p) => { const e = (p.split('.').pop() || '').toLowerCase(); return e === 'jpeg' ? 'jpg' : e || 'png'; };

async function jsonReq(method, url, body) {
  const opts = { method, headers: { ...auth() } };
  if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  return j;
}

async function uploadImage(path) {
  const bytes = readFileSync(path);
  const form = new FormData();
  form.append('file', new Blob([bytes]), basename(path));
  const res = await fetch(`${BASE}/upload`, { method: 'POST', headers: { ...auth() }, body: form });
  const j = await res.json().catch(() => ({}));
  if (j.code !== 0 || !j.data?.image_token) throw new Error(`upload failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.data.image_token;
}

async function main() {
  const a = parseArgs(process.argv);
  if (!API_KEY) { console.log('POF_TRIPO_ERROR=no TRIPO_API_KEY in env'); { process.exitCode = 1; return; } }
  if (!a.output || (!a.prompt && !a.image)) { console.log('POF_TRIPO_ERROR=need --output and one of --prompt / --image'); { process.exitCode = 1; return; } }

  const opt = {};
  if (a.model) opt.model_version = a.model;
  if (a['face-limit']) opt.face_limit = parseInt(a['face-limit'], 10);
  if (a.pbr) opt.pbr = true;
  if (a.quad) opt.quad = true;

  let body;
  try {
    if (a.image) {
      if (!existsSync(a.image)) throw new Error(`image not found: ${a.image}`);
      const token = await uploadImage(a.image);
      console.log(`POF_TRIPO_UPLOAD=${token}`);
      body = { type: 'image_to_model', file: { type: imgType(a.image), file_token: token }, ...opt };
    } else {
      body = { type: 'text_to_model', prompt: a.prompt, ...opt };
    }

    const created = await jsonReq('POST', `${BASE}/task`, body);
    if (created.code !== 0 || !created.data?.task_id) {
      console.log(`POF_TRIPO_ERROR=create ${created.code}: ${created.message || 'unknown'}${created.suggestion ? ' (' + created.suggestion + ')' : ''}`);
      { process.exitCode = 1; return; }
    }
    const taskId = created.data.task_id;
    console.log(`POF_TRIPO_TASK=${taskId}`);

    const deadline = Date.now() + parseInt(a['max-ms'] || '600000', 10);
    let out;
    while (Date.now() < deadline) {
      const s = await jsonReq('GET', `${BASE}/task/${taskId}`);
      const d = s.data || {};
      const status = String(d.status || '').toLowerCase();
      console.log(`POF_TRIPO_STATUS=${status} progress=${d.progress ?? '?'}`);
      if (status === 'success') { out = d.output || {}; break; }
      if (['failed', 'cancelled', 'banned', 'expired', 'unknown'].includes(status)) {
        console.log(`POF_TRIPO_ERROR=task ${status}`); { process.exitCode = 1; return; }
      }
      await sleep(4000);
    }
    if (!out) { console.log('POF_TRIPO_ERROR=timed out'); { process.exitCode = 1; return; } }

    const url = out.pbr_model || out.model || out.base_model;
    if (!url) { console.log('POF_TRIPO_ERROR=no model url in output'); { process.exitCode = 1; return; } }
    const dl = await fetch(url);
    if (!dl.ok) { console.log(`POF_TRIPO_ERROR=download ${dl.status}`); { process.exitCode = 1; return; } }
    const outPath = resolve(a.output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(await dl.arrayBuffer()));
    console.log(`POF_TRIPO_BYTES=${statSync(outPath).size}`);
    console.log(`POF_TRIPO_DONE=${outPath}`);
  } catch (e) {
    console.log(`POF_TRIPO_ERROR=${e instanceof Error ? e.message : String(e)}`);
    { process.exitCode = 1; return; }
  }
}
main();
