import type { SubModuleId } from '@/types/modules';
import type {
  PromptVariant,
  ABTest,
  TemplateFamily,
  EvolutionStats,
  ModuleEvolutionStats,
  EvolutionSuggestion,
  VariantStyle,
  MutationType,
  PromptOptimizationResult,
  PromptOptimizationDiff,
  VariantStats,
  VariantVersionEntry,
  VariantLineageNode,
  VariantVersionHistory,
} from '@/types/prompt-evolution';
import type { SessionRecord, ModuleStats } from '@/types/session-analytics';
import { applyMutation, classifyStyle } from './mutations';
import { clusterPrompts, getBestCluster } from './clustering';
import { createABTest, evaluateTest } from './ab-testing';
import {
  insertVariant,
  getVariantById,
  getVariantsForItem as getVariantsForItemDb,
  getVariantsForModule as getVariantsForModuleDb,
  getAllVariants as getAllVariantsDb,
  hasActiveVariant,
  setActiveVariant,
  upsertABTest,
  getABTestById,
  getAllABTests,
  getABTestsForItem,
} from './evolution-db';

// ── Persistence ─────────────────────────────────────────────────────────────
// Variants and A/B tests live in SQLite (see ./evolution-db) so experiments
// survive a server restart. Template families are cheap derived data that we
// keep in-memory and rebuild on demand.

const templateFamilies = new Map<string, TemplateFamily>();

// ── Variant management ──────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createVariant(
  moduleId: SubModuleId,
  checklistItemId: string,
  prompt: string,
  origin: PromptVariant['origin'] = 'default',
  parentId: string | null = null,
  mutationType?: MutationType,
): PromptVariant {
  const style = classifyStyle(prompt);
  // The first version authored for a checklist item becomes the active/current
  // one; later mutations don't steal "current" until the user restores them.
  const active = !hasActiveVariant(moduleId, checklistItemId);
  const variant: PromptVariant = {
    id: genId('var'),
    moduleId,
    checklistItemId,
    label: `${origin} variant (${style})`,
    prompt,
    origin,
    style,
    parentId,
    mutationType,
    active,
    createdAt: new Date().toISOString(),
  };
  insertVariant(variant);
  return variant;
}

export function getVariant(id: string): PromptVariant | null {
  return getVariantById(id);
}

export function getVariantsForItem(moduleId: SubModuleId, checklistItemId: string): PromptVariant[] {
  return getVariantsForItemDb(moduleId, checklistItemId);
}

export function getVariantsForModule(moduleId: SubModuleId): PromptVariant[] {
  return getVariantsForModuleDb(moduleId);
}

export function getAllVariants(): PromptVariant[] {
  return getAllVariantsDb();
}

// ── Version history & rollback ───────────────────────────────────────────────

/** Aggregate a variant's A/B performance across every test it joined. */
function computeVariantStats(variantId: string, tests: ABTest[]): VariantStats {
  let trials = 0;
  let successes = 0;
  let wins = 0;
  let testCount = 0;
  for (const t of tests) {
    if (t.variantAId === variantId) {
      trials += t.variantATrials;
      successes += t.variantASuccesses;
      testCount++;
      if (t.winnerId === variantId) wins++;
    } else if (t.variantBId === variantId) {
      trials += t.variantBTrials;
      successes += t.variantBSuccesses;
      testCount++;
      if (t.winnerId === variantId) wins++;
    }
  }
  return {
    variantId,
    trials,
    successes,
    successRate: trials > 0 ? successes / trials : 0,
    wins,
    testCount,
  };
}

/**
 * Build the version timeline for one checklist item: a flat list of versions
 * (each annotated with A/B success rate) plus the lineage forest formed by
 * `parentId` links so the UI can render a tech-tree of mutations.
 */
