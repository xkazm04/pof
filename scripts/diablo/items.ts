/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Base items → UE data assets (/diablo W10, D2): one UARPGItemDefinition per promoted diablo1 base item, built from its OWN
 * step artifacts (the SOURCED `Base Type & Rarity` and `Damage / Implicit` seeds) — the fields UE gained in W10 (damage /
 * armour range, durability, attribute requirements) plus slot and value. Writes generated/diablo/items.json (gitignored:
 * reference values stay out of the repo) and runs scripts/diablo/ue_items.py headless, which verifies by reading back.
 *
 *   npx tsx scripts/diablo/items.ts [--ids d1-row119,…]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { seededEntities } from '../../src/lib/catalog/seed';
import { statNumber } from '../../src/lib/catalog/acceptance/dataCheckers';
import { diabloUeRoot } from './ueRoot';

const UE_CMD = process.env.POF_UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const UPROJECT = process.env.POF_UPROJECT ?? 'C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject';
const OUT = resolve('generated', 'diablo', 'items.json');
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const want = opt('ids')?.split(',').map((s) => s.trim());

const items = seededEntities('items').filter((e) => e.id.startsWith('d1-') && (!want || want.includes(e.id))).flatMap((e) => {
  const arts = listArtifacts('items', e.id);
  const base = arts.find((a) => a.step === 'Base Type & Rarity')?.data.baseType as Record<string, unknown> | undefined;
  if (!base) { console.log(`skip ${e.id}: no Base Type & Rarity artifact (seed it first)`); return []; }
  const dmg = arts.find((a) => a.step === 'Damage / Implicit')?.data.damage as Record<string, unknown> | undefined;
  const req = (base.requirements ?? {}) as Record<string, unknown>;
  const armor = (base.armor ?? {}) as Record<string, unknown>;
  const value = ((e.data as { stats?: { label: string; value: string }[] })?.stats ?? []).find((s) => s.label === 'Value')?.value;
  const { root, slug } = diabloUeRoot(e, 'items');
  return [{
    entityId: e.id,
    asset: `${root}/DA_${slug}`,
    displayName: e.name,
    slot: base.slot,
    twoHanded: base.twoHanded === true,
    minDamage: statNumber(dmg?.damageMin) ?? 0,
    maxDamage: statNumber(dmg?.damageMax) ?? 0,
    minArmor: statNumber(armor.minimum) ?? 0,
    maxArmor: statNumber(armor.maximum) ?? 0,
    maxDurability: statNumber(base.durability) ?? 0,
    requiredStrength: statNumber(req.strength) ?? 0,
    requiredDexterity: statNumber(req.dexterity) ?? 0,
    requiredIntelligence: statNumber(req.intelligence) ?? 0,
    baseValue: Number(value ?? 0) || 0,
  }];
});
mkdirSync(resolve('generated', 'diablo'), { recursive: true });
writeFileSync(OUT, JSON.stringify({ items }, null, 2));
console.log(`${items.length} item(s) → ${OUT}`);

const log = resolve(process.env.TEMP ?? '.', 'ue-items.log');
try {
  execFileSync(UE_CMD, [UPROJECT, '-run=pythonscript', `-script=${resolve('scripts/diablo/ue_items.py')}`, '-unattended', '-nopause', '-nullrhi', `-abslog=${log}`],
    { env: { ...process.env, POF_DIABLO_ITEMS: OUT }, stdio: 'ignore', timeout: 1_200_000 });
} catch { /* UE's headless shutdown can exit non-zero; the log is the verdict */ }
const out = existsSync(log) ? readFileSync(log, 'utf8') : '';
if (!out) console.log(`no UE log at ${log} — the commandlet did not run`);
for (const line of out.split(/\r?\n/)) {
  const m = /(POF_DIABLO_ITEMS_\w+=.*)$/.exec(line);
  if (m) console.log(m[1].slice(0, 900));
  if (/LogPython: Error/.test(line)) console.log(line.slice(0, 300));
}
