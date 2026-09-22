/**
 * Reference WRAPPERS — the reusable, re-projectable record of one source row.
 *
 * A wrapper keeps two things apart that an ingest usually fuses:
 *  - `raw` — the source record exactly as the technique read it. Never edited.
 *  - `entity` — its CURRENT projection into PoF's catalog shape, stamped with the
 *    `mappingVersion` that produced it.
 *
 * Replicating a game takes hundreds of mapping adjustments. With raw and projection fused,
 * each adjustment means re-reading the game and losing sight of what changed; kept apart, an
 * adjustment is a re-projection whose effect is countable (`reprojected` in the store report)
 * and whose input is still on the row. The techniques and maps can change underneath a
 * wrapper; the raw record and its identity do not.
 */
import { ingestRecords, type IngestedEntity } from '@/lib/catalog/ingest/run';
import type { ColumnAudit, FieldMap } from '@/lib/catalog/ingest/fieldMap';
import type { MalformedRow, TsvRefusal } from '@/lib/catalog/ingest/tsv';
import type { EntityProvenance } from '@/lib/catalog/types';
import { censusTable, type ColumnCensus } from './census';
import { contentHash } from './hash';
import { getTechnique, techniqueLabel } from './techniques';
import type { ReferenceSource, ReferenceTableSpec } from './sources';

export interface ReferenceWrapper {
  /** `<sourceId>:<file>:<key>` — stable across re-ingests while the key is. */
  wrapperId: string;
  sourceId: string;
  file: string;
  /** `tsv@1` — which reader produced `raw`. */
  technique: string;
  key: string;
  keyKind: 'column' | 'positional';
  raw: Record<string, string>;
  rawHash: string;
  catalogId: string;
  entity: IngestedEntity;
  mappingVersion: string;
}

export interface TableWrapResult {
  file: string;
  catalogId: string;
  wrappers: ReferenceWrapper[];
  audit: ColumnAudit;
  census: ColumnCensus[];
  malformed: MalformedRow[];
  positionalIds: number;
  duplicateKeys: { key: string; rows: number[] }[];
  mappingVersion: string;
  refusal?: TsvRefusal;
}

/** A map's identity. Decoders are data (see `decode.ts`), so a changed decoder moves it. */
export const mappingVersion = (map: FieldMap): string => contentHash(map);

/**
 * The projection's identity, ignoring `provenance.ingestedAt` — a timestamp that changes on
 * every run would make every re-ingest look like a re-projection and bury the real ones.
 */
export function projectionHash(entity: IngestedEntity): string {
  const stableProvenance: Partial<IngestedEntity['provenance']> = { ...entity.provenance };
  delete stableProvenance.ingestedAt;
  return contentHash({ ...entity, provenance: stableProvenance });
}

/** Pure: one table's text → wrappers + everything the loop needs to judge the mapping. */
export function wrapTable(source: ReferenceSource, spec: ReferenceTableSpec, text: string, now = new Date().toISOString()): TableWrapResult {
  const technique = getTechnique(spec.technique);
  const table = technique.read(text);
  const version = mappingVersion(spec.map);
  const provenanceFor = (sourceFile: string, sourceRow: string): EntityProvenance => ({
    kind: 'ingest', sourceGame: source.game, sourceProject: source.project,
    sourceFile, sourceRow, licenceNote: source.licenceNote, ingestedAt: now,
    canonProfile: source.canonProfile,
  });
  const result = ingestRecords(table, {
    catalogId: spec.catalogId, sourceFile: spec.file, keyColumn: spec.keyColumn,
    map: spec.map, provenanceFor, idPrefix: source.idPrefix,
  });

  const seen = new Set<string>();
  const wrappers = table.rows.map((raw, i): ReferenceWrapper => {
    const declared = spec.keyColumn ? (raw[spec.keyColumn] ?? '').trim() : '';
    const key = declared || `row${i}`;
    // A duplicate key is REPORTED by ingestRecords; for storage the later row still needs
    // its own identity, or the upsert would silently keep only one of them.
    let wrapperId = `${source.id}:${spec.file}:${key}`;
    if (seen.has(wrapperId)) wrapperId = `${wrapperId}@row${i}`;
    seen.add(wrapperId);
    return {
      wrapperId, sourceId: source.id, file: spec.file, technique: techniqueLabel(technique),
      key, keyKind: declared ? 'column' : 'positional',
      raw, rawHash: contentHash(raw),
      catalogId: spec.catalogId, entity: result.entities[i], mappingVersion: version,
    };
  });

  return {
    file: spec.file, catalogId: spec.catalogId, wrappers,
    audit: result.audit, census: censusTable(table.rows, table.columns),
    malformed: result.malformed, positionalIds: result.positionalIds,
    duplicateKeys: result.duplicateKeys, mappingVersion: version, refusal: table.refusal,
  };
}
