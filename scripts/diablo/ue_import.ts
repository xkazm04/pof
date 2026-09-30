/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Import an ingested entity into UE from its OWN pipeline artifacts (/diablo W06).
 *
 *   npx tsx scripts/diablo/ue_import.ts --catalog bestiary --id d1-MT_NZOMBIE --fbx generated/tripo3d/x.fbx \
 *     [--height-cm 180] [--tint "0.55,0.62,0.45"] [--share-mesh /Game/Diablo/Bestiary/Zombie/SK_Zombie]
 *
 * Builds the POF_DIABLO_MONSTER spec for scripts/diablo/ue_import_monster.py from the entity's artifacts
 * — name and accepted Concept 2D Art (the icon file) — and runs the UE commandlet.
 * Values travel on the command line / environment only and land in the gitignored /Game/Diablo content;
 * none enters a repo. The monster's numbers (HP, damage, speed, cadence) are NOT set here — its converted
 * stat row owns them (scripts/diablo/stats.ts --apply, D23/W08).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { seededEntities } from '../../src/lib/catalog/seed';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs helper shared with the gap-loop scripts (the one naming rule).
import { iconFileName } from '../gap-loop/power-icon-payload.mjs';
import { diabloUeRoot } from './ueRoot';
import { attackKindOf } from '../../src/lib/catalog/reference/behaviourScale';

const UE_CMD = process.env.POF_UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const UPROJECT = process.env.POF_UPROJECT ?? 'C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject';
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
const fbx = opt('fbx');
if (!entityId) { console.error('usage: ue_import.ts --catalog <id> --id <entityId> [--fbx <file>] [--height-cm N] [--tint r,g,b] [--share-mesh /Game/...]'); process.exit(2); }
const entity = seededEntities(catalogId).find((e) => e.id === entityId);
if (!entity) { console.error(`REFUSED: ${catalogId}/${entityId} is not a seeded/promoted entity`); process.exit(1); }


// Damage is NOT set here: this import used to write the Stat Block's REFERENCE-scale damage onto the ability (and
// guessed the Stat Block's shape to find it). Since D23 the monster's converted stat row owns it — run
// scripts/diablo/stats.ts --apply after an import (W08).
console.log('melee damage: owned by the stat row (scripts/diablo/stats.ts --apply) — not set by the import');

const concept = resolve('generated', 'icons', iconFileName(catalogId, 'Concept 2D Art', 'jpg', entityId));
const spec = {
  name: diabloUeRoot(entity).slug,
  // Melee or ranged, from the monster's AI routine (W09) — an unmodelled routine refuses here, before UE runs.
  attack: attackKindOf(entity.tags?.[0] ?? ''),
  ...(fbx ? { fbx: resolve(fbx) } : {}),
  ...(existsSync(concept) ? { concept } : {}),
  heightCm: Number(opt('height-cm') ?? 180),
  ...(opt('tint') ? { tint: opt('tint')!.split(',').map(Number) } : {}),
  ...(opt('share-mesh') ? { shareMesh: opt('share-mesh') } : {}),
};
console.log(`spec: ${JSON.stringify(spec)}`);
const log = resolve(process.env.TEMP ?? '.', `ue-import-${entityId}.log`);
try {
  execFileSync(UE_CMD, [UPROJECT, '-run=pythonscript', `-script=${resolve('scripts/diablo/ue_import_monster.py')}`,
    '-unattended', '-nopause', '-nullrhi', `-abslog=${log}`],
  { env: { ...process.env, POF_DIABLO_MONSTER: JSON.stringify(spec) }, stdio: 'ignore', timeout: 1_200_000 });
} catch { /* UE's headless shutdown can exit non-zero; the log is the verdict */ }
const out = existsSync(log) ? readFileSync(log, 'utf8') : '';
if (!out) console.log(`no UE log at ${log} — the commandlet did not run`);
// UE writes CRLF: split on it, or `.*$` cannot pass the trailing \r and NO marker is echoed (W07).
for (const line of out.split(/\r?\n/)) {
  const m = /(POF_DIABLO_UE_\w+=.*)$/.exec(line);
  if (m) console.log(m[1].slice(0, 600));
  if (/LogPython: Error/.test(line)) console.log(line.slice(0, 300));
}
