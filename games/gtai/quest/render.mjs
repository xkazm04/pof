#!/usr/bin/env node
/* eslint-disable no-console -- a terminal CLI outside src/: stdout is its interface (repo law allows console here). */
// render.mjs - council proposals + guard verdicts -> one self-contained fuse page (`<runDir>/fuse.html`).
//
//   node games/gtai/quest/render.mjs <runDir>        (council.mjs render <runDir> calls renderFuse)
//
// The page is published as a claude.ai Artifact with capabilities {db:{}, user:{}}. The owner ticks the
// elements to keep (keys match FusionSource.elements: spine, giver, beat:<id>, line:<id>, mechanic:<id>,
// character:<id>), writes notes, and "Save fusion" writes ONE db doc `fusion/current`
// ({ runId, sources: FusionSource[], notes, savedAt }). Without db it shows the JSON to copy.
// A seat that was skipped or delivered invalid output renders as an honest card; a path is never faked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const SEAT_ORDER = ['claude', 'grok'];
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readIf = (f) => (fs.existsSync(f) ? readJson(f) : null);

/** Everything the page needs, read from the run folder. */
export function collectCouncil(runDir) {
  const meta = readIf(path.join(runDir, 'run.json')) ?? { runId: path.basename(runDir) };
  const seats = readIf(path.join(runDir, 'seats.json'));
  const verdicts = readIf(path.join(runDir, 'verdicts.json')) ?? {};
  const economy = readIf(path.join(ROOT, 'games', 'gtai', 'balance', 'quest-economy.json'));
  const slots = [];
  for (const seat of SEAT_ORDER) {
    // A seat that was never convened (e.g. an Opus-only rework) is not "skipped": it is simply not in the run.
    if (seats?.seats && !seats.seats[seat]) continue;
    const good = readIf(path.join(runDir, `proposals.${seat}.json`));
    if (Array.isArray(good)) {
      for (const p of good) slots.push({ kind: 'path', seat, proposal: p });
      continue;
    }
    const bad = readIf(path.join(runDir, `proposals.${seat}.invalid.json`));
    const rec = seats?.seats?.[seat];
    let reason;
    if (bad) reason = `invalid output: ${[].concat(bad.reason ?? []).slice(0, 4).join('; ')}`;
    else if (rec?.status === 'skipped') reason = `seat skipped: ${rec.reason ?? 'probe failed'}`;
    else if (rec) reason = `seat ${rec.status}: ${rec.reason ?? 'no proposals written'}`;
    else reason = seats ? 'seat skipped: not in this run' : 'seat skipped: the council has not run yet';
    slots.push({ kind: 'skip', seat, reason });
  }
  const act = meta.act ?? slots.find((s) => s.kind === 'path')?.proposal.act ?? null;
  return {
    runId: meta.runId, act, goal: meta.goal ?? '', constraints: meta.constraints ?? '',
    band: act && economy ? economy.acts?.[act] ?? null : null,
    economyRevision: economy?.revision ?? null, economyProvisional: economy?.provisional ?? null,
    seats: seats?.seats ?? {}, slots, verdicts,
    ledger: readLedgerSummary(),
    // Concept sheets for characters without an approved look (concepts.mjs). Paths are relative to the run
    // folder, so the published page ships them as supporting files.
    concepts: readIf(path.join(runDir, 'concepts.json'))?.characters ?? null,
  };
}

const ACT_ORDER = ['prologue', 'clock-out', 'act1', 'act2', 'act3', 'act4', 'finale'];

/** Every shipped or planned quest package, in play order, reduced to what the cast register needs:
 *  the owner asked (2026-11-02) that every report says who each name is and how far each character has come. */
function readLedgerSummary() {
  const dir = path.join(ROOT, 'games', 'gtai', 'quests');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const id of fs.readdirSync(dir)) {
    if (id.startsWith('_')) continue;
    const q = readIf(path.join(dir, id, 'quest.json'));
    if (!q) continue;
    out.push({ id, act: q.act, title: q.title, status: q.status,
      characters: (q.characters ?? []).map((c) => ({ id: c.id, name: c.name, role: c.role })),
      beats: (q.beats ?? []).map((b) => b.title) });
  }
  return out.sort((a, b) => ACT_ORDER.indexOf(a.act) - ACT_ORDER.indexOf(b.act) || (a.id < b.id ? -1 : 1));
}

// The page's CSS and client script are plain files beside this one (fuse/), inlined at render time so the
// published page stays self-contained. Editing them never needs template-string escaping.
const ASSET = (name) => fs.readFileSync(path.join(HERE, 'fuse', name), 'utf8');
const FONTS = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Mono:wght@400;600;700&family=Public+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap';

