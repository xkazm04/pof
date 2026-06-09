import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import type {
  ImplementationPattern,
  PatternRow,
  PatternCategory,
  PatternConfidence,
  PatternLibraryDashboard,
  PatternSearchParams,
  PatternSuggestion,
  PatternSource,
  PatternAuthorInput,
  PatternMetaPatch,
  AntiPattern,
  AntiPatternRow,
  AntiPatternSeverity,
  AntiPatternWarning,
} from '@/types/pattern-library';

// ── Schema bootstrap ─────────────────────────────────────────────────────────

export function ensurePatternLibraryTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS pattern_library (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      module_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      tags TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      approach TEXT NOT NULL DEFAULT '',
      success_rate REAL NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0,
      project_count INTEGER NOT NULL DEFAULT 1,
      avg_duration_ms INTEGER NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL DEFAULT 'experimental',
      involved_classes TEXT NOT NULL DEFAULT '[]',
      pitfalls TEXT NOT NULL DEFAULT '[]',
      example_prompt TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_success_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Add curation columns on legacy DBs (idempotent ALTERs).
  const cols = db.prepare(`PRAGMA table_info(pattern_library)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  const addIfMissing = (col: string, ddl: string) => {
    if (!names.has(col)) db.exec(`ALTER TABLE pattern_library ADD COLUMN ${ddl}`);
  };
  addIfMissing('source', `source TEXT NOT NULL DEFAULT 'mined'`);
  addIfMissing('verified', `verified INTEGER NOT NULL DEFAULT 0`);
  addIfMissing('pinned', `pinned INTEGER NOT NULL DEFAULT 0`);
  addIfMissing('verified_at', `verified_at TEXT`);
  addIfMissing('verified_by', `verified_by TEXT`);
  addIfMissing('authored_by', `authored_by TEXT`);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pattern_library_module
    ON pattern_library(module_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pattern_library_category
    ON pattern_library(category)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pattern_library_success
    ON pattern_library(success_rate DESC)
  `);

  // Curation indices — pinned/verified are part of the canonical sort key.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pattern_library_curation
    ON pattern_library(pinned DESC, verified DESC, success_rate DESC)
  `);
}

// ── Row mapping ──────────────────────────────────────────────────────────────

function rowToPattern(row: PatternRow): ImplementationPattern {
  return {
    id: row.id,
    title: row.title,
    moduleId: row.module_id as SubModuleId,
    category: row.category as PatternCategory,
    tags: safeParse<string[]>(row.tags, []),
    description: row.description,
    approach: row.approach,
    successRate: row.success_rate,
    sessionCount: row.session_count,
    projectCount: row.project_count,
    avgDurationMs: row.avg_duration_ms,
    confidence: row.confidence as PatternConfidence,
    involvedClasses: safeParse<string[]>(row.involved_classes, []),
    pitfalls: safeParse<string[]>(row.pitfalls, []),
    examplePrompt: row.example_prompt ?? undefined,
    firstSeenAt: row.first_seen_at,
    lastSuccessAt: row.last_success_at,
    source: (row.source as PatternSource) ?? 'mined',
    verified: !!row.verified,
    pinned: !!row.pinned,
    verifiedAt: row.verified_at ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    authoredBy: row.authored_by ?? undefined,
  };
}

function safeParse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function upsertPattern(pattern: ImplementationPattern): void {
  ensurePatternLibraryTable();
  const db = getDb();

  // Re-mining must not clobber human curation: on conflict we preserve
  // existing title/description/pitfalls if a human already verified the row.
  db.prepare(`
    INSERT INTO pattern_library
      (id, title, module_id, category, tags, description, approach,
       success_rate, session_count, project_count, avg_duration_ms,
       confidence, involved_classes, pitfalls, example_prompt,
       first_seen_at, last_success_at, updated_at,
       source, verified, pinned, verified_at, verified_by, authored_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'),
            ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = CASE WHEN pattern_library.verified = 1 THEN pattern_library.title ELSE excluded.title END,
      description = CASE WHEN pattern_library.verified = 1 THEN pattern_library.description ELSE excluded.description END,
      success_rate = excluded.success_rate,
      session_count = excluded.session_count,
      project_count = excluded.project_count,
      avg_duration_ms = excluded.avg_duration_ms,
      confidence = excluded.confidence,
      involved_classes = excluded.involved_classes,
      pitfalls = CASE WHEN pattern_library.verified = 1 THEN pattern_library.pitfalls ELSE excluded.pitfalls END,
      example_prompt = excluded.example_prompt,
      last_success_at = excluded.last_success_at,
      updated_at = datetime('now')
      -- source/verified/pinned/verified_at/verified_by/authored_by are preserved
  `).run(
    pattern.id,
    pattern.title,
    pattern.moduleId,
    pattern.category,
    JSON.stringify(pattern.tags),
    pattern.description,
    pattern.approach,
    pattern.successRate,
    pattern.sessionCount,
    pattern.projectCount,
    pattern.avgDurationMs,
    pattern.confidence,
    JSON.stringify(pattern.involvedClasses),
    JSON.stringify(pattern.pitfalls),
    pattern.examplePrompt ?? null,
    pattern.firstSeenAt,
    pattern.lastSuccessAt,
    pattern.source ?? 'mined',
    pattern.verified ? 1 : 0,
    pattern.pinned ? 1 : 0,
    pattern.verifiedAt ?? null,
    pattern.verifiedBy ?? null,
    pattern.authoredBy ?? null,
  );
}

/** Canonical sort: pinned first, then verified, then success-driven. */
const CURATION_ORDER = 'pinned DESC, verified DESC, success_rate DESC, session_count DESC';

export function getAllPatterns(): ImplementationPattern[] {
  ensurePatternLibraryTable();
  const rows = getDb()
    .prepare(`SELECT * FROM pattern_library ORDER BY ${CURATION_ORDER}`)
    .all() as PatternRow[];
  return rows.map(rowToPattern);
}

export function getPatternsByModule(moduleId: SubModuleId): ImplementationPattern[] {
  ensurePatternLibraryTable();
  const rows = getDb()
    .prepare(`SELECT * FROM pattern_library WHERE module_id = ? ORDER BY ${CURATION_ORDER}`)
    .all(moduleId) as PatternRow[];
  return rows.map(rowToPattern);
}

export function getPattern(id: string): ImplementationPattern | null {
  ensurePatternLibraryTable();
  const row = getDb()
    .prepare('SELECT * FROM pattern_library WHERE id = ?')
    .get(id) as PatternRow | undefined;
  return row ? rowToPattern(row) : null;
}

export function deletePattern(id: string): boolean {
  ensurePatternLibraryTable();
  const result = getDb()
    .prepare('DELETE FROM pattern_library WHERE id = ?')
    .run(id);
  return result.changes > 0;
}

// ── Search ───────────────────────────────────────────────────────────────────

export function searchPatterns(params: PatternSearchParams): ImplementationPattern[] {
  ensurePatternLibraryTable();
  const db = getDb();

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.moduleId) {
    conditions.push('module_id = ?');
    values.push(params.moduleId);
  }

  if (params.category) {
    conditions.push('category = ?');
    values.push(params.category);
  }

  if (params.minSuccessRate !== undefined) {
    conditions.push('success_rate >= ?');
    values.push(params.minSuccessRate);
  }

  if (params.query) {
    conditions.push('(title LIKE ? OR description LIKE ? OR tags LIKE ? OR approach LIKE ?)');
    const q = `%${params.query}%`;
    values.push(q, q, q, q);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Pinned + verified always lead each tie-break; user's sortBy is the inner key.
  let inner: string;
  switch (params.sortBy) {
    case 'usage': inner = 'session_count DESC'; break;
    case 'recent': inner = 'last_success_at DESC'; break;
    case 'duration': inner = 'avg_duration_ms ASC'; break;
    default: inner = 'success_rate DESC, session_count DESC';
  }
  const orderBy = `pinned DESC, verified DESC, ${inner}`;

  const rows = db
    .prepare(`SELECT * FROM pattern_library ${where} ORDER BY ${orderBy} LIMIT 50`)
    .all(...values) as PatternRow[];

  return rows.map(rowToPattern);
}

// ── Curation: author / verify / pin / edit ──────────────────────────────────

/** Slugify a string for use in a pattern ID. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'pattern';
}

/**
 * Insert a human-authored pattern. Authored patterns start with verified=true
 * and source='authored' — a human is on the line for them, so they outrank
 * mined entries in suggestion ordering.
 */
export function authorPattern(input: PatternAuthorInput): ImplementationPattern {
  ensurePatternLibraryTable();
  const now = new Date().toISOString();
  const id = `authored--${input.moduleId}--${slugify(input.title)}--${Date.now().toString(36)}`;
  const pattern: ImplementationPattern = {
    id,
    title: input.title,
    moduleId: input.moduleId,
    category: input.category,
    tags: input.tags ?? [],
    description: input.description,
    approach: input.approach,
    successRate: 0,
    sessionCount: 0,
    projectCount: 0,
    avgDurationMs: 0,
    confidence: 'experimental',
    involvedClasses: input.involvedClasses ?? [],
    pitfalls: input.pitfalls ?? [],
    examplePrompt: input.examplePrompt,
    firstSeenAt: now,
    lastSuccessAt: now,
    source: 'authored',
    verified: true,
    pinned: false,
    verifiedAt: now,
    verifiedBy: input.authoredBy,
    authoredBy: input.authoredBy,
  };
  upsertPattern(pattern);
  return pattern;
}

/** Flip the verified flag on a pattern. */
export function setPatternVerified(
  id: string,
  verified: boolean,
  verifiedBy?: string,
): ImplementationPattern | null {
  ensurePatternLibraryTable();
  const db = getDb();
  const result = db.prepare(`
    UPDATE pattern_library
       SET verified = ?,
           verified_at = ?,
           verified_by = ?,
           updated_at = datetime('now')
     WHERE id = ?
  `).run(
    verified ? 1 : 0,
    verified ? new Date().toISOString() : null,
    verified ? (verifiedBy ?? null) : null,
    id,
  );
  if (result.changes === 0) return null;
  return getPattern(id);
}

/** Pin/unpin a pattern as the canonical one for its module. */
export function setPatternPinned(id: string, pinned: boolean): ImplementationPattern | null {
  ensurePatternLibraryTable();
  const db = getDb();
  const result = db.prepare(`
    UPDATE pattern_library
       SET pinned = ?,
           updated_at = datetime('now')
     WHERE id = ?
  `).run(pinned ? 1 : 0, id);
  if (result.changes === 0) return null;
  return getPattern(id);
}

/**
 * Patch curated text fields (title/description/category/tags/approach/classes/pitfalls/examplePrompt).
 * No-op for fields not present in the patch.
 */
export function updatePatternMeta(
  id: string,
  patch: PatternMetaPatch,
): ImplementationPattern | null {
  ensurePatternLibraryTable();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) { sets.push('title = ?'); values.push(patch.title); }
  if (patch.description !== undefined) { sets.push('description = ?'); values.push(patch.description); }
  if (patch.category !== undefined) { sets.push('category = ?'); values.push(patch.category); }
  if (patch.approach !== undefined) { sets.push('approach = ?'); values.push(patch.approach); }
  if (patch.tags !== undefined) { sets.push('tags = ?'); values.push(JSON.stringify(patch.tags)); }
  if (patch.involvedClasses !== undefined) {
    sets.push('involved_classes = ?'); values.push(JSON.stringify(patch.involvedClasses));
  }
  if (patch.pitfalls !== undefined) {
    sets.push('pitfalls = ?'); values.push(JSON.stringify(patch.pitfalls));
  }
  if (patch.examplePrompt !== undefined) {
    sets.push('example_prompt = ?'); values.push(patch.examplePrompt || null);
  }
  if (sets.length === 0) return getPattern(id);

  sets.push(`updated_at = datetime('now')`);
  values.push(id);

  const result = getDb()
    .prepare(`UPDATE pattern_library SET ${sets.join(', ')} WHERE id = ?`)
    .run(...values);
  if (result.changes === 0) return null;
  return getPattern(id);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export function getPatternDashboard(): PatternLibraryDashboard {
  ensurePatternLibraryTable();
  const patterns = getAllPatterns();

  const totalSessions = patterns.reduce((s, p) => s + p.sessionCount, 0);
  const avgSuccessRate = patterns.length > 0
    ? patterns.reduce((s, p) => s + p.successRate, 0) / patterns.length
    : 0;

  // Top modules by pattern count
  const moduleCounts = new Map<string, number>();
  const categoryCounts = new Map<PatternCategory, number>();
  for (const p of patterns) {
    moduleCounts.set(p.moduleId, (moduleCounts.get(p.moduleId) ?? 0) + 1);
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }

  const topModules = [...moduleCounts.entries()]
    .map(([moduleId, patternCount]) => ({ moduleId: moduleId as SubModuleId, patternCount }))
    .sort((a, b) => b.patternCount - a.patternCount)
    .slice(0, 10);

  const categories = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    patterns,
    totalPatterns: patterns.length,
    totalSessions,
    avgSuccessRate,
    topModules,
    categories,
  };
}

// ── Suggestion engine ────────────────────────────────────────────────────────

export function suggestPatterns(
  moduleId: SubModuleId,
  checklistLabel?: string,
): PatternSuggestion[] {
  const patterns = getPatternsByModule(moduleId);
  if (patterns.length === 0) return [];

  // Global avg duration for time savings comparison
  const globalAvg = patterns.reduce((s, p) => s + p.avgDurationMs, 0) / patterns.length;

  const suggestions: PatternSuggestion[] = [];

  for (const pattern of patterns) {
    let relevance = 0;
    let reason = '';

    // Human curation outranks mining: pinned > verified > everything else.
    // The bonuses are large enough that a pinned/verified pattern beats a
    // mined one even if the mined one has marginally higher success rate.
    if (pattern.pinned) {
      relevance += 60;
      reason += 'Pinned as canonical. ';
    } else if (pattern.verified) {
      relevance += 40;
      reason += 'Human-verified. ';
    }

    // Authored patterns get a small additional nudge over comparable mined ones.
    if (pattern.source === 'authored') {
      relevance += 5;
    }

    // Base relevance from success rate
    relevance += Math.round(pattern.successRate * 40);

    // Session count confidence bonus
    relevance += Math.min(20, pattern.sessionCount * 2);

    // Project diversity bonus
    if (pattern.projectCount > 1) {
      relevance += Math.min(20, pattern.projectCount * 5);
      reason += `Proven across ${pattern.projectCount} projects. `;
    }

    // Checklist label keyword matching
    if (checklistLabel) {
      const label = checklistLabel.toLowerCase();
      const titleMatch = pattern.title.toLowerCase();
      const tagMatch = pattern.tags.some((t) => label.includes(t.toLowerCase()));
      if (titleMatch.split(' ').some((w) => label.includes(w) && w.length > 3)) {
        relevance += 20;
        reason += 'Title matches your task. ';
      } else if (tagMatch) {
        relevance += 10;
        reason += 'Tags match your task. ';
      }
    }

    // Success rate badge
    if (pattern.successRate >= 0.8) {
      reason += `${Math.round(pattern.successRate * 100)}% success rate. `;
    }

    // Curated entries always make the cut; mined ones still need a signal.
    if (relevance < 20 && !pattern.verified && !pattern.pinned) continue;

    suggestions.push({
      pattern,
      relevance: Math.min(100, relevance),
      reason: reason.trim(),
      timeSavingsMs: Math.round(globalAvg - pattern.avgDurationMs),
    });
  }

  return suggestions
    .sort((a, b) => {
      // Hard precedence: pinned > verified > relevance score
      if (a.pattern.pinned !== b.pattern.pinned) return a.pattern.pinned ? -1 : 1;
      if (a.pattern.verified !== b.pattern.verified) return a.pattern.verified ? -1 : 1;
      return b.relevance - a.relevance;
    })
    .slice(0, 5);
}

// ══════════════════════════════════════════════════════════════════════════════
// Anti-Pattern Storage & Detection
// ══════════════════════════════════════════════════════════════════════════════

export function ensureAntiPatternTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS anti_patterns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      module_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      tags TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      approach TEXT NOT NULL DEFAULT '',
      failure_rate REAL NOT NULL DEFAULT 0,
      session_count INTEGER NOT NULL DEFAULT 0,
      severity TEXT NOT NULL DEFAULT 'medium',
      trigger_keywords TEXT NOT NULL DEFAULT '[]',
      alternative_json TEXT,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_failed_at TEXT NOT NULL DEFAULT (datetime('now')),
      example_prompt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_anti_patterns_module
    ON anti_patterns(module_id)
  `);
}

