/**
 * Pure resolution of a `table` View against a step's produced artifact data — the ONE
 * answer to "what does this table actually render, and which declared columns can never
 * resolve?". Shared by the renderer (`ArchetypeStep`'s ViewPanel → `DataTable`) and by the
 * fleet spec linter, so a column the linter accepts is exactly a column the UI can show.
 *
 * Why it exists: 99 of 451 declared table columns across the fleet could never resolve
 * against their own `produce()` output — 28 tables rendered entirely `— missing` to every
 * user. The two dominant causes were structural, not typos: a step whose produce writes a
 * LIST of row records (`tiers: [{tier, minPoints, …}]`) or a KEYED GROUP of row records
 * (`layers: { bed: {name, gainDb, …} }`) was rendered by a key·value table that looked for
 * the column keys at the TOP level, where they never live. So the resolver understands
 * three real shapes instead of one:
 *
 *  - `kv`   — a flat record: the classic label·value table (unchanged behaviour).
 *  - `rows` — a list of row records, or a keyed group of them: a real multi-column table,
 *             one row per record, the group key carried as the row label. Sibling scalars
 *             and unrelated blocks (e.g. `wiringContract`) are NOT rows: a record only
 *             becomes a row if it carries at least one declared column.
 *  - `mismatch` / `absent` — the data is the wrong shape, or was never produced. Named
 *             honestly by the caller; never rendered as a grid of "— missing" lies.
 *
 * `rowsKey` (optional, on the view descriptor) points at a nested container when the row
 * list lives one level down (`hazards.hazardList`, `telemetry.events`) — the view `field`
 * stays the top-level key so the linter's field-coherence rules (f)/(g) are untouched.
 *
 * Pure: no React, no store, no I/O.
 */

export interface TableViewColumn { key: string; label?: string; unit?: string }

/** One rendered row: its optional group label plus the record the columns read from. */
export interface TableViewRow { label?: string; values: Record<string, unknown> }

export type TableResolution =
  | { mode: 'absent' }
  | { mode: 'mismatch'; actual: string }
  | { mode: 'kv'; values: Record<string, unknown>; missing: string[] }
  | { mode: 'rows'; rows: TableViewRow[]; missing: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Plain-language name of a value's runtime shape, for honest mismatch copy. */
export function describeTableShape(v: unknown): string {
  if (v == null) return 'nothing';
  if (Array.isArray(v)) return 'a list';
  if (typeof v === 'object') return 'a key·value object';
  return `a ${typeof v}`;
}

/** Columns that no row (or the flat record) carries a non-null value for. */
function missingColumns(columns: TableViewColumn[], records: Record<string, unknown>[]): string[] {
  return columns.filter((c) => !records.some((r) => r[c.key] != null)).map((c) => c.key);
}

export function resolveTableView(
  data: Record<string, unknown>,
  field: string,
  columns: TableViewColumn[],
  rowsKey?: string,
): TableResolution {
  const base = data?.[field];
  if (base == null) return { mode: 'absent' };
  const container = rowsKey ? (isRecord(base) ? base[rowsKey] : undefined) : base;
  if (container == null) return { mode: 'absent' };

  // A list of row records → a real multi-column table.
  if (Array.isArray(container)) {
    const rows = container.filter(isRecord).map((values) => ({ values }));
    if (rows.length === 0) return { mode: 'mismatch', actual: 'a list of plain values' };
    return { mode: 'rows', rows, missing: missingColumns(columns, rows.map((r) => r.values)) };
  }

  if (!isRecord(container)) return { mode: 'mismatch', actual: describeTableShape(container) };

  // A flat record whose OWN keys carry the columns is the classic key·value table.
  const flatHit = columns.some((c) => container[c.key] != null);
  if (flatHit) return { mode: 'kv', values: container, missing: missingColumns(columns, [container]) };

  // Otherwise: a keyed GROUP of row records (`layers: { bed: {...}, layerA: {...} }`).
  // Only a nested record that carries at least one declared column becomes a row — a
  // sibling `wiringContract` / `note` block is metadata, not a blank row.
  const grouped = Object.entries(container)
    .filter(([, v]) => isRecord(v) && columns.some((c) => (v as Record<string, unknown>)[c.key] != null))
    .map(([label, v]) => ({ label, values: v as Record<string, unknown> }));
  if (grouped.length > 0) {
    return { mode: 'rows', rows: grouped, missing: missingColumns(columns, grouped.map((r) => r.values)) };
  }

  // Present, a record, but nothing the declared columns can read: report it as the
  // key·value table it is, with every column honestly missing (the linter forbids this
  // state for a registered step — see rule (l)).
  return { mode: 'kv', values: container, missing: columns.map((c) => c.key) };
}
