/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * STAT ROWS for ingested monsters (/diablo W07, operator decision D23) — convert, then (optionally) apply in UE.
 *
 *   npx tsx scripts/diablo/stats.ts --root <txtdata> [--ids a,b] [--class warrior] [--apply]
 *
 * Each promoted diablo1 bestiary entity gets its OWN `FARPGAttributeInitRow` in a Diablo-scoped DataTable
 * (/Game/Diablo/DT_D1MonsterStats — PoF itself has none: DT_AttributeDefaults was never created, W07), through
 * the DECLARED conversion in `@/lib/catalog/reference/playerScale`:
 *   reference anchor — the Diablo I hero (class table + starting weapon), read from the operator's data root;
 *   target anchor    — PoF's player, read from the UE source defaults;
 *   monster          — the WRAPPER's raw row (the reference itself). Not the produced Stat Block: its `damage`
 *                      came back in three shapes across five rows (W07), so a reader of it is guessing.
 * Rows, loss ledger and basis are written to generated/diablo/stat-rows.json (gitignored — values stay out of
 * the repo). --apply runs scripts/diablo/ue_stat_rows.py headless: it fills the table, points each monster's
 * Blueprint at its row and its melee ability at the converted damage, and verifies by reading back.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getDb } from '../../src/lib/db';
import { listWrappers } from '../../src/lib/catalog/reference/wrappers-db';
import { parseTsv } from '../../src/lib/catalog/ingest/tsv';
import { resistanceByElement } from '../../src/lib/catalog/reference/stepSeeds';
import { convertMonsterScale, diabloReferencePlayer, uePlayerAnchor } from '../../src/lib/catalog/reference/playerScale';
import { seededEntities } from '../../src/lib/catalog/seed';
import { diabloUeRoot } from './ueRoot';

const UE_CMD = process.env.POF_UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const UPROJECT = process.env.POF_UPROJECT ?? 'C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject';
const UE_SRC = resolve(UPROJECT, '..', 'Source', 'PoF', 'AbilitySystem');
const OUT = resolve('generated', 'diablo', 'stat-rows.json');
export const STAT_TABLE = '/Game/Diablo/DT_D1MonsterStats';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const root = opt('root');
if (!root) { console.error('usage: stats.ts --root <txtdata> [--ids a,b] [--class warrior] [--apply]'); process.exit(2); }
const cls = opt('class') ?? 'warrior';
const tsv = (rel: string) => {
  const t = parseTsv(readFileSync(join(root, rel), 'utf8'));
  if (t.refusal) throw new Error(`${rel}: ${t.refusal.message}`);
  return t.rows;
};

// Reference anchor: the class table is Attribute/Value rows; the starting weapon is loadout item0 in itemdat.
const kv = (rows: Record<string, string>[], k: string, v: string) => Object.fromEntries(rows.map((r) => [r[k], r[v]]));
const attributes = kv(tsv(`classes/${cls}/attributes.tsv`), 'Attribute', 'Value');
const item0 = kv(tsv(`classes/${cls}/starting_loadout.tsv`), 'Variable', 'Value').item0;
const weaponRow = tsv('items/itemdat.tsv').find((r) => r.id === item0);
if (!weaponRow) { console.error(`REFUSED: starting weapon ${item0} is not in itemdat`); process.exit(1); }
const className = kv(tsv('classes/classdat.tsv'), 'folderName', 'className')[cls] ?? cls;
const from = diabloReferencePlayer({
  className, attributes,
  weapon: { name: weaponRow.name, minDamage: Number(weaponRow.minDamage), maxDamage: Number(weaponRow.maxDamage) },
});
// Target anchor: PoF's player from the UE source defaults.
const to = uePlayerAnchor({
  attributeSetCpp: readFileSync(join(UE_SRC, 'ARPGAttributeSet.cpp'), 'utf8'),
  meleeHeader: readFileSync(join(UE_SRC, 'GA_MeleeAttack.h'), 'utf8'),
});
console.log(`reference: ${from.basis} — life ${from.life}, hit ${from.hit}`);
console.log(`target:    ${to.basis} — life ${to.life}, hit ${to.hit}, mitigation ${to.mitigation}`);

