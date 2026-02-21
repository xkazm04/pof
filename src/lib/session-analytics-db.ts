import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import type {
  SessionRecord,
  ModuleStats,
  PromptInsight,
  PromptQualityScore,
  PromptSuggestion,
  AnalyticsDashboard,
} from '@/types/session-analytics';

// ── Schema bootstrap ──

export function ensureSessionAnalyticsTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      session_key TEXT NOT NULL,
      prompt TEXT NOT NULL,
      prompt_preview TEXT NOT NULL,
      had_project_context INTEGER NOT NULL DEFAULT 0,
      prompt_length INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Index for fast module queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_session_analytics_module
    ON session_analytics(module_id)
  `);
}

// ── Row mapping ──

function rowToRecord(row: Record<string, unknown>): SessionRecord {
  return {
    id: row.id as number,
    moduleId: row.module_id as SubModuleId,
    sessionKey: row.session_key as string,
    prompt: row.prompt as string,
    promptPreview: row.prompt_preview as string,
    hadProjectContext: (row.had_project_context as number) === 1,
    promptLength: row.prompt_length as number,
    success: (row.success as number) === 1,
    durationMs: row.duration_ms as number,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string,
  };
}

// ── CRUD ──

export function recordSession(data: {
  moduleId: SubModuleId;
  sessionKey: string;
  prompt: string;
  hadProjectContext: boolean;
  success: boolean;
  durationMs: number;
  startedAt: string;
  completedAt: string;
}): SessionRecord {
  ensureSessionAnalyticsTable();
  const db = getDb();

  const preview = data.prompt.slice(0, 80).replace(/\n/g, ' ');

  const result = db.prepare(`
    INSERT INTO session_analytics
      (module_id, session_key, prompt, prompt_preview, had_project_context, prompt_length, success, duration_ms, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.moduleId,
    data.sessionKey,
    data.prompt,
    preview,
    data.hadProjectContext ? 1 : 0,
    data.prompt.length,
    data.success ? 1 : 0,
    data.durationMs,
    data.startedAt,
    data.completedAt,
  );

  const record = getRecord(result.lastInsertRowid as number);
  if (!record) {
    throw new Error(`Failed to retrieve session_analytics record after INSERT (rowid=${result.lastInsertRowid})`);
  }
  return record;
}