// ── Row mapping ──

function rowToAntiPattern(row: AntiPatternRow): AntiPattern {
  return {
    id: row.id,
    title: row.title,
    moduleId: row.module_id as SubModuleId,
    category: row.category as PatternCategory,
    tags: safeParse<string[]>(row.tags, []),
    description: row.description,
    approach: row.approach,
    failureRate: row.failure_rate,
    sessionCount: row.session_count,
    severity: row.severity as AntiPatternSeverity,
    triggerKeywords: safeParse<string[]>(row.trigger_keywords, []),
    alternative: row.alternative_json ? safeParse<AntiPattern['alternative']>(row.alternative_json, undefined) : undefined,
    firstSeenAt: row.first_seen_at,
    lastFailedAt: row.last_failed_at,
    examplePrompt: row.example_prompt ?? undefined,
  };
}

// ── CRUD ──

export function upsertAntiPattern(ap: AntiPattern): void {
  ensureAntiPatternTable();
  const db = getDb();

  db.prepare(`
    INSERT INTO anti_patterns
      (id, title, module_id, category, tags, description, approach,
       failure_rate, session_count, severity, trigger_keywords,
       alternative_json, first_seen_at, last_failed_at, example_prompt, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      failure_rate = excluded.failure_rate,
      session_count = excluded.session_count,
      severity = excluded.severity,
      trigger_keywords = excluded.trigger_keywords,
      alternative_json = excluded.alternative_json,
      last_failed_at = excluded.last_failed_at,
      example_prompt = excluded.example_prompt,
      updated_at = datetime('now')
  `).run(
    ap.id,
    ap.title,
    ap.moduleId,
    ap.category,
    JSON.stringify(ap.tags),
    ap.description,
    ap.approach,
    ap.failureRate,
    ap.sessionCount,
    ap.severity,
    JSON.stringify(ap.triggerKeywords),
    ap.alternative ? JSON.stringify(ap.alternative) : null,
    ap.firstSeenAt,
    ap.lastFailedAt,
    ap.examplePrompt ?? null,
  );
}

