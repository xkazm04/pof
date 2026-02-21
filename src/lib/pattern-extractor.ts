import { getDb } from './db';
import type { SubModuleId } from '@/types/modules';
import { ensureSessionAnalyticsTable } from './session-analytics-db';
import { ensurePatternLibraryTable, upsertPattern, ensureAntiPatternTable, upsertAntiPattern, getPatternsByModule } from './pattern-library-db';
import { MODULE_FEATURE_DEFINITIONS } from './feature-definitions';
import type { ImplementationPattern, PatternCategory, PatternConfidence, AntiPattern, AntiPatternSeverity } from '@/types/pattern-library';
import type { ExtractedEntity, StructuredInsight } from '@/types/structured-insights';

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

// ── Class name extraction ────────────────────────────────────────────────────

const UE_CLASS_REGEX = /\b([AUF][A-Z][A-Za-z0-9]+(?:Component|Controller|Character|Base|Instance|System|Subsystem|Widget|Effect|Ability|Set|Asset|Manager|Volume)?)\b/g;

function extractClasses(text: string): string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  UE_CLASS_REGEX.lastIndex = 0;
  while ((match = UE_CLASS_REGEX.exec(text)) !== null) {
    // Filter out common false positives
    const name = match[1];
    if (name.length >= 4 && !['ANSI', 'ASCII', 'ATTR', 'AUTO', 'UPROPERTY', 'UFUNCTION', 'UCLASS', 'USTRUCT', 'UENUM', 'UMETA', 'FORCEINLINE'].includes(name)) {
      matches.add(name);
    }
  }
  return [...matches].slice(0, 15);
}

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

