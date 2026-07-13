/**
 * gap-loop — flip a step-facts entry after a step gains a REAL engine (trueEngine +
 * generatorWired), which un-does its UNPOWERED grade on the /status map.
 * Promoted from the batch-3 scratchpad (2026-07-13).
 *
 *   node scripts/gap-loop/flip-stepfact.mjs <catalogId> <step> [engine] [note]
 */
import fs from 'node:fs';
import { join } from 'node:path';

const F = join(process.cwd(), 'src', 'lib', 'status', 'step-facts.json');
const [catalogId, step] = [process.argv[2], process.argv[3]];
if (!catalogId || !step) { console.error('usage: node flip-stepfact.mjs <catalogId> <step> [engine] [note]'); process.exit(1); }
const engine = process.argv[4] || 'Leonardo (Lucid Origin)';
const note = process.argv[5] ||
  `Powered by gap-loop (${new Date().toISOString().slice(0, 10)}): a real asset is generated via the wired engine, ` +
  'Qwen3-VL-4B gated (>=7), and injected into the artifact data; VLM verdict recorded. trueEngine reflects the real producing engine.';

const j = JSON.parse(fs.readFileSync(F, 'utf8'));
const s = j.steps.find((x) => x.catalogId === catalogId && x.step === step);
if (!s) { console.log('NOT FOUND', catalogId, step); process.exit(1); }
s.trueEngine = engine;
s.generatorWired = true;
s.note = note;
fs.writeFileSync(F, JSON.stringify(j, null, 2) + '\n');
console.log('FLIPPED', catalogId, '::', step, '-> trueEngine', engine);
