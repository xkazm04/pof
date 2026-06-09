import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import { ensurePatternLibraryTable, upsertPattern, ensureAntiPatternTable, upsertAntiPattern, getPatternsByModule } from './pattern-library-db';
import { MODULE_FEATURE_DEFINITIONS } from './feature-definitions';
import { MODULE_LABELS } from './module-registry';
import type { ImplementationPattern, PatternCategory, PatternConfidence, AntiPattern, AntiPatternSeverity } from '@/types/pattern-library';
import { extractClasses } from './structured-insights';

/**
 * Extracts reusable implementation patterns from successful CLI sessions.
 *
 * Mining strategy:
 * 1. Group sessions by module
 * 2. Cluster successful prompts by keyword overlap
 * 3. Extract class names, architectural patterns, and approaches
 * 4. Score by success rate, usage count, and project diversity
 * 5. Detect common pitfalls from failed sessions
 */

// ── Module → pattern category mapping ────────────────────────────────────────

const MODULE_PATTERN_CATEGORIES: Record<string, PatternCategory> = {
  'arpg-character': 'class-hierarchy',
  'arpg-animation': 'animation-setup',
  'arpg-gas': 'gas-integration',
  'arpg-combat': 'gas-integration',
  'arpg-enemy-ai': 'ai-behavior',
  'arpg-inventory': 'component-design',
  'arpg-loot': 'data-flow',
  'arpg-ui': 'ui-architecture',
  'arpg-progression': 'data-flow',
  'arpg-world': 'component-design',
  'arpg-save': 'save-system',
  'arpg-polish': 'optimization',
  'ai-behavior': 'ai-behavior',
  'dialogue-quests': 'state-machine',
};

// ── Approach detection ───────────────────────────────────────────────────────

const APPROACH_KEYWORDS: [string, string[]][] = [
  ['inheritance', ['subclass', 'extends', 'derive', 'base class', 'override', 'virtual']],
  ['composition', ['component', 'ActorComponent', 'add component', 'modular', 'plugin']],
  ['data-driven', ['data table', 'data asset', 'PrimaryDataAsset', 'curve table', 'FDataTableRow']],
  ['event-driven', ['delegate', 'event', 'broadcast', 'multicast', 'OnNotify', 'GameplayEvent']],
  ['state-machine', ['state machine', 'FSM', 'transition', 'state graph', 'behavior tree']],
  ['gas-ability', ['GameplayAbility', 'AbilityTask', 'GameplayEffect', 'GameplayCue', 'ASC']],
  ['montage-based', ['montage', 'PlayMontageAndWait', 'montage section', 'anim notify']],
  ['subsystem', ['Subsystem', 'GameInstanceSubsystem', 'WorldSubsystem', 'LocalPlayerSubsystem']],
];

function detectApproach(text: string): string {
  const lower = text.toLowerCase();
  let bestApproach = 'general';
  let bestScore = 0;

  for (const [approach, keywords] of APPROACH_KEYWORDS) {
    const score = keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestApproach = approach;
    }
  }

  return bestApproach;
}

// ── Pitfall extraction from failed sessions ──────────────────────────────────

function extractPitfalls(failedPrompts: string[]): string[] {
  const pitfalls: string[] = [];
  const lower = failedPrompts.map((p) => p.toLowerCase()).join(' ');

  if (lower.includes('compile') || lower.includes('build error') || lower.includes('linker')) {
    pitfalls.push('Build errors — check include paths and module dependencies');
  }
  if (lower.includes('crash') || lower.includes('nullptr') || lower.includes('null pointer')) {
    pitfalls.push('Null pointer crashes — verify component initialization order');
  }
  if (lower.includes('circular') || lower.includes('dependency')) {
    pitfalls.push('Circular dependencies — use forward declarations and interfaces');
  }
  if (lower.includes('deadlock') || lower.includes('infinite loop') || lower.includes('stuck')) {
    pitfalls.push('State machine deadlocks — ensure all transitions have exit conditions');
  }
  if (lower.includes('replication') || lower.includes('net')) {
    pitfalls.push('Replication issues — mark properties as Replicated and use RPCs');
  }

  return pitfalls.slice(0, 5);
}

// ── Confidence calculation ───────────────────────────────────────────────────

function computeConfidence(sessionCount: number, projectCount: number, successRate: number): PatternConfidence {
  if (sessionCount >= 10 && projectCount >= 2 && successRate >= 0.7) return 'proven';
  if (sessionCount >= 5 && successRate >= 0.5) return 'promising';
  return 'experimental';
}

