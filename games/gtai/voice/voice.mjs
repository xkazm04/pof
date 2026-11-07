#!/usr/bin/env node
/**
 * voice.mjs — the headless side of the PoF Voice room (lane pof-voice). Talks to a RUNNING PoF server.
 *
 *   node games/gtai/voice/voice.mjs status                          proven / total, per quest, next unproven
 *   node games/gtai/voice/voice.mjs next [--n N] [--quest <id>]     the next unproven lines, in play order
 *   node games/gtai/voice/voice.mjs line --line <id> [--quest <id>] a line's takes, verdicts and the owner's notes
 *   node games/gtai/voice/voice.mjs verdicts [--since 2h|<ISO>|<ms>] [--quest <id>]  every verdict + note, by line
 *   node games/gtai/voice/voice.mjs readback [--line <id>] [--quest <id>]   local Whisper read-back of takes not read yet
 *   node games/gtai/voice/voice.mjs takes --line <id> --n <k> --direction "<text>"
 *        [--quest <id>] [--voice <voiceRowId>] [--model eleven_v3|eleven_multilingual_v2]
 *        [--stability x] [--style x] [--speed x]
 *   node games/gtai/voice/voice.mjs design --character <id> [--n 3] [--description "<text>"]
 *   node games/gtai/voice/voice.mjs stock --character <id> --voice-id <provider id> --name <name> [--note <text>]
 *   node games/gtai/voice/voice.mjs stock --casting <casting.json>   every premade pick of a casting file (candidates)
 *   node games/gtai/voice/voice.mjs voices [--character <id>]
 *   node games/gtai/voice/voice.mjs casting [--character <id>]       casting rounds: candidates, verdicts, notes, round comments
 *   node games/gtai/voice/voice.mjs round --character <id> --file <round.json>   design one casting round (1-5 voices)
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
const lineRow = (e) => `  ${pad(e.questId, 16)} ${pad(e.lineId, 26)} ${pad(e.speaker, 20)} ${pad(e.lineClass ?? 'story', 6)} ${pad(e.state, 17)}${e.flagged ? ` [${e.flagged} flagged]` : ''} ${e.text.length > 70 ? `${e.text.slice(0, 67)}...` : e.text}`;
/** What a direction is written for: the class (a bark fires on its when-tags and may repeat) and the beat. */
const contextOf = (l) => [
  l.lineClass === 'bark' ? `  bark · fires on: ${(l.when ?? []).join(', ')} (if a tag recurs in play, direct it for the repeat hearing too)` : '  story line · plays in the flow of its beat',
  l.beatId ? `  scene ${l.beatTitle ?? l.beatId}: ${l.beatSummary ?? ''}` : null,
].filter(Boolean).join('\n');

async function findLine(lineId, questId) {
  const room = await call('');
  const hits = room.queue.filter((e) => e.lineId === lineId && (!questId || e.questId === questId));
  if (hits.length === 0) throw new Error(`no line ${lineId}${questId ? ` in ${questId}` : ''} in the queue`);
  if (hits.length > 1) throw new Error(`line id ${lineId} is in several quests (${hits.map((h) => h.questId).join(', ')}); pass --quest`);
  return hits[0];
}

const num = (v) => (v === undefined ? undefined : Number(v));
/** `--since`: epoch ms, an ISO time, or an age like `45m`, `2h`, `1d`; absent = everything. */
function sinceMs(v) {
  if (!v) return 0;
  const age = /^(\d+)([mhd])$/.exec(v);
  if (age) return Date.now() - Number(age[1]) * { m: 60_000, h: 3_600_000, d: 86_400_000 }[age[2]];
  const t = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
  if (Number.isNaN(t)) throw new Error(`--since ${v}: use epoch ms, an ISO time, or 45m / 2h / 1d`);
  return t;
}