const SECTIONS = [
  ['register', 'Cast register', 'Who each name is, and every character\'s story so far.'],
  ['triage', 'Cast triage', 'New faces need an agreed look and name before the quest is built. Approve, regenerate with a note, or drop.'],
  ['story', 'Story goal', 'What each path does for the campaign, and the laugh or turn that earns it.'],
  ['numbers', 'Reward and difficulty', 'Each path against the act band. A highlighted cell is outside the band.'],
  ['guards', 'Guards', 'PoF verdicts. A red guard blocks the quest unless you override it with a reason.'],
  ['cast', 'Cast', 'Tick the characters to keep. New characters need art before the quest can ship.'],
  ['beats', 'Beats', 'The quest structure, in play order.'],
  ['lines', 'Lines', 'Every line carries its purpose. Tick the ones worth keeping.'],
  ['mechanics', 'Mechanics', 'What the game or PoF must support.'],
  ['hooks', 'Story hooks', 'Campaign state each path reads and writes.'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** JSON safe inside a <script> element. */
const LS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');
const embed = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(LS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);


export function renderHtml(data) {
  const live = data.slots.filter((s) => s.kind === 'path').length;
  const seatLine = Object.entries(data.seats).map(([k, v]) => `${k}: ${v.status}${v.cost_usd != null ? ` ($${Number(v.cost_usd).toFixed(2)})` : ''}`).join(' · ') || 'no seats.json';
  const nav = SECTIONS.map(([id, label]) => `<a href="#sec-${id}">${esc(label)}</a>`).join('');
  const sections = SECTIONS.map(([id, label, hint]) => `<section class="cmp" id="sec-${id}" aria-labelledby="h-${id}">
<div class="divider"><h2 id="h-${id}">${esc(label)}</h2><p>${esc(hint)}</p></div>
<div id="body-${id}"></div>
</section>`).join('\n');
  // The publish step wraps this in the document skeleton (artifact page contract), so no doctype/html/head here.
  return `<title>Quest Council Fuse</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${FONTS}">
<style>${ASSET('fuse.css')}</style>
<div class="bar"><div class="wrap">
<span class="brand">Fuse</span>
<nav aria-label="Sections">${nav}<a href="#fuse">Save</a></nav>
<span class="kept" id="kept" aria-live="polite"></span>
<button id="save-top" type="button" class="ghost">Save fusion</button>
</div></div>
<main class="wrap">
<header class="top">
<span class="eyebrow">GTAI: Uprising · quest council · ${esc(data.act ?? '?')}</span>
<h1>Quest Council <em>Fuse</em></h1>
<p class="meta"><span>run ${esc(data.runId)}</span><span>${live} path(s)</span><span>${esc(seatLine)}</span></p>
<div class="brief">
<div><span class="sub">Owner goal</span><p>${esc(data.goal) || '<i>(none recorded)</i>'}</p>${data.constraints ? `<span class="sub" style="display:block;margin-top:12px">Constraints</span><p>${esc(data.constraints)}</p>` : ''}</div>
<div><span class="sub">How to fuse</span><p>Pick one path as the spine, tick what to keep from any path, write notes, then save. Claude paths use warm keys, Grok paths cool ones; variant B has an outlined key.</p>
<div class="legend" style="margin-top:8px"><span class="g green">✓ pass</span><span class="g red">✕ block</span><span class="g unmeasured">– unmeasured</span></div></div>
</div>
</header>
<section aria-label="The paths"><div class="overview" id="overview"></div></section>
${sections}
<section class="fuse" id="fuse" aria-labelledby="fuse-h">
<h2 id="fuse-h">Fuse and save</h2>
<label for="notes">Your notes (copied verbatim into the quest package)</label>
<textarea id="notes" placeholder="What to keep, what to change, the tone you want"></textarea>
<div class="actions"><button id="save" type="button">Save fusion</button><button id="copy" type="button" class="ghost">Copy fusion JSON</button></div>
<p id="status" class="status" role="status" aria-live="polite"></p>
<pre id="fusion-json" aria-label="Fusion JSON"></pre>
</section>
<footer>Paths are never invented: a seat that delivered nothing shows as an empty card. Unmeasured is never a pass.</footer>
</main>
<script type="application/json" id="council-data">${embed(data)}</script>
<script>${ASSET('fuse.client.js')}</script>
`;
}

export function renderFuse(runDir) {
  const data = collectCouncil(runDir);
  const html = renderHtml(data);
  const file = path.join(runDir, 'fuse.html');
  fs.writeFileSync(file, html);
  return { file, bytes: Buffer.byteLength(html), paths: data.slots.filter((s) => s.kind === 'path').length, skipped: data.slots.filter((s) => s.kind === 'skip').length };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: render.mjs <runDir>'); process.exit(2); }
  const out = renderFuse(path.resolve(dir));
  console.log(`fuse: ${out.file} (${Math.round(out.bytes / 1024)} KB, ${out.paths} paths, ${out.skipped} skipped)`);
}
