import { getDb } from '@/lib/db';
import type { SubModuleId } from '@/types/modules';
import type {
  PromptVariant,
  ABTest,
  ABTestStatus,
  VariantStyle,
  MutationType,
} from '@/types/prompt-evolution';

/**
 * SQLite persistence for the prompt-evolution engine.
 *
 * The engine used to keep variants and A/B tests in module-scoped `Map`s, so a
 * server restart silently wiped every experiment. These two tables make the
 * lineage + test results durable so the version timeline (parent/mutation
 * lineage, compare-any-two, rollback) survives restarts.
 */

// ── Schema bootstrap ─────────────────────────────────────────────────────────

export function ensurePromptEvolutionTables(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_variants (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      checklist_item_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      origin TEXT NOT NULL DEFAULT 'default',
      style TEXT NOT NULL DEFAULT 'descriptive',
      parent_id TEXT,
      mutation_type TEXT,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_variants_item
    ON prompt_variants(module_id, checklist_item_id)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_ab_tests (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      checklist_item_id TEXT NOT NULL,
      variant_a_id TEXT NOT NULL,
      variant_b_id TEXT NOT NULL,
      variant_a_trials INTEGER NOT NULL DEFAULT 0,
      variant_b_trials INTEGER NOT NULL DEFAULT 0,
      variant_a_successes INTEGER NOT NULL DEFAULT 0,
      variant_b_successes INTEGER NOT NULL DEFAULT 0,
      variant_a_total_duration_ms INTEGER NOT NULL DEFAULT 0,
      variant_b_total_duration_ms INTEGER NOT NULL DEFAULT 0,
      min_trials INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'running',
      winner_id TEXT,
      confidence REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      concluded_at TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompt_ab_tests_item
    ON prompt_ab_tests(module_id, checklist_item_id)
  `);
}

// ── Row mapping ──────────────────────────────────────────────────────────────

interface VariantRow {
  id: string;
  module_id: string;
  checklist_item_id: string;
  label: string;
  prompt: string;
  origin: string;
  style: string;
  parent_id: string | null;
  mutation_type: string | null;
  active: number;
  created_at: string;
}

function rowToVariant(row: VariantRow): PromptVariant {
  return {
    id: row.id,
    moduleId: row.module_id as SubModuleId,
    checklistItemId: row.checklist_item_id,
    label: row.label,
    prompt: row.prompt,
    origin: row.origin as PromptVariant['origin'],
    style: row.style as VariantStyle,
    parentId: row.parent_id,
    mutationType: (row.mutation_type as MutationType) ?? undefined,
    active: !!row.active,
    createdAt: row.created_at,
  };
}

interface ABTestRow {
  id: string;
  module_id: string;
  checklist_item_id: string;
  variant_a_id: string;
  variant_b_id: string;
  variant_a_trials: number;
  variant_b_trials: number;
  variant_a_successes: number;
  variant_b_successes: number;
  variant_a_total_duration_ms: number;
  variant_b_total_duration_ms: number;
  min_trials: number;
  status: string;
  winner_id: string | null;
  confidence: number;
  created_at: string;
  concluded_at: string | null;
}

function rowToABTest(row: ABTestRow): ABTest {
  return {
    id: row.id,
    moduleId: row.module_id as SubModuleId,
    checklistItemId: row.checklist_item_id,
    variantAId: row.variant_a_id,
    variantBId: row.variant_b_id,
    variantATrials: row.variant_a_trials,
    variantBTrials: row.variant_b_trials,
    variantASuccesses: row.variant_a_successes,
    variantBSuccesses: row.variant_b_successes,
    variantATotalDurationMs: row.variant_a_total_duration_ms,
    variantBTotalDurationMs: row.variant_b_total_duration_ms,
    minTrials: row.min_trials,
    status: row.status as ABTestStatus,
    winnerId: row.winner_id,
    confidence: row.confidence,
    createdAt: row.created_at,
    concludedAt: row.concluded_at,
  };
}

// ── Variant CRUD ─────────────────────────────────────────────────────────────

export function insertVariant(variant: PromptVariant): void {
  ensurePromptEvolutionTables();
  getDb().prepare(`
    INSERT INTO prompt_variants
      (id, module_id, checklist_item_id, label, prompt, origin, style,
       parent_id, mutation_type, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    variant.id,
    variant.moduleId,
    variant.checklistItemId,
    variant.label,
    variant.prompt,
    variant.origin,
    variant.style,
    variant.parentId,
    variant.mutationType ?? null,
    variant.active ? 1 : 0,
    variant.createdAt,
  );
}

export function getVariantById(id: string): PromptVariant | null {
  ensurePromptEvolutionTables();
  const row = getDb()
    .prepare('SELECT * FROM prompt_variants WHERE id = ?')
    .get(id) as VariantRow | undefined;
  return row ? rowToVariant(row) : null;
}

export function getVariantsForItem(moduleId: SubModuleId, checklistItemId: string): PromptVariant[] {
  ensurePromptEvolutionTables();
  const rows = getDb()
    .prepare('SELECT * FROM prompt_variants WHERE module_id = ? AND checklist_item_id = ? ORDER BY created_at ASC')
    .all(moduleId, checklistItemId) as VariantRow[];
  return rows.map(rowToVariant);
}

export function getVariantsForModule(moduleId: SubModuleId): PromptVariant[] {
  ensurePromptEvolutionTables();
  const rows = getDb()
    .prepare('SELECT * FROM prompt_variants WHERE module_id = ? ORDER BY created_at ASC')
    .all(moduleId) as VariantRow[];
  return rows.map(rowToVariant);
}

export function getAllVariants(): PromptVariant[] {
  ensurePromptEvolutionTables();
  const rows = getDb()
    .prepare('SELECT * FROM prompt_variants ORDER BY created_at ASC')
    .all() as VariantRow[];
  return rows.map(rowToVariant);
}

/** True if a checklist item already has an active version. */
export function hasActiveVariant(moduleId: SubModuleId, checklistItemId: string): boolean {
  ensurePromptEvolutionTables();
  const row = getDb()
    .prepare('SELECT 1 FROM prompt_variants WHERE module_id = ? AND checklist_item_id = ? AND active = 1 LIMIT 1')
    .get(moduleId, checklistItemId) as { 1: number } | undefined;
  return !!row;
}

/**
 * Make `variantId` the single active version for its checklist item — the
 * rollback / restore primitive. Clears the flag on every sibling atomically.
 */
export function setActiveVariant(moduleId: SubModuleId, checklistItemId: string, variantId: string): void {
  ensurePromptEvolutionTables();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('UPDATE prompt_variants SET active = 0 WHERE module_id = ? AND checklist_item_id = ?')
      .run(moduleId, checklistItemId);
    db.prepare('UPDATE prompt_variants SET active = 1 WHERE id = ?').run(variantId);
  });
  tx();
}

