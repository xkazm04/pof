import { getDb } from './db';
import { SUB_MODULES, CATEGORIES, MODULE_LABELS } from './module-registry';
import { MODULE_FEATURE_DEFINITIONS } from './feature-definitions';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: 'checklist' | 'feature' | 'module' | 'category' | 'finding' | 'build';
  moduleId: string;
  moduleLabel: string;
  title: string;
  snippet: string;
  /** FTS5 rank (lower = better match) */
  rank: number;
}

// ── Schema ───────────────────────────────────────────────────────────────────

export function ensureSearchIndex(): void {
  const db = getDb();

  // FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      doc_id,
      doc_type,
      module_id,
      title,
      body,
      tokenize='porter unicode61'
    )
  `);

  // Track last rebuild timestamp in settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

// ── Rebuild index ────────────────────────────────────────────────────────────

export function rebuildSearchIndex(): { indexed: number } {
  const db = getDb();
  ensureSearchIndex();

  // Clear existing index
  db.exec('DELETE FROM search_index');

  const insert = db.prepare(
    'INSERT INTO search_index (doc_id, doc_type, module_id, title, body) VALUES (?, ?, ?, ?, ?)'
  );

  let count = 0;

  const insertAll = db.transaction(() => {
    // 1. Categories
    for (const cat of CATEGORIES) {
      insert.run(`cat-${cat.id}`, 'category', cat.id, cat.label, cat.subModules.join(' '));
      count++;
    }

    // 2. Sub-modules (label + description)
    for (const mod of SUB_MODULES) {
      insert.run(
        `mod-${mod.id}`,
        'module',
        mod.id,
        mod.label,
        mod.description
      );
      count++;

      // 3. Checklist items for each module
      if (mod.checklist) {
        for (const item of mod.checklist) {
          insert.run(
            `cl-${mod.id}-${item.id}`,
            'checklist',
            mod.id,
            item.label,
            item.description
          );
          count++;
        }
      }

      // 4. Quick actions
      for (const qa of mod.quickActions) {
        insert.run(
          `qa-${mod.id}-${qa.id}`,
          'checklist', // treat as checklist-like for navigation
          mod.id,
          qa.label,
          qa.description ?? ''
        );
        count++;
      }
    }

    // 5. Feature definitions
    for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
      for (const feat of features) {
        insert.run(
          `feat-${moduleId}-${feat.featureName}`,
          'feature',
          moduleId,
          feat.featureName,
          `${feat.category} ${feat.description}`
        );
        count++;
      }
    }

    // 6. Feature matrix rows from DB (reviewed features with notes)
    const fmRows = db.prepare(
      'SELECT module_id, feature_name, description, review_notes, next_steps, status FROM feature_matrix'
    ).all() as { module_id: string; feature_name: string; description: string; review_notes: string; next_steps: string; status: string }[];

    for (const row of fmRows) {
      const body = [row.description, row.review_notes, row.next_steps, row.status].filter(Boolean).join(' ');
      insert.run(
        `fm-${row.module_id}-${row.feature_name}`,
        'feature',
        row.module_id,
        row.feature_name,
        body
      );
      count++;
    }

    // 7. Eval findings
    const findings = db.prepare(
      'SELECT id, module_id, category, description, suggested_fix, severity, pass FROM eval_findings'
    ).all() as { id: string; module_id: string; category: string; description: string; suggested_fix: string; severity: string; pass: string }[];

    for (const f of findings) {
      const body = [f.pass, f.severity, f.category, f.description, f.suggested_fix].filter(Boolean).join(' ');
      insert.run(
        `ef-${f.id}`,
        'finding',
        f.module_id,
        `${f.category} (${f.severity})`,
        body
      );
      count++;
    }

    // 8. Build history (recent 50)
    const builds = db.prepare(
      'SELECT id, platform, config, status, error_summary, notes, created_at FROM build_history ORDER BY created_at DESC LIMIT 50'
    ).all() as { id: number; platform: string; config: string; status: string; error_summary: string | null; notes: string | null; created_at: string }[];

    for (const b of builds) {
      const body = [b.platform, b.config, b.status, b.error_summary, b.notes].filter(Boolean).join(' ');
      insert.run(
        `build-${b.id}`,
        'build',
        '',
        `Build ${b.platform} ${b.config}`,
        body
      );
      count++;
    }
  });

  insertAll();

  // Record rebuild timestamp
  db.prepare('INSERT OR REPLACE INTO search_meta (key, value) VALUES (?, ?)').run(
    'last_rebuild',
    new Date().toISOString()
  );

  return { indexed: count };
}

// ── Query ────────────────────────────────────────────────────────────────────

export function searchIndex(
  query: string,
  options?: { types?: string[]; limit?: number }
): SearchResult[] {
  const db = getDb();
  ensureSearchIndex();

  const limit = options?.limit ?? 30;
  const types = options?.types;

  // Sanitize query for FTS5 — escape special characters and add prefix matching
  const sanitized = query
    .replace(/['"]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim();

  if (!sanitized) return [];

  // Add * for prefix matching on each term
  const ftsQuery = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"*`)
    .join(' ');

  let sql = `
    SELECT
      doc_id,
      doc_type,
      module_id,
      snippet(search_index, 3, '→', '←', '…', 24) AS title_snippet,
      snippet(search_index, 4, '→', '←', '…', 40) AS body_snippet,
      rank
    FROM search_index
    WHERE search_index MATCH ?
  `;

  const params: (string | number)[] = [ftsQuery];

  if (types && types.length > 0) {
    const placeholders = types.map(() => '?').join(', ');
    sql += ` AND doc_type IN (${placeholders})`;
    params.push(...types);
  }

  sql += ' ORDER BY rank LIMIT ?';
  params.push(limit);

  try {
    const rows = db.prepare(sql).all(...params) as {
      doc_id: string;
      doc_type: string;
      module_id: string;
      title_snippet: string;
      body_snippet: string;
      rank: number;
    }[];

    return rows.map((r) => ({
      id: r.doc_id,
      type: r.doc_type as SearchResult['type'],
      moduleId: r.module_id,
      moduleLabel: r.module_id ? (MODULE_LABELS[r.module_id] ?? r.module_id) : '',
      title: r.title_snippet,
      snippet: r.body_snippet,
      rank: r.rank,
    }));
  } catch {
    // If query syntax is bad, return empty
    return [];
  }
}

// ── Last rebuild info ────────────────────────────────────────────────────────

export function getLastRebuildTime(): string | null {
  const db = getDb();
  try {
    const row = db.prepare('SELECT value FROM search_meta WHERE key = ?').get('last_rebuild') as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}