const promoted = new Set(seededEntities('bestiary').filter((e) => e.id.startsWith('d1-')).map((e) => e.id));
const want = opt('ids')?.split(',').map((s) => s.trim()) ?? [...promoted];
const wrappers = listWrappers(getDb(), { sourceId: 'diablo1', catalogId: 'bestiary' }).filter((w) => want.includes(w.entity.id));
const rows = wrappers.map((w) => {
  const r = w.raw;
  const res = resistanceByElement(r.resistance ?? '');
  const c = convertMonsterScale({
    hp: { min: Number(r.hitPointsMinimum), max: Number(r.hitPointsMaximum) },
    damage: { min: Number(r.minDamage), max: Number(r.maxDamage) },
    resist: { magic: res.MAGIC, fire: res.FIRE, lightning: res.LIGHTNING },
  }, from, to);
  const { root: ueRoot, slug } = diabloUeRoot(w.entity);
  return {
    entityId: w.entity.id,
    name: w.entity.name,
    blueprint: `${ueRoot}/BP_${slug}`,
    melee: `${ueRoot}/GA_${slug}_Melee`,
    baseDamage: c.row.baseDamage,
    // FARPGAttributeInitRow — property names exactly as the UE struct declares them.
    ueRow: {
      Health: c.row.maxHealth, MaxHealth: c.row.maxHealth,
      AttackPower: c.row.attackPower,
      // Reference monsters do not crit (Critical Strike is a Warrior CLASS flag) and their armour class is a
      // to-hit term, not a damage reduction — carrying either would break the hits-to-kill equivalence.
      CriticalChance: 0, Armor: 0,
      MagicResistance: c.row.resist.magic, FireResistance: c.row.resist.fire, LightningResistance: c.row.resist.lightning,
      CharacterLevel: Number(r.level),
    },
    ledger: [
      ...c.ledger,
      { field: 'criticalChance', grade: 'full', reason: 'zeroed: a reference monster never lands a critical hit (Critical Strike is a Warrior class flag)' },
      { field: 'armor', grade: 'dropped', reason: 'the reference armour class only lowers the PLAYER\'s chance to hit; PoF Armor reduces damage, which would break hits-to-kill' },
      { field: 'characterLevel', grade: 'data-only', reason: 'carried, but no level-scaling curve table is assigned, so it moves no number yet' },
    ],
    invariants: c.invariants,
    source: `${w.file} ${r._monster_id}`,
  };
});
const missing = want.filter((id) => !rows.some((r) => r.entityId === id));
if (missing.length) console.log(`no wrapper for: ${missing.join(', ')}`);
mkdirSync(resolve('generated', 'diablo'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ table: STAT_TABLE, basis: { from, to, skill: 'player skill unestimated on both sides' }, rows }, null, 2));
for (const r of rows) {
  const i = r.invariants;
  console.log(`${r.entityId.padEnd(15)} MaxHealth ${r.ueRow.MaxHealth.toFixed(2).padStart(7)} · BaseDamage ${r.baseDamage.toFixed(2).padStart(6)} · player hits-to-kill ${i.playerHitsToKill.reference.toFixed(2)}→${i.playerHitsToKill.converted.toFixed(2)} · monster hits-to-kill-player ${i.monsterHitsToKillPlayer.reference.toFixed(1)}→${i.monsterHitsToKillPlayer.converted.toFixed(1)}`);
}
console.log(`rows → ${OUT}`);

if (process.argv.includes('--apply')) {
  const log = resolve(process.env.TEMP ?? '.', 'ue-stat-rows.log');
  try {
    execFileSync(UE_CMD, [UPROJECT, '-run=pythonscript', `-script=${resolve('scripts/diablo/ue_stat_rows.py')}`,
      '-unattended', '-nopause', '-nullrhi', `-abslog=${log}`],
    { env: { ...process.env, POF_DIABLO_STATS: OUT }, stdio: 'ignore', timeout: 1_200_000 });
  } catch { /* UE's headless shutdown can exit non-zero; the log is the verdict */ }
  const out = existsSync(log) ? readFileSync(log, 'utf8') : '';
  if (!out) console.log(`no UE log at ${log} — the commandlet did not run`);
  for (const line of out.split(/\r?\n/)) {
    const m = /(POF_DIABLO_STATS_\w+=.*)$/.exec(line);
    if (m) console.log(m[1].slice(0, 700));
    if (/LogPython: Error/.test(line)) console.log(line.slice(0, 300));
  }
}