export function getVersionHistory(
  moduleId: SubModuleId,
  checklistItemId: string,
): VariantVersionHistory {
  const variantList = getVariantsForItemDb(moduleId, checklistItemId);
  const tests = getABTestsForItem(moduleId, checklistItemId);

  const versions: VariantVersionEntry[] = variantList.map((v) => ({
    variant: v,
    stats: computeVariantStats(v.id, tests),
    isActive: v.active,
  }));

  // Build the lineage forest. A version is a root when it has no parent, or its
  // parent lives outside this checklist item (defensive — shouldn't happen).
  const nodes = new Map<string, VariantLineageNode>();
  for (const entry of versions) {
    nodes.set(entry.variant.id, { ...entry, children: [], depth: 0 });
  }
  const roots: VariantLineageNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.variant.parentId;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Assign depth + keep children/roots in chronological order.
  const byCreated = (a: VariantLineageNode, b: VariantLineageNode) =>
    a.variant.createdAt.localeCompare(b.variant.createdAt);
  const walk = (node: VariantLineageNode, depth: number) => {
    node.depth = depth;
    node.children.sort(byCreated);
    for (const child of node.children) walk(child, depth + 1);
  };
  roots.sort(byCreated);
  for (const root of roots) walk(root, 0);

  return {
    moduleId,
    checklistItemId,
    versions,
    roots,
    activeVariantId: versions.find((v) => v.isActive)?.variant.id ?? null,
  };
}

/**
 * Restore (roll back to) a previous version — makes it the active/current one
 * for its checklist item. Returns the updated variant, or null if not found.
 */
export function restoreVariant(variantId: string): PromptVariant | null {
  const variant = getVariantById(variantId);
  if (!variant) return null;
  setActiveVariant(variant.moduleId, variant.checklistItemId, variantId);
  return { ...variant, active: true };
}

// ── Mutation ────────────────────────────────────────────────────────────────

export function mutateVariant(variantId: string, mutation: MutationType): PromptVariant | null {
  const parent = getVariantById(variantId);
  if (!parent) return null;

  const result = applyMutation(parent.prompt, mutation);
  return createVariant(
    parent.moduleId,
    parent.checklistItemId,
    result.prompt,
    'mutation',
    parent.id,
    mutation,
  );
}

// ── A/B Testing ─────────────────────────────────────────────────────────────

export function startABTest(
  moduleId: SubModuleId,
  checklistItemId: string,
  variantAId: string,
  variantBId: string,
): ABTest {
  const test = createABTest(moduleId, checklistItemId, variantAId, variantBId);
  upsertABTest(test);
  return test;
}

export function getABTest(id: string): ABTest | null {
  return getABTestById(id);
}

export function getActiveTests(moduleId?: SubModuleId): ABTest[] {
  return getAllABTests().filter(
    (t) => t.status === 'running' && (!moduleId || t.moduleId === moduleId),
  );
}

export function getAllTests(): ABTest[] {
  return getAllABTests();
}

export function recordTestTrial(
  testId: string,
  variantSlot: 'A' | 'B',
  success: boolean,
  durationMs: number,
): ABTest | null {
  const test = getABTestById(testId);
  if (!test || test.status !== 'running') return null;

  const updated = {
    ...test,
    ...(variantSlot === 'A'
      ? {
          variantATrials: test.variantATrials + 1,
          variantASuccesses: test.variantASuccesses + (success ? 1 : 0),
          variantATotalDurationMs: test.variantATotalDurationMs + durationMs,
        }
      : {
          variantBTrials: test.variantBTrials + 1,
          variantBSuccesses: test.variantBSuccesses + (success ? 1 : 0),
          variantBTotalDurationMs: test.variantBTotalDurationMs + durationMs,
        }),
  };

  // Check if test should conclude
  const evaluated = evaluateTest(updated);
  upsertABTest(evaluated);
  return evaluated;
}

export function concludeTest(testId: string): ABTest | null {
  const test = getABTestById(testId);
  if (!test) return null;
  if (test.status === 'concluded') return test;

  const concluded: ABTest = {
    ...test,
    status: 'concluded',
    concludedAt: new Date().toISOString(),
  };

  // Determine winner even without statistical significance
  const rateA = test.variantATrials > 0 ? test.variantASuccesses / test.variantATrials : 0;
  const rateB = test.variantBTrials > 0 ? test.variantBSuccesses / test.variantBTrials : 0;
  concluded.winnerId = rateA >= rateB ? test.variantAId : test.variantBId;
  concluded.confidence = Math.min(0.7, (test.variantATrials + test.variantBTrials) / 20);

  upsertABTest(concluded);
  return concluded;
}

// ── Clustering ──────────────────────────────────────────────────────────────

export function clusterModulePrompts(sessions: SessionRecord[]) {
  return clusterPrompts(sessions);
}