// ── Title generation ─────────────────────────────────────────────────────────

function generateTitle(moduleId: SubModuleId, approach: string, classes: string[]): string {
  const moduleLabel = MODULE_LABELS[moduleId] ?? moduleId;
  const approachLabel = APPROACH_LABELS[approach] ?? approach;

  if (classes.length > 0) {
    const keyClass = classes.find((c) => c.startsWith('A') || c.startsWith('U')) ?? classes[0];
    return `${moduleLabel}: ${keyClass} (${approachLabel})`;
  }

  return `${moduleLabel}: ${approachLabel} Pattern`;
}

// MODULE_LABELS is imported from module-registry (derived from SUB_MODULES) so
// labels have a single owner. APPROACH_LABELS is approach-specific, not a module
// list, so it stays local.
const APPROACH_LABELS: Record<string, string> = {
  'inheritance': 'Inheritance',
  'composition': 'Composition',
  'data-driven': 'Data-Driven',
  'event-driven': 'Event-Driven',
  'state-machine': 'State Machine',
  'gas-ability': 'GAS Ability',
  'montage-based': 'Montage-Based',
  'subsystem': 'Subsystem',
  'general': 'General',
};

// ── Session row type ─────────────────────────────────────────────────────────

interface SessionRow {
  module_id: string;
  prompt: string;
  success: number;
  duration_ms: number;
  completed_at: string;
}

// ── Main extraction function ─────────────────────────────────────────────────

export function extractPatterns(): { extracted: number; updated: number } {
  ensurePatternLibraryTable();
  const db = getDb();

  // Get all sessions grouped by module
  const modules = db.prepare(
    'SELECT DISTINCT module_id FROM session_analytics'
  ).all() as { module_id: string }[];

  let extracted = 0;
  let updated = 0;

  for (const { module_id: moduleId } of modules) {
    const sessions = db.prepare(
      'SELECT module_id, prompt, success, duration_ms, completed_at FROM session_analytics WHERE module_id = ? ORDER BY completed_at DESC'
    ).all(moduleId) as SessionRow[];

    if (sessions.length < 3) continue;

    const successful = sessions.filter((s) => s.success === 1);
    const failed = sessions.filter((s) => s.success === 0);

    if (successful.length === 0) continue;

    // Cluster successful prompts by approach
    const approachClusters = new Map<string, SessionRow[]>();
    for (const session of successful) {
      const approach = detectApproach(session.prompt);
      const existing = approachClusters.get(approach) ?? [];
      existing.push(session);
      approachClusters.set(approach, existing);
    }

    for (const [approach, cluster] of approachClusters) {
      if (cluster.length < 2) continue;

      // Extract pattern data from cluster
      const allPromptText = cluster.map((s) => s.prompt).join('\n');
      const classes = extractClasses(allPromptText);
      const pitfalls = extractPitfalls(failed.map((s) => s.prompt));

      const successRate = successful.length / sessions.length;
      const avgDuration = Math.round(cluster.reduce((s, c) => s + c.duration_ms, 0) / cluster.length);
      const confidence = computeConfidence(cluster.length, 1, successRate);

      const patternId = `${moduleId}--${approach}`;
      const category = MODULE_PATTERN_CATEGORIES[moduleId] ?? 'general';

      // Generate description from feature definitions
      const features = MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? [];
      const featureNames = features.map((f) => f.featureName).join(', ');
      const description = `Implementation pattern for ${MODULE_LABELS[moduleId] ?? moduleId} using ${APPROACH_LABELS[approach] ?? approach} approach. `
        + `Covers: ${featureNames || 'general module functionality'}. `
        + `Based on ${cluster.length} successful sessions with ${Math.round(successRate * 100)}% success rate.`;

      // Tags from feature definitions + approach
      const tags = [
        approach,
        moduleId,
        ...classes.slice(0, 5).map((c) => c.toLowerCase()),
        ...(features ?? []).slice(0, 3).map((f) => f.category.toLowerCase()),
      ];

      const pattern: ImplementationPattern = {
        id: patternId,
        title: generateTitle(moduleId as SubModuleId, approach, classes),
        moduleId: moduleId as SubModuleId,
        category,
        tags: [...new Set(tags)],
        description,
        approach,
        successRate,
        sessionCount: cluster.length,
        projectCount: 1,
        avgDurationMs: avgDuration,
        confidence,
        involvedClasses: classes,
        pitfalls,
        firstSeenAt: cluster[cluster.length - 1].completed_at,
        lastSuccessAt: cluster[0].completed_at,
        examplePrompt: cluster[0].prompt.slice(0, 500),
        source: 'mined',
        verified: false,
        pinned: false,
      };

      // Check if this is an update or new
      const existing = db.prepare('SELECT id FROM pattern_library WHERE id = ?').get(patternId);
      upsertPattern(pattern);

      if (existing) updated++;
      else extracted++;
    }
  }

  // Also seed patterns from feature definitions for modules with no sessions
  const seeded = seedPatternsFromDefinitions();
  extracted += seeded;

  return { extracted, updated };
}

