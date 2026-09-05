#!/usr/bin/env node
/**
 * Critique a captured animation filmstrip via /api/verify/animation.
 * Usage:
 *   node scripts/anim-critique.mjs --dir <frameDir> --intent "<how it should read>" \
 *     [--name AM_SwordSlashC] [--duration 1.2] [--cam main|side] [--model gemini-2.5-pro] [--url http://localhost:3000] \
 *     [--loop-markers <file with pof_loop_closure.py stdout>] [--oneshot]
 *
 * Two tiers, reported side by side and never averaged: INTEGRITY (Tier-1, numeric loop
 * closure in millimetres — pass `--loop-markers`) and CRAFT (Tier-2, the VLM's six
 * dimensions). A Tier-1 fail skips the paid vision call entirely, and craft then prints as
 * NOT RUN rather than borrowing the integrity verdict.
 */
import { argv } from 'node:process';
import { readFileSync } from 'node:fs';

const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const dir = arg('dir');
const name = arg('name', 'animation');
const intent = arg('intent');
const duration = arg('duration');
const cam = arg('cam', 'main');
const model = arg('model');
const provider = arg('provider'); // 'qwen' | 'gemini' (route default: gemini)
const url = arg('url', 'http://localhost:3000');
const loopMarkersFile = arg('loop-markers');
const oneshot = argv.includes('--oneshot');

if (!dir || !intent) {
  console.error('usage: node scripts/anim-critique.mjs --dir <frameDir> --intent "<how it should read>" [--name X] [--duration 1.2] [--cam main|side] [--model gemini-2.5-pro]');
  process.exit(2);
}

const body = { name, intent, frameDir: dir, cam };
if (duration) body.durationSeconds = Number(duration);
if (model) body.model = model;
if (provider) body.provider = provider;
if (loopMarkersFile) {
  body.loopMarkers = readFileSync(loopMarkersFile, 'utf8');
  body.loopIntent = oneshot ? 'oneshot' : 'loop';
}

const res = await fetch(`${url}/api/verify/animation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const env = await res.json().catch(() => null);
if (!res.ok || !env?.success) {
  console.error('critique failed:', env?.error ?? res.status);
  process.exit(1);
}

const c = env.data;
const bar = (n) => '#'.repeat(Math.round(n / 10)).padEnd(10, '.');

// TIER 1 — integrity. Printed first because it runs first, and printed with its own basis:
// it is a millimetre measurement, not an opinion, and it is never folded into the craft
// score. `not-run` / `n/a` / `error` all print as themselves — none of them is a pass.
const t1 = c.tier1;
if (t1) {
  const m = t1.card?.metrics;
  const detail = m ? `  [pose ${m.poseGapMm} mm · worst joint ${m.worstJointMm} mm · seam ${m.velJumpMm} mm · ${m.frames} frames]` : '';
  console.log(`\n  TIER 1 · ${t1.status.toUpperCase()} — ${t1.basis}`);
  console.log(`   ${t1.reason}${detail}`);
}
if (c.gated) {
  console.log(`\n  TIER 2 · NOT RUN — ${c.tier2?.basis ?? 'craft'}`);
  console.log(`   ${c.tier2?.reason ?? 'the aesthetic pass was skipped'}`);
  console.log(`   (${c.frames.length} frames were captured; none were sent to a vision model)\n`);
  process.exit(0);
}
// Name the WRITER, not the family: the Qwen chain re-routes on quota, so a card can come
// from a fallback model. `unreported` means the seam could not know — never a guess.
const v = c.vision;
const writer = !v
  ? (c.provider ?? 'gemini')
  : v.attribution === 'unreported'
    ? `${c.provider ?? 'gemini'} · model unreported`
    : `${v.model}${v.fellBackFrom?.length ? ` (fallback from ${v.fellBackFrom.join(', ')})` : ''}`;
// State the sampling beside the score: a bare frame count hides that the judge saw 10 of 14
// captured frames, on a spacing the sampler made uneven.
const s = c.sampled;
const strip = !s
  ? `${c.frames.length} frames`
  : s.available === null
    ? `${s.kept} frames (caller-supplied; captured total unknown)`
    : s.kept >= s.available
      ? `all ${s.available} frames`
      : `${s.kept} of ${s.available} frames · ${s.uniform ? `every ${s.stride}` : 'UNEVEN spacing'}`;
const header = `\n  TIER 2 · ${name} — ${c.verdict.toUpperCase()} (${c.score}/100 mean)   [${strip} · ${writer}]`;
console.log(c.reason ? `${header}\n  ${c.reason}\n` : `${header}\n`);
for (const [k, v] of Object.entries(c.dimensions)) {
  console.log(`  ${k.padEnd(14)} ${bar(v)} ${String(v).padStart(3)}`);
}
console.log('\n  reasons:');
for (const r of c.reasons) console.log(`   - ${r}`);
console.log(`\n  top fix: ${c.topFix}\n`);
