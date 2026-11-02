#!/usr/bin/env node
/* eslint-disable no-console -- a terminal CLI outside src/: stdout is its interface (repo law allows console here). */
// council.mjs - the GTAI quest council (spark `gta-quest-loop`, WP3).
//
//   node games/gtai/quest/council.mjs brief  --act <ActId> --goal "<owner goal>" [--constraints "<text>"] [--run <runId>]
//   node games/gtai/quest/council.mjs run    <runDir> [--seats claude,grok] [--ceiling-min 30] [--probe-s 150]
//   node games/gtai/quest/council.mjs assess <runDir>
//   node games/gtai/quest/council.mjs render <runDir>
//   node games/gtai/quest/council.mjs judge  <questDir> --author claude|grok [--ceiling-min 30]
//   node games/gtai/quest/council.mjs check  <questDir>
//
// Seats run through the ai-registry's contest machinery (engineCommand, parseEnvelope, classifyOutcome,
// resolveBin, runSeat), imported from the registry checkout ($AI_REGISTRY_DIR, else `registry.local` in
// .ai/manifest.yaml, else ../ai-registry). A seat that fails its probe is skipped and recorded, never faked.
// Plain Node ESM; console is fine here (outside src/).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..');
const GTAI = path.join(ROOT, 'games', 'gtai');
const COUNCIL_DIR = path.join(GTAI, 'quests', '_council');
const SCHEMA_FILE = path.join(HERE, 'proposal.schema.json');

export const ACT_IDS = ['prologue', 'clock-out', 'act1', 'act2', 'act3', 'act4', 'finale'];
/** Arc-table label in pitch.md §2 for each act id. */
const ACT_LABEL = { prologue: 'Prologue', 'clock-out': 'Clock-Out', act1: 'Act 1', act2: 'Act 2', act3: 'Act 3', act4: 'Act 4', finale: 'Finale' };
/** Souls unlocked by the END of each act (pitch §4: one per act; the 4th is protected and never named). */
const SOULS_BY_ACT = {
  prologue: [], 'clock-out': [], act1: ['gearbox'], act2: ['gearbox', 'sentry'], act3: ['gearbox', 'sentry', 'hauler'],
  act4: ['gearbox', 'sentry', 'hauler', 'the fourth soul (protected: never name or use it)'],
  finale: ['gearbox', 'sentry', 'hauler', 'the fourth soul (protected: never name or use it)'],
};
/** The council's seats (brief WP3). */
export const SEATS = {
  claude: { engine: 'claude', model: 'claude-opus-5-5', effort: 'high' },
  grok: { engine: 'grok', model: 'grok-4.7', effort: 'high' },
};
const otherSeat = (s) => (s === 'claude' ? 'grok' : 'claude');

// ------------------------------------------------------------------------------------------ utils
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const positional = (n) => argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))[n];
const die = (m) => { console.error(`council: ${m}`); process.exit(2); };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); };
const posix = (p) => p.split(path.sep).join('/');
const rel = (p) => posix(path.relative(ROOT, p));
const pad2 = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;

// ------------------------------------------------------------------------------------------ registry
function registryDir() {
  if (process.env.AI_REGISTRY_DIR) return path.resolve(process.env.AI_REGISTRY_DIR);
  try {
    const m = fs.readFileSync(path.join(ROOT, '.ai', 'manifest.yaml'), 'utf8').match(/^registry:\s*\n(?:[ \t]+.*\n)*?[ \t]+local:\s*(\S+)/m);
    if (m) return path.resolve(ROOT, m[1]);
  } catch { /* fall through */ }
  return path.resolve(ROOT, '..', 'ai-registry');
}

let registryCache = null;
/** The contest seat machinery from the registry checkout. Throws a clear error when the import fails. */
export async function loadRegistry() {
  if (registryCache) return registryCache;
  const dir = registryDir();
  const lib = path.join(dir, 'skills', 'contest', 'scripts', 'lib');
  try {
    const participants = await import(pathToFileURL(path.join(lib, 'participants.mjs')).href);
    const seat = await import(pathToFileURL(path.join(lib, 'seat.mjs')).href);
    for (const k of ['engineCommand', 'parseEnvelope', 'classifyOutcome']) if (typeof participants[k] !== 'function') throw new Error(`participants.mjs has no ${k}`);
    for (const k of ['resolveBin', 'runSeat']) if (typeof seat[k] !== 'function') throw new Error(`seat.mjs has no ${k}`);
    registryCache = { dir, ...participants, ...seat };
    return registryCache;
  } catch (e) {
    throw new Error(`cannot import the registry seat machinery from ${posix(lib)} (${e.message}). Set AI_REGISTRY_DIR.`);
  }
}

