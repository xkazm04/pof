/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Build a FAMILY MEMBER's UE variant from its OWN pipeline artifacts (/diablo W07).
 *
 *   npx tsx scripts/diablo/ue_variant.ts --catalog bestiary --id d1-MT_TSKELAX [--height-cm 180]
 *
 * W06 ran scripts/diablo/ue_family_variant.py by hand with a typed env JSON (name, head, tint, melee
 * damage). Everything it needs is already recorded: the head and the tint ride on the member's `3D & Rig`
 * candidate (`sharedWith`, `tint` — written by family.ts), the concept is its accepted Concept 2D Art, and
 * the UE folders come from `diabloUeRoot`. Damage is NOT set here: the member's stat row owns it
 * (scripts/diablo/stats.ts --apply, D23). Values travel in the environment only and land in the gitignored
 * /Game/Diablo content.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { listArtifacts } from '../../src/lib/pipeline-artifacts-db';
import { seededEntities } from '../../src/lib/catalog/seed';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs helper shared with the gap-loop scripts (the one naming rule).
import { iconFileName } from '../gap-loop/power-icon-payload.mjs';
import { diabloUeRoot } from './ueRoot';

const UE_CMD = process.env.POF_UE_CMD ?? 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const UPROJECT = process.env.POF_UPROJECT ?? 'C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject';
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog') ?? 'bestiary';
const entityId = opt('id');
if (!entityId) { console.error('usage: ue_variant.ts --catalog <id> --id <member> [--height-cm N]'); process.exit(2); }
const all = seededEntities(catalogId);
const member = all.find((e) => e.id === entityId);
if (!member) { console.error(`REFUSED: ${entityId} is not seeded/promoted`); process.exit(1); }

const hist = listArtifacts(catalogId, entityId).find((a) => a.step === '3D & Rig')?.data.genHistory as
  { selectedId?: string; batches?: { candidates?: { id: string; payload?: Record<string, unknown> }[] }[] } | undefined;
const cand = hist?.batches?.flatMap((b) => b.candidates ?? []).find((c) => c.id === hist.selectedId);
const headId = typeof cand?.payload?.sharedWith === 'string' ? cand.payload.sharedWith : undefined;
const head = headId ? all.find((e) => e.id === headId) : undefined;
if (!head) { console.error(`REFUSED: ${entityId}'s 3D & Rig does not share a family head's mesh — run family.ts first`); process.exit(1); }
const tint = Array.isArray(cand?.payload?.tint) ? cand.payload.tint as number[] : undefined;
// D25 (W08): the value-preserving recolour wins over the legacy multiply tint when the member carries one.
const recolour = Array.isArray(cand?.payload?.recolour) ? cand.payload.recolour as number[] : undefined;

const concept = resolve('generated', 'icons', iconFileName(catalogId, 'Concept 2D Art', 'jpg', entityId));
const spec = {
  name: diabloUeRoot(member).slug,
  sourceName: diabloUeRoot(head).slug,
  ...(recolour ? { recolour } : tint ? { tint } : {}),
  heightCm: Number(opt('height-cm') ?? 180),
  ...(existsSync(concept) ? { concept } : {}),
};
console.log(`spec: ${JSON.stringify(spec)}`);
const log = resolve(process.env.TEMP ?? '.', `ue-variant-${entityId}.log`);
try {
  execFileSync(UE_CMD, [UPROJECT, '-run=pythonscript', `-script=${resolve('scripts/diablo/ue_family_variant.py')}`,
    '-unattended', '-nopause', '-nullrhi', `-abslog=${log}`],
  { env: { ...process.env, POF_DIABLO_VARIANT: JSON.stringify(spec) }, stdio: 'ignore', timeout: 1_200_000 });
} catch { /* UE's headless shutdown can exit non-zero; the log is the verdict */ }
const out = existsSync(log) ? readFileSync(log, 'utf8') : '';
if (!out) console.log(`no UE log at ${log} — the commandlet did not run`);
for (const line of out.split(/\r?\n/)) {
  const m = /(POF_DIABLO_VARIANT_\w+=.*)$/.exec(line);
  if (m) console.log(m[1].slice(0, 600));
  if (/LogPython: Error/.test(line)) console.log(line.slice(0, 300));
}
