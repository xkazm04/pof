/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Retire the botw wrapper rows a full ingest of every BOTW spec at the pin no longer produces — the
 * rows a reader re-key leaves behind (the store never deletes; a re-keyed record is `created` and its
 * old row keeps the old entity id). botw-scoped: no other source's rows are read or touched (/diablo
 * shares the store).
 *
 *   npx tsx scripts/zelda/retire-stale.ts --root <botw clone> --dry-run          # print the stale set only
 *   npx tsx scripts/zelda/retire-stale.ts --root <botw clone> --expect <N>       # retire, guarded
 *
 * It always prints the stale set first. It retires only when every stale row is a `definition` record
 * (the one kind a re-key may leave behind) and their count is exactly `--expect` — the number written in
 * the wave note BEFORE the ingest — and then deletes exactly those rows in one transaction.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '@/lib/db';
import { BOTW } from '@/lib/catalog/reference/sources';
import { findStaleWrappers, producedWrapperIds, retireStaleWrappers } from '@/lib/catalog/reference/staleWrappers';
import { arg, flag, requireClone, treeFiles } from './shared';

const RETIRABLE_KINDS = ['definition'] as const;

const root = arg('root');
requireClone(root);
const dataRoot = root as string;
const dryRun = flag('dry-run');
const expectArg = arg('expect');
const expected = expectArg === undefined ? NaN : Number(expectArg);
if (!dryRun && !Number.isInteger(expected)) {
  console.error('REFUSED: --expect <N> is required (the stale count written in the wave note), or pass --dry-run');
  process.exit(2);
}

const db = getDb();
const produced = producedWrapperIds(BOTW, treeFiles(dataRoot), (file) => readFileSync(join(dataRoot, file), 'utf8'));
const stale = findStaleWrappers(db, BOTW.id, produced.ids);

console.log(`\n=== STALE ${BOTW.id} wrappers (produced by a full read: ${produced.ids.size}; refused files: ${produced.refused.length}) ===\n`);
for (const s of stale) console.log(`  ${s.kind.padEnd(10)} ${s.catalogId.padEnd(16)} ${s.wrapperId}`);
const tally = (pick: (s: (typeof stale)[number]) => string) =>
  [...stale.reduce((m, s) => m.set(pick(s), (m.get(pick(s)) ?? 0) + 1), new Map<string, number>())].map(([k, n]) => `${k} ${n}`).join(' · ') || 'none';
console.log(`\nstale ${stale.length} — by kind: ${tally((s) => s.kind)} — by catalog: ${tally((s) => s.catalogId)}`);

if (dryRun) process.exit(0);

const result = retireStaleWrappers(db, BOTW.id, produced.ids, { expected, kinds: RETIRABLE_KINDS });
if (!result.ok) {
  console.error(`\nREFUSED: ${result.reason} — nothing deleted`);
  process.exit(3);
}
console.log(`\nretired ${result.retired.length} stale ${BOTW.id} row(s) in one transaction (guard: kinds ${RETIRABLE_KINDS.join(', ')}, expected ${expected}).`);