// ── A/B test CRUD ────────────────────────────────────────────────────────────

/** Insert or replace an A/B test row (the engine recomputes the whole record). */
export function upsertABTest(test: ABTest): void {
  ensurePromptEvolutionTables();
  getDb().prepare(`
    INSERT INTO prompt_ab_tests
      (id, module_id, checklist_item_id, variant_a_id, variant_b_id,
       variant_a_trials, variant_b_trials, variant_a_successes, variant_b_successes,
       variant_a_total_duration_ms, variant_b_total_duration_ms, min_trials,
       status, winner_id, confidence, created_at, concluded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      variant_a_trials = excluded.variant_a_trials,
      variant_b_trials = excluded.variant_b_trials,
      variant_a_successes = excluded.variant_a_successes,
      variant_b_successes = excluded.variant_b_successes,
      variant_a_total_duration_ms = excluded.variant_a_total_duration_ms,
      variant_b_total_duration_ms = excluded.variant_b_total_duration_ms,
      status = excluded.status,
      winner_id = excluded.winner_id,
      confidence = excluded.confidence,
      concluded_at = excluded.concluded_at
  `).run(
    test.id,
    test.moduleId,
    test.checklistItemId,
    test.variantAId,
    test.variantBId,
    test.variantATrials,
    test.variantBTrials,
    test.variantASuccesses,
    test.variantBSuccesses,
    test.variantATotalDurationMs,
    test.variantBTotalDurationMs,
    test.minTrials,
    test.status,
    test.winnerId,
    test.confidence,
    test.createdAt,
    test.concludedAt,
  );
}

export function getABTestById(id: string): ABTest | null {
  ensurePromptEvolutionTables();
  const row = getDb()
    .prepare('SELECT * FROM prompt_ab_tests WHERE id = ?')
    .get(id) as ABTestRow | undefined;
  return row ? rowToABTest(row) : null;
}

/**
 * Atomically record one A/B trial: increment the chosen variant's counters in SQL
 * (`x = x + 1`, never a JS read-modify-write off a stale snapshot — that loses
 * concurrent trials and skews which variant is declared the winner), then re-read the
 * fresh row, evaluate it, and persist the verdict, all inside one transaction so
 * nothing can interleave. `evaluate` is injected by the engine to avoid a circular import.
 */
export function recordTrialAndEvaluate(
  testId: string,
  variantSlot: 'A' | 'B',
  success: boolean,
  durationMs: number,
  evaluate: (test: ABTest) => ABTest,
): ABTest | null {
  ensurePromptEvolutionTables();
  const db = getDb();
  // Column names come from a fixed A/B branch — no user input in the SQL identifiers.
  const cols = variantSlot === 'A'
    ? { trials: 'variant_a_trials', successes: 'variant_a_successes', duration: 'variant_a_total_duration_ms' }
    : { trials: 'variant_b_trials', successes: 'variant_b_successes', duration: 'variant_b_total_duration_ms' };
  const tx = db.transaction((): ABTest | null => {
    const current = getABTestById(testId);
    if (!current || current.status !== 'running') return null;
    db.prepare(
      `UPDATE prompt_ab_tests
         SET ${cols.trials} = ${cols.trials} + 1,
             ${cols.successes} = ${cols.successes} + ?,
             ${cols.duration} = ${cols.duration} + ?
       WHERE id = ?`,
    ).run(success ? 1 : 0, durationMs, testId);
    const fresh = getABTestById(testId);
    if (!fresh) return null;
    const evaluated = evaluate(fresh);
    upsertABTest(evaluated);
    return evaluated;
  });
  return tx();
}

export function getAllABTests(): ABTest[] {
  ensurePromptEvolutionTables();
  const rows = getDb()
    .prepare('SELECT * FROM prompt_ab_tests ORDER BY created_at ASC')
    .all() as ABTestRow[];
  return rows.map(rowToABTest);
}

export function getABTestsForItem(moduleId: SubModuleId, checklistItemId: string): ABTest[] {
  ensurePromptEvolutionTables();
  const rows = getDb()
    .prepare('SELECT * FROM prompt_ab_tests WHERE module_id = ? AND checklist_item_id = ? ORDER BY created_at ASC')
    .all(moduleId, checklistItemId) as ABTestRow[];
  return rows.map(rowToABTest);
}
