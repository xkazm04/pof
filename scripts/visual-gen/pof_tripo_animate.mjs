#!/usr/bin/env node
/**
 * PoF Tripo3D animation chain — the CLOUD auto-rig + preset-animation pipeline on top
 * of a Tripo-generated model. Sequence: animate_prerigcheck (anatomy gate) ->
 * animate_rig ->
 * animate_retarget (a preset like run/walk, baked, exported with geometry) -> download
 * the animated skeletal FBX for UE import. Explores the rig/animation services PoF has
 * not solved locally. Emits POF_TRIPO_* markers. Needs TRIPO_API_KEY in env.
 *
 *   node pof_tripo_animate.mjs --model-task <id> --animation preset:run --output out.fbx
 *   # optional: --spec tripo|mixamo  --rig-type biped  --rig-task <id> (skip rigging)
 *   #           --no-geometry (anim only)  --format fbx|glb
 *   #           --force-rig (skip the anatomy gate — a wrong rig SUCCEEDS, so opt in only)
 */
import { writeFileSync, mkdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';

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

async function post(body) {
  const res = await fetch(`${BASE}/task`, { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({}));
}
async function get(id) {
  const res = await fetch(`${BASE}/task/${id}`, { headers: { ...auth() } });
  return res.json().catch(() => ({}));
}

/** Create a task, poll to success, return the full output object. */
async function runTask(label, body, maxMs = 600000) {
  const created = await post(body);
  if (created.code !== 0 || !created.data?.task_id) {
    throw new Error(`${label} create ${created.code}: ${created.message || 'unknown'}${created.suggestion ? ' (' + created.suggestion + ')' : ''}`);
  }
  const id = created.data.task_id;
  console.log(`POF_TRIPO_${label.toUpperCase()}=${id}`);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const s = await get(id);
    const d = s.data || {};
    const status = String(d.status || '').toLowerCase();
    console.log(`POF_TRIPO_STATUS=${label}:${status} progress=${d.progress ?? '?'}`);
    if (status === 'success') return { id, output: d.output || {} };
    if (['failed', 'cancelled', 'banned', 'expired', 'unknown'].includes(status)) throw new Error(`${label} task ${status}`);
    await sleep(4000);
  }
  throw new Error(`${label} timed out`);
}

async function main() {
  const a = parseArgs(process.argv);
  if (!API_KEY) { console.log('POF_TRIPO_ERROR=no TRIPO_API_KEY in env'); process.exitCode = 1; return; }
  if (!a.output || (!a['model-task'] && !a['rig-task'])) {
    console.log('POF_TRIPO_ERROR=need --output and one of --model-task / --rig-task'); process.exitCode = 1; return;
  }
  const format = a.format || 'fbx';
  const animation = a.animation || 'preset:run';

  try {
    // 1. Rig (unless a rig task id was supplied).
    let rigTaskId = a['rig-task'];
    if (!rigTaskId) {
      const wantRig = a['rig-type'] || 'biped';
      // GATE ON ANATOMY BEFORE RIGGING. This step was listed in this file's own docstring
      // and never implemented, so every model went to the biped rigger unconditionally.
      // That matters because the failure is silent: handed a spider, a quadruped or any
      // non-humanoid, a biped rigger does not error — it fits a human skeleton to whatever
      // silhouette it got and returns a rig, so the task succeeds, the mesh imports, and
      // the defect only shows as limbs following the wrong bones once a clip plays.
      // See the `creature-rig-not-biped` gotcha. `--force-rig` keeps the old behaviour
      // for a deliberate experiment; it must be asked for, never assumed.
      const pre = await runTask('prerigcheck', {
        type: 'animate_prerigcheck',
        original_model_task_id: a['model-task'],
      });
      const riggable = pre.output.riggable;
      const detected = pre.output.rig_type;
      console.log(`POF_TRIPO_PRERIG=riggable=${riggable} rig_type=${detected ?? 'unknown'}`);
      if (!a['force-rig']) {
        if (riggable === false) {
          console.log('POF_TRIPO_ERROR=model reported NOT riggable by animate_prerigcheck; rigging it anyway returns a rig that silently mis-follows the mesh (pass --force-rig to override)');
          process.exitCode = 1;
          return;
        }
        if (detected && detected !== wantRig) {
          console.log(`POF_TRIPO_ERROR=anatomy mismatch: prerigcheck detected rig_type='${detected}' but '${wantRig}' was requested — a mismatched auto-rig SUCCEEDS and returns a wrong rig rather than failing, so this refuses instead (rig the halves separately, or pass --rig-type ${detected} / --force-rig)`);
          process.exitCode = 1;
          return;
        }
      }
      const rigBody = { type: 'animate_rig', original_model_task_id: a['model-task'], out_format: format, rig_type: wantRig, spec: a.spec || 'tripo' };
      const rig = await runTask('rig', rigBody);
      rigTaskId = rig.id;
    }

    // 2. Retarget a preset animation onto the rigged model, baked, with geometry.
    const retBody = {
      type: 'animate_retarget',
      original_model_task_id: rigTaskId,
      animation,
      out_format: format,
      bake_animation: true,
      export_with_geometry: a['no-geometry'] ? false : true,
    };
    const ret = await runTask('anim', retBody);

    const url = ret.output.model || ret.output.pbr_model || ret.output.base_model || ret.output.rigged_model;
    if (!url) { console.log(`POF_TRIPO_ERROR=no model url in retarget output: ${JSON.stringify(ret.output).slice(0, 300)}`); process.exitCode = 1; return; }
    const dl = await fetch(url);
    if (!dl.ok) { console.log(`POF_TRIPO_ERROR=download ${dl.status}`); process.exitCode = 1; return; }
    const outPath = resolve(a.output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(await dl.arrayBuffer()));
    console.log(`POF_TRIPO_BYTES=${statSync(outPath).size}`);
    console.log(`POF_TRIPO_DONE=${outPath}`);
  } catch (e) {
    console.log(`POF_TRIPO_ERROR=${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}
main();