export function getRecord(id: number): SessionRecord | null {
  ensureSessionAnalyticsTable();
  const row = getDb()
    .prepare('SELECT * FROM session_analytics WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : null;
}

export function getRecentSessions(limit: number = 20): SessionRecord[] {
  ensureSessionAnalyticsTable();
  const rows = getDb()
    .prepare('SELECT * FROM session_analytics ORDER BY completed_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function getModuleSessions(moduleId: SubModuleId): SessionRecord[] {
  ensureSessionAnalyticsTable();
  const rows = getDb()
    .prepare('SELECT * FROM session_analytics WHERE module_id = ? ORDER BY completed_at DESC')
    .all(moduleId) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

// ── Analytics: Module Stats ──

interface RawModuleStatsRow {
  module_id: string;
  total: number;
  success_count: number;
  avg_duration: number | null;
  avg_success_duration: number | null;
  avg_fail_duration: number | null;
  ctx_count: number;
  ctx_success_count: number;
  no_ctx_count: number;
  no_ctx_success_count: number;
  avg_success_prompt_len: number | null;
  avg_fail_prompt_len: number | null;
}

const MODULE_STATS_SQL = `
  SELECT
    module_id,
    COUNT(*) AS total,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success_count,
    AVG(duration_ms) AS avg_duration,
    AVG(CASE WHEN success = 1 THEN duration_ms END) AS avg_success_duration,
    AVG(CASE WHEN success = 0 THEN duration_ms END) AS avg_fail_duration,
    SUM(CASE WHEN had_project_context = 1 THEN 1 ELSE 0 END) AS ctx_count,
    SUM(CASE WHEN had_project_context = 1 AND success = 1 THEN 1 ELSE 0 END) AS ctx_success_count,
    SUM(CASE WHEN had_project_context = 0 THEN 1 ELSE 0 END) AS no_ctx_count,
    SUM(CASE WHEN had_project_context = 0 AND success = 1 THEN 1 ELSE 0 END) AS no_ctx_success_count,
    AVG(CASE WHEN success = 1 THEN prompt_length END) AS avg_success_prompt_len,
    AVG(CASE WHEN success = 0 THEN prompt_length END) AS avg_fail_prompt_len
  FROM session_analytics
`;

function rowToModuleStats(r: RawModuleStatsRow): ModuleStats {
  const total = r.total;
  const successCount = r.success_count;
  const failCount = total - successCount;
  const ctxCount = r.ctx_count;
  const ctxSuccessCount = r.ctx_success_count;
  const noCtxCount = r.no_ctx_count;
  const noCtxSuccessCount = r.no_ctx_success_count;

  return {
    moduleId: r.module_id as SubModuleId,
    totalSessions: total,
    successCount,
    failCount,
    successRate: total > 0 ? successCount / total : 0,
    avgDurationMs: r.avg_duration ?? 0,
    avgSuccessDurationMs: r.avg_success_duration ?? 0,
    avgFailDurationMs: r.avg_fail_duration ?? 0,
    contextInjectedCount: ctxCount,
    contextInjectedSuccessRate: ctxCount > 0 ? ctxSuccessCount / ctxCount : 0,
    noContextCount: noCtxCount,
    noContextSuccessRate: noCtxCount > 0 ? noCtxSuccessCount / noCtxCount : 0,
  };
}

export function getModuleStats(moduleId: SubModuleId): ModuleStats {
  ensureSessionAnalyticsTable();
  const row = getDb()
    .prepare(MODULE_STATS_SQL + ' WHERE module_id = ?')
    .get(moduleId) as RawModuleStatsRow | undefined;

  if (!row || row.total === 0) {
    return {
      moduleId,
      totalSessions: 0, successCount: 0, failCount: 0, successRate: 0,
      avgDurationMs: 0, avgSuccessDurationMs: 0, avgFailDurationMs: 0,
      contextInjectedCount: 0, contextInjectedSuccessRate: 0,
      noContextCount: 0, noContextSuccessRate: 0,
    };
  }

  return rowToModuleStats(row);
}

/** Returns stats for all modules in a single query (no N+1). */
export function getAllModuleStats(): ModuleStats[] {
  ensureSessionAnalyticsTable();
  const rows = getDb()
    .prepare(MODULE_STATS_SQL + ' GROUP BY module_id')
    .all() as RawModuleStatsRow[];

  return rows.map(rowToModuleStats);
}

/** Raw row also carries prompt-length averages for insights/suggestions. */
function getModuleStatsRaw(moduleId: SubModuleId): RawModuleStatsRow | null {
  ensureSessionAnalyticsTable();
  const row = getDb()
    .prepare(MODULE_STATS_SQL + ' WHERE module_id = ?')
    .get(moduleId) as RawModuleStatsRow | undefined;
  return row && row.total > 0 ? row : null;
}

// ── Analytics: Prompt Quality Score ──

export function getPromptQualityScore(moduleId: SubModuleId): PromptQualityScore {
  ensureSessionAnalyticsTable();
  const db = getDb();

  const allRows = db.prepare(
    'SELECT success FROM session_analytics WHERE module_id = ? ORDER BY completed_at DESC'
  ).all(moduleId) as { success: number }[];

  const total = allRows.length;
  if (total === 0) {
    return { moduleId, score: 0, trend: 'stable', recentSuccessRate: 0, overallSuccessRate: 0, sessionsRecorded: 0 };
  }

  const overallSuccess = allRows.filter((r) => r.success === 1).length / total;
  const recent = allRows.slice(0, Math.min(10, total));
  const recentSuccess = recent.filter((r) => r.success === 1).length / recent.length;

  // Older window for trend comparison
  const older = allRows.slice(10, Math.min(20, total));
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (older.length >= 5) {
    const olderRate = older.filter((r) => r.success === 1).length / older.length;
    const diff = recentSuccess - olderRate;
    if (diff > 0.15) trend = 'improving';
    else if (diff < -0.15) trend = 'declining';
  }

  // Score: weighted blend of recent (70%) and overall (30%), scaled to 0-100
  const score = Math.round((recentSuccess * 0.7 + overallSuccess * 0.3) * 100);

  return {
    moduleId,
    score,
    trend,
    recentSuccessRate: recentSuccess,
    overallSuccessRate: overallSuccess,
    sessionsRecorded: total,
  };
}

// ── Analytics: Pattern Insights ──

export function generateInsights(moduleId: SubModuleId): PromptInsight[] {
  const raw = getModuleStatsRaw(moduleId);
  if (!raw || raw.total < 5) return [];

  const stats = rowToModuleStats(raw);
  const insights: PromptInsight[] = [];

  // 1. Context injection insight
  if (stats.contextInjectedCount >= 3 && stats.noContextCount >= 3) {
    const ctxRate = stats.contextInjectedSuccessRate;
    const noCtxRate = stats.noContextSuccessRate;

    if (noCtxRate > 0 && ctxRate > noCtxRate) {
      const factor = Math.round((ctxRate / noCtxRate) * 10) / 10;
      if (factor >= 1.5) {
        insights.push({
          type: 'context-injection',
          moduleId,
          message: `Sessions with project context succeed ${factor}x more often`,
          factor,
          confidence: Math.min(1, (stats.contextInjectedCount + stats.noContextCount) / 20),
          suggestion: 'Add project context to your prompts for better results.',
        });
      }
    } else if (ctxRate === 0 && noCtxRate === 0) {
      // Both failing — different suggestion
    } else if (noCtxRate === 0 && ctxRate > 0) {
      insights.push({
        type: 'context-injection',
        moduleId,
        message: 'Sessions without context always fail for this module',
        factor: Infinity,
        confidence: Math.min(1, stats.noContextCount / 10),
        suggestion: 'Always include project context injection for this module.',
      });
    }
  }

  // 2. Prompt length insight (avg_success_prompt_len / avg_fail_prompt_len come from the single query)
  if (raw.avg_success_prompt_len && raw.avg_fail_prompt_len && stats.successCount >= 3 && stats.failCount >= 3) {
    const successLen = raw.avg_success_prompt_len;
    const failLen = raw.avg_fail_prompt_len;
    const ratio = successLen / failLen;

    if (ratio > 1.5) {
      insights.push({
        type: 'prompt-length',
        moduleId,
        message: `Successful prompts are ${Math.round(ratio * 10) / 10}x longer on average`,
        factor: ratio,
        confidence: Math.min(1, stats.totalSessions / 20),
        suggestion: `Try adding more detail to your prompts (avg success: ${Math.round(successLen)} chars vs avg fail: ${Math.round(failLen)} chars).`,
      });
    } else if (ratio < 0.67) {
      insights.push({
        type: 'prompt-length',
        moduleId,
        message: `Shorter, focused prompts succeed more often`,
        factor: Math.round((1 / ratio) * 10) / 10,
        confidence: Math.min(1, stats.totalSessions / 20),
        suggestion: `Keep prompts concise (avg success: ${Math.round(successLen)} chars vs avg fail: ${Math.round(failLen)} chars).`,
      });
    }
  }

  // 3. Module success rate insight
  if (stats.successRate < 0.4 && stats.totalSessions >= 10) {
    insights.push({
      type: 'module-success-rate',
      moduleId,
      message: `This module has a low success rate (${Math.round(stats.successRate * 100)}%)`,
      factor: stats.successRate,
      confidence: Math.min(1, stats.totalSessions / 20),
      suggestion: 'Consider breaking complex tasks into smaller steps, or adding more context.',
    });
  }

  // 4. Speed insight — successful sessions that take too long
  if (stats.avgSuccessDurationMs > 120000 && stats.successCount >= 5) {
    insights.push({
      type: 'time-of-day',
      moduleId,
      message: `Successful tasks average ${Math.round(stats.avgSuccessDurationMs / 1000)}s — context injection could speed this up`,
      factor: stats.avgSuccessDurationMs / 60000,
      confidence: Math.min(1, stats.successCount / 15),
      suggestion: 'Inject project context to reduce exploration time.',
    });
  }

  return insights;
}

// ── Prompt Suggestions (before sending) ──

export function getPromptSuggestions(moduleId: SubModuleId, prompt: string): PromptSuggestion[] {
  const raw = getModuleStatsRaw(moduleId);
  if (!raw || raw.total < 5) return [];

  const stats = rowToModuleStats(raw);
  const suggestions: PromptSuggestion[] = [];

  // 1. Suggest context injection if prompt lacks it
  const hasContext = prompt.includes('## Project Context') || prompt.includes('## Build Command');
  if (!hasContext && stats.contextInjectedSuccessRate > stats.noContextSuccessRate && stats.contextInjectedCount >= 3) {
    const factor = stats.noContextSuccessRate > 0
      ? Math.round((stats.contextInjectedSuccessRate / stats.noContextSuccessRate) * 10) / 10
      : 0;
    const factorStr = factor > 0 ? ` (${factor}x success rate improvement)` : '';
    suggestions.push({
      type: 'add-context',
      message: `Add project context for ${moduleId}${factorStr}`,
      confidence: Math.min(1, stats.totalSessions / 20),
    });
  }

  // 2. Prompt length suggestion (avg_success_prompt_len comes from the single query)
  if (raw.avg_success_prompt_len) {
    const idealLen = raw.avg_success_prompt_len;
    if (prompt.length < idealLen * 0.4 && stats.successCount >= 5) {
      suggestions.push({
        type: 'lengthen',
        message: `Successful prompts for this module average ${Math.round(idealLen)} chars — consider adding more detail`,
        confidence: Math.min(1, stats.successCount / 15),
      });
    } else if (prompt.length > idealLen * 3 && stats.successCount >= 5) {
      suggestions.push({
        type: 'shorten',
        message: `This prompt is much longer than typical successful prompts (${Math.round(idealLen)} chars avg)`,
        confidence: Math.min(1, stats.successCount / 15),
      });
    }
  }

  // 3. Module-specific tip for low success rate
  if (stats.successRate < 0.4 && stats.totalSessions >= 10) {
    suggestions.push({
      type: 'module-tip',
      message: `${moduleId} has ${Math.round(stats.successRate * 100)}% success rate — try breaking into smaller tasks`,
      confidence: Math.min(1, stats.totalSessions / 20),
    });
  }

  return suggestions;
}

// ── Full Dashboard ──

export function getDashboard(): AnalyticsDashboard {
  ensureSessionAnalyticsTable();

  // Single GROUP BY query returns all per-module stats + prompt-length averages
  const moduleStats = getAllModuleStats();

  // Derive global totals from per-module stats (avoids 3 extra queries)
  const totalSessions = moduleStats.reduce((s, m) => s + m.totalSessions, 0);
  const totalSuccess = moduleStats.reduce((s, m) => s + m.successCount, 0);
  const totalDurationMs = moduleStats.reduce((s, m) => s + m.avgDurationMs * m.totalSessions, 0);

  const moduleIds = moduleStats.map((m) => m.moduleId);
  const insights: PromptInsight[] = [];
  const qualityScores: PromptQualityScore[] = [];
  for (const mid of moduleIds) {
    insights.push(...generateInsights(mid));
    qualityScores.push(getPromptQualityScore(mid));
  }

  // Sort insights by confidence * factor descending
  insights.sort((a, b) => {
    const aScore = a.confidence * (isFinite(a.factor) ? a.factor : 10);
    const bScore = b.confidence * (isFinite(b.factor) ? b.factor : 10);
    return bScore - aScore;
  });

  const recentSessions = getRecentSessions(15);

  return {
    totalSessions,
    overallSuccessRate: totalSessions > 0 ? totalSuccess / totalSessions : 0,
    totalDurationMs,
    moduleStats,
    insights,
    qualityScores: qualityScores.sort((a, b) => b.score - a.score),
    recentSessions,
  };
}

// ── Session count per module (for threshold checks) ──

export function getSessionCount(moduleId: SubModuleId): number {
  ensureSessionAnalyticsTable();
  const row = getDb()
    .prepare('SELECT COUNT(*) as cnt FROM session_analytics WHERE module_id = ?')
    .get(moduleId) as { cnt: number };
  return row.cnt;
}