export function getAllAntiPatterns(): AntiPattern[] {
  ensureAntiPatternTable();
  const rows = getDb()
    .prepare('SELECT * FROM anti_patterns ORDER BY failure_rate DESC, session_count DESC')
    .all() as AntiPatternRow[];
  return rows.map(rowToAntiPattern);
}

export function getAntiPatternsByModule(moduleId: SubModuleId): AntiPattern[] {
  ensureAntiPatternTable();
  const rows = getDb()
    .prepare('SELECT * FROM anti_patterns WHERE module_id = ? ORDER BY failure_rate DESC')
    .all(moduleId) as AntiPatternRow[];
  return rows.map(rowToAntiPattern);
}

// ── Prompt matching — check if a prompt triggers any anti-pattern ──

export function checkPromptForAntiPatterns(
  prompt: string,
  moduleId?: SubModuleId,
): AntiPatternWarning[] {
  const antiPatterns = moduleId
    ? getAntiPatternsByModule(moduleId)
    : getAllAntiPatterns();

  if (antiPatterns.length === 0) return [];

  const lower = prompt.toLowerCase();
  // Tokenize into whole words so a keyword matches a complete word only. Unanchored
  // `includes` let "state" match inside "stateful" and "cast" inside "broadcast", firing
  // scary false anti-pattern warnings on unrelated prompts and eroding trust in the guardrail.
  const promptWords = new Set(lower.split(/[^a-z0-9]+/).filter(Boolean));
  const warnings: AntiPatternWarning[] = [];

  for (const ap of antiPatterns) {
    // Whole-word matches, and require at least two distinct keyword hits so a single generic
    // token can't drive a blocking-style "this approach failed 85% — switch?" warning.
    const matchedKeywords = ap.triggerKeywords.filter((kw) => promptWords.has(kw.toLowerCase()));
    if (matchedKeywords.length < 2) continue;

    const matchScore = Math.min(100, Math.round((matchedKeywords.length / Math.max(1, ap.triggerKeywords.length)) * 100));
    if (matchScore < 30) continue;

    const failPct = Math.round(ap.failureRate * 100);
    let message = `This approach failed ${failPct}% of the time in ${ap.moduleId} (${ap.sessionCount} sessions).`;

    if (ap.alternative) {
      const altPct = Math.round(ap.alternative.successRate * 100);
      message += ` The ${ap.alternative.approach} approach succeeds ${altPct}% — switch to it?`;
    }

    warnings.push({ antiPattern: ap, matchScore, message });
  }

  return warnings.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
}
