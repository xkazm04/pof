/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Write asset-needs/<project>.json (`asset-needs/1`, src/lib/asset-needs/schema.ts) from the game project's own files.
 *   npx tsx scripts/asset-needs.ts bp
 * Only bp is onboarded. Its root is BP_ROOT, else the sibling ../bp; bp is only read. No POF server, no DB.
 * Exit 0 written, 1 refused (unreadable source, a file the contract refuses), 2 unknown project. Docs: docs/asset-needs.md.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BP_PATHS, buildBpAssetNeeds } from '../src/lib/asset-needs/bp';
import { newestScorecard } from '../src/lib/asset-needs/score';
import { serializeAssetNeeds } from '../src/lib/asset-needs/schema';

const POF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = process.argv[2];

if (project === 'pof') {
  console.error('pof has no game content to measure - its UE project is gone (fleet-memory line 222)');
  process.exit(2);
}
if (project !== 'bp') {
  console.error(`asset-needs: no adapter for "${project ?? ''}" - only bp is onboarded (usage: npx tsx scripts/asset-needs.ts bp)`);
  process.exit(2);
}

function refuse(why: string): never {
  console.error(`asset-needs: REFUSED - ${why}; asset-needs/bp.json is left unchanged`);
  process.exit(1);
}
const head = (cwd: string): string => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(); } catch { return refuse(`no git HEAD at ${cwd}`); }
};

const bpRoot = resolve(process.env.BP_ROOT || join(POF_ROOT, '..', 'bp'));
const read = (rel: string): string => {
  const p = join(bpRoot, rel);
  if (!existsSync(p)) refuse(`bp has no ${rel} (bp root ${bpRoot}; set BP_ROOT)`);
  return readFileSync(p, 'utf8');
};

const artDir = join(bpRoot, BP_PATHS.artSource);
if (!existsSync(artDir)) refuse(`bp has no ${BP_PATHS.artSource} (bp root ${bpRoot}; set BP_ROOT)`);
const manifests = readdirSync(artDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(artDir, d.name, 'manifest.json')))
  .map((d) => ({ folder: d.name, text: read(`${BP_PATHS.artSource}/${d.name}/manifest.json`) }));
const runsDir = join(bpRoot, BP_PATHS.runs);
const newest = existsSync(runsDir) ? newestScorecard(readdirSync(runsDir)) : undefined;
if (!newest) refuse(`no dated run note under ${BP_PATHS.runs}`);
const scorecardPath = `${BP_PATHS.runs}/${newest}`;

const built = buildBpAssetNeeds(
  { manifests, scorecard: { path: scorecardPath, text: read(scorecardPath) }, breakdown: read(BP_PATHS.breakdown), plan: read(BP_PATHS.plan) },
  { generatedAt: new Date().toISOString(), commit: head(bpRoot), pofCommit: head(POF_ROOT) },
);
if (!built.ok) refuse(built.error.join('; '));
const doc = built.data;

const out = join(POF_ROOT, 'asset-needs', 'bp.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, serializeAssetNeeds(doc));
const by = (k: string) => doc.needs.filter((n) => n.kind === k).length;
console.log(`asset-needs: bp @ ${doc.source.commit.slice(0, 7)} - inventory ${doc.inventory.length}, needs ${doc.needs.length} (scored-low ${by('scored-low')}, missing ${by('missing')}), scorecard ${newest} -> asset-needs/bp.json`);
