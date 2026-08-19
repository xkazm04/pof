/* eslint-disable no-console -- CLI script: stdout IS the operator interface (same
   exemption as scripts/judge-run.ts, scripts/gen-lucid.ts). */
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
 * TRUTH RULES (2026-08-19) — both live in ./power-icon-payload.mjs so they are testable
 * without a live generation:
 *  1. The artifact status is the GATE'S OWN verdict. It used to be a hardcoded `'pass'`
 *     sitting three lines above a computed `score >= 7 ? 'pass' : 'fail'` — so a
 *     sub-threshold image was persisted as a passing artifact with a failing verdict
 *     beside it. A gate that did not run reports `pending`, not a default either way.
 *  2. The gated file is written under `iconSlug(catalogId, step)` — the name every
 *     consumer matches on — so an icon this script writes is reachable by the step it was
 *     generated for. Non-winning tries go to the OS temp dir, never into the served
 *     library. Each run also REPORTS any file in generated/icons/ that no registered step
 *     can match (reported, never deleted).
 *
 *   node scripts/gap-loop/power-icon.mjs '<json spec>'
 * spec = {catalogId, entityId, step, name, prompt, subject, width?, height?, tier?}
 * env: POF_ORIGIN (default http://localhost:3001), POF_TRIPOSR_ROOT (venv for the gate),
 *      POF_STYLE_DNA=off (skip style injection)
 */
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  PASS_AT,
  iconFileName,
  gateOutcome,
  buildArtifactPayload,
  buildVerdictPayload,
  reachableIconSlugs,
  unreachableIconNames,
} from './power-icon-payload.mjs';

const ORIGIN = process.env.POF_ORIGIN || 'http://localhost:3001';
const TRIPOSR_ROOT = process.env.POF_TRIPOSR_ROOT || 'C:/Users/kazda/kiro/TripoSR';
const VENV = join(TRIPOSR_ROOT, '.venv', 'Scripts', 'python.exe');
const CRITIQUE = join(process.cwd(), 'scripts', 'visual-gen', 'pof_vlm_critique.py');
const OUTDIR = join(process.cwd(), 'generated', 'icons');
const APPLY_STYLE = process.env.POF_STYLE_DNA !== 'off';

const spec = JSON.parse(process.argv[2]);
const { catalogId, entityId, step, name } = spec;
const width = spec.width || 512, height = spec.height || 512;
mkdirSync(OUTDIR, { recursive: true });
// Non-winning tries are gate scratch, not library art: they live outside generated/icons/
// so every file the served icon listing shows is one a step can actually match.
const TRYDIR = mkdtempSync(join(tmpdir(), 'pof-icon-'));

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
    return { score: m ? parseFloat(m[1]) : null, raw: raw.slice(0, 400), defects: defects.slice(0, 300), error: m ? '' : 'no POF_VLM_SCORE marker in the gate output' };
  } catch (e) {
    const so = (e.stdout || '') + (e.stderr || '');
    const m = so.match(/POF_VLM_SCORE=([\d.]+)/);
    return { score: m ? parseFloat(m[1]) : null, raw: 'gate-error: ' + String(e).slice(0, 200), defects: so.slice(-300), error: String(e).slice(0, 200) };
  }
}

/**
 * Name every file in generated/icons/ that no registered (catalog, step) can match. These
 * are listed by /api/visual-gen/icons and dead to every consumer; the fix is a rename to
 * `<iconSlug(catalogId, step)>.jpg`, which is the operator's call — nothing is deleted here.
 */
