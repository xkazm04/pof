#!/usr/bin/env node
/**
 * Critique a captured animation filmstrip via /api/verify/animation.
 * Usage:
 *   node scripts/anim-critique.mjs --dir <frameDir> --intent "<how it should read>" \
 *     [--name AM_SwordSlashC] [--duration 1.2] [--cam main|side] [--model gemini-2.5-pro] [--url http://localhost:3000]
 */
import { argv } from 'node:process';

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

if (!dir || !intent) {
  console.error('usage: node scripts/anim-critique.mjs --dir <frameDir> --intent "<how it should read>" [--name X] [--duration 1.2] [--cam main|side] [--model gemini-2.5-pro]');
  process.exit(2);
}

const body = { name, intent, frameDir: dir, cam };
if (duration) body.durationSeconds = Number(duration);
if (model) body.model = model;
if (provider) body.provider = provider;

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
console.log(`\n  ${name} — ${c.verdict.toUpperCase()} (${c.score}/100)   [${c.frames.length} frames · ${c.provider ?? 'gemini'}]\n`);
for (const [k, v] of Object.entries(c.dimensions)) {
  console.log(`  ${k.padEnd(14)} ${bar(v)} ${String(v).padStart(3)}`);
}
console.log('\n  reasons:');
for (const r of c.reasons) console.log(`   - ${r}`);
console.log(`\n  top fix: ${c.topFix}\n`);