function seatSpec(name) {
  const s = SEATS[name];
  if (!s) die(`unknown seat "${name}" (${Object.keys(SEATS).join(', ')})`);
  return { ...s, label: null, id: name, spec: `${s.engine}:${s.model}@${s.effort}` };
}

// ------------------------------------------------------------------------------------------ pitch
function section(md, n) {
  const start = md.search(new RegExp(`^## ${n}\\. `, 'm'));
  if (start < 0) return '';
  const rest = md.slice(start);
  const next = rest.slice(3).search(/^## \d+\. /m);
  return (next < 0 ? rest : rest.slice(0, next + 3)).trim();
}
const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stripTags = (s) => s.replace(/\s*\*\*\[(owner|proposal|open)[^\]]*\]\*\*/g, '').trim();

/** Cast from pitch §3: each table row / labelled paragraph -> `- Name (\`id\`): role`. */
export function castFromPitch(md) {
  const s3 = section(md, 3);
  const out = [];
  let antagonists = false;
  for (const line of s3.split('\n')) {
    // Protected canon (pitch §10): the act-antagonist order/allegiance and the betrayer are owner-only,
    // so the brief never carries the host's proposals for them.
    if (/^\*\*[^*]+\*\*/.test(line) && !line.startsWith('|')) antagonists = /^\*\*Act antagonists/i.test(line);
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const names = [...cells[0].matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].trim());
      if (!names.length || /^-+$/.test(cells[0])) continue;
      let role = stripTags(cells.at(-1).replace(/\*\*/g, ''));
      if (antagonists) role = 'act antagonist (which act, and whose side, is owner-only)';
      role = role.replace(/\.?\s*(Proposed|Alternative) betrayer[^.]*\.?/gi, '').trim();
      const what = cells[0].replace(/\*\*[^*]+\*\*/g, '').replace(/^[,\s]+/, '').trim();
      for (const n of names) out.push(`- ${n} (\`${kebab(n)}\`)${what && names.length === 1 ? `, ${what}` : ''}: ${role}`);
    } else {
      const m = line.match(/^\*\*([^*]+)\*\*:\s*\*\*([^*]+)\*\*\s*(.*)$/);
      if (m) out.push(`- ${m[2].trim()} (\`${kebab(m[2])}\`): ${m[1].trim().toLowerCase()}. ${stripTags(m[3].replace(/\*\*/g, '')).replace(/^\([^)]*\)\.\s*/, '').split(/(?<=\.)\s/)[0]}`);
    }
  }
  return out.join('\n');
}

/** The pitch §2 arc-table row for an act, as a small two-column table. */
export function actRowFromPitch(md, act) {
  const lines = section(md, 2).split('\n');
  const head = lines.find((l) => /^\|\s*Part\s*\|/.test(l));
  const row = lines.find((l) => l.startsWith(`| ${ACT_LABEL[act]}`));
  if (!head || !row) return `(no row for ${act} in pitch.md §2)`;
  const h = head.split('|').slice(1, -1).map((c) => c.trim());
  const r = row.split('|').slice(1, -1).map((c) => c.trim());
  return h.map((k, i) => `- ${k}: ${r[i] ?? ''}`).join('\n');
}

// ------------------------------------------------------------------------------------------ ledger + voices
/** Quest packages on disk (folders starting with `_` are never ledger quests). Unreadable ones are reported. */
export function readLedger() {
  const dir = path.join(GTAI, 'quests');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const id of fs.readdirSync(dir).sort()) {
    if (id.startsWith('_')) continue;
    const f = path.join(dir, id, 'quest.json');
    if (!fs.existsSync(f)) continue;
    try { out.push(readJson(f)); } catch (e) { console.error(`council: ledger quest ${id} unreadable (${e.message}); skipped`); }
  }
  return out;
}

