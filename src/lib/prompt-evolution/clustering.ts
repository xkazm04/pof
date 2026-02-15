import type { PromptCluster } from '@/types/prompt-evolution';
import type { SessionRecord } from '@/types/session-analytics';

// ── Text similarity & clustering ────────────────────────────────────────────
// Uses token-based Jaccard similarity (no external embeddings needed).
// Groups prompts into clusters of similar phrasing to identify which
// patterns correlate with success.

/** Tokenize a prompt into lowercase word-level n-grams. */
function tokenize(text: string, n = 2): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    grams.add(words.slice(i, i + n).join(' '));
  }
  // Also add unigrams for short texts
  for (const w of words) {
    if (w.length > 3) grams.add(w);
  }
  return grams;
}

/** Jaccard similarity between two token sets. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/** Extract the most frequent meaningful keywords from a set of prompts. */
function extractKeywords(prompts: string[], topN = 5): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'this', 'that', 'these', 'those', 'it', 'its', 'all', 'each',
    'file', 'create', 'use', 'add', 'set', 'make', 'get', 'new',
  ]);

  const freq = new Map<string, number>();
  for (const prompt of prompts) {
    const words = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    const seen = new Set<string>();
    for (const w of words) {
      if (w.length > 3 && !stopWords.has(w) && !seen.has(w)) {
        seen.add(w);
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// ── Agglomerative clustering ────────────────────────────────────────────────

interface ClusterNode {
  sessionIds: number[];
  prompts: string[];
  successes: boolean[];
  tokens: Set<string>;
}

/**
 * Cluster session records by prompt similarity.
 * Uses single-link agglomerative clustering with a Jaccard threshold.
 */
export function clusterPrompts(
  sessions: SessionRecord[],
  threshold = 0.25,
  maxClusters = 8,
): PromptCluster[] {
  if (sessions.length === 0) return [];

  // Initialize: each session is its own cluster
  let clusters: ClusterNode[] = sessions.map((s) => ({
    sessionIds: [s.id],
    prompts: [s.prompt],
    successes: [s.success],
    tokens: tokenize(s.prompt),
  }));

  // Agglomerative merge loop
  while (clusters.length > maxClusters) {
    let bestI = 0;
    let bestJ = 1;
    let bestSim = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = jaccardSimilarity(clusters[i].tokens, clusters[j].tokens);
        if (sim > bestSim) {
          bestSim = sim;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // Stop if best similarity is below threshold
    if (bestSim < threshold) break;

    // Merge bestJ into bestI
    const merged: ClusterNode = {
      sessionIds: [...clusters[bestI].sessionIds, ...clusters[bestJ].sessionIds],
      prompts: [...clusters[bestI].prompts, ...clusters[bestJ].prompts],
      successes: [...clusters[bestI].successes, ...clusters[bestJ].successes],
      tokens: new Set([...clusters[bestI].tokens, ...clusters[bestJ].tokens]),
    };

    clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
    clusters.push(merged);
  }

  // Convert to PromptCluster and sort by success rate descending
  return clusters
    .filter((c) => c.sessionIds.length >= 2) // Drop singletons
    .map((c) => {
      const successCount = c.successes.filter(Boolean).length;
      const total = c.successes.length;
      // Pick the most representative prompt (closest to median length)
      const avgLen = c.prompts.reduce((s, p) => s + p.length, 0) / c.prompts.length;
      const sorted = [...c.prompts].sort((a, b) => Math.abs(a.length - avgLen) - Math.abs(b.length - avgLen));
      const representative = sorted[0].length > 120 ? sorted[0].slice(0, 120) + '...' : sorted[0];

      return {
        label: extractKeywords(c.prompts, 3).join(', ') || 'misc',
        sessionIds: c.sessionIds,
        successRate: total > 0 ? successCount / total : 0,
        avgLength: Math.round(avgLen),
        keywords: extractKeywords(c.prompts, 5),
        representative,
      };
    })
    .sort((a, b) => b.successRate - a.successRate);
}

/** Find the best-performing cluster for a module. */
export function getBestCluster(clusters: PromptCluster[]): PromptCluster | null {
  if (clusters.length === 0) return null;
  // Require at least 3 sessions for confidence
  const viable = clusters.filter((c) => c.sessionIds.length >= 3);
  if (viable.length === 0) return clusters[0];
  return viable[0]; // Already sorted by success rate
}
