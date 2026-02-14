import type { ModuleCorrelation } from './correlation-engine';

// ─── Insight types ───────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export type InsightCategory =
  | 'brittle-module'      // high deps + low quality
  | 'neglected-module'    // low activity + low quality
  | 'blocked-progress'    // high blocked count
  | 'quality-disconnect'  // scan score vs quality score mismatch
  | 'overworked-low-roi'  // high session count + low success
  | 'strong-module'       // high quality + good coverage
  | 'coverage-gap'        // low completion percentage
  | 'dependency-bottleneck'; // many things depend on it and it's not done

export interface CorrelatedInsight {
  id: string;
  moduleId: string;
  moduleLabel: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  /** Which data sources contributed to this insight */
  sources: ('quality' | 'dependencies' | 'analytics' | 'scanner')[];
  /** Which tab to navigate to for drill-down */
  drillDownTab: 'quality' | 'dependencies' | 'analytics' | 'scanner';
  /** Numeric value for sorting priority (lower = more urgent) */
  priority: number;
}

// ─── Rule engine ─────────────────────────────────────────────────────────────

type InsightRule = (m: ModuleCorrelation) => CorrelatedInsight | null;

const rules: InsightRule[] = [
  // Rule 1: Brittle module — high dependency count + low quality
  (m) => {
    if (m.dependencyCount >= 3 && m.avgQuality !== null && m.avgQuality < 3) {
      return {
        id: `brittle-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'brittle-module',
        severity: 'critical',
        title: `${m.label} is brittle`,
        description: `Has ${m.dependencyCount} cross-module dependencies but quality is only ${m.avgQuality}/5. Changes here risk cascading failures.`,
        sources: ['quality', 'dependencies'],
        drillDownTab: 'dependencies',
        priority: 1,
      };
    }
    return null;
  },

  // Rule 2: Neglected module — low session activity + low quality/completion
  (m) => {
    if (m.sessionCount <= 1 && m.pctComplete < 0.3 && m.totalFeatures > 0) {
      return {
        id: `neglected-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'neglected-module',
        severity: 'warning',
        title: `${m.label} is neglected`,
        description: `Only ${m.sessionCount} CLI session${m.sessionCount === 1 ? '' : 's'} and ${Math.round(m.pctComplete * 100)}% complete. This module needs attention.`,
        sources: ['quality', 'analytics'],
        drillDownTab: 'analytics',
        priority: 2,
      };
    }
    return null;
  },

  // Rule 3: Blocked progress — many blocked features
  (m) => {
    if (m.blockedCount >= 3) {
      return {
        id: `blocked-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'blocked-progress',
        severity: 'warning',
        title: `${m.label} has ${m.blockedCount} blocked features`,
        description: `Resolve upstream dependencies first. Blocked features cannot progress until their dependencies are implemented.`,
        sources: ['dependencies'],
        drillDownTab: 'dependencies',
        priority: 3,
      };
    }
    return null;
  },

  // Rule 4: Quality disconnect — scanner score and quality rating diverge
  (m) => {
    if (m.avgQuality !== null && m.scannerScore !== null) {
      const qualityNorm = (m.avgQuality / 5) * 100;
      const gap = Math.abs(qualityNorm - m.scannerScore);
      if (gap > 30) {
        const higher = qualityNorm > m.scannerScore ? 'quality review' : 'scanner';
        return {
          id: `disconnect-${m.moduleId}`,
          moduleId: m.moduleId,
          moduleLabel: m.label,
          category: 'quality-disconnect',
          severity: 'info',
          title: `${m.label} scores diverge`,
          description: `Quality review (${m.avgQuality}/5) and scanner (${m.scannerScore}/100) disagree. The ${higher} rates it higher — investigate the discrepancy.`,
          sources: ['quality', 'scanner'],
          drillDownTab: 'scanner',
          priority: 4,
        };
      }
    }
    return null;
  },

  // Rule 5: Overworked with low ROI — many sessions but low success rate
  (m) => {
    if (m.sessionCount >= 5 && m.successRate < 0.4) {
      return {
        id: `low-roi-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'overworked-low-roi',
        severity: 'warning',
        title: `${m.label} has low success rate`,
        description: `${m.sessionCount} sessions but only ${Math.round(m.successRate * 100)}% success. Consider reviewing prompts or breaking tasks into smaller steps.`,
        sources: ['analytics'],
        drillDownTab: 'analytics',
        priority: 3,
      };
    }
    return null;
  },

  // Rule 6: Strong module — high quality, good coverage, good scanner score
  (m) => {
    if (m.avgQuality !== null && m.avgQuality >= 4 && m.pctComplete >= 0.7) {
      return {
        id: `strong-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'strong-module',
        severity: 'positive',
        title: `${m.label} is in great shape`,
        description: `Quality ${m.avgQuality}/5 with ${Math.round(m.pctComplete * 100)}% features implemented. Keep up the good work.`,
        sources: ['quality'],
        drillDownTab: 'quality',
        priority: 10,
      };
    }
    return null;
  },

  // Rule 7: Coverage gap — very low implementation percentage
  (m) => {
    if (m.totalFeatures >= 5 && m.pctComplete < 0.15 && m.avgQuality === null) {
      return {
        id: `coverage-gap-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'coverage-gap',
        severity: 'info',
        title: `${m.label} hasn't been reviewed`,
        description: `${m.totalFeatures} features defined but none reviewed yet. Run a quality review to establish a baseline.`,
        sources: ['quality'],
        drillDownTab: 'quality',
        priority: 5,
      };
    }
    return null;
  },

  // Rule 8: Dependency bottleneck — module has blocked items AND is depended on by others
  (m) => {
    if (m.blockedCount >= 2 && m.dependencyCount >= 4 && m.pctComplete < 0.5) {
      return {
        id: `bottleneck-${m.moduleId}`,
        moduleId: m.moduleId,
        moduleLabel: m.label,
        category: 'dependency-bottleneck',
        severity: 'critical',
        title: `${m.label} is a dependency bottleneck`,
        description: `${m.dependencyCount} dependencies cross into this module but it's only ${Math.round(m.pctComplete * 100)}% complete with ${m.blockedCount} blocked features. Prioritize this module to unblock others.`,
        sources: ['quality', 'dependencies'],
        drillDownTab: 'dependencies',
        priority: 0,
      };
    }
    return null;
  },
];

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateInsights(modules: ModuleCorrelation[]): CorrelatedInsight[] {
  const insights: CorrelatedInsight[] = [];

  for (const mod of modules) {
    for (const rule of rules) {
      const insight = rule(mod);
      if (insight) {
        insights.push(insight);
      }
    }
  }

  // Sort by priority (lower = more urgent), then severity
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };

  insights.sort((a, b) => {
    const pd = a.priority - b.priority;
    if (pd !== 0) return pd;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return insights;
}