// ── Template families ───────────────────────────────────────────────────────

export function buildTemplateFamilies(moduleId: SubModuleId): TemplateFamily[] {
  const moduleVariants = getVariantsForModule(moduleId);
  if (moduleVariants.length < 2) return [];

  // Group by checklistItemId
  const byItem = new Map<string, PromptVariant[]>();
  for (const v of moduleVariants) {
    const list = byItem.get(v.checklistItemId) ?? [];
    list.push(v);
    byItem.set(v.checklistItemId, list);
  }

  const families: TemplateFamily[] = [];
  for (const [itemId, itemVariants] of byItem) {
    if (itemVariants.length < 2) continue;

    // Group by style
    const byStyle = new Map<VariantStyle, PromptVariant[]>();
    for (const v of itemVariants) {
      const list = byStyle.get(v.style) ?? [];
      list.push(v);
      byStyle.set(v.style, list);
    }

    for (const [style, styleVariants] of byStyle) {
      if (styleVariants.length < 2) continue;

      const family: TemplateFamily = {
        id: genId('fam'),
        moduleId,
        label: `${itemId} — ${style}`,
        centroidVariantId: styleVariants[0].id, // First created is the centroid
        variantIds: styleVariants.map((v) => v.id),
        avgSuccessRate: 0, // Would need session data to compute
        avgDurationMs: 0,
        dominantStyle: style,
      };
      families.push(family);
      templateFamilies.set(family.id, family);
    }
  }

  return families;
}

// ── Best variant selection ──────────────────────────────────────────────────

/** Get the best-performing variant for a checklist item, based on A/B test results. */
export function getBestVariant(
  moduleId: SubModuleId,
  checklistItemId: string,
): PromptVariant | null {
  // Check concluded tests for winners
  const concluded = getAllABTests().filter(
    (t) => t.status === 'concluded' && t.moduleId === moduleId && t.checklistItemId === checklistItemId && t.winnerId,
  );

  if (concluded.length > 0) {
    // Most recent winner
    const latest = concluded.sort((a, b) =>
      (b.concludedAt ?? '').localeCompare(a.concludedAt ?? '')
    )[0];
    if (latest.winnerId) {
      return getVariant(latest.winnerId);
    }
  }

  return null;
}

// ── Suggestions ─────────────────────────────────────────────────────────────

export function generateSuggestions(
  moduleId: SubModuleId,
  sessions: SessionRecord[],
): EvolutionSuggestion[] {
  const suggestions: EvolutionSuggestion[] = [];
  const moduleVariants = getVariantsForModule(moduleId);
  const activeTests = getActiveTests(moduleId);

  // Suggest clustering if enough sessions
  if (sessions.length >= 10) {
    const clusters = clusterPrompts(sessions);
    const best = getBestCluster(clusters);
    if (best && best.successRate > 0.7) {
      suggestions.push({
        type: 'cluster-insight',
        moduleId,
        message: `Prompts with keywords "${best.keywords.slice(0, 3).join(', ')}" have ${Math.round(best.successRate * 100)}% success rate`,
        confidence: Math.min(1, best.sessionIds.length / 10),
      });
    }
  }

  // Suggest A/B test if variants exist but no active test
  if (moduleVariants.length >= 2 && activeTests.length === 0) {
    const byItem = new Map<string, PromptVariant[]>();
    for (const v of moduleVariants) {
      const list = byItem.get(v.checklistItemId) ?? [];
      list.push(v);
      byItem.set(v.checklistItemId, list);
    }

    for (const [itemId, itemVariants] of byItem) {
      if (itemVariants.length >= 2) {
        suggestions.push({
          type: 'start-ab-test',
          moduleId,
          checklistItemId: itemId,
          message: `${itemVariants.length} variants available for "${itemId}" — start A/B testing`,
          confidence: 0.7,
        });
        break; // One suggestion per module
      }
    }
  }

  // Suggest adopting winners from concluded tests
  const concluded = getAllABTests().filter(
    (t) => t.status === 'concluded' && t.moduleId === moduleId && t.winnerId,
  );
  for (const test of concluded) {
    const winner = test.winnerId ? getVariant(test.winnerId) : null;
    if (winner) {
      suggestions.push({
        type: 'adopt-winner',
        moduleId,
        checklistItemId: test.checklistItemId,
        message: `A/B test concluded: "${winner.label}" won with ${Math.round(test.confidence * 100)}% confidence`,
        variantId: winner.id,
        confidence: test.confidence,
      });
    }
  }

  return suggestions;
}

