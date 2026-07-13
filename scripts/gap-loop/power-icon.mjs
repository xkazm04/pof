/**
 * gap-loop — power a 2D icon/art gallery step with a REAL Leonardo (Lucid Origin)
 * image, Qwen-VL gated, injected into the artifact's genHistory as a data-URL swatch,
 * then VLM-judged. Self-contained: image bytes travel inside the artifact; a local copy
 * is saved (gitignored generated/icons/) only for the Qwen gate.
 *
 * Promoted from the batch-3 scratchpad (2026-07-13) with Style DNA wired in: every
 * generation passes `applyStyleDna: true` so campaign art inherits the project's active
 * style profile (distill one via POST /api/visual-gen/style-dna). Set POF_STYLE_DNA=off
 * to opt out for a style-neutral batch.
 *
 *   node scripts/gap-loop/power-icon.mjs '<json spec>'
 * spec = {catalogId, entityId, step, name, prompt, subject, width?, height?, tier?}
 * env: POF_ORIGIN (default http://localhost:3001), POF_TRIPOSR_ROOT (venv for the gate),
 *      POF_STYLE_DNA=off (skip style injection)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ORIGIN = process.env.POF_ORIGIN || 'http://localhost:3001';
const TRIPOSR_ROOT = process.env.POF_TRIPOSR_ROOT || 'C:/Users/kazda/kiro/TripoSR';
const VENV = join(TRIPOSR_ROOT, '.venv', 'Scripts', 'python.exe');
const CRITIQUE = join(process.cwd(), 'scripts', 'visual-gen', 'pof_vlm_critique.py');
const OUTDIR = join(process.cwd(), 'generated', 'icons');
const APPLY_STYLE = process.env.POF_STYLE_DNA !== 'off';
const PASS = 7;

const spec = JSON.parse(process.argv[2]);
const { catalogId, entityId, step, name } = spec;
const width = spec.width || 512, height = spec.height || 512;
mkdirSync(OUTDIR, { recursive: true });

let styleApplied = null;

async function genImage(prompt) {
  const r = await fetch(`${ORIGIN}/api/leonardo`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'image', prompt, opts: { width, height }, applyStyleDna: APPLY_STYLE }),
  });
  const j = await r.json();
  if (j.success === false) throw new Error('leonardo: ' + j.error);
  const b64 = j.data?.imageBase64;
  if (!b64) throw new Error('no imageBase64: ' + JSON.stringify(j).slice(0, 200));
  styleApplied = j.data?.styleDnaApplied ?? null;
  return b64;
}

function qwenScore(file, subject) {
  try {
    const out = execFileSync(VENV, [CRITIQUE, '--render', file, '--model', 'Qwen/Qwen3-VL-4B-Instruct', '--subject', subject],
      { encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 24 });
    const m = out.match(/POF_VLM_SCORE=([\d.]+)/);
    const raw = (out.match(/POF_VLM_RAW=(.*)/) || [])[1] || '';
    const defects = (out.match(/POF_VLM_DEFECTS=(.*)/) || [])[1] || '';
    return { score: m ? parseFloat(m[1]) : null, raw: raw.slice(0, 400), defects: defects.slice(0, 300) };
  } catch (e) {
    const so = (e.stdout || '') + (e.stderr || '');
    const m = so.match(/POF_VLM_SCORE=([\d.]+)/);
    return { score: m ? parseFloat(m[1]) : null, raw: 'gate-error: ' + String(e).slice(0, 200), defects: so.slice(-300) };
  }
}

async function main() {
  let best = null;
  const tries = [spec.prompt, spec.prompt + ', ultra-clean crisp silhouette, professional game UI icon, high detail, single subject only'];
  for (let i = 0; i < tries.length; i++) {
    const prompt = tries[i];
    console.log(`GEN try ${i + 1}: ${prompt.slice(0, 80)}... (styleDna=${APPLY_STYLE ? 'on' : 'off'})`);
    const b64 = await genImage(prompt);
    if (styleApplied) console.log(`  style applied: "${styleApplied}"`);
    const file = join(OUTDIR, `${catalogId}__${entityId}__t${i}.jpg`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    const g = qwenScore(file, spec.subject);
    console.log(`  Qwen score=${g.score} defects=${g.defects.slice(0, 120)}`);
    const cand = { b64, file, prompt, score: g.score ?? 0, raw: g.raw, defects: g.defects };
    if (!best || (cand.score) > best.score) best = cand;
    if ((g.score ?? 0) >= PASS) break;
  }

  // inject genHistory batch with the best candidate as a data-URL swatch
  const candId = 'b0-c0';
  const dataUrl = `data:image/jpeg;base64,${best.b64}`;
  const genHistory = {
    batches: [{
      id: 'b0', createdAt: new Date().toISOString(),
      direction: `real Lucid Origin generation for ${name}` + (styleApplied ? ` (project style: ${styleApplied})` : ''),
      prompt: best.prompt,
      candidates: [{ id: candId, swatch: `url(${dataUrl})`,
        payload: { provider: 'leonardo-lucid-origin', engine: 'Leonardo (Lucid Origin)', assetPath: best.file, vlmScore: best.score, styleDna: styleApplied } }],
    }],
    selectedId: candId,
  };
  const data = { selected: 0, selectedId: candId, genHistory };
  const ar = await fetch(`${ORIGIN}/api/pipeline-artifacts`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId, entityId, step, data, status: 'pass', tier: spec.tier || 'L1' }),
  });
  const aj = await ar.json();
  const artStatus = aj.data?.status ?? aj.data?.artifact?.status ?? (aj.success === false ? 'ERR:' + aj.error : '?');
  console.log(`ARTIFACT posted → status=${artStatus}`);

  // VLM verdict
  const verdict = (best.score ?? 0) >= PASS ? 'pass' : 'fail';
  const findings = `Qwen3-VL-4B scored ${best.score}/10 the Lucid Origin render for "${name}" (${step}). ` +
    (styleApplied ? `Project style "${styleApplied}" applied. ` : '') +
    (best.defects ? `Noted: ${best.defects}. ` : '') + `Raw: ${best.raw}`;
  const vr = await fetch(`${ORIGIN}/api/judge-verdicts`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId, entityId, step, judge: 'vlm', verdict,
      score: Math.round((best.score ?? 0) * 10), findings: findings.slice(0, 1500), model: 'qwen3-vl-4b' }),
  });
  const vj = await vr.json();
  console.log(`VERDICT posted → ${verdict} (${vj.success === false ? 'ERR:' + vj.error : 'ok'})`);
  console.log(`RESULT ${catalogId}::${step} bestScore=${best.score} verdict=${verdict} artStatus=${artStatus} styleDna=${styleApplied ?? 'none'}`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
