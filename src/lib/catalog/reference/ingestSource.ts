/**
 * Ingest one reference source from a local data root: read every table, wrap it, resolve
 * cross-table links, persist the wrappers and record the run. Server/script only (fs).
 *
 * The run summary is the loop's measuring stick — coverage, gaps, sentinels, unresolved
 * links and the created/reprojected/unchanged split per run — and it is stored, so the
 * trend across hundreds of adjustments is queryable rather than remembered.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type Database from 'better-sqlite3';
import { auditColumns, type FieldMap } from '@/lib/catalog/ingest/fieldMap';
import type { TsvRefusal } from '@/lib/catalog/ingest/tsv';
import { resolveLinks, type LinkReport } from './links';
import { getReferenceSource, type ReferenceSource, type ReferenceTableSpec } from './sources';
import { wrapTable, type ReferenceWrapper, type TableWrapResult } from './wrapper';
import { recordRun, upsertWrappers, type StoreReport } from './wrappers-db';
import { getTechnique } from '@/lib/catalog/reference/techniques';
import { censusTable } from './census';
import { expandGlob, isGlobPattern } from './pathCoverage';

export interface TableRunSummary {
  file: string;
  catalogId: string;
  status: 'ingested' | 'missing' | 'refused';
  rows: number;
  coverage: number;
  mapped: number;
  gaps: number;
  unclassified: string[];
  declaredButAbsent: string[];
  malformed: number;
  positionalIds: number;
  duplicateKeys: number;
  rowIdMismatch?: { expected: number; actual: number };
  /** Mapped columns holding sentinel-looking values their mapping does NOT drop — decode them or explain. */
  sentinelColumns: { column: string; values: string[] }[];
  mappingVersion: string;
  refusal?: TsvRefusal;
  /**
   * Present only for a GLOB spec: how many files it matched, how many of them yielded no record
   * (read fine, nothing to wrap — spelled apart from a failure), and which were refused.
   */
  files?: { matched: number; withoutRecords: number; refused: string[] };
}

export interface IngestRunSummary {
  sourceId: string;
  dataRoot: string;
  tables: TableRunSummary[];
  manifests: ManifestRunSummary[];
  links: LinkReport;
  store: StoreReport;
  runId: number;
}

export interface ManifestRunSummary {
  file: string;
  status: 'checked' | 'missing' | 'refused';
  unclassified: string[];
  declaredButAbsent: string[];
  malformed: number;
  /** Manifest keys whose corresponding data table is not registered on the source. */
  unregisteredKeys: string[];
  refusal?: TsvRefusal;
}

export interface IngestDeps {
  db: Database.Database;
  readFile?: (path: string) => string;
  now?: string;
  /** Every file under the data root as a POSIX relative path — only glob specs ask. */
  listFiles?: (root: string) => string[];
  /** Extra measurements stored with the run (a loop's coverage snapshot), never read back here. */
  runExtras?: Record<string, unknown>;
}