async function reportUnreachableIcons() {
  try {
    const [pj, ij] = await Promise.all([
      fetch(`${ORIGIN}/api/catalog/pipelines`).then((r) => r.json()),
      fetch(`${ORIGIN}/api/visual-gen/icons`).then((r) => r.json()),
    ]);
    if (pj.success === false || ij.success === false) {
      console.log('UNREACHABLE-CHECK skipped: could not read pipelines/icons from the app');
      return;
    }
    const reachable = reachableIconSlugs(pj.data ?? []);
    const names = (ij.data?.icons ?? []).map((i) => i.name);
    const dead = unreachableIconNames(names, reachable);
    if (!dead.length) {
      console.log(`UNREACHABLE-CHECK ok: all ${names.length} icons in generated/icons/ match a registered step`);
      return;
    }
    console.log(`UNREACHABLE-CHECK ${dead.length}/${names.length} icons match NO registered step and can never be shown:`);
    for (const d of dead) console.log(`  - ${d}`);
    console.log('  fix: rename each to <iconSlug(catalogId, step)>.jpg (e.g. items_Art.jpg). Nothing was deleted.');
  } catch (e) {
    console.log('UNREACHABLE-CHECK skipped: ' + String(e).slice(0, 160));
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
    const file = join(TRYDIR, `t${i}.jpg`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    const g = qwenScore(file, spec.subject);
    console.log(`  Qwen score=${g.score} defects=${g.defects.slice(0, 120)}`);
    const cand = { b64, file, prompt, score: g.score, raw: g.raw, defects: g.defects, gateError: g.error };
    if (!best || (cand.score ?? -1) > (best.score ?? -1)) best = cand;
    if ((g.score ?? 0) >= PASS_AT) break;
  }

  // The winner — and ONLY the winner — enters the served library, under the name the
  // consumer matches on (iconSlug), so this step can actually show what it generated.
  const iconPath = join(OUTDIR, iconFileName(catalogId, step));
  writeFileSync(iconPath, Buffer.from(best.b64, 'base64'));
  console.log(`ICON written → ${iconPath}`);

  const gate = gateOutcome(best.score, PASS_AT, best.gateError);

  // inject genHistory batch with the best candidate as a data-URL swatch
  const candId = 'b0-c0';
  const dataUrl = `data:image/jpeg;base64,${best.b64}`;
  const genHistory = {
    batches: [{
      id: 'b0', createdAt: new Date().toISOString(),
      direction: `real Lucid Origin generation for ${name}` + (styleApplied ? ` (project style: ${styleApplied})` : ''),
      prompt: best.prompt,
      candidates: [{ id: candId, swatch: `url(${dataUrl})`,
        payload: { provider: 'leonardo-lucid-origin', engine: 'Leonardo (Lucid Origin)', assetPath: iconPath, vlmScore: best.score, vlmGateRan: gate.ran, styleDna: styleApplied } }],
    }],
    selectedId: candId,
  };
  const data = { selected: 0, selectedId: candId, genHistory };
  const ar = await fetch(`${ORIGIN}/api/pipeline-artifacts`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildArtifactPayload({ catalogId, entityId, step, data, gate, tier: spec.tier || 'L1' })),
  });
  const aj = await ar.json();
  const artStatus = aj.data?.status ?? aj.data?.artifact?.status ?? (aj.success === false ? 'ERR:' + aj.error : '?');
  console.log(`ARTIFACT posted → sent=${gate.status} persisted=${artStatus} (${gate.reason})`);

  // VLM verdict — posted only when the gate actually produced a score.
  const findings = `Qwen3-VL-4B scored ${best.score}/10 the Lucid Origin render for "${name}" (${step}). ` +
    (styleApplied ? `Project style "${styleApplied}" applied. ` : '') +
    (best.defects ? `Noted: ${best.defects}. ` : '') + `Raw: ${best.raw}`;
  const verdictBody = buildVerdictPayload({ catalogId, entityId, step, gate, findings });
  if (verdictBody) {
    const vr = await fetch(`${ORIGIN}/api/judge-verdicts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(verdictBody),
    });
    const vj = await vr.json();
    console.log(`VERDICT posted → ${gate.verdict} (${vj.success === false ? 'ERR:' + vj.error : 'ok'})`);
  } else {
    console.log('VERDICT skipped → the gate produced no score; judge_verdicts takes pass|fail only and neither was measured');
  }

  console.log(`RESULT ${catalogId}::${step} bestScore=${best.score} status=${gate.status} verdict=${gate.verdict ?? 'none'} persisted=${artStatus} styleDna=${styleApplied ?? 'none'}`);
  await reportUnreachableIcons();
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
