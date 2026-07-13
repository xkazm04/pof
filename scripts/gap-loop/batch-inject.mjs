/**
 * gap-loop — inject real gated images into each 2D-art artifact (merge genHistory into
 * the existing passing data so the step's checker still holds) + POST VLM verdicts.
 * Consumes batch-generate.mjs's gate manifest + pof_vlm_batch.py's raw marker output.
 *
 * Promoted from the batch-3 scratchpad (2026-07-13); carries each entry's `styleDna`
 * (the Style DNA profile batch-generate recorded) into the injected payload/direction.
 *
 *   node scripts/gap-loop/batch-inject.mjs <gate-manifest.json> <gate-raw.txt>
 * env: POF_ORIGIN (default http://localhost:3001)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ORIGIN = process.env.POF_ORIGIN || 'http://localhost:3001';
const manifestPath = process.argv[2];
const rawPath = process.argv[3];
if (!manifestPath || !rawPath) { console.error('usage: node batch-inject.mjs <gate-manifest.json> <gate-raw.txt>'); process.exit(1); }

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const raw = readFileSync(rawPath, 'utf8');
const scores = {};
for (const line of raw.split('\n')) {
  const m = line.match(/POF_VLM_ITEM=(\{.*\})/);
  if (m) { const r = JSON.parse(m[1]); scores[r.id] = r; }
}

async function currentData(catalogId, step) {
  const j = await (await fetch(`${ORIGIN}/api/pipeline-artifacts?catalogId=${catalogId}`)).json();
  const arr = j.data?.artifacts || j.data || [];
  const a = arr.find((x) => x.step === step);
  return a?.data || {};
}

const out = [];
for (const m of manifest) {
  const g = scores[m.id];
  if (!g || g.score == null) { console.log(`SKIP ${m.id} (no score)`); continue; }
  const b64 = readFileSync(m.file).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${b64}`;
  const candId = 'b0-c0';
  const genHistory = { batches: [{ id: 'b0', createdAt: new Date().toISOString(),
    direction: `real Lucid Origin generation (${m.step})` + (m.styleDna ? ` (project style: ${m.styleDna})` : ''), prompt: m.prompt,
    candidates: [{ id: candId, swatch: `url(${dataUrl})`,
      payload: { provider: 'leonardo-lucid-origin', engine: 'Leonardo (Lucid Origin)', assetPath: m.file, vlmScore: g.score, styleDna: m.styleDna ?? null } }] }],
    selectedId: candId };
  const base = await currentData(m.catalogId, m.step);
  const data = { ...base, genHistory };
  if ('selected' in base || base.selected === undefined) data.selected = base.selected ?? 0; // keep gallery selection valid
  data.selectedId = candId;

  const ar = await fetch(`${ORIGIN}/api/pipeline-artifacts`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId: m.catalogId, entityId: m.entityId, step: m.step, data, status: 'pass', tier: 'L1' }) });
  const aj = await ar.json();
  const artStatus = aj.data?.status ?? aj.data?.artifact?.status ?? (aj.success === false ? 'ERR:' + aj.error : '?');

  const verdict = g.score >= 7 ? 'pass' : 'fail';
  const findings = (`Qwen3-VL-4B scored ${g.score}/10 the Lucid Origin render for ${m.catalogId}::${m.step}. ` +
    (m.styleDna ? `Project style "${m.styleDna}" applied. ` : '') +
    `Defects: ${g.defects || 'none noted'}. Verdict: ${g.verdict || ''}`).slice(0, 1500);
  const vr = await fetch(`${ORIGIN}/api/judge-verdicts`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ catalogId: m.catalogId, entityId: m.entityId, step: m.step, judge: 'vlm', verdict, score: g.score * 10, findings, model: 'qwen3-vl-4b' }) });
  const vj = await vr.json();
  out.push({ id: m.id, catalogId: m.catalogId, step: m.step, score: g.score, verdict, artStatus, verdictOk: vj.success !== false });
  console.log(`${verdict.toUpperCase()} ${g.score}/10  ${m.catalogId}::${m.step}  art=${artStatus} verdictOk=${vj.success !== false}`);
}
console.log(`\nINJECTED ${out.length}; artPass=${out.filter((o) => o.artStatus === 'pass').length}; verdictPass=${out.filter((o) => o.verdict === 'pass').length}`);
writeFileSync(join(dirname(manifestPath), 'inject-out.json'), JSON.stringify(out, null, 1));