export function voiceIds() {
  const dir = path.join(GTAI, 'voices');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort() : [];
}
const voiceText = (id) => fs.readFileSync(path.join(GTAI, 'voices', `${id}.md`), 'utf8').trim();

// ------------------------------------------------------------------------------------------ validation
/** A small JSON-Schema (draft-07 subset) validator: exactly the keywords proposal.schema.json uses. */
export function validateSchema(schema, value, at = '$') {
  const errs = [];
  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  if ('const' in schema && value !== schema.const) errs.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  if (schema.oneOf) {
    const ok = schema.oneOf.filter((s) => validateSchema(s, value, at).length === 0).length;
    if (ok !== 1) errs.push(`${at}: must match exactly one of ${schema.oneOf.map((s) => s.type ?? 'object').join(' | ')}`);
    return errs;
  }
  if (schema.type) {
    const t = typeOf(value);
    if (t !== schema.type) { errs.push(`${at}: must be ${schema.type}, got ${t}`); return errs; }
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${at}: must not be empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: "${value}" must match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errs.push(`${at}: must be a finite number`);
    if (schema.minimum != null && value < schema.minimum) errs.push(`${at}: must be >= ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errs.push(`${at}: must be <= ${schema.maximum}`);
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) errs.push(`${at}: must be > ${schema.exclusiveMinimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errs.push(`${at}: items must be unique`);
    if (schema.items) value.forEach((v, i) => errs.push(...validateSchema(schema.items, v, `${at}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${at}: missing required "${k}"`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errs.push(...validateSchema(schema.properties[k], v, `${at}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${at}: unknown key "${k}"`);
    }
  }
  return errs;
}

/** Schema + the brief's own rules for one seat's `[A, B]` delivery. Returns error strings (empty = valid). */
export function validateDelivery(arr, { seat, act }) {
  const schema = readJson(SCHEMA_FILE);
  if (!Array.isArray(arr)) return ['reply must be a JSON array [A, B]'];
  const errs = [];
  if (arr.length !== 2) errs.push(`array must have exactly 2 objects, got ${arr.length}`);
  arr.forEach((p, i) => {
    const at = `[${i}]`;
    const s = validateSchema(schema, p, at);
    errs.push(...s);
    if (s.length || !p || typeof p !== 'object') return;
    const want = i === 0 ? 'A' : 'B';
    if (p.variant !== want) errs.push(`${at}.variant: element ${i} must be variant ${want}`);
    if (p.seat !== seat) errs.push(`${at}.seat: must be "${seat}"`);
    if (p.pathId !== `${p.seat}-${p.variant}`) errs.push(`${at}.pathId: must be "${p.seat}-${p.variant}"`);
    if (act && p.act !== act) errs.push(`${at}.act: must be "${act}"`);
    if (p.lines.length < 8 || p.lines.length > 14) errs.push(`${at}.lines: needs 8-14 lines, got ${p.lines.length}`);
    if (p.beats.length < 3) errs.push(`${at}.beats: needs at least 3 beats, got ${p.beats.length}`);
    const lineIds = new Set();
    for (const l of p.lines) { if (lineIds.has(l.id)) errs.push(`${at}.lines: duplicate id "${l.id}"`); lineIds.add(l.id); }
    const charIds = new Set(p.characters.map((c) => c.id));
    for (const l of p.lines) if (!charIds.has(l.speaker)) errs.push(`${at}.lines["${l.id}"].speaker "${l.speaker}" is not a characters id`);
    for (const b of p.beats) for (const id of b.lineIds) if (!lineIds.has(id)) errs.push(`${at}.beats["${b.id}"].lineIds: "${id}" is not a line id`);
    const fresh = p.characters.filter((c) => c.status === 'new');
    if (fresh.length > 1) errs.push(`${at}.characters: at most one new character per variant, got ${fresh.length}`);
    for (const c of fresh) if (!c.designNote) errs.push(`${at}.characters["${c.id}"]: a new character needs a designNote`);
  });
  if (errs.length === 0 && arr.length === 2) {
    const [a, b] = arr.map((p) => p.fingerprint);
    for (const k of ['giver', 'coreVerb', 'payoffKind']) if (String(a[k]).toLowerCase() === String(b[k]).toLowerCase()) errs.push(`[1].fingerprint.${k}: variant B must differ from A (both "${a[k]}")`);
  }
  return errs;
}

/** The first JSON array in a seat's reply (bare, or inside a code fence, or after a banner). */
export function extractArray(text) {
  const t = String(text ?? '').replace(/```(?:json)?/g, '').trim();
  try { const v = JSON.parse(t); if (Array.isArray(v)) return v; } catch { /* keep looking */ }
  const end = t.lastIndexOf(']');
  for (let i = t.indexOf('['), n = 0; i >= 0 && i < end && n < 50; i = t.indexOf('[', i + 1), n += 1) {
    try { const v = JSON.parse(t.slice(i, end + 1)); if (Array.isArray(v)) return v; } catch { /* next */ }
  }
  return null;
}

/** The first JSON object in a reply. */
export function extractObject(text) {
  const t = String(text ?? '').replace(/```(?:json)?/g, '').trim();
  const end = t.lastIndexOf('}');
  for (let i = t.indexOf('{'), n = 0; i >= 0 && i < end && n < 50; i = t.indexOf('{', i + 1), n += 1) {
    try { const v = JSON.parse(t.slice(i, end + 1)); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch { /* next */ }
  }
  return null;
}

// ------------------------------------------------------------------------------------------ brief
/** The story guard's variable vocabulary (assess-cli.ts --story-vars), rendered for the brief. */
export function storyVarsBlock() {
  const r = spawnSync('npx', ['--no-install', 'tsx', path.join('games', 'gtai', 'quest', 'assess-cli.ts'), '--story-vars'],
    { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  let v;
  try { v = JSON.parse(r.stdout); } catch { throw new Error(`assess-cli.ts --story-vars failed (exit ${r.status}): ${String(r.stderr).slice(0, 300)}`); }
  const tick = (s) => '`' + s + '`';
  const rows = v.variables.map((x) => {
    const rule = x.protected ? ' NEVER write it.' : x.writtenByArc ? ` Set by the ${x.writtenByArc} arc: never write it; read it only in ${x.writtenByArc} or later.` : '';
    return `- ${tick(x.name)}: ${x.doc}${rule}`;
  });
  const p = v.questVarPrefix;
  return `${rows.join('\n')}\n\nA quest's own state is a new variable named ${tick(`${p}<name>`)} in snake case, e.g. ${tick(`${p}fax_jobs_done`)}. ` +
    'Any other name is undeclared and blocks the story guard. Read only the variables above, or one an earlier quest writes.' +
    ((v.claimableBeats ?? []).length
      ? '\n\nA quest may REALISE one arc beat of its own act by setting `claimsBeat` to the beat id; it then must write ' +
        "that beat's variables (and only then may it). One quest per beat. Claimable beats:\n" +
        v.claimableBeats.map((b) => `- ${tick(b.id)} (${b.act}): ${b.title}; writes ${b.writes.map(tick).join(', ')}`).join('\n')
      : '');
}

function brief() {
  const act = opt('act') ?? die('--act is required');
  if (!ACT_IDS.includes(act)) die(`--act must be one of ${ACT_IDS.join(', ')}`);
  const goal = opt('goal') ?? die('--goal is required (the owner goal, verbatim)');
  const constraints = opt('constraints', '');
  const runId = opt('run', `${stamp()}-${act}`);
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) die('--run must be filesystem-safe');
  const dir = path.join(COUNCIL_DIR, runId);
  if (fs.existsSync(path.join(dir, 'BRIEF.md'))) die(`${rel(dir)} already has a BRIEF.md; pick another --run`);
  const pitch = fs.readFileSync(path.join(GTAI, 'pitch.md'), 'utf8');
  const economy = readJson(path.join(GTAI, 'balance', 'quest-economy.json'));
  const band = economy.acts?.[act];
  const ledger = readLedger();
  const voices = voiceIds();
  const strip = (s) => s.replace(/^## \d+\.[^\n]*\n/, '').trim();
  const fill = {
    act, runId, date: new Date().toISOString().slice(0, 10), goal,
    constraints: constraints.trim() || '(none given)',
    actRow: actRowFromPitch(pitch, act),
    economyRevision: String(economy.revision),
    economyBand: band ? '```json\n' + JSON.stringify(band, null, 2) + '\n```' : '(no band for this act)',
    cast: castFromPitch(pitch),
    souls: SOULS_BY_ACT[act].length ? SOULS_BY_ACT[act].join(', ') : 'none yet',
    tone: strip(section(pitch, 6)),
    madness: strip(section(pitch, 5)),
    voices: voices.length ? voices.map((id) => `### Voice bible \`${id}\`\n\n${voiceText(id).replace(/^# /gm, '#### ').replace(/^## /gm, '##### ')}`).join('\n\n') : '(no voice bibles yet)',
    storyVars: storyVarsBlock(),
    ledger: ledger.length
      ? ledger.map((q) => `- ${q.title} (${q.act}): giver \`${q.fingerprint?.giver}\`, verb \`${q.fingerprint?.coreVerb}\`, payoff \`${q.fingerprint?.payoffKind}\`, location \`${q.fingerprint?.location}\`, new mechanic \`${q.fingerprint?.newMechanic}\``).join('\n')
      : '(none yet: this is the first quest)',
  };
  let md = fs.readFileSync(path.join(HERE, 'brief.template.md'), 'utf8');
  for (const [k, v] of Object.entries(fill)) md = md.replaceAll(`{{${k}}}`, v);
  if (/\{\{\w+\}\}/.test(md)) die(`template marker left unfilled: ${md.match(/\{\{\w+\}\}/)[0]}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'BRIEF.md'), md);
  fs.copyFileSync(SCHEMA_FILE, path.join(dir, 'proposal.schema.json'));
  writeJson(path.join(dir, 'run.json'), { runId, act, goal, constraints, createdAt: new Date().toISOString(), voices, ledger: ledger.map((q) => q.id), economyRevision: economy.revision });
  console.log(`brief: ${rel(path.join(dir, 'BRIEF.md'))} (${md.length} chars, ${voices.length} voice bibles, ${ledger.length} ledger quests)`);
  console.log(`next: node games/gtai/quest/council.mjs run ${rel(dir)}`);
}

// ------------------------------------------------------------------------------------------ run
async function probeSeat(reg, p, timeoutMs) {
  const bin = reg.resolveBin(p.engine);
  if (!bin) return { available: false, reason: `no ${p.engine} CLI found (set CONTEST_${p.engine.toUpperCase()}_BIN)` };
  const logDir = path.join(os.tmpdir(), `gtai-council-probe-${process.pid}`, p.id);
  const command = reg.engineCommand({ ...p, effort: 'low' }, bin, 'Reply with exactly the word READY and nothing else. Do not use any tools.', { workspace: '.' });
  const r = await reg.runSeat(command, { cwd: os.tmpdir(), timeoutMs, logDir });
  const parsed = reg.parseEnvelope(p.engine, r.stdout);
  const outcome = reg.classifyOutcome(parsed, r);
  const ok = outcome === 'completed' && /READY/i.test(parsed.final);
  return { available: ok, outcome, wall_s: r.wall_s, cost_usd: parsed.cost_usd ?? null, reason: ok ? null : (parsed.errors[0] ?? (r.timedOut ? 'timed out' : `exit ${r.exit}, reply "${parsed.final.slice(0, 80)}"`)) };
}

async function seatTurn(reg, p, prompt, { cwd, timeoutMs, logDir }) {
  const bin = reg.resolveBin(p.engine);
  const r = await reg.runSeat(reg.engineCommand(p, bin, prompt, { workspace: '.' }), { cwd, timeoutMs, logDir });
  const parsed = reg.parseEnvelope(p.engine, r.stdout);
  return { r, parsed, outcome: reg.classifyOutcome(parsed, r) };
}

async function runCouncil() {
  const dir = path.resolve(positional(1) ?? die('usage: run <runDir>'));
  if (!fs.existsSync(path.join(dir, 'BRIEF.md'))) die(`${rel(dir)} has no BRIEF.md (run \`brief\` first)`);
  const meta = readJson(path.join(dir, 'run.json'));
  const reg = await loadRegistry().catch((e) => die(e.message));
  const names = opt('seats', 'claude,grok').split(',').map((s) => s.trim()).filter(Boolean);
  const seats = names.map(seatSpec);
  const ceilingMs = Number(opt('ceiling-min', '30')) * 60_000;
  const probeMs = Number(opt('probe-s', '150')) * 1000;
  if (!(ceilingMs > 0) || !(probeMs > 0)) die('--ceiling-min and --probe-s need positive numbers');
  const seatsFile = path.join(dir, 'seats.json');
  const record = { runId: meta.runId, startedAt: new Date().toISOString(), seats: {} };
  const save = () => writeJson(seatsFile, record);

  console.log(`probing ${seats.map((p) => p.spec).join(', ')} (ceiling ${probeMs / 1000}s)`);
  const probes = await Promise.all(seats.map((p) => probeSeat(reg, p, probeMs)));
  seats.forEach((p, i) => {
    record.seats[p.id] = { spec: p.spec, status: probes[i].available ? 'live' : 'skipped', reason: probes[i].reason, probe: probes[i] };
    console.log(`${probes[i].available ? 'live   ' : 'SKIPPED'} ${p.spec}${probes[i].available ? ` (${probes[i].wall_s}s)` : `: ${probes[i].reason}`}`);
  });
  save();

  await Promise.all(seats.filter((p) => record.seats[p.id].status === 'live').map(async (p) => {
    const rec = record.seats[p.id];
    const logRoot = path.join(dir, '_logs', p.id);
    const prompt = `Read BRIEF.md in the current directory. You are seat "${p.id}". Reply with only the JSON array.`;
    const t0 = Date.now();
    rec.attempts = [];
    let turn = await seatTurn(reg, p, prompt, { cwd: dir, timeoutMs: ceilingMs, logDir: path.join(logRoot, 'attempt-1') });
    const note = (t, n) => rec.attempts.push({ attempt: n, outcome: t.outcome, exit: t.r.exit, timedOut: t.r.timedOut, wall_s: t.r.wall_s, cost_usd: t.parsed.cost_usd ?? null, turns: t.parsed.turns, usage: t.parsed.usage, errors: t.parsed.errors });
    note(turn, 1);
    let arr = turn.outcome === 'completed' ? extractArray(turn.parsed.final) : null;
    let errors = turn.outcome !== 'completed' ? [`seat ${turn.outcome}: ${turn.parsed.errors.join('; ') || `exit ${turn.r.exit}`}`] : arr ? validateDelivery(arr, { seat: p.id, act: meta.act }) : ['no JSON array found in the reply'];
    if (errors.length && turn.outcome === 'completed') {
      // One repair round: the seat gets its own reply and the validation errors back.
      const repair = `# Repair\n\nYour reply to BRIEF.md failed validation. Fix every error and reply with only the corrected JSON array [A, B].\n\n## Errors\n\n${errors.map((e) => `- ${e}`).join('\n')}\n\n## Your previous reply\n\n${turn.parsed.final}\n`;
      fs.writeFileSync(path.join(dir, `REPAIR.${p.id}.md`), repair);
      console.log(`${p.id}: ${errors.length} validation error(s); one repair round`);
      turn = await seatTurn(reg, p, `Read REPAIR.${p.id}.md and BRIEF.md in the current directory. You are seat "${p.id}". Reply with only the corrected JSON array.`, { cwd: dir, timeoutMs: ceilingMs, logDir: path.join(logRoot, 'attempt-2') });
      note(turn, 2);
      arr = turn.outcome === 'completed' ? extractArray(turn.parsed.final) : null;
      errors = turn.outcome !== 'completed' ? [`repair ${turn.outcome}: ${turn.parsed.errors.join('; ') || `exit ${turn.r.exit}`}`] : arr ? validateDelivery(arr, { seat: p.id, act: meta.act }) : ['no JSON array found in the repair reply'];
    }
    rec.wall_s = Math.round((Date.now() - t0) / 10) / 100;
    const costs = rec.attempts.map((a) => a.cost_usd).filter((c) => c != null);
    rec.cost_usd = costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) * 10000) / 10000 : null;
    if (rec.cost_usd == null) rec.cost_note = 'the envelope reported no cost (unmeasured, not zero)';
    if (errors.length === 0) {
      writeJson(path.join(dir, `proposals.${p.id}.json`), arr);
      rec.status = 'delivered';
      rec.pathIds = arr.map((x) => x.pathId);
    } else {
      writeJson(path.join(dir, `proposals.${p.id}.invalid.json`), { seat: p.id, reason: errors, reply: arr ?? turn.parsed.final });
      rec.status = 'invalid';
      rec.reason = errors.slice(0, 20).join('; ');
    }
    console.log(`${p.id}: ${rec.status} in ${rec.wall_s}s, cost ${rec.cost_usd ?? 'unmeasured'}`);
    save();
  }));
  record.finishedAt = new Date().toISOString();
  // Total includes the probes. A seat whose envelope reports no cost makes the total a floor, not a sum.
  const all = Object.values(record.seats).flatMap((s) => [s.probe?.cost_usd, ...(s.attempts ?? []).map((a) => a.cost_usd)]);
  const known = all.filter((c) => c != null);
  record.cost_usd_total = known.length ? Math.round(known.reduce((a, b) => a + b, 0) * 10000) / 10000 : null;
  record.cost_complete = all.every((c) => c != null);
  save();
  console.log(`cost: ${record.cost_usd_total ?? 'unmeasured'}${record.cost_complete ? '' : ' (incomplete: a seat reported no cost)'}`);
  console.log(`seats: ${rel(seatsFile)}\nnext: node games/gtai/quest/council.mjs assess ${rel(dir)}`);
}

// ------------------------------------------------------------------------------------------ assess / check / render
function tsx(args) {
  const r = spawnSync('npx', ['--no-install', 'tsx', path.join('games', 'gtai', 'quest', 'assess-cli.ts'), ...args], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
}

function assess() {
  const dir = path.resolve(positional(1) ?? die('usage: assess <runDir>'));
  process.exit(tsx([dir]));
}

function check() {
  const dir = path.resolve(positional(1) ?? die('usage: check <questDir>'));
  process.exit(tsx(['--package', dir]));
}

async function render() {
  const dir = path.resolve(positional(1) ?? die('usage: render <runDir>'));
  const { renderFuse } = await import(pathToFileURL(path.join(HERE, 'render.mjs')).href);
  const out = renderFuse(dir);
  console.log(`fuse: ${rel(out.file)} (${Math.round(out.bytes / 1024)} KB, ${out.paths} paths, ${out.skipped} skipped/invalid seats)`);
}

// ------------------------------------------------------------------------------------------ judge
/** Neutral line aliases (`L1`..`Ln`): real line ids can carry the authoring seat's name. */
export const judgeAlias = (pkg) => pkg.lines.map((l, i) => [`L${i + 1}`, l.id]);

export function judgePrompt(pkg) {
  const speakers = [...new Set(pkg.lines.map((l) => l.speaker))];
  const bible = (id) => (fs.existsSync(path.join(GTAI, 'voices', `${id}.md`)) ? voiceText(id) : `(no voice bible for \`${id}\`: judge voiceFit against the line alone and say so in the note)`);
  // Blind: no seat, no provenance, no fusion notes. Only the lines, who speaks them, and the bibles.
  const lines = pkg.lines.map((l, i) => ({ lineId: `L${i + 1}`, speaker: l.speaker, purpose: l.purpose, text: l.text, ...(l.when ? { when: l.when } : {}) }));
  return `# Line judge

You judge the voice lines of one quest for GTAI: Uprising. You do not know who wrote them. Do not write or edit any file.

Doctrine: no line is filler. Every line must be funny, or move a character, or move the game forward, and it claims the purposes it earns.

## Rubric (per line)
- \`earned\` 1-5: does the line earn EVERY purpose it claims? 5 = each claim lands hard; 3 = one claim is weak; 1 = it earns none.
- \`voiceFit\` 1-5: fit to the speaker's voice bible below (rhythm, vocabulary, refusals, never-says list). 5 = only this speaker could say it; 1 = breaks a refusal or a never-says entry.
- \`note\`: one short sentence; name the problem when either score is below 4.

## Quest
${pkg.title}: ${pkg.logline}

## Lines
\`\`\`json
${JSON.stringify(lines, null, 2)}
\`\`\`

## Voice bibles (verbatim)
${speakers.map((id) => `### \`${id}\`\n\n${bible(id).replace(/^# /gm, '#### ').replace(/^## /gm, '##### ')}`).join('\n\n')}

## Reply
Only a JSON object, no prose, no code fence:
{"lines":[{"lineId":"<id>","earned":<1-5>,"voiceFit":<1-5>,"note":"<text>"}]}
One entry per line above, every line exactly once.
`;
}

export function validateJudgement(obj, pkg) {
  const errs = [];
  const ids = new Set(pkg.lines.map((_, i) => `L${i + 1}`));
  if (!obj || !Array.isArray(obj.lines)) return ['reply must be {"lines":[...]}'];
  const seen = new Set();
  for (const j of obj.lines) {
    if (!ids.has(j.lineId)) errs.push(`unknown lineId "${j.lineId}"`);
    if (seen.has(j.lineId)) errs.push(`lineId "${j.lineId}" judged twice`);
    seen.add(j.lineId);
    for (const k of ['earned', 'voiceFit']) if (!Number.isInteger(j[k]) || j[k] < 1 || j[k] > 5) errs.push(`${j.lineId}.${k} must be an integer 1-5`);
    if (typeof j.note !== 'string') errs.push(`${j.lineId}.note must be a string`);
  }
  for (const id of ids) if (!seen.has(id)) errs.push(`line "${id}" was not judged`);
  return errs;
}

async function judge() {
  const qdir = path.resolve(positional(1) ?? die('usage: judge <questDir> --author claude|grok'));
  const author = opt('author') ?? die('--author claude|grok is required');
  if (!SEATS[author]) die('--author must be claude or grok');
  const pkg = readJson(path.join(qdir, 'quest.json'));
  if (!Array.isArray(pkg.lines) || pkg.lines.length === 0) die('quest.json has no lines to judge');
  const judgeSeat = otherSeat(author);
  const p = seatSpec(judgeSeat);
  const reg = await loadRegistry().catch((e) => die(e.message));
  if (!reg.resolveBin(p.engine)) die(`judge seat ${judgeSeat}: no ${p.engine} CLI found`);
  const work = path.join(qdir, 'verdicts', '_judge');
  fs.mkdirSync(work, { recursive: true });
  fs.writeFileSync(path.join(work, 'JUDGE.md'), judgePrompt(pkg));
  const ceilingMs = Number(opt('ceiling-min', '30')) * 60_000;
  const turn = await seatTurn(reg, p, 'Read JUDGE.md in the current directory and reply with only the JSON object.', { cwd: work, timeoutMs: ceilingMs, logDir: path.join(work, '_logs') });
  if (turn.outcome !== 'completed') die(`judge seat ${judgeSeat} ${turn.outcome}: ${turn.parsed.errors.join('; ') || `exit ${turn.r.exit}`}`);
  const obj = extractObject(turn.parsed.final);
  const errs = validateJudgement(obj, pkg);
  const alias = new Map(judgeAlias(pkg));
  if (errs.length) {
    writeJson(path.join(work, 'invalid.json'), { errors: errs, reply: turn.parsed.final });
    die(`judge reply invalid (${errs.length} error(s), first: ${errs[0]}); see ${rel(path.join(work, 'invalid.json'))}`);
  }
  const report = {
    schema: 'gtai.lineJudge/1', judgeSeat, authorSeat: author, judgedAt: new Date().toISOString(),
    lines: obj.lines.map((j) => ({ lineId: alias.get(j.lineId), earned: j.earned, voiceFit: j.voiceFit, note: j.note })),
  };
  writeJson(path.join(qdir, 'verdicts', 'lines.judge.json'), report);
  const weak = report.lines.filter((j) => j.earned < 4 || j.voiceFit < 4);
  console.log(`judge: ${judgeSeat} judged ${report.lines.length} lines (${weak.length} below 4) in ${turn.r.wall_s}s, cost ${turn.parsed.cost_usd ?? 'unmeasured'} -> ${rel(path.join(qdir, 'verdicts', 'lines.judge.json'))}`);
}

// ------------------------------------------------------------------------------------------ main
const CMDS = { brief, run: runCouncil, assess, render, judge, check };
const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const cmd = argv[0];
  if (!CMDS[cmd]) die(`usage: council.mjs <${Object.keys(CMDS).join('|')}> ... (see the header of this file)`);
  await CMDS[cmd]();
}
