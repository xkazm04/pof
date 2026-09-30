/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Diablo spells → UE abilities (/diablo W13, D33 + D4) — the spell counterpart of stats.ts.
 *
 *   npx tsx scripts/diablo/spells.ts --root <txtdata> [--caster sorcerer] [--apply]
 *
 * A spell's numbers come from its engine-derived LAW (reference/spellLaw.ts) evaluated for a named reference caster
 * (class tables under --root). They are converted to PoF with the D23 anchors so the casts-to-kill against a converted
 * monster are preserved: damage × (PoF hit / reference hit); mana × (PoF pool / caster pool), which keeps casts per pool;
 * seconds stay seconds. --apply writes a Blueprint subclass of UGA_TimedProjectileSpell per spell (no cooldown — the
 * cast limits the rate) under /Game/Diablo/Spells (gitignored in UE: reference values stay local) and reads it back.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classNameOf, kv, loadHitAnchors, tsvRows, UE_SRC, UPROJECT } from './anchors';
import { fireboltAt, referenceCaster, SPELL_LAW_IDS, CAST_LAW_ID } from '../../src/lib/catalog/reference/spellLaw';
import type { ConversionLoss } from '../../src/lib/catalog/reference/playerScale';

const UE_CMD = process.env.POF_UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const OUT = resolve('generated', 'diablo', 'spells.json');
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const root = opt('root');
if (!root) { console.error('usage: spells.ts --root <txtdata> [--caster sorcerer] [--apply]'); process.exit(2); }
const casterClass = opt('caster') ?? 'sorcerer';

const { from, to } = loadHitAnchors(root);
const caster = referenceCaster({
  className: classNameOf(root, casterClass),
  attributes: kv(tsvRows(root, `classes/${casterClass}/attributes.tsv`), 'Attribute', 'Value'),
  animations: kv(tsvRows(root, `classes/${casterClass}/animations.tsv`), 'Variable', 'Value'),
});
const manaM = /InitMaxMana\(\s*([\d.]+)f?\s*\)/.exec(readFileSync(join(UE_SRC, 'ARPGAttributeSet.cpp'), 'utf8'));
if (!manaM) { console.error('REFUSED: UARPGAttributeSet has no InitMaxMana(...) default — no mana anchor'); process.exit(1); }
const pofPool = Number(manaM[1]);
console.log(`hit anchors: ${from.basis} ${from.hit} → ${to.basis} ${to.hit}`);
console.log(`caster:      ${caster.basis} — Magic ${caster.magic}, cast ${caster.castingFrames}/${caster.castingActionFrame} frames, mana ${caster.maxMana} → PoF pool ${pofPool}`);

const rows = tsvRows(root, 'spells/spelldat.tsv');
const spells = Object.keys(SPELL_LAW_IDS).map((id) => {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`REFUSED: ${id} is not in spelldat`);
  const n = fireboltAt(caster, 1, Number(row.manaCost));
  const baseDamage = Number((n.damage.mean * (to.hit / from.hit)).toFixed(2));
  const manaCost = Number((n.manaCost * (pofPool / caster.maxMana)).toFixed(2));
  const ledger: ConversionLoss[] = [
    { field: 'damage', grade: 'approximate', reason: `the reference rolls ${n.damage.minimum}-${n.damage.maximum}; one value, the mean, scaled by the D23 hit ratio to keep casts-to-kill` },
    { field: 'toHit', grade: 'dropped', reason: `the reference rolls to hit per target (${Math.round(n.toHit(1, 0) * 100)}% against a level-1 monster beside the caster); PoF projectiles always hit what they touch` },
    { field: 'mana', grade: 'approximate', reason: `cost × (PoF pool ${pofPool} / reference pool ${caster.maxMana}) keeps ${n.castsPerPool} casts per pool — but PoF regenerates mana and Diablo I does not` },
    { field: 'castTime', grade: 'full', reason: 'seconds are seconds (d1-timing-law: 20 ticks/s)' },
    { field: 'projectileSpeed', grade: 'dropped', reason: 'the missile speed is not converted — PoF\'s projectile default flies' },
  ];
  return {
    entityId: `d1-${id}`, asset: `/Game/Diablo/Spells/GA_D1_${id}`, laws: [SPELL_LAW_IDS[id], CAST_LAW_ID, 'd1-timing-law'],
    reference: { damage: n.damage, manaCost: n.manaCost, castTime: n.castTime, releaseTime: n.releaseTime, castsPerPool: n.castsPerPool },
    baseDamage, manaCost, castTime: n.castTime, releaseTime: n.releaseTime, damageTag: 'Damage.Fire', ledger,
  };
});
for (const s of spells) {
  console.log(`${s.entityId.padEnd(14)} damage ${s.baseDamage} · mana ${s.manaCost} · release ${s.releaseTime.toFixed(2)} s · cast ${s.castTime.toFixed(2)} s · no cooldown`);
  for (const l of s.ledger) console.log(`    ${l.grade.padEnd(11)} ${l.field}: ${l.reason}`);
}
mkdirSync(resolve('generated', 'diablo'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ anchors: { from, to, caster, pofPool }, spells }, null, 2));
console.log(`→ ${OUT}`);

if (process.argv.includes('--apply')) {
  const log = resolve(process.env.TEMP ?? '.', 'ue-spells.log');
  try {
    execFileSync(UE_CMD, [UPROJECT, '-run=pythonscript', `-script=${resolve('scripts/diablo/ue_spells.py')}`, '-unattended', '-nopause', '-nullrhi', `-abslog=${log}`],
      { env: { ...process.env, POF_DIABLO_SPELLS: OUT }, stdio: 'ignore', timeout: 1_200_000 });
  } catch { /* UE's headless shutdown can exit non-zero; the log is the verdict */ }
  const out = existsSync(log) ? readFileSync(log, 'utf8') : '';
  if (!out) console.log(`no UE log at ${log} — the commandlet did not run`);
  for (const line of out.split(/\r?\n/)) {
    const m = /(POF_DIABLO_SPELLS_\w+=.*)$/.exec(line);
    if (m) console.log(m[1].slice(0, 900));
    if (/LogPython: Error/.test(line)) console.log(line.slice(0, 300));
  }
}