// ── Stats ───────────────────────────────────────────────────────────────────

export function getEvolutionStats(): EvolutionStats {
  const allVariants = getAllVariants();
  const allTests = getAllTests();
  const active = allTests.filter((t) => t.status === 'running');
  const concluded = allTests.filter((t) => t.status === 'concluded');

  // Per-module breakdown
  const moduleIds = new Set(allVariants.map((v) => v.moduleId));
  const moduleBreakdown: ModuleEvolutionStats[] = [];
  let totalImprovement = 0;
  let improvementCount = 0;

  for (const mid of moduleIds) {
    const modVariants = allVariants.filter((v) => v.moduleId === mid);
    const modActiveTests = active.filter((t) => t.moduleId === mid);
    const modConcluded = concluded.filter((t) => t.moduleId === mid);

    // Compute best/default success rates from concluded tests
    let bestRate = 0;
    let defaultRate = 0;
    for (const test of modConcluded) {
      const rateA = test.variantATrials > 0 ? test.variantASuccesses / test.variantATrials : 0;
      const rateB = test.variantBTrials > 0 ? test.variantBSuccesses / test.variantBTrials : 0;
      bestRate = Math.max(bestRate, rateA, rateB);
      defaultRate = Math.max(defaultRate, Math.min(rateA, rateB));
    }

    const improvement = bestRate - defaultRate;
    if (modConcluded.length > 0) {
      totalImprovement += improvement;
      improvementCount++;
    }

    moduleBreakdown.push({
      moduleId: mid,
      variants: modVariants.length,
      activeTests: modActiveTests.length,
      bestSuccessRate: bestRate,
      defaultSuccessRate: defaultRate,
      improvement,
    });
  }

  const topModule = moduleBreakdown.sort((a, b) => b.improvement - a.improvement)[0];

  return {
    totalVariants: allVariants.length,
    activeABTests: active.length,
    concludedABTests: concluded.length,
    templateFamilies: templateFamilies.size,
    avgImprovementRate: improvementCount > 0 ? totalImprovement / improvementCount : 0,
    topPerformingModule: topModule?.moduleId ?? null,
    moduleBreakdown,
  };
}

// ── Prompt Optimizer ─────────────────────────────────────────────────────────
// Analyzes historical session outcomes and applies learned patterns to rewrite
// prompts before submission. Returns a before/after diff so users learn what
// makes prompts effective.

/**
 * Optimize a user prompt based on historical analytics for this module.
 * Applies multiple heuristic passes based on what patterns correlate with success.
 */
