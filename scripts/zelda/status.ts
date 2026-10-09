/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * The /zelda snapshot. Read-only: walks the pinned clone's `src/` tree and reports, per area,
 * how many files a spec reads (covered), how many are descoped with a reason, and how many are
 * still OPEN; the wrappers held per catalog; the trend across recorded rounds; and whether the
 * termination rule is met.
 *
 *   npx tsx scripts/zelda/status.ts --root <botw clone> [--depth 3] [--open N] [--files] [--vault <dir>] [--json]
 *
 * Coverage is derived from the tree at the pin every time — never read back from a stored number —
 * so a glob that stops matching or a descope that swallows too much moves a count visibly.
 */
import { getDb } from '@/lib/db';
import { BOTW_PIN } from '@/lib/catalog/ingest/botw';
import { terminationVerdict, type RoundSnapshot } from '@/lib/catalog/reference/pathCoverage';
import { BOTW } from '@/lib/catalog/reference/sources';
import { listRuns, summarizeWrappers } from '@/lib/catalog/reference/wrappers-db';
import type { StoreReport } from '@/lib/catalog/reference/wrappers-db';
import { arg, botwCoverage, countsOf, DEFAULT_VAULT, flag, requireClone, vaultCounts } from './shared';

const root = arg('root');
requireClone(root);
const depth = Number(arg('depth') ?? 3);
const openShown = Number(arg('open') ?? 0);
const vault = arg('vault') ?? DEFAULT_VAULT;

const coverage = botwCoverage(root as string, depth);
const { vaultFound, ...learning } = vaultCounts(vault);
const db = getDb();
const wrapped = summarizeWrappers(db, BOTW.id);

interface RecordedRound extends RoundSnapshot { run: number; at: string; pin?: string }
const rounds: RecordedRound[] = listRuns(db, BOTW.id, 20).flatMap((r) => {
  const s = r.summary as { store?: StoreReport; pathCoverage?: RoundSnapshot['coverage']; vault?: RoundSnapshot['vault']; pin?: string };
  // A run recorded without the loop's measurements (an older tool) cannot take part in the STOP rule.
  if (!s.store || !s.pathCoverage || !s.vault) return [];
  return [{ run: r.id, at: r.at, pin: s.pin, store: s.store, coverage: s.pathCoverage, vault: s.vault }];
});
const verdict = terminationVerdict(rounds);
const live = countsOf(coverage);
const last = rounds[0];
const unrecorded = last && (['covered', 'descoped', 'open'] as const).some((k) => last.coverage[k] !== live[k]);

if (flag('json')) {
  console.log(JSON.stringify({
    source: BOTW.id, pin: BOTW_PIN, coverage: { ...live, areas: coverage.areas, descopes: coverage.descopes, specs: coverage.specs },
    wrapped, vault: { ...learning, vaultFound }, trend: rounds, termination: verdict, unrecordedChanges: Boolean(unrecorded),
  }, null, 2));
  process.exit(0);
}

console.log(`\n=== ${BOTW.game} @ ${BOTW_PIN.slice(0, 7)} — /zelda status ===\n`);
console.log(`${'area'.padEnd(36)} ${'total'.padStart(6)} ${'covered'.padStart(8)} ${'descoped'.padStart(9)} ${'open'.padStart(6)}`);
for (const a of coverage.areas) {
  console.log(`${a.area.padEnd(36)} ${String(a.total).padStart(6)} ${String(a.covered).padStart(8)} ${String(a.descoped).padStart(9)} ${String(a.open).padStart(6)}`);
}
console.log(`${'TOTAL'.padEnd(36)} ${String(live.total).padStart(6)} ${String(live.covered).padStart(8)} ${String(live.descoped).padStart(9)} ${String(live.open).padStart(6)}`);

console.log('\nspecs (covered):');
for (const s of coverage.specs) console.log(`  ${String(s.files).padStart(5)}  ${s.pattern}`);
if (!coverage.specs.length) console.log('  (none yet)');
console.log('\ndescopes:');
for (const d of coverage.descopes) console.log(`  ${String(d.files).padStart(5)}  ${d.pattern} — ${d.reason}${d.files === 0 ? '   ← MATCHES NOTHING' : ''}`);

console.log('\nwrappers held (per catalog; --files lists every file):');
const byCatalog = new Map<string, { wrappers: number; files: number }>();
for (const w of wrapped) {
  const row = byCatalog.get(w.catalogId) ?? { wrappers: 0, files: 0 };
  row.wrappers += w.wrappers;
  row.files++;
  byCatalog.set(w.catalogId, row);
}
for (const [catalogId, row] of byCatalog) console.log(`  ${catalogId.padEnd(16)} ${String(row.wrappers).padStart(6)} records from ${row.files} file(s)`);
if (!wrapped.length) console.log('  (none — run scripts/zelda/ingest.ts)');
if (flag('files')) for (const w of wrapped) console.log(`    ${String(w.wrappers).padStart(4)}  ${w.file}`);

console.log('\nrounds (newest first):');
for (const r of rounds) {
  console.log(`  run #${r.run} ${r.at}  covered ${r.coverage.covered} descoped ${r.coverage.descoped} open ${r.coverage.open}`
    + `  | created ${r.store.created} rawChanged ${r.store.rawChanged} reprojected ${r.store.reprojected} unchanged ${r.store.unchanged}`
    + `  | path ${r.vault.pathNodes} findings ${r.vault.findings} upgrades ${r.vault.upgrades}${r.pin && r.pin !== BOTW_PIN ? `  (pin ${r.pin.slice(0, 7)})` : ''}`);
}
if (!rounds.length) console.log('  (no round recorded yet — run scripts/zelda/ingest.ts)');
if (unrecorded) console.log('  NOTE: the live tree coverage differs from the last recorded round — run ingest.ts to record this round.');
console.log(`  vault now: Path nodes ${learning.pathNodes} · findings ${learning.findings} · upgrades ${learning.upgrades}${vaultFound ? '' : `  (vault ${vault} not found)`}`);

console.log(`\nTERMINATION: ${verdict.met ? 'MET — write the final histogram + descope reasons to State.md and set status: done' : 'not met'}`);
for (const reason of verdict.reasons) console.log(`  - ${reason}`);

if (openShown > 0) {
  console.log(`\nopen files (first ${openShown} of ${coverage.openFiles.length}):`);
  for (const f of coverage.openFiles.slice(0, openShown)) console.log(`  ${f}`);
}
