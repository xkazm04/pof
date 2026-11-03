#!/usr/bin/env node
/**
 * voice.mjs — the headless side of the PoF Voice room (lane pof-voice). Talks to a RUNNING PoF server.
 *
 *   node games/gtai/voice/voice.mjs status                          proven / total, per quest, next unproven
 *   node games/gtai/voice/voice.mjs next [--n N] [--quest <id>]     the next unproven lines, in play order
 *   node games/gtai/voice/voice.mjs line --line <id> [--quest <id>] a line's takes, verdicts and the owner's notes
 *   node games/gtai/voice/voice.mjs takes --line <id> --n <k> --direction "<text>"
 *        [--quest <id>] [--voice <voiceRowId>] [--model eleven_v3|eleven_multilingual_v2]
 *        [--stability x] [--style x] [--speed x]
 *   node games/gtai/voice/voice.mjs design --character <id> [--n 3] [--description "<text>"]
 *   node games/gtai/voice/voice.mjs stock --character <id> --voice-id <provider id> --name <name> [--note <text>]
 *   node games/gtai/voice/voice.mjs voices [--character <id>]
 *   node games/gtai/voice/voice.mjs export --quest <id>             writes ONLY approved takes into the game
 *
 * HUMAN GATED: there is deliberately no approve, reject or cast command. Verdicts and casting are the
 * owner's clicks in the Voice room (the routes refuse this process with 403). Server: --base or POF_URL,
 * default http://localhost:3001.
 */
const out = (s) => process.stdout.write(`${s}
`);
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};
const BASE = (opt('base') ?? process.env.POF_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const API = `${BASE}/api/games/gtai/voice`;

async function call(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`PoF is not reachable at ${BASE} (${e.message}). Start it, or pass --base.`);
  }
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}, not JSON` }));
  if (!json.success) throw new Error(`${res.status}: ${json.error}`);
  return json.data;
}

const pad = (s, n) => String(s).padEnd(n);
const lineRow = (e) => `  ${pad(e.questId, 16)} ${pad(e.lineId, 26)} ${pad(e.speaker, 20)} ${pad(e.state, 17)} ${e.text.length > 70 ? `${e.text.slice(0, 67)}...` : e.text}`;

async function findLine(lineId, questId) {
  const room = await call('');
  const hits = room.queue.filter((e) => e.lineId === lineId && (!questId || e.questId === questId));
  if (hits.length === 0) throw new Error(`no line ${lineId}${questId ? ` in ${questId}` : ''} in the queue`);
  if (hits.length > 1) throw new Error(`line id ${lineId} is in several quests (${hits.map((h) => h.questId).join(', ')}); pass --quest`);
  return hits[0];
}

const num = (v) => (v === undefined ? undefined : Number(v));

async function main() {
  switch (cmd) {
    case 'status': {
      const s = await call(`?view=status&n=${opt('n', '5')}`);
      out(`proven ${s.proven} / ${s.total} lines · ${s.chars} characters spent on takes`);
      for (const q of s.quests) out(`  ${pad(q.questId, 16)} ${pad(q.title, 28)} ${q.proven}/${q.total}`);
      out('next unproven:');
      for (const e of s.next) out(lineRow(e));
      return;
    }
    case 'next': {
      const room = await call('');
      const quest = opt('quest');
      const rows = room.queue.filter((e) => e.state !== 'proven' && (!quest || e.questId === quest)).slice(0, Number(opt('n', '5')));
      for (const e of rows) out(lineRow(e));
      if (rows.length === 0) out('  nothing unproven');
      return;
    }
    case 'line': {
      const e = await findLine(opt('line'), opt('quest'));
      const d = await call(`/lines?questId=${encodeURIComponent(e.questId)}&lineId=${encodeURIComponent(e.lineId)}`);
      out(`${d.line.questId}/${d.line.lineId} · ${d.line.speaker} · ${d.line.state}\n  "${d.line.text}"`);
      for (const t of d.takes) {
        out(`  take ${t.id.slice(0, 8)} ${pad(t.verdict, 10)}${t.stale ? ' (stale text)' : ''} dir="${t.direction}" ${t.settings.model} ${t.durationMs ?? '?'}ms ${t.chars}ch${t.verdictNote ? ` · note: ${t.verdictNote}` : ''}`);
      }
      return;
    }
    case 'takes': {
      const e = await findLine(opt('line'), opt('quest'));
      const settings = { model: opt('model'), stability: num(opt('stability')), style: num(opt('style')), speed: num(opt('speed')) };
      const r = await call('/takes', { questId: e.questId, lineId: e.lineId, n: Number(opt('n', '1')), direction: opt('direction', ''), voiceId: opt('voice'), settings });
      for (const t of r.takes) out(`  take ${t.id} ${t.durationMs ?? '?'}ms ${t.loudnessLufs ?? '?'} LUFS sent="${t.sentText.slice(0, 80)}"`);
      out(`${r.takes.length} takes · ${r.chars} characters. The owner judges them in the Voice room.`);
      return;
    }
    case 'design': {
      const r = await call('/voices', { action: 'design', characterId: opt('character'), n: Number(opt('n', '3')), description: opt('description') });
      for (const v of r.voices) out(`  candidate ${v.id} ${v.name}`);
      out(`${r.voices.length} candidates · ${r.chars} characters. The owner listens and casts in the Voice room.`);
      return;
    }
    case 'stock': {
      const r = await call('/voices', { action: 'stock', characterId: opt('character'), providerVoiceId: opt('voice-id'), name: opt('name'), note: opt('note') });
      out(`  candidate ${r.voices[0].id} ${r.voices[0].name} (stock)`);
      return;
    }
    case 'voices': {
      const r = await call('/voices');
      const who = opt('character');
      for (const v of r.voices.filter((x) => !who || x.characterId === who)) {
        out(`  ${pad(v.characterId, 20)} ${pad(v.status, 10)} ${pad(v.source, 9)} ${v.id} ${v.name}`);
      }
      return;
    }
    case 'export': {
      const quest = opt('quest');
      if (!quest) throw new Error('export needs --quest <id>');
      const r = await call('/export', { questId: quest });
      for (const w of r.written) out(`  wrote ${w.lineId} -> ${w.path}`);
      for (const s of r.skipped) out(`  skipped ${s.lineId}: ${s.reason}`);
      out(`${r.written.length} written, ${r.skipped.length} skipped (unproven lines are never exported)`);
      return;
    }
    default:
      out('usage: voice.mjs status | next | line | takes | design | stock | voices | export (see the header). '
        + 'There is no approve/reject/cast: the owner does that in the PoF Voice room.');
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(`voice.mjs: ${e.message}`);
  process.exitCode = 1;
});