export function optimizePrompt(
  prompt: string,
  moduleId: SubModuleId,
  sessions: SessionRecord[],
  moduleStats: ModuleStats,
): PromptOptimizationResult {
  const diffs: PromptOptimizationDiff[] = [];
  let optimized = prompt;
  const sampleSize = sessions.length;

  if (sampleSize < 3) {
    return { original: prompt, optimized: prompt, diffs: [], predictedImprovement: 0, sampleSize, wasModified: false };
  }

  // Separate successful and failed sessions
  const successes = sessions.filter((s) => s.success);
  const failures = sessions.filter((s) => !s.success);

  // ── Pass 1: Context injection ──────────────────────────────────────────
  const hasContext = prompt.includes('## Project Context') || prompt.includes('## Build Command');
  if (!hasContext) {
    const ctxRate = moduleStats.contextInjectedSuccessRate;
    const noCtxRate = moduleStats.noContextSuccessRate;
    if (moduleStats.contextInjectedCount >= 3 && ctxRate > noCtxRate && noCtxRate < 0.8) {
      const factor = noCtxRate > 0 ? Math.round((ctxRate / noCtxRate) * 10) / 10 : Infinity;
      if (factor >= 1.3 || noCtxRate === 0) {
        optimized = `IMPORTANT: Use the project context (module name, API macro, build command, project path) provided in the header above. Do not hardcode paths or module names.\n\n${optimized}`;
        diffs.push({
          type: 'add-context',
          description: 'Added project context reminder',
          reason: isFinite(factor)
            ? `Sessions with context succeed ${factor}x more often (${Math.round(ctxRate * 100)}% vs ${Math.round(noCtxRate * 100)}%)`
            : `Sessions without context always fail for this module`,
        });
      }
    }
  }

  // ── Pass 2: Prompt length optimization ─────────────────────────────────
  if (successes.length >= 3 && failures.length >= 3) {
    const avgSuccessLen = successes.reduce((s, r) => s + r.promptLength, 0) / successes.length;
    const avgFailLen = failures.reduce((s, r) => s + r.promptLength, 0) / failures.length;
    const taskText = extractTaskSection(optimized);

    // Successful prompts are significantly longer → lengthen short prompts
    if (avgSuccessLen > avgFailLen * 1.5 && taskText.length < avgSuccessLen * 0.4) {
      optimized = addSpecificityHints(optimized);
      diffs.push({
        type: 'lengthen',
        description: 'Added specificity hints',
        reason: `Successful prompts average ${Math.round(avgSuccessLen)} chars vs ${Math.round(avgFailLen)} for failures — your prompt is below the success threshold`,
      });
    }

    // Successful prompts are significantly shorter → shorten verbose prompts
    if (avgSuccessLen < avgFailLen * 0.67 && taskText.length > avgSuccessLen * 2.5) {
      const before = optimized;
      optimized = trimRedundancy(optimized);
      if (optimized !== before) {
        diffs.push({
          type: 'shorten',
          description: 'Trimmed redundant detail',
          reason: `Concise prompts succeed more often (avg success: ${Math.round(avgSuccessLen)} chars vs avg fail: ${Math.round(avgFailLen)} chars)`,
        });
      }
    }
  }

  // ── Pass 3: Style optimization from cluster analysis ───────────────────
  if (sessions.length >= 8) {
    const clusters = clusterPrompts(sessions);
    const bestCluster = getBestCluster(clusters);
    if (bestCluster && bestCluster.successRate > 0.7 && bestCluster.sessionIds.length >= 3) {
      const currentStyle = classifyStyle(prompt);
      // Determine the dominant style of the best cluster
      const clusterSessions = sessions.filter((s) => bestCluster.sessionIds.includes(s.id));
      const clusterStyles = clusterSessions.map((s) => classifyStyle(s.prompt));
      const styleCounts = new Map<VariantStyle, number>();
      for (const s of clusterStyles) {
        styleCounts.set(s, (styleCounts.get(s) ?? 0) + 1);
      }
      const dominantStyle = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

      if (dominantStyle && dominantStyle !== currentStyle) {
        // Apply the mutation that transforms to the dominant style
        const styleToMutation: Partial<Record<VariantStyle, MutationType>> = {
          'imperative': 'imperative-rewrite',
          'step-by-step': 'step-by-step',
          'holistic': 'holistic',
          'minimal': 'shorten',
          'example-rich': 'add-examples',
        };
        const mutation = styleToMutation[dominantStyle];
        if (mutation) {
          const result = applyMutation(optimized, mutation);
          optimized = result.prompt;
          diffs.push({
            type: 'restructure',
            description: `Restructured to ${dominantStyle} style`,
            reason: `"${dominantStyle}" prompts have ${Math.round(bestCluster.successRate * 100)}% success rate in this module (keywords: ${bestCluster.keywords.slice(0, 3).join(', ')})`,
          });
        }
      }
    }
  }

  // ── Pass 4: Verification step ──────────────────────────────────────────
  const hasVerify = /verify|compile|build.*success/i.test(prompt);
  if (!hasVerify && successes.length >= 3) {
    // Check if successful prompts tend to include verification
    const successWithVerify = successes.filter((s) => /verify|compile|build.*success/i.test(s.prompt)).length;
    const failWithVerify = failures.filter((s) => /verify|compile|build.*success/i.test(s.prompt)).length;
    const successVerifyRate = successes.length > 0 ? successWithVerify / successes.length : 0;
    const failVerifyRate = failures.length > 0 ? failWithVerify / failures.length : 0;

    if (successVerifyRate > failVerifyRate + 0.2 && successVerifyRate > 0.4) {
      optimized += '\n\nAfter creating all files, verify the build compiles successfully. Fix any errors before finishing.';
      diffs.push({
        type: 'add-verification',
        description: 'Added build verification step',
        reason: `${Math.round(successVerifyRate * 100)}% of successful prompts include verification vs ${Math.round(failVerifyRate * 100)}% of failures`,
      });
    }
  }

  // ── Pass 5: Imperative rewrite for low success modules ─────────────────
  if (moduleStats.successRate < 0.4 && moduleStats.totalSessions >= 10) {
    const isImperative = /^(you must|create|implement|build|add|generate|write)/im.test(prompt);
    if (!isImperative) {
      const imperativeSuccessRate = successes.filter((s) =>
        /^(you must|create|implement|build|add|generate|write)/im.test(s.prompt)
      ).length / Math.max(successes.length, 1);
      if (imperativeSuccessRate > moduleStats.successRate) {
        optimized = `You MUST complete this task fully. Do not ask for confirmation.\n\n${optimized}`;
        diffs.push({
          type: 'imperative-rewrite',
          description: 'Added imperative directive',
          reason: `Module has ${Math.round(moduleStats.successRate * 100)}% success rate — imperative prompts perform better`,
        });
      }
    }
  }

  // Calculate predicted improvement
  const predictedImprovement = estimateImprovement(diffs, moduleStats);

  return {
    original: prompt,
    optimized,
    diffs,
    predictedImprovement,
    sampleSize,
    wasModified: optimized !== prompt,
  };
}

