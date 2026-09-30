/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * INPUT-GATE ARENA: which local vision model should answer the image->3D input gate, and at
 * what refusal line? Sibling of ../eye-race.ts, for `visual-gen/input-gate` instead of
 * `recognize`.
 *
 * Protocol:
 *  - The prompt is copied from input-gate.ts and asserted against it on start. If the gate's
 *    prompt changes, this refuses to run until the copy is updated.
 *  - Every arm is called the way providers/ollama.ts calls it: /api/chat, temperature 0,
 *    num_ctx 8192, think:false, image as base64.
 *  - Truth is ./truth.mjs, labelled by eye against the gate's five criteria. Ambiguous
 *    images are excluded, not guessed.
 *  - The ranking metric is BAD INPUTS THAT GET THROUGH at the line that actually refuses.
 *    Only a `fail` verdict (score < failBelow) stops the job; a `warn` still ships.
 *  - Each arm gets a discarded warm-up, and its placement (the fraction resident on the
 *    GPU) is read from /api/ps and stored in every row, because a spilled arm's latency
 *    measures offload, not the model.
 *
 *   node scripts/vision-arena/input-gate/race.mjs run <ollama-model> [repeats=2]
 *   node scripts/vision-arena/input-gate/race.mjs score
 *
 * Results append to $ARENA_OUT (default .ai/arena/input-gate.jsonl, committed as the arena record).
 * The run is resumable: rows already present are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CASES } from './truth.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const OUT = process.env.ARENA_OUT ?? path.join(ROOT, '.ai/arena/input-gate.jsonl');
const HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/+$/, '');
const GATE_SRC = fs.readFileSync(path.join(ROOT, 'src/lib/visual-gen/input-gate.ts'), 'utf8');

const SUBJECT = 'character or object concept';
const PROMPT =
  `This image is a 2D concept of a '${SUBJECT}' about to be fed to an image-to-3D mesh generator. ` +
  'Score how well it satisfies the generator input requirements: ' +
  '(1) exactly one subject, no scene clutter or companions; ' +
  '(2) plain uniform background (white/neutral) with nothing that could bleed into the mesh; ' +
  '(3) near-canonical pose — roughly A-pose, limbs uncrossed, minimal self-occlusion; ' +
  '(4) subject fully in frame, not cropped; ' +
  '(5) clean readable silhouette without motion blur or extreme stylization. ' +
  'Violations cause fused limbs, floaters and fragmented geometry downstream. ' +
  'Reply on ONE line EXACTLY as: ' +
  "SCORE=<0-10 integer>; DEFECTS=<comma-separated problems or 'none'>; VERDICT=<one short sentence>.";
for (const frag of ['exactly one subject, no scene clutter or companions', 'plain uniform background (white/neutral)',
  '(3) near-canonical pose — roughly A-pose', 'subject fully in frame, not cropped', "SCORE=<0-10 integer>; DEFECTS="]) {
  if (!GATE_SRC.includes(frag)) throw new Error(`prompt drifted from input-gate.ts: ${frag}`);
}
const parseScore = (t) => { const m = t.match(/SCORE=\s*(\d+)/); return m ? Number(m[1]) : null; };

async function call(model, file) {
  const base = { model, stream: false, options: { temperature: 0, num_ctx: 8192 },
    messages: [{ role: 'user', content: PROMPT, images: [fs.readFileSync(path.join(ROOT, file)).toString('base64')] }] };
  const send = (body) => fetch(`${HOST}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let res = await send({ ...base, think: false });
  if (!res.ok && res.status === 400) res = await send(base);
  if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).message?.content ?? '';
}

async function placement(model) {
  const j = await (await fetch(`${HOST}/api/ps`)).json();
  const tag = model.includes(':') ? model : `${model}:latest`;
  const m = (j.models || []).find((x) => x.name === tag || x.model === tag);
  return m ? { size: m.size, gpu_frac: +(m.size_vram / m.size).toFixed(3), others: (j.models || []).length - 1 } : null;
}

async function run(model, repeats) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const read = () => (fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const done = new Set(read().filter((r) => !r.error).map((r) => `${r.model}|${r.file}|${r.rep}`));
  const t0 = Date.now(); await call(model, CASES[0].file);
  const place = await placement(model);
  console.log(`[${model}] warm-up ${((Date.now() - t0) / 1000).toFixed(1)}s, placement ${JSON.stringify(place)}`);
  if (place && place.gpu_frac < 1) console.log(`[${model}] WARNING: partly on host memory; latency is not comparable`);
  for (let rep = 1; rep <= repeats; rep++) {
    for (const c of CASES) {
      if (done.has(`${model}|${c.file}|${rep}`)) continue;
      const t = Date.now();
      try {
        const text = await call(model, c.file);
        fs.appendFileSync(OUT, JSON.stringify({ model, rep, file: c.file, expect: c.expect, score: parseScore(text), ms: Date.now() - t, placement: place, text: text.slice(0, 400) }) + '\n');
      } catch (e) {
        fs.appendFileSync(OUT, JSON.stringify({ model, rep, file: c.file, error: String(e).slice(0, 300) }) + '\n');
      }
    }
    console.log(`[${model}] rep ${rep} done`);
  }
}

function score() {
  const files = new Set(CASES.map((c) => c.file));
  const rows = fs.readFileSync(OUT, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => !r.error && files.has(r.file));
  const nPass = CASES.filter((c) => c.expect === 'pass').length, nFail = CASES.length - nPass;
  const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
  for (const model of [...new Set(rows.map((r) => r.model))]) {
    const rs = rows.filter((r) => r.model === model);
    const pos = rs.filter((r) => r.expect === 'pass' && r.score !== null).map((r) => r.score);
    const neg = rs.filter((r) => r.expect === 'fail' && r.score !== null).map((r) => r.score);
    let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0;
    const byFile = {}; for (const r of rs) (byFile[r.file] ??= {})[r.rep] = r.score;
    const pairs = Object.values(byFile).filter((v) => 1 in v && 2 in v);
    const lines = [5, 7, 8, 9].map((t) => {
      const bad = new Set(rs.filter((r) => r.expect === 'fail' && (r.score ?? 0) >= t).map((r) => r.file)).size;
      const good = new Set(rs.filter((r) => r.expect === 'pass' && (r.score ?? 0) < t).map((r) => r.file)).size;
      return `refuse<${t}: bad through ${bad}/${nFail}, good refused ${good}/${nPass}`;
    });
    console.log(`${model}\n  AUROC ${(w / (pos.length * neg.length)).toFixed(3)} | unparseable ${rs.filter((r) => r.score === null).length}` +
      ` | identical across repeats ${pairs.filter((v) => v[1] === v[2]).length}/${pairs.length}` +
      ` | ms p50 ${q(rs.map((r) => r.ms), 0.5)} p90 ${q(rs.map((r) => r.ms), 0.9)} | placement ${JSON.stringify(rs[0]?.placement)}\n  ${lines.join('\n  ')}`);
  }
}

const [cmd, model, reps] = process.argv.slice(2);
if (cmd === 'run' && model) await run(model, Number(reps || 2));
else if (cmd === 'score') score();
else console.log('usage: race.mjs run <ollama-model> [repeats] | race.mjs score');
