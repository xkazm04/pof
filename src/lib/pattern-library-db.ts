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

  db.prepare(`
    INSERT INTO pattern_library
      (id, title, module_id, category, tags, description, approach,
       success_rate, session_count, project_count, avg_duration_ms,
       confidence, involved_classes, pitfalls, example_prompt,
       first_seen_at, last_success_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      success_rate = excluded.success_rate,
      session_count = excluded.session_count,
      project_count = excluded.project_count,
      avg_duration_ms = excluded.avg_duration_ms,
      confidence = excluded.confidence,
      involved_classes = excluded.involved_classes,
      pitfalls = excluded.pitfalls,
      example_prompt = excluded.example_prompt,
      last_success_at = excluded.last_success_at,
      updated_at = datetime('now')
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
  );
}

export function getAllPatterns(): ImplementationPattern[] {
  ensurePatternLibraryTable();
  const rows = getDb()
    .prepare('SELECT * FROM pattern_library ORDER BY success_rate DESC, session_count DESC')
    .all() as PatternRow[];
  return rows.map(rowToPattern);
}

export function getPatternsByModule(moduleId: SubModuleId): ImplementationPattern[] {
  ensurePatternLibraryTable();
  const rows = getDb()
    .prepare('SELECT * FROM pattern_library WHERE module_id = ? ORDER BY success_rate DESC')
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

  let orderBy: string;
  switch (params.sortBy) {
    case 'usage': orderBy = 'session_count DESC'; break;
    case 'recent': orderBy = 'last_success_at DESC'; break;
    case 'duration': orderBy = 'avg_duration_ms ASC'; break;
    default: orderBy = 'success_rate DESC, session_count DESC';
  }

  const rows = db
    .prepare(`SELECT * FROM pattern_library ${where} ORDER BY ${orderBy} LIMIT 50`)
    .all(...values) as PatternRow[];

  return rows.map(rowToPattern);
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

    if (relevance < 20) continue;

    suggestions.push({
      pattern,
      relevance: Math.min(100, relevance),
      reason: reason.trim(),
      timeSavingsMs: Math.round(globalAvg - pattern.avgDurationMs),
    });
  }

  return suggestions
    .sort((a, b) => b.relevance - a.relevance)
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
  const warnings: AntiPatternWarning[] = [];

  for (const ap of antiPatterns) {
    // Score keyword matches
    const matchedKeywords = ap.triggerKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
    if (matchedKeywords.length === 0) continue;

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