// ── Seed patterns from feature definitions ───────────────────────────────────

function seedPatternsFromDefinitions(): number {
  const db = getDb();
  let seeded = 0;

  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    // Group features by category
    const categoryGroups = new Map<string, typeof features>();
    for (const feat of features) {
      const existing = categoryGroups.get(feat.category) ?? [];
      existing.push(feat);
      categoryGroups.set(feat.category, existing);
    }

    for (const [category, feats] of categoryGroups) {
      const patternId = `${moduleId}--seed--${category.toLowerCase().replace(/\s+/g, '-')}`;

      // Skip if already exists
      const existing = db.prepare('SELECT id FROM pattern_library WHERE id = ?').get(patternId);
      if (existing) continue;

      const classes = extractClasses(feats.map((f) => f.description).join(' '));
      const approach = detectApproach(feats.map((f) => f.description).join(' '));
      const moduleCategory = MODULE_PATTERN_CATEGORIES[moduleId] ?? 'general';

      const pattern: ImplementationPattern = {
        id: patternId,
        title: `${MODULE_LABELS[moduleId] ?? moduleId}: ${category}`,
        moduleId: moduleId as SubModuleId,
        category: moduleCategory,
        tags: [approach, moduleId, category.toLowerCase(), ...classes.slice(0, 3).map((c) => c.toLowerCase())],
        description: feats.map((f) => `**${f.featureName}**: ${f.description}`).join('\n'),
        approach,
        successRate: 0,
        sessionCount: 0,
        projectCount: 0,
        avgDurationMs: 0,
        confidence: 'experimental',
        involvedClasses: classes,
        pitfalls: [],
        firstSeenAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        source: 'mined',
        verified: false,
        pinned: false,
      };

      upsertPattern(pattern);
      seeded++;
    }
  }

  return seeded;
}

// ══════════════════════════════════════════════════════════════════════════════
// Anti-Pattern Extraction — mines failed sessions for approaches to avoid
// ══════════════════════════════════════════════════════════════════════════════

function computeSeverity(failureRate: number, sessionCount: number): AntiPatternSeverity {
  if (failureRate >= 0.8 && sessionCount >= 5) return 'critical';
  if (failureRate >= 0.6 && sessionCount >= 3) return 'high';
  return 'medium';
}

function extractTriggerKeywords(prompts: string[], approach: string): string[] {
  const keywords = new Set<string>();

  // Always include the approach itself
  const approachKw = APPROACH_KEYWORDS.find(([a]) => a === approach);
  if (approachKw) {
    for (const kw of approachKw[1]) {
      keywords.add(kw.toLowerCase());
    }
  }

  // Extract commonly-repeated words from failed prompts (3+ chars, appears in >50% of prompts)
  const wordCounts = new Map<string, number>();
  for (const prompt of prompts) {
    const words = new Set(prompt.toLowerCase().split(/\s+/).filter((w) => w.length >= 4));
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.floor(prompts.length * 0.5));
  for (const [word, count] of wordCounts) {
    if (count >= threshold && !['implement', 'create', 'build', 'make', 'should', 'using', 'with', 'that', 'this', 'from', 'have', 'been'].includes(word)) {
      keywords.add(word);
    }
  }

  return [...keywords].slice(0, 15);
}

/**
 * Extracts anti-patterns from sessions with high failure rates.
 * Inverts the normal pattern extraction: mines failed sessions
 * and labels them as approaches to avoid.
 */