// ── Helper: extract the task section from a prompt (after ## Task or entire prompt) ──

function extractTaskSection(prompt: string): string {
  const taskMatch = prompt.match(/## Task\s*\n([\s\S]*)/i);
  return taskMatch ? taskMatch[1] : prompt;
}

// ── Helper: add specificity hints to a short prompt ──

function addSpecificityHints(prompt: string): string {
  const hints: string[] = [];

  // Check if it mentions file types
  if (!/\.h\b|\.cpp\b|header|source/i.test(prompt)) {
    hints.push('Specify which .h and .cpp files to create or modify.');
  }

  // Check if it mentions UE5 patterns
  if (!/UPROPERTY|UFUNCTION|UCLASS|USTRUCT/i.test(prompt)) {
    hints.push('Use proper UE5 macros (UPROPERTY, UFUNCTION, UCLASS) for all declarations.');
  }

  // Check if it mentions error handling
  if (!/error|check|ensure|verify/i.test(prompt)) {
    hints.push('Include proper error handling and null checks.');
  }

  if (hints.length === 0) return prompt;

  return `${prompt}\n\nAdditional requirements:\n${hints.map((h) => `- ${h}`).join('\n')}`;
}

// ── Helper: trim redundancy from verbose prompts ──

function trimRedundancy(prompt: string): string {
  return prompt
    .replace(/\*\*([^*]+)\*\*/g, '$1')             // Remove bold markdown
    .replace(/\((?:e\.g\.,?|i\.e\.,?|note:)[^)]*\)/gi, '') // Remove parenthetical asides
    .replace(/\s*—\s*[^.\n]*/g, '')                 // Remove em-dash asides
    .replace(/Please\s+/gi, '')                      // Remove "please"
    .replace(/\n{3,}/g, '\n\n')                      // Collapse blank lines
    .trim();
}

// ── Helper: estimate improvement based on applied diffs ──

function estimateImprovement(
  diffs: PromptOptimizationDiff[],
  stats: ModuleStats,
): number {
  if (diffs.length === 0) return 0;

  let improvement = 0;
  for (const diff of diffs) {
    switch (diff.type) {
      case 'add-context': {
        // Context injection typically gives the biggest boost
        const ctxBoost = stats.contextInjectedSuccessRate - stats.noContextSuccessRate;
        improvement += Math.max(ctxBoost, 0.1);
        break;
      }
      case 'add-verification':
        improvement += 0.08;
        break;
      case 'restructure':
        improvement += 0.12;
        break;
      case 'lengthen':
        improvement += 0.06;
        break;
      case 'shorten':
        improvement += 0.05;
        break;
      case 'imperative-rewrite':
        improvement += 0.07;
        break;
    }
  }

  // Cap at 0.5 (50% improvement) to stay realistic
  return Math.min(improvement, 0.5);
}