/** Recursive POSIX listing of a data root (only reached when a source has a glob spec). */
export function listFilesUnder(root: string): string[] {
  return (readdirSync(root, { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
    .filter((d) => d.isFile())
    .map((d) => relative(root, join(d.parentPath, d.name)).replace(/\\/g, '/'))
    .sort();
}

/** Values a column's mapping already drops — a sentinel it handles is not a finding. */
function droppedBy(map: FieldMap, column: string): Set<string> {
  const rule = map[column];
  if (!rule || rule.kind !== 'mapped' || !rule.decode) return new Set();
  return new Set(rule.decode.flatMap((d) => (d.op === 'drop' ? d.values : [])));
}

function summarizeTable(r: TableWrapResult, map: FieldMap): TableRunSummary {
  if (r.refusal) {
    return {
      file: r.file, catalogId: r.catalogId, status: 'refused', rows: 0, coverage: 0,
      mapped: 0, gaps: 0, unclassified: [], declaredButAbsent: [], malformed: 0,
      positionalIds: 0, duplicateKeys: 0, sentinelColumns: [], mappingVersion: r.mappingVersion,
      refusal: r.refusal,
    };
  }
  const mappedCols = new Set(r.audit.mapped);
  return {
    file: r.file, catalogId: r.catalogId, status: 'ingested', rows: r.wrappers.length,
    coverage: r.audit.coverage, mapped: r.audit.mapped.length, gaps: r.audit.gap.length,
    unclassified: r.audit.unclassified, declaredButAbsent: r.audit.declaredButAbsent,
    malformed: r.malformed.length, positionalIds: r.positionalIds, duplicateKeys: r.duplicateKeys.length,
    ...(r.rowIdMismatch ? { rowIdMismatch: r.rowIdMismatch } : {}),
    sentinelColumns: r.census
      .filter((c) => mappedCols.has(c.column))
      .map((c) => ({ column: c.column, open: c.sentinels.filter((s) => !droppedBy(map, c.column).has(s.value)) }))
      .filter((c) => c.open.length > 0)
      .map((c) => ({ column: c.column, values: c.open.map((s) => `${s.value}×${s.count}`) })),
    mappingVersion: r.mappingVersion,
  };
}

const MISSING_SUMMARY = {
  status: 'missing', rows: 0, coverage: 0, mapped: 0, gaps: 0, unclassified: [], declaredButAbsent: [],
  malformed: 0, positionalIds: 0, duplicateKeys: 0, sentinelColumns: [], mappingVersion: '',
} as const;

/**
 * A GLOB spec: every matching file is wrapped on its own (its path is its wrappers' identity),
 * then the spec is summarised ONCE. The audit is read from the first wrapped file — a glob spec
 * reads one technique whose column set is fixed by the reader — with unjudged columns unioned
 * across files; a key produced twice anywhere in the spec counts as a duplicate.
 */
function wrapGlobSpec(
  source: ReferenceSource, spec: ReferenceTableSpec, dataRoot: string, files: string[],
  read: (path: string) => string, now?: string,
): { summary: TableRunSummary; wrappers: ReferenceWrapper[] } {
  const matched = expandGlob(files, spec.file);
  if (matched.length === 0) {
    // A glob that matches nothing is a finding about the data root or the glob, not an empty area.
    return {
      summary: { file: spec.file, catalogId: spec.catalogId, ...MISSING_SUMMARY, unclassified: [], declaredButAbsent: [], sentinelColumns: [], files: { matched: 0, withoutRecords: 0, refused: [] } },
      wrappers: [],
    };
  }
  const results: TableWrapResult[] = [];
  const refused: string[] = [];
  for (const file of matched) {
    const result = wrapTable(source, { ...spec, file }, read(join(dataRoot, file)), now);
    if (result.refusal) refused.push(file);
    else results.push(result);
  }
  const wrappers = results.flatMap((r) => r.wrappers);
  const ids = new Map<string, number[]>();
  wrappers.forEach((w, i) => ids.set(w.entity.id, [...(ids.get(w.entity.id) ?? []), i]));
  const first = results[0];
  const fileCounts = { matched: matched.length, withoutRecords: results.filter((r) => r.wrappers.length === 0).length, refused };
  if (!first) {
    return {
      summary: {
        file: spec.file, catalogId: spec.catalogId, ...MISSING_SUMMARY, status: 'refused',
        unclassified: [], declaredButAbsent: [], sentinelColumns: [], files: fileCounts,
      },
      wrappers: [],
    };
  }
  const columns = first.census.map((c) => c.column);
  const aggregate: TableWrapResult = {
    file: spec.file, catalogId: spec.catalogId, wrappers,
    audit: { ...first.audit, unclassified: [...new Set(results.flatMap((r) => r.audit.unclassified))] },
    census: censusTable(wrappers.map((w) => w.raw), columns),
    malformed: results.flatMap((r) => r.malformed),
    positionalIds: results.reduce((n, r) => n + r.positionalIds, 0),
    duplicateKeys: [...ids.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ key, rows })),
    mappingVersion: first.mappingVersion,
  };
  return { summary: { ...summarizeTable(aggregate, spec.map), files: fileCounts }, wrappers };
}

export function ingestSourceFromDir(sourceId: string, dataRoot: string, deps: IngestDeps): IngestRunSummary {
  const source = getReferenceSource(sourceId);
  const read = deps.readFile ?? ((p: string) => readFileSync(p, 'utf8'));
  const tables: TableRunSummary[] = [];
  const manifests: ManifestRunSummary[] = [];
  let all: ReferenceWrapper[] = [];
  let tree: string[] | undefined;

  for (const spec of source.tables) {
    if (isGlobPattern(spec.file)) {
      tree ??= (deps.listFiles ?? listFilesUnder)(dataRoot);
      const { summary, wrappers } = wrapGlobSpec(source, spec, dataRoot, tree, read, deps.now);
      tables.push(summary);
      all = all.concat(wrappers);
      continue;
    }
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

  for (const spec of source.manifests ?? []) {
    let text: string;
    try {
      text = read(join(dataRoot, spec.file));
    } catch {
      manifests.push({
        file: spec.file, status: 'missing', unclassified: [], declaredButAbsent: [],
        malformed: 0, unregisteredKeys: [],
      });
      continue;
    }
    const table = getTechnique(spec.technique).read(text);
    if (table.refusal) {
      manifests.push({
        file: spec.file, status: 'refused', unclassified: [], declaredButAbsent: [],
        malformed: 0, unregisteredKeys: [], refusal: table.refusal,
      });
      continue;
    }
    const audit = auditColumns(table.columns, spec.map);
    const registered = new Set(source.tables.map((tableSpec) => tableSpec.file));
    const unregisteredKeys = table.rows
      .map((row) => row[spec.keyColumn]?.trim())
      .filter((key): key is string => Boolean(key))
      .filter((key) => !registered.has(spec.registeredFilePattern.replace('{key}', key)));
    manifests.push({
      file: spec.file, status: 'checked', unclassified: audit.unclassified,
      declaredButAbsent: audit.declaredButAbsent, malformed: table.malformed.length,
      unregisteredKeys: [...new Set(unregisteredKeys)],
    });
  }

  const { wrappers, report: links } = resolveLinks(all, source.idPrefix);
  const store = upsertWrappers(deps.db, wrappers);
  const summary = { sourceId, dataRoot, tables, manifests, links, store };
  const runId = recordRun(deps.db, sourceId, deps.runExtras ? { ...summary, ...deps.runExtras } : summary);
  return { ...summary, runId };
}