export function extractAntiPatterns(): { extracted: number; updated: number } {
  ensureAntiPatternTable();
  const db = getDb();

  const modules = db.prepare(
    'SELECT DISTINCT module_id FROM session_analytics'
  ).all() as { module_id: string }[];

  let extracted = 0;
  let updated = 0;

  for (const { module_id: moduleId } of modules) {
    const sessions = db.prepare(
      'SELECT module_id, prompt, success, duration_ms, completed_at FROM session_analytics WHERE module_id = ? ORDER BY completed_at DESC'
    ).all(moduleId) as SessionRow[];

    if (sessions.length < 5) continue;

    const failed = sessions.filter((s) => s.success === 0);
    const successful = sessions.filter((s) => s.success === 1);

    if (failed.length < 3) continue;

    // Classify every session's approach exactly once, then reuse the map for
    // both the failure clustering and the per-approach failure-rate filter
    // below (otherwise detectApproach re-scans every session per cluster).
    const approachOf = new Map<SessionRow, string>();
    for (const session of sessions) {
      approachOf.set(session, detectApproach(session.prompt));
    }

    // Cluster failed prompts by approach
    const failClusters = new Map<string, SessionRow[]>();
    for (const session of failed) {
      const approach = approachOf.get(session)!;
      const existing = failClusters.get(approach) ?? [];
      existing.push(session);
      failClusters.set(approach, existing);
    }

    for (const [approach, cluster] of failClusters) {
      if (cluster.length < 2) continue;

      // Calculate failure rate for this approach across all sessions
      const approachSessions = sessions.filter((s) => approachOf.get(s) === approach);
      const approachFailed = approachSessions.filter((s) => s.success === 0);
      const failureRate = approachFailed.length / approachSessions.length;

      // Only flag as anti-pattern if failure rate is above 70%
      if (failureRate < 0.7) continue;

      const antiPatternId = `anti--${moduleId}--${approach}`;
      const category = MODULE_PATTERN_CATEGORIES[moduleId] ?? 'general';
      const severity = computeSeverity(failureRate, cluster.length);

      const allFailedText = cluster.map((s) => s.prompt).join('\n');
      const triggerKeywords = extractTriggerKeywords(cluster.map((s) => s.prompt), approach);

      // Find the best successful alternative pattern for this module
      const successPatterns = getPatternsByModule(moduleId as SubModuleId);
      const bestAlternative = successPatterns
        .filter((p) => p.approach !== approach && p.successRate >= 0.5 && p.sessionCount >= 2)
        .sort((a, b) => b.successRate - a.successRate)[0];

      const moduleLabel = MODULE_LABELS[moduleId] ?? moduleId;
      const approachLabel = APPROACH_LABELS[approach] ?? approach;

      const description = `The ${approachLabel} approach for ${moduleLabel} fails ${Math.round(failureRate * 100)}% of the time. `
        + `Based on ${cluster.length} failed sessions out of ${approachSessions.length} total sessions using this approach.`
        + (bestAlternative
          ? ` Consider using the ${APPROACH_LABELS[bestAlternative.approach] ?? bestAlternative.approach} approach instead (${Math.round(bestAlternative.successRate * 100)}% success rate).`
          : '');

      const ap: AntiPattern = {
        id: antiPatternId,
        title: `${approachLabel} in ${moduleLabel}`,
        moduleId: moduleId as SubModuleId,
        category,
        tags: [approach, moduleId, 'anti-pattern', ...triggerKeywords.slice(0, 3)],
        description,
        approach,
        failureRate,
        sessionCount: cluster.length,
        severity,
        triggerKeywords,
        alternative: bestAlternative
          ? {
              approach: bestAlternative.approach,
              successRate: bestAlternative.successRate,
              title: bestAlternative.title,
              examplePrompt: bestAlternative.examplePrompt,
            }
          : undefined,
        firstSeenAt: cluster[cluster.length - 1].completed_at,
        lastFailedAt: cluster[0].completed_at,
        examplePrompt: cluster[0].prompt.slice(0, 500),
      };

      const existing = db.prepare('SELECT id FROM anti_patterns WHERE id = ?').get(antiPatternId);
      upsertAntiPattern(ap);

      if (existing) updated++;
      else extracted++;
    }
  }

  return { extracted, updated };
}

// ══════════════════════════════════════════════════════════════════════════════
// Structured Entity Extraction has moved to `structured-insights.ts`.
// Re-exported here for backward compatibility with existing importers.
// ══════════════════════════════════════════════════════════════════════════════

export { extractStructuredEntities } from './structured-insights';
