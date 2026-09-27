/* eslint-disable no-console -- CLI report; stdout and stderr are its interfaces. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listEntities } from '@/lib/catalog-db';
import { getDb } from '@/lib/db';
import { listAllArtifacts } from '@/lib/pipeline-artifacts-db';
import { loreBooks } from '@/lib/catalog/reference/loreBooks';
import { loreParity, type LoreFactGraph, type LoreParityEntry } from '@/lib/catalog/reference/loreParity';
import { listWrappers } from '@/lib/catalog/reference/wrappers-db';

const valueAfter = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const graphPath = valueAfter('--graph');
if (!graphPath) {
  console.error('Usage: npx tsx scripts/diablo/loreParity.ts --graph <path> [--json] [--out <path>]');
  process.exit(1);
}

const readGraph = (path: string): LoreFactGraph => {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Lore graph must be a JSON object');
  const candidate = parsed as Partial<LoreFactGraph>;
  if (!Array.isArray(candidate.entities) || !Array.isArray(candidate.facts)) {
    throw new Error('Lore graph must contain entities[] and facts[]');
  }
  return candidate as LoreFactGraph;
};

const db = getDb();
const promoted = new Set(listEntities('codex')
  .filter((entity) => entity.entityId.startsWith('d1-lore-'))
  .map((entity) => entity.entityId));
const entries: LoreParityEntry[] = loreBooks(listWrappers(db, { sourceId: 'diablo1' })).wrappers
  .filter((wrapper) => promoted.has(wrapper.entity.id))
  .map((wrapper) => ({
    entityId: wrapper.entity.id,
    name: wrapper.entity.name,
    textIds: ((wrapper.entity.data.volumes ?? []) as { line?: unknown }[])
      .map((volume) => volume.line)
      .filter((line): line is string => typeof line === 'string'),
  }));

const report = loreParity({
  graph: readGraph(resolve(graphPath)),
  entries,
  artifacts: listAllArtifacts({ catalogId: 'codex' }),
});
const json = JSON.stringify(report, null, 2);
const outPath = valueAfter('--out');
if (outPath) writeFileSync(resolve(outPath), `${json}\n`, 'utf8');

if (process.argv.includes('--json')) {
  console.log(json);
} else {
  const percent = (value: number | null): string => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
  console.log('entry'.padEnd(36), 'facts'.padStart(5), 'pairs'.padStart(5), 'edges'.padStart(5), 'supp'.padStart(5), 'unsup'.padStart(5), 'unres'.padStart(5), 'precision'.padStart(10), 'recall'.padStart(8));
  for (const entry of report.entries) {
    console.log(
      entry.name.slice(0, 36).padEnd(36),
      String(entry.referenceFacts.length).padStart(5),
      String(entry.referencePairs).padStart(5),
      String(entry.producedEdges.length).padStart(5),
      String(entry.supported.length).padStart(5),
      String(entry.unsupported.length).padStart(5),
      String(entry.unresolvedNodes.length).padStart(5),
      percent(entry.precision).padStart(10),
      percent(entry.recall).padStart(8),
    );
  }
  const totals = report.totals;
  console.log(
    'TOTAL'.padEnd(36),
    String(totals.referenceFacts).padStart(5),
    String(totals.referencePairs).padStart(5),
    String(totals.producedEdges).padStart(5),
    String(totals.supported).padStart(5),
    String(totals.unsupported).padStart(5),
    String(totals.unresolvedNodes).padStart(5),
    percent(totals.precision).padStart(10),
    percent(totals.recall).padStart(8),
  );
}
