/**
 * The ingest run: TSV text + a mapping table → PoF entities and the report that says what
 * did not fit.
 *
 * The entity and the audit are built from the SAME `FieldMap`. That is deliberate: a
 * mapper that walks its own list of assignments while a separate list describes the gaps
 * is two sources of truth for one mapping, and they drift the first time somebody adds a
 * field to only one of them. Here a rule is `mapped('data.stats[Level]')` exactly once,
 * and both the value and the coverage number follow from it.
 *
 * Nothing here writes to the database. A dry run is the point — the report is the
 * deliverable, and persisting 700 rows of another studio's balance data is a decision an
 * operator makes explicitly, not a side effect of looking.
 */
import { auditColumns, type ColumnAudit, type FieldMap } from './fieldMap';
import { parseTsv, type MalformedRow, type TsvTable } from './tsv';
import { applyDecode } from './decode';
import type { CatalogEntityBase, CatalogLink, EntityProvenance } from '../types';

/**
 * An entity produced by ingest. `data` is an open bag rather than one of the strict
 * catalog payload types on purpose: a real source cannot fill every required field (see
 * `TARGET_GAPS`), and casting a partial object to `ArchetypeConfig` would put a lie in the
 * type system where nothing could find it. The unfilled fields are REPORTED instead.
 */
export interface IngestedEntity extends CatalogEntityBase {
  data: Record<string, unknown>;
  provenance: EntityProvenance;
}

export interface TableIngestResult {
  catalogId: string;
  sourceFile: string;
  entities: IngestedEntity[];
  audit: ColumnAudit;
  malformed: MalformedRow[];
  /**
   * Rows whose key column was blank, so identity fell back to row POSITION. Reported
   * because a positional id is stable only while the upstream file's row order is: it is a
   * working identity, not a good one.
   */
  positionalIds: number;
  /**
   * Keys the key column produced more than once. A duplicate is never merged away — two
   * rows sharing a key are two entities whose identities collide, and silently keeping the
   * last one is how an ingest loses balance data nobody notices is gone.
   */
  duplicateKeys: { key: string; rows: number[] }[];
}

/** Which catalog a `links[role=…]` target belongs to. */
const ROLE_CATALOG: Record<string, string> = {
  loot: 'loot-tables',
  ability: 'spellbook',
  'unique-drop': 'items',
};

const LIST_PATH = /^data\.([A-Za-z0-9_]+)\[\]$/;

const STATS_PATH = /^data\.stats\[(.+)\]$/;
const LINK_PATH = /^links\[role=(.+)\]$/;

/** Apply one `mapped(...)` destination path to the entity under construction. */
function applyTo(entity: IngestedEntity, path: string, value: string): void {
  // A blank cell is "none", not "the empty string" — writing it would manufacture data.
  if (value === '') return;

  if (path === 'id' || path === 'name') { entity[path] = value; return; }

  if (path === 'tags') {
    if (!entity.tags.includes(value)) entity.tags.push(value);
    return;
  }

  const stat = STATS_PATH.exec(path);
  if (stat) {
    const stats = (entity.data.stats ??= []) as { label: string; value: string }[];
    stats.push({ label: stat[1], value });
    return;
  }

  const link = LINK_PATH.exec(path);
  if (link) {
    const role = link[1];
    const links = (entity.links ??= []) as CatalogLink[];
    // The referenced entity is named in the SOURCE's vocabulary; resolving it to a real
    // PoF entity id is a later pass that needs both catalogs ingested. Recording the raw
    // reference is honest; inventing an id that resolves nowhere is not.
    links.push({ catalogId: ROLE_CATALOG[role] ?? 'unknown', entityId: value, role });
    return;
  }

  const list = LIST_PATH.exec(path);
  if (list) {
    const arr = (entity.data[list[1]] ??= []) as string[];
    if (!arr.includes(value)) arr.push(value);
    return;
  }

  if (path === 'data.abilities') {
    const abilities = (entity.data.abilities ??= []) as string[];
    if (!abilities.includes(value)) abilities.push(value);
    return;
  }

  if (path.startsWith('data.')) { entity.data[path.slice(5)] = value; return; }

  // A destination the applier does not understand must not vanish: park it where the
  // report can see it rather than dropping the value on the floor.
  (entity.data.__unapplied ??= {} as Record<string, string>);
  (entity.data.__unapplied as Record<string, string>)[path] = value;
}

export interface IngestTableOptions {
  catalogId: string;
  sourceFile: string;
  /**
   * Column whose value identifies the row in the SOURCE. Optional, and blank cells are
   * tolerated, because a legacy table's identity is often POSITIONAL: Diablo's
   * `itemdat.tsv` gives a symbolic `id` to only the 50 rows the game code names directly
   * and leaves the other 118 droppable base items with no key at all — while `name`, the
   * obvious substitute, repeats 21 times. Keying such a table on a column either drops
   * two-thirds of it or collides rows; neither failure is visible from the output.
   */
  keyColumn?: string;
  map: FieldMap;
  provenanceFor: (sourceFile: string, sourceRow: string) => EntityProvenance;
  /** Prefix for generated entity ids, so ingested ids cannot collide with code seeds. */
  idPrefix: string;
}

/** Pure: text in, entities and report out. No database, no filesystem. */
export function ingestTable(tsvText: string, opts: IngestTableOptions): TableIngestResult {
  return ingestRecords(parseTsv(tsvText), opts);
}

/**
 * Pure: already-read records in, entities and report out. Separate from `ingestTable` so a
 * reading TECHNIQUE other than TSV (gamedata text, C arrays, a binary archive) can hand its
 * records to the same projection. `entities[i]` is always the projection of `table.rows[i]` —
 * no row is skipped — which is what lets a wrapper pair a raw record with its entity.
 */
export function ingestRecords(table: TsvTable, opts: IngestTableOptions): TableIngestResult {
  const audit = auditColumns(table.columns, opts.map);
  const entities: IngestedEntity[] = [];
  let positionalIds = 0;
  const seen = new Map<string, number[]>();

  table.rows.forEach((row, index) => {
    const declared = opts.keyColumn ? row[opts.keyColumn] : '';
    const positional = !declared;
    if (positional) positionalIds++;
    const key = declared || `row${index}`;
    const keyLabel = opts.keyColumn && declared ? `${opts.keyColumn}=${declared}` : `row=${index}`;
    seen.set(key, [...(seen.get(key) ?? []), index]);

    const entity: IngestedEntity = {
      id: `${opts.idPrefix}-${key}`,
      catalogId: opts.catalogId,
      name: key,
      categoryPath: [],
      tags: [],
      lifecycle: 'planned',
      data: {},
      provenance: opts.provenanceFor(opts.sourceFile, keyLabel),
    };

    for (const column of audit.mapped) {
      const rule = opts.map[column];
      if (rule.kind !== 'mapped') continue;
      for (const value of applyDecode(row[column], rule.decode)) applyTo(entity, rule.to, value);
    }

    // The source key stays the identity even when a `name` column overwrote the label —
    // an ingested entity must remain traceable to its row.
    entity.id = `${opts.idPrefix}-${key}`;
    entities.push(entity);
  });

  return {
    catalogId: opts.catalogId,
    sourceFile: opts.sourceFile,
    entities,
    audit,
    malformed: table.malformed,
    positionalIds,
    duplicateKeys: [...seen.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => ({ key, rows })),
  };
}