const MODULE_LABELS: Record<string, string> = {
  'arpg-character': 'Character',
  'arpg-animation': 'Animation',
  'arpg-gas': 'GAS',
  'arpg-combat': 'Combat',
  'arpg-enemy-ai': 'Enemy AI',
  'arpg-inventory': 'Inventory',
  'arpg-loot': 'Loot',
  'arpg-ui': 'UI/HUD',
  'arpg-progression': 'Progression',
  'arpg-world': 'World',
  'arpg-save': 'Save System',
  'arpg-polish': 'Polish',
  'ai-behavior': 'AI Behavior',
  'dialogue-quests': 'Dialogue',
};

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
  ensureSessionAnalyticsTable();
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
  ensureSessionAnalyticsTable();
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

    // Cluster failed prompts by approach
    const failClusters = new Map<string, SessionRow[]>();
    for (const session of failed) {
      const approach = detectApproach(session.prompt);
      const existing = failClusters.get(approach) ?? [];
      existing.push(session);
      failClusters.set(approach, existing);
    }

    for (const [approach, cluster] of failClusters) {
      if (cluster.length < 2) continue;

      // Calculate failure rate for this approach across all sessions
      const approachSessions = sessions.filter((s) => detectApproach(s.prompt) === approach);
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
// Structured Entity Extraction — extracts rich entities from CLI response text
// ══════════════════════════════════════════════════════════════════════════════

// ── DB table ─────────────────────────────────────────────────────────────────

export function ensureStructuredInsightsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS structured_insights (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
      entities_json TEXT NOT NULL DEFAULT '[]',
      class_hierarchy_json TEXT NOT NULL DEFAULT '[]',
      steps_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      file_paths_json TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_structured_insights_session
    ON structured_insights(session_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_structured_insights_module
    ON structured_insights(module_id)
  `);
}

// ── Class hierarchy extraction ───────────────────────────────────────────────

// Matches patterns like "AMyClass : public ACharacter" or "AMyClass extends ABase"
const INHERITANCE_REGEX = /\b([AUF][A-Z][A-Za-z0-9]+)\s*(?::\s*(?:public|protected|private)\s+|extends\s+)([AUF][A-Z][A-Za-z0-9]+)\b/g;

function extractClassHierarchy(text: string): { name: string; parent?: string }[] {
  const hierarchy = new Map<string, string | undefined>();

  // First pass: find explicit inheritance
  INHERITANCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INHERITANCE_REGEX.exec(text)) !== null) {
    hierarchy.set(match[1], match[2]);
  }

  // Second pass: collect standalone class names not yet in hierarchy
  const allClasses = extractClasses(text);
  for (const cls of allClasses) {
    if (!hierarchy.has(cls)) {
      hierarchy.set(cls, undefined);
    }
  }

  return Array.from(hierarchy.entries())
    .map(([name, parent]) => ({ name, parent }))
    .slice(0, 20);
}

// ── Implementation step extraction ───────────────────────────────────────────

// Matches numbered step patterns: "1. Create...", "Step 1:", "- First, ..."
const STEP_PATTERNS = [
  /(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\n\n|$)/g,           // "1. Do thing"
  /(?:^|\n)\s*(?:Step|Phase)\s+(\d+)[:.]\s*(.+?)(?=\n|$)/gi,     // "Step 1: Do thing"
];

const COMPLEXITY_HIGH_KEYWORDS = ['complex', 'difficult', 'advanced', 'extensive', 'significant', 'refactor', 'rewrite', 'redesign'];
const COMPLEXITY_LOW_KEYWORDS = ['simple', 'easy', 'basic', 'trivial', 'quick', 'minor', 'small', 'just'];

function estimateStepComplexity(text: string): 'low' | 'medium' | 'high' {
  const lower = text.toLowerCase();
  if (COMPLEXITY_HIGH_KEYWORDS.some((kw) => lower.includes(kw))) return 'high';
  if (COMPLEXITY_LOW_KEYWORDS.some((kw) => lower.includes(kw))) return 'low';
  // Longer descriptions tend to be more complex
  if (text.length > 200) return 'high';
  if (text.length < 60) return 'low';
  return 'medium';
}

function extractSteps(text: string): { order: number; description: string; complexity: 'low' | 'medium' | 'high' }[] {
  const steps: { order: number; description: string; complexity: 'low' | 'medium' | 'high' }[] = [];
  const seen = new Set<string>();

  for (const pattern of STEP_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const order = parseInt(match[1], 10);
      const description = match[2].trim().replace(/\*\*/g, '');
      const key = description.slice(0, 50).toLowerCase();
      if (!seen.has(key) && description.length > 5) {
        seen.add(key);
        steps.push({ order, description, complexity: estimateStepComplexity(description) });
      }
    }
  }

  return steps.sort((a, b) => a.order - b.order).slice(0, 15);
}

// ── Warning/caveat extraction ────────────────────────────────────────────────

const WARNING_PATTERNS = [
  /(?:⚠️|Warning|WARN|Caution|Note|Important|Be careful|Watch out|Caveat)[:\s]+(.+?)(?=\n\n|\n(?:⚠️|Warning|WARN|Caution|Note|Important|\d+\.)|\n$|$)/gi,
  /\*\*(?:Warning|Note|Important|Caution)\*\*[:\s]+(.+?)(?=\n\n|$)/gi,
];

function extractWarnings(text: string): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const pattern of WARNING_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const warning = match[1].trim().replace(/\*\*/g, '').slice(0, 300);
      const key = warning.slice(0, 40).toLowerCase();
      if (warning.length > 10 && !seen.has(key)) {
        seen.add(key);
        warnings.push(warning);
      }
    }
  }

  return warnings.slice(0, 10);
}

// ── File path extraction ─────────────────────────────────────────────────────

const FILE_PATH_REGEX = /(?:Source\/|Private\/|Public\/|Content\/)[\w/.-]+\.\w{1,5}/g;
const HEADER_INCLUDE_REGEX = /#include\s+["<]([\w/.-]+\.h)[">]/g;

function extractFilePaths(text: string): string[] {
  const paths = new Set<string>();

  FILE_PATH_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_PATH_REGEX.exec(text)) !== null) {
    paths.add(match[0]);
  }

  HEADER_INCLUDE_REGEX.lastIndex = 0;
  while ((match = HEADER_INCLUDE_REGEX.exec(text)) !== null) {
    paths.add(match[1]);
  }

  return [...paths].slice(0, 20);
}

// ── Concept keyword extraction ───────────────────────────────────────────────

const UE_CONCEPTS = [
  'Gameplay Ability System', 'GAS', 'Behavior Tree', 'EQS', 'NavMesh',
  'Enhanced Input', 'Replication', 'RPC', 'GameplayEffect', 'GameplayCue',
  'Data Table', 'Data Asset', 'Subsystem', 'Blueprint', 'Widget',
  'Animation Blueprint', 'Montage', 'Blend Space', 'State Machine',
  'Collision Channel', 'Object Pool', 'Instanced Static Mesh',
  'Niagara', 'Material Instance', 'Post Process', 'Level Streaming',
  'World Partition', 'Gameplay Tag', 'Slate', 'UMG',
];

function extractConcepts(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const concept of UE_CONCEPTS) {
    if (lower.includes(concept.toLowerCase())) {
      found.push(concept);
    }
  }
  return found.slice(0, 10);
}

// ── Link entities to modules ─────────────────────────────────────────────────

function linkEntityToModule(entity: string): string | undefined {
  const lower = entity.toLowerCase();
  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      if (
        feat.featureName.toLowerCase().includes(lower) ||
        lower.includes(feat.featureName.toLowerCase()) ||
        feat.description.toLowerCase().includes(lower)
      ) {
        return moduleId;
      }
    }
  }
  return undefined;
}

// ── Main structured extraction ───────────────────────────────────────────────

export function extractStructuredEntities(
  text: string,
  moduleId: SubModuleId,
  sessionId: string
): StructuredInsight {
  const classHierarchy = extractClassHierarchy(text);
  const steps = extractSteps(text);
  const warnings = extractWarnings(text);
  const filePaths = extractFilePaths(text);
  const concepts = extractConcepts(text);

  // Build entity list
  const entities: ExtractedEntity[] = [];

  for (const cls of classHierarchy) {
    entities.push({
      type: 'class',
      value: cls.name,
      parent: cls.parent,
      moduleId: linkEntityToModule(cls.name) ?? moduleId,
    });
  }

  for (const step of steps) {
    entities.push({
      type: 'step',
      value: step.description,
      complexity: step.complexity,
      order: step.order,
      moduleId,
    });
  }

  for (const warning of warnings) {
    entities.push({ type: 'warning', value: warning, moduleId });
  }

  for (const fp of filePaths) {
    entities.push({ type: 'file', value: fp, moduleId });
  }

  for (const concept of concepts) {
    entities.push({
      type: 'concept',
      value: concept,
      moduleId: linkEntityToModule(concept) ?? moduleId,
    });
  }

  const id = `si-${sessionId}-${Date.now()}`;

  return {
    id,
    sessionId,
    moduleId,
    extractedAt: new Date().toISOString(),
    entities,
    classHierarchy,
    steps,
    warnings,
    filePaths,
  };
}

// ── Persist to DB ────────────────────────────────────────────────────────────

export function saveStructuredInsight(insight: StructuredInsight): void {
  ensureStructuredInsightsTable();
  const db = getDb();

  db.prepare(`
    INSERT OR REPLACE INTO structured_insights
      (id, session_id, module_id, extracted_at, entities_json, class_hierarchy_json, steps_json, warnings_json, file_paths_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    insight.id,
    insight.sessionId,
    insight.moduleId,
    insight.extractedAt,
    JSON.stringify(insight.entities),
    JSON.stringify(insight.classHierarchy),
    JSON.stringify(insight.steps),
    JSON.stringify(insight.warnings),
    JSON.stringify(insight.filePaths),
  );
}

// ── Query ────────────────────────────────────────────────────────────────────

export function getInsightsForSession(sessionId: string): StructuredInsight | null {
  ensureStructuredInsightsTable();
  const db = getDb();

  const row = db.prepare(
    'SELECT * FROM structured_insights WHERE session_id = ? ORDER BY extracted_at DESC LIMIT 1'
  ).get(sessionId) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    moduleId: row.module_id as string,
    extractedAt: row.extracted_at as string,
    entities: JSON.parse(row.entities_json as string),
    classHierarchy: JSON.parse(row.class_hierarchy_json as string),
    steps: JSON.parse(row.steps_json as string),
    warnings: JSON.parse(row.warnings_json as string),
    filePaths: JSON.parse(row.file_paths_json as string),
  };
}

export function getInsightsForModule(moduleId: SubModuleId): StructuredInsight[] {
  ensureStructuredInsightsTable();
  const db = getDb();

  const rows = db.prepare(
    'SELECT * FROM structured_insights WHERE module_id = ? ORDER BY extracted_at DESC LIMIT 20'
  ).all(moduleId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    moduleId: row.module_id as string,
    extractedAt: row.extracted_at as string,
    entities: JSON.parse(row.entities_json as string),
    classHierarchy: JSON.parse(row.class_hierarchy_json as string),
    steps: JSON.parse(row.steps_json as string),
    warnings: JSON.parse(row.warnings_json as string),
    filePaths: JSON.parse(row.file_paths_json as string),
  }));
}
