/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Diablo affix tiers → UE `FAffixTableRow`s (/diablo W14, operator decision D32: reuse the D23 anchors for magnitudes).
 *
 *   npx tsx scripts/diablo/affixes.ts --root <txtdata> [--apply]
 *
 * One UE row per Diablo TIER (the roller's unit), grouped by family (AffixGroup = the promoted family id, so one per
 * family per item). Magnitudes: resistances %→fraction; LIFE × (PoF life / reference life); MANA × (PoF pool / reference
 * caster pool, W13); flat damage × the hit ratio; attributes raw (approximate); a curse is negative. The tier already
 * encodes the item level, so rows set bScaleWithItemLevel = false. A tier whose power has no flat PoF attribute + effect is
 * EXCLUDED with its reason — never forced. Legality is Diablo's `itemTypes`, so there is ONE POOL PER ITEM CLASS (W15):
 * Weapon, Armor (body + helm), Shield, Misc (rings, amulets). --apply writes Config/Tags/DiabloAffixes.ini (one
 * Affix.D1.<side>.<power> tag per family — names, not values), then DT_D1Affixes_<Class> under /Game/Diablo/Items
 * (gitignored: reference values stay local), sets each Diablo item's AffixPool to its class's table, rolls every pool
 * through the real UARPGAffixRoller and reports what the rolls obey.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classNameOf, kv, loadHitAnchors, tsvRows, UE_SRC, UPROJECT } from './anchors';
import { referenceCaster } from '../../src/lib/catalog/reference/spellLaw';
import { affixFamilies } from '../../src/lib/catalog/reference/affixFamilies';
import { listWrappers } from '../../src/lib/catalog/reference/wrappers-db';
import { getDb } from '../../src/lib/db';

const UE_CMD = process.env.POF_UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const OUT = resolve('generated', 'diablo', 'affixes.json');
const ITEMS = resolve('generated', 'diablo', 'items.json');
/** A Diablo item's slot (UE vocabulary, W10 slotOf) → the affix class whose tiers may roll on it. */
const CLASS_OF_SLOT: Record<string, string> = { Weapon: 'Weapon', Chest: 'Armor', Helm: 'Armor', OffHand: 'Shield', Ring: 'Misc', Amulet: 'Misc' };
const TAGS_INI = join(UPROJECT, '..', 'Config', 'Tags', 'DiabloAffixes.ini');
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const root = opt('root');
if (!root) { console.error('usage: affixes.ts --root <txtdata> [--apply]'); process.exit(2); }

const { from, to } = loadHitAnchors(root);
const caster = referenceCaster({
  className: classNameOf(root, 'sorcerer'),
  attributes: kv(tsvRows(root, 'classes/sorcerer/attributes.tsv'), 'Attribute', 'Value'),
  animations: kv(tsvRows(root, 'classes/sorcerer/animations.tsv'), 'Variable', 'Value'),
});
const manaM = /InitMaxMana\(\s*([\d.]+)f?\s*\)/.exec(readFileSync(join(UE_SRC, 'ARPGAttributeSet.cpp'), 'utf8'));
if (!manaM) { console.error('REFUSED: UARPGAttributeSet has no InitMaxMana(...) default — no mana anchor'); process.exit(1); }
const pofPool = Number(manaM[1]);

/** Power → the UE effect that applies it and the D32 scale; a power absent here is excluded (with the reason below). */
const E = (cls: string) => `/Script/PoF.${cls}`;
const CONVERT: Record<string, { effect: string; scale: number; basis: string; grade: 'full' | 'approximate' }> = {
  STR: { effect: E('GE_Affix_Strength'), scale: 1, basis: 'raw points', grade: 'approximate' },
  DEX: { effect: E('GE_Affix_Dexterity'), scale: 1, basis: 'raw points', grade: 'approximate' },
  MAG: { effect: E('GE_Affix_Intelligence'), scale: 1, basis: 'raw points (Magic read as Intelligence)', grade: 'approximate' },
  ATTRIBS: { effect: E('GE_Affix_AllAttributes'), scale: 1, basis: 'raw points, three of four attributes', grade: 'approximate' },
  LIFE: { effect: E('GE_Affix_MaxHealth'), scale: to.life / from.life, basis: `× PoF life ${to.life} / reference life ${from.life}`, grade: 'full' },
  MANA: { effect: E('GE_Affix_MaxMana'), scale: pofPool / caster.maxMana, basis: `× PoF pool ${pofPool} / reference caster pool ${caster.maxMana}`, grade: 'full' },
  FIRERES: { effect: E('GE_Affix_FireResistance'), scale: 0.01, basis: '% → fraction', grade: 'full' },
  LIGHTRES: { effect: E('GE_Affix_LightningResistance'), scale: 0.01, basis: '% → fraction', grade: 'full' },
  MAGICRES: { effect: E('GE_Affix_MagicResistance'), scale: 0.01, basis: '% → fraction', grade: 'full' },
  ALLRES: { effect: E('GE_Affix_AllResistances'), scale: 0.01, basis: '% → fraction', grade: 'full' },
  DAMMOD: { effect: E('GE_Affix_AttackPower'), scale: to.hit / from.hit, basis: `× hit ratio ${to.hit} / ${from.hit}`, grade: 'full' },
};
const PERCENT = new Set(['ACP', 'DAMP', 'TOHIT_DAMP']);
const ITEM_PROPERTY = new Set(['DUR', 'INDESTRUCTIBLE']);

