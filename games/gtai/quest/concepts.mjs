#!/usr/bin/env node
/* eslint-disable no-console -- a terminal CLI outside src/: stdout is its interface (repo law allows console here). */
// concepts.mjs - concept turnaround sheets for every on-screen character in a council run who has no approved look.
//
//   node games/gtai/quest/concepts.mjs <runDir> [--only id,id] [--note "<id>: <owner note>"]... [--dry]
//
// Owner rule (2026-11-02): a new cast member gets concept art and a triage (look + name) before the quest
// is built. Images come from the Codex CLI's built-in image_gen tool on the ChatGPT plan (one `codex exec`
// per image, serial; research/chatgpt-pro-image-route.md). The prompt follows the owner's turnaround-sheet
// pattern (the Torque prototype prompt). Writes <runDir>/concepts/<id>.png and <runDir>/concepts.json.
// Approved looks live in games/gtai/cast/looks.json and are never regenerated.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const LOOKS = path.join(ROOT, 'games', 'gtai', 'cast', 'looks.json');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const all = (k) => argv.flatMap((a, i) => (a === `--${k}` && argv[i + 1] ? [argv[i + 1]] : []));
const readIf = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);

export function conceptPrompt(c, owner) {
  return [
    'Use the built-in image_gen tool (imagegen skill) to generate ONE image.',
    '',
    `Full-body character concept art turnaround sheet of ${c.name.toUpperCase()}, ${c.who}, in GTAI: Uprising, a brutal, profane top-down crime comedy where factory robots run the underworld of an American city.`,
    'Camera: eye-level three-quarter front hero view alongside an orthographic rear mechanical callout view.',
    `Design details: ${c.designNote}`,
    owner ? `Owner direction for this sheet: ${owner}` : null,
    'Rendering style: bold stylized 3D-to-2D key concept illustration with heavy ink linework, gritty painted metal textures, sharp rim lighting and hard-surface production readiness.',
    'Background: dark blueprint slate with technical callout annotations naming the key parts.',
    'Horizontal 16:9 character production sheet, ultra-clean silhouette that also reads from directly above.',
    'An original design: no real person, no brand, no logo.',
    '',
    `Then copy the generated file to ./${c.id}.png in the current directory and print the original path.`,
  ].filter((l) => l !== null).join('\n');
}

/** Characters needing a look: on screen (not voice-only), not Rivet-approved, with a design note. */
export function candidates(proposals, looks) {
  const seen = new Map();
  for (const p of proposals) for (const c of p.characters ?? []) {
    if (c.role === 'voice' || looks[c.id]?.status === 'approved' || seen.has(c.id)) continue;
    if (!c.designNote) { seen.set(c.id, { ...c, skip: 'no designNote' }); continue; }
    seen.set(c.id, { id: c.id, name: c.name, designNote: c.designNote, role: c.role,
      who: `${c.role === 'giver' ? 'the quest giver' : c.role} (${c.status === 'new' ? 'new to the cast' : 'met for the first time'})` });
  }
  return [...seen.values()];
}

function main() {
  const runDir = path.resolve(argv[0] ?? '');
  if (!argv[0] || !fs.existsSync(runDir)) { console.error('usage: concepts.mjs <runDir> [--only id,id] [--note "<id>: <note>"] [--dry]'); process.exit(2); }
  const proposals = ['claude', 'grok'].flatMap((s) => readIf(path.join(runDir, `proposals.${s}.json`)) ?? []);
  const looks = readIf(LOOKS) ?? {};
  // Rivet's look is locked (art-direction/trivet); never regenerate him here.
  looks.rivet ??= { status: 'approved', name: 'Rivet' };
  const only = opt('only')?.split(',').map((s) => s.trim());
  const notes = Object.fromEntries(all('note').map((n) => { const i = n.indexOf(':'); return [n.slice(0, i).trim(), n.slice(i + 1).trim()]; }));
  const list = candidates(proposals, looks).filter((c) => !only || only.includes(c.id));
  const outDir = path.join(runDir, 'concepts');
  fs.mkdirSync(outDir, { recursive: true });
  const indexFile = path.join(runDir, 'concepts.json');
  const index = readIf(indexFile) ?? { characters: {} };
  for (const c of list) {
    if (c.skip) { index.characters[c.id] = { name: c.name, file: null, error: c.skip }; console.log(`skip ${c.id}: ${c.skip}`); continue; }
    const prompt = conceptPrompt(c, notes[c.id]);
    fs.writeFileSync(path.join(outDir, `PROMPT.${c.id}.md`), prompt);
    const entry = { name: c.name, role: c.role, designNote: c.designNote, prompt, file: null, generatedAt: null, error: null, ownerNote: notes[c.id] ?? null };
    if (argv.includes('--dry')) { index.characters[c.id] = entry; console.log(`dry ${c.id}`); continue; }
    const target = path.join(outDir, `${c.id}.png`);
    if (fs.existsSync(target)) fs.renameSync(target, path.join(outDir, `${c.id}.${Date.now()}.prev.png`));
    const t0 = Date.now();
    const r = spawnSync('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-o', `${c.id}.last.txt`, '-C', '.',
      `"Read PROMPT.${c.id}.md in the current directory and follow it exactly."`],
    { cwd: outDir, encoding: 'utf8', shell: process.platform === 'win32', timeout: 8 * 60_000, windowsHide: true });
    const wall = Math.round((Date.now() - t0) / 1000);
    if (fs.existsSync(target)) {
      entry.file = `concepts/${c.id}.png`; entry.generatedAt = new Date().toISOString();
      console.log(`ok   ${c.id} (${wall}s)`);
    } else {
      entry.error = r.error ? String(r.error.message) : `codex exit ${r.status}; no ${c.id}.png written (see concepts/${c.id}.last.txt)`;
      console.log(`FAIL ${c.id} (${wall}s): ${entry.error}`);
    }
    index.characters[c.id] = entry;
    fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  }
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`concepts: ${Object.keys(index.characters).length} character(s) -> ${path.relative(ROOT, indexFile)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
