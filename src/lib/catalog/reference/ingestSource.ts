/**
 * Ingest one reference source from a local data root: read every table, wrap it, resolve
 * cross-table links, persist the wrappers and record the run. Server/script only (fs).
 *
 * The run summary is the loop's measuring stick — coverage, gaps, sentinels, unresolved
 * links and the created/reprojected/unchanged split per run — and it is stored, so the
 * trend across hundreds of adjustments is queryable rather than remembered.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { FieldMap } from '@/lib/catalog/ingest/fieldMap';
import { resolveLinks, type LinkReport } from './links';
import { getReferenceSource } from './sources';
import { wrapTable, type ReferenceWrapper, type TableWrapResult } from './wrapper';
import { recordRun, upsertWrappers, type StoreReport } from './wrappers-db';

export interface TableRunSummary {
  file: string;
  catalogId: string;
  status: 'ingested' | 'missing';
  rows: number;
  coverage: number;
  mapped: number;
  gaps: number;
  unclassified: string[];
  declaredButAbsent: string[];
  malformed: number;
  positionalIds: number;
  duplicateKeys: number;
  /** Mapped columns holding sentinel-looking values their mapping does NOT drop — decode them or explain. */
  sentinelColumns: { column: string; values: string[] }[];
  mappingVersion: string;
}

export interface IngestRunSummary {
  sourceId: string;
  dataRoot: string;
  tables: TableRunSummary[];
  links: LinkReport;
  store: StoreReport;
  runId: number;
}

export interface IngestDeps {
  db: Database.Database;
  readFile?: (path: string) => string;
  now?: string;
}

/** Values a column's mapping already drops — a sentinel it handles is not a finding. */
function droppedBy(map: FieldMap, column: string): Set<string> {
  const rule = map[column];
  if (!rule || rule.kind !== 'mapped' || !rule.decode) return new Set();
  return new Set(rule.decode.flatMap((d) => (d.op === 'drop' ? d.values : [])));
}

function summarizeTable(r: TableWrapResult, map: FieldMap): TableRunSummary {
  const mappedCols = new Set(r.audit.mapped);
  return {
    file: r.file, catalogId: r.catalogId, status: 'ingested', rows: r.wrappers.length,
    coverage: r.audit.coverage, mapped: r.audit.mapped.length, gaps: r.audit.gap.length,
    unclassified: r.audit.unclassified, declaredButAbsent: r.audit.declaredButAbsent,
    malformed: r.malformed.length, positionalIds: r.positionalIds, duplicateKeys: r.duplicateKeys.length,
    sentinelColumns: r.census
      .filter((c) => mappedCols.has(c.column))
      .map((c) => ({ column: c.column, open: c.sentinels.filter((s) => !droppedBy(map, c.column).has(s.value)) }))
      .filter((c) => c.open.length > 0)
      .map((c) => ({ column: c.column, values: c.open.map((s) => `${s.value}×${s.count}`) })),
    mappingVersion: r.mappingVersion,
  };
}

export function ingestSourceFromDir(sourceId: string, dataRoot: string, deps: IngestDeps): IngestRunSummary {
  const source = getReferenceSource(sourceId);
  const read = deps.readFile ?? ((p: string) => readFileSync(p, 'utf8'));
  const tables: TableRunSummary[] = [];
  let all: ReferenceWrapper[] = [];

  for (const spec of source.tables) {
    let text: string;
    try {
      text = read(join(dataRoot, spec.file));
    } catch {
      // A missing table is a finding about the data root, not an empty table.
      tables.push({
        file: spec.file, catalogId: spec.catalogId, status: 'missing', rows: 0, coverage: 0, mapped: 0,
        gaps: 0, unclassified: [], declaredButAbsent: [], malformed: 0, positionalIds: 0, duplicateKeys: 0,
        sentinelColumns: [], mappingVersion: '',
      });
      continue;
    }
    const result = wrapTable(source, spec, text, deps.now);
    tables.push(summarizeTable(result, spec.map));
    all = all.concat(result.wrappers);
  }

  const { wrappers, report: links } = resolveLinks(all, source.idPrefix);
  const store = upsertWrappers(deps.db, wrappers);
  const summary = { sourceId, dataRoot, tables, links, store };
  const runId = recordRun(deps.db, sourceId, summary);
  return { ...summary, runId };
}