async function main() {
  switch (cmd) {
    case 'status': {
      const s = await call(`?view=status&n=${opt('n', '5')}`);
      out(`proven ${s.proven} / ${s.total} lines · ${s.chars} characters spent on takes${s.flaggedLines ? ` · ${s.flaggedLines} lines with a flagged take (read-back or long pause: point the owner at them)` : ''}`);
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
      out(contextOf(d.line));
      for (const t of d.takes) {
        out(`  take ${t.id.slice(0, 8)} ${pad(t.verdict, 10)}${t.stale ? ` (not current: ${t.reason ?? 'stale'})` : ''} dir="${t.direction}" ${t.settings.model} ${t.durationMs ?? '?'}ms ${t.chars}ch ${t.readbackWer === null ? 'read-back pending' : `heard ${Math.round(t.readbackWer * 100)}% wrong`}${t.verdictNote ? ` · note: ${t.verdictNote}` : ''}`);
      }
      return;
    }
    case 'verdicts': {
      // The owner's feedback stream: every verdict + note since --since, so the next round reads one list.
      const since = sinceMs(opt('since'));
      const quest = opt('quest');
      const { verdicts } = await call(`?view=verdicts&since=${since}`);
      const rows = verdicts.filter((v) => !quest || v.questId === quest);
      let line = '';
      for (const v of rows) {
        const key = `${v.questId}/${v.lineId}`;
        if (key !== line) { out(key); line = key; }
        out(`  ${new Date(v.at).toISOString().slice(0, 16)} ${pad(v.verdict, 10)} take ${v.takeId.slice(0, 8)} dir="${v.direction}" ${v.model}${v.note ? ` · note: ${v.note}` : ''}`);
      }
      const count = (k) => rows.filter((v) => v.verdict === k).length;
      out(`${rows.length} verdicts since ${since ? new Date(since).toISOString() : 'the start'}: ${count('approved')} approved, ${count('rejected')} rejected`);
      return;
    }
    case 'readback': {
      // Words-only ear proxy (local Whisper, offline, free): a backfill / retry; new takes are read back on their own.
      const l = opt('line');
      const e = l ? await findLine(l, opt('quest')) : null;
      const r = await call('/readback', e ? { questId: e.questId, lineId: e.lineId } : { questId: opt('quest') });
      out(`read back ${r.measured} of ${r.requested} takes (${r.rescored} stored scores re-derived)${r.failed.length ? ` · unmeasured: ${r.failed.join('; ')}` : ''}`);
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
      const casting = opt('casting');
      if (casting) {
        // The audio lane's casting.json: { cast: { <character>: { voice_id, voice, note } } } -> one candidate each.
        const { readFileSync } = await import('node:fs');
        const cast = JSON.parse(readFileSync(casting, 'utf8')).cast ?? {};
        for (const [characterId, c] of Object.entries(cast)) {
          const r = await call('/voices', { action: 'stock', characterId, providerVoiceId: c.voice_id, name: `${c.voice} (stock)`, note: c.note ?? null });
          out(`  candidate ${r.voices[0].id} ${characterId} = ${c.voice} (stock)`);
        }
        return;
      }
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
      if (r.written.length && r.mastering) out(`mastered to ${r.mastering.lufs} LUFS / ${r.mastering.truePeakDb} dBTP, mono (${r.mastering.source})`);
      for (const x of r.mastering?.refused ?? []) out(`  TREATMENT REFUSED ${x} (that voice exported untreated)`);
      for (const w of r.written) out(`  wrote ${w.lineId} -> ${w.path}${w.lufs == null ? ' (level unmeasured)' : ` at ${w.lufs} LUFS${w.onLevel === false ? ' OFF LEVEL: listen' : ''}`}${w.treatment ? ` through ${w.treatment}` : ''}`);
      for (const s of r.skipped) out(`  skipped ${s.lineId}: ${s.reason}`);
      for (const s of r.stale ?? []) out(`  STALE IN GAME ${s.lineId}: ${s.reason} (left as is; the owner decides)`);
      out(`${r.written.length} written, ${r.skipped.length} skipped (unproven lines are never exported)`);
      return;
    }
    case 'casting': {
      const who = opt('character');
      if (!who) {
        const r = await call('/casting');
        for (const c of r.characters) out(`  ${pad(c.id, 20)} ${pad(c.title, 34)} ${c.cast ? 'cast' : 'not cast'}${c.hasArt ? '' : ' (no art)'}`);
        return;
      }
      const v = await call(`/casting?character=${encodeURIComponent(who)}`);
      out(`${v.title}: ${v.cast ? `CAST ${v.cast.name} (${v.cast.id})` : 'not cast'} · ${v.rounds.length} rounds`);
      for (const { round, candidates } of v.rounds) {
        out(`\nround ${round.roundNo} [${round.status}] ${round.model} · ${round.id}\n  brief: ${round.brief}`);
        candidates.forEach((c, i) => {
          out(`  #${i + 1} ${pad(c.candidate.verdict, 8)} ${c.candidate.label} · seed ${c.candidate.seed} · voice ${c.voice.id}${c.candidate.parentVoiceId ? ` · iterates ${c.candidate.parentVoiceId}` : ''}`);
          out(`       desc: ${c.voice.designPrompt}`);
          if (c.candidate.note) out(`       NOTE: ${c.candidate.note}`);
        });
        if (round.ownerNote) out(`  ROUND COMMENT: ${round.ownerNote}`);
      }
      return;
    }
    case 'round': {
      // A round file: { "brief": "...", "candidates": [{ "label", "description", "seed"?, "parentVoiceId"? }], "sampleText"?, "model"? }
      const who = opt('character');
      const file = opt('file');
      if (!who || !file) throw new Error('round needs --character <id> --file <round.json>');
      const { readFileSync } = await import('node:fs');
      const spec = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
      const r = await call('/casting', { characterId: who, ...spec });
      out(`round ${r.round.roundNo} for ${who}: ${r.voices.length} voices designed · ${r.chars} chars${r.log ? ` · log ${r.log}` : ''}`);
      for (const f of r.failed) out(`  FAILED ${f.label}: ${f.error}`);
      return;
    }
    default:
      out('usage: voice.mjs status | next | line | verdicts | readback | takes | design | stock | voices | casting | round | export (see the header). '
        + 'There is no approve/reject/cast: the owner does that in the PoF Voice room.');
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(`voice.mjs: ${e.message}`);
  process.exitCode = 1;
});