interface Tier { name: string; valueMin: number; valueMax: number; minItemLevel: number; weight: number; itemTypes: string[] }
const families = affixFamilies(listWrappers(getDb(), { sourceId: 'diablo1', catalogId: 'affixes' }));
const rows: Record<string, unknown>[] = [];
const excluded: Record<string, number> = {};
const round = (x: number) => Number(x.toFixed(4));
for (const f of families) {
  const d = f.entity.data as { power: string; side: string; derived: { sign?: number; reason?: string }; tiers: Tier[] };
  const base = d.power.replace(/_CURSE$/, '');
  const c = CONVERT[base];
  if (!c) {
    const why = PERCENT.has(base) ? 'percent of the ITEM (model gap)' : ITEM_PROPERTY.has(base) ? 'an item property (no effect)' : `no PoF home — ${d.derived.reason ?? ''}`;
    excluded[why] = (excluded[why] ?? 0) + d.tiers.length;
    continue;
  }
  const sign = d.derived.sign === -1 ? -1 : 1;
  d.tiers.forEach((t, i) => {
    const lo = Number(t.valueMin) * c.scale * sign;
    const hi = Number(t.valueMax) * c.scale * sign;
    rows.push({
      Name: `${f.entity.id}-t${i + 1}`, family: f.entity.id, AffixTag: `Affix.D1.${d.side}.${d.power}`, power: d.power, itemTypes: t.itemTypes,
      DisplayName: t.name, bIsPrefix: d.side === 'prefix', MinValue: round(Math.min(lo, hi)), MaxValue: round(Math.max(lo, hi)),
      Weight: Number(t.weight) || 1, MinRarity: 'Uncommon', AffixGroup: f.entity.id, MinItemLevel: Number(t.minItemLevel) || 0,
      Effect: c.effect, bScaleWithItemLevel: false, reference: { min: Number(t.valueMin), max: Number(t.valueMax) }, basis: c.basis, grade: c.grade,
    });
  });
}
const items = existsSync(ITEMS) ? (JSON.parse(readFileSync(ITEMS, 'utf8')).items as { asset: string; slot: string }[]) : [];
const pools = [...new Set(Object.values(CLASS_OF_SLOT))].map((cls) => {
  const legal = rows.filter((r) => (r.itemTypes as string[]).includes(cls));
  const assets = items.filter((i) => CLASS_OF_SLOT[i.slot] === cls).map((i) => i.asset);
  return { cls, table: `/Game/Diablo/Items/DT_D1Affixes_${cls}`, rows: legal, assets };
}).filter((p) => p.assets.length > 0);
console.log(`anchors: life ${from.life}→${to.life}, hit ${from.hit}→${to.hit}, mana pool ${caster.maxMana}→${pofPool}`);
console.log(`${rows.length} convertible tiers in ${new Set(rows.map((r) => r.family)).size} families`);
for (const [why, n] of Object.entries(excluded)) console.log(`  excluded ${String(n).padStart(3)} tiers: ${why.slice(0, 110)}`);
for (const p of pools) console.log(`  pool ${p.cls.padEnd(7)} ${p.rows.length} tiers / ${new Set(p.rows.map((r) => r.family)).size} families → ${p.assets.length} item(s)`);
const unpooled = items.filter((i) => !CLASS_OF_SLOT[i.slot]);
if (unpooled.length) console.log(`  items with no affix class: ${unpooled.map((i) => i.asset).join(', ')}`);

mkdirSync(resolve('generated', 'diablo'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ pools, allConvertible: rows.length, excluded }, null, 2));
console.log(`→ ${OUT}`);

if (process.argv.includes('--apply')) {
  // Tags first: the editor reads Config/Tags/*.ini at startup, so they must exist before the commandlet launches.
  const tags = [...new Set(rows.map((r) => String(r.AffixTag)))].sort();
  mkdirSync(join(UPROJECT, '..', 'Config', 'Tags'), { recursive: true });
  writeFileSync(TAGS_INI, ['[/Script/GameplayTags.GameplayTagsList]',
    ...tags.map((t) => `GameplayTagList=(Tag="${t}",DevComment="Diablo I affix family (scripts/diablo/affixes.ts, /diablo W15)")`), ''].join('\r\n'));
  console.log(`${tags.length} tag(s) → ${TAGS_INI}`);
  const log = resolve(process.env.TEMP ?? '.', 'ue-affixes.log');
  try {
    execFileSync(UE_CMD, [UPROJECT, '-run=pythonscript', `-script=${resolve('scripts/diablo/ue_affixes.py')}`, '-unattended', '-nopause', '-nullrhi', `-abslog=${log}`],
      { env: { ...process.env, POF_DIABLO_AFFIXES: OUT }, stdio: 'ignore', timeout: 1_200_000 });
  } catch { /* UE's headless shutdown can exit non-zero; the log is the verdict */ }
  const out = existsSync(log) ? readFileSync(log, 'utf8') : '';
  if (!out) console.log(`no UE log at ${log} — the commandlet did not run`);
  for (const line of out.split(/\r?\n/)) {
    const m = /(POF_DIABLO_AFFIXES_\w+=.*)$/.exec(line);
    if (m) console.log(m[1].slice(0, 900));
    if (/LogPython: Error|LogDataTable: (Error|Warning)/.test(line)) console.log(line.slice(0, 300));
  }
}
