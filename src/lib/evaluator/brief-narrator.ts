import type { CorrelatedInsight, InsightSeverity, InsightCategory } from './insight-generator';
import type { ProjectHealthSummary } from './combined-health';

// ─── Producers Brief narrator ────────────────────────────────────────────────
//
// Translates technical findings + health scores into plain-English cards
// for non-technical stakeholders. Zero UE5 vocabulary — no "blueprint",
// "actor", "AnimBP", "C++", "delegate", "subsystem", "blackboard", etc.
//
// Outputs three layers:
//   1. headline      — one-line project verdict
//   2. moduleBriefs  — one card per scored module (health + key risk)
//   3. risks         — issue-level cards with consequence + time-to-fix

export type BriefTone = 'green' | 'steady' | 'watch' | 'risk' | 'critical';

export interface ModuleBrief {
  moduleId: string;
  label: string;
  score: number;
  tone: BriefTone;
  /** Plain-English health phrase (e.g. "Combat is solid"). */
  headline: string;
  /** Optional sub-line spelling out the weakest dimension. */
  detail: string | null;
}

export interface RiskBrief {
  id: string;
  moduleId: string;
  moduleLabel: string;
  tone: BriefTone;
  /** Plain-English title (no jargon). */
  title: string;
  /** What it means for the player / project, in everyday language. */
  consequence: string;
  /** Rough time-to-fix, e.g. "about 2 hours to address". */
  timeToFix: string;
}

export interface ProducersBrief {
  /** One-line project verdict suitable for a status email. */
  headline: string;
  /** Three to five sentences a producer can read aloud. */
  paragraph: string;
  moduleBriefs: ModuleBrief[];
  risks: RiskBrief[];
  /** Modules that are visibly strong — worth celebrating. */
  highlights: ModuleBrief[];
}

// ─── Tone mapping ────────────────────────────────────────────────────────────

export function toneForScore(score: number): BriefTone {
  if (score >= 80) return 'green';
  if (score >= 65) return 'steady';
  if (score >= 50) return 'watch';
  if (score >= 30) return 'risk';
  return 'critical';
}

function toneForSeverity(severity: InsightSeverity): BriefTone {
  switch (severity) {
    case 'critical': return 'critical';
    case 'warning':  return 'risk';
    case 'info':     return 'watch';
    case 'positive': return 'green';
  }
}

function healthPhrase(score: number): string {
  if (score >= 85) return 'in excellent shape';
  if (score >= 70) return 'solid';
  if (score >= 55) return 'healthy with rough edges';
  if (score >= 40) return 'wobbly';
  if (score >= 25) return 'at risk';
  return 'in trouble';
}

function weakestDimension(b: { quality: number; dependencyHealth: number; coverage: number; activity: number }): { name: string; value: number } | null {
  const entries = [
    { name: 'craft quality',           value: b.quality },
    { name: 'connections to other systems', value: b.dependencyHealth },
    { name: 'feature coverage',        value: b.coverage },
    { name: 'recent work',             value: b.activity },
  ];
  entries.sort((a, b) => a.value - b.value);
  const lowest = entries[0];
  if (lowest.value >= 70) return null;
  return lowest;
}

function detailFor(b: { quality: number; dependencyHealth: number; coverage: number; activity: number }): string | null {
  const weakest = weakestDimension(b);
  if (!weakest) return null;
  if (weakest.name === 'craft quality') {
    return weakest.value < 30 ? 'the build quality is rough.' : 'the build quality could be tighter.';
  }
  if (weakest.name === 'connections to other systems') {
    return weakest.value < 30
      ? 'a lot of features are blocked waiting on other systems.'
      : 'some features are stuck waiting on other systems.';
  }
  if (weakest.name === 'feature coverage') {
    return weakest.value < 30
      ? 'most of the planned features aren’t in yet.'
      : 'about half the planned features still need to land.';
  }
  if (weakest.name === 'recent work') {
    return 'nobody’s touched it in a while.';
  }
  return null;
}

// ─── Risk consequence + time-to-fix ──────────────────────────────────────────

/**
 * Plain-English consequence + rough time estimate for each insight category.
 * Phrased in player / producer terms — no UE5 vocabulary.
 */
function describeRisk(insight: CorrelatedInsight): { title: string; consequence: string; timeToFix: string } {
  const m = insight.moduleLabel;

  // Time estimate is derived purely from priority — the higher the urgency,
  // the bigger the chunk of dev time it represents.
  const time = timeToFix(insight);

  switch (insight.category as InsightCategory) {
    case 'brittle-module':
      return {
        title: `${m} is fragile`,
        consequence: `Many other parts of the game lean on ${m}. If it cracks, the cracks spread — bugs here can knock out unrelated features.`,
        timeToFix: time,
      };
    case 'neglected-module':
      return {
        title: `${m} is falling behind`,
        consequence: `Little has been done here. Players will notice missing pieces that competitors ship as standard.`,
        timeToFix: time,
      };
    case 'blocked-progress':
      return {
        title: `${m} is stuck waiting`,
        consequence: `Several features can’t move forward until earlier work lands. Effort spent here is wasted until the upstream work is finished.`,
        timeToFix: time,
      };
    case 'quality-disconnect':
      return {
        title: `${m} gets mixed reviews`,
        consequence: `Two reviewers disagree on how good ${m} is. Worth a closer look before showing it to anyone outside the team.`,
        timeToFix: time,
      };
    case 'overworked-low-roi':
      return {
        title: `${m} is consuming time without payoff`,
        consequence: `A lot of work has gone in but most attempts fail. Either the goal is unclear or the approach needs a rethink.`,
        timeToFix: time,
      };
    case 'strong-module':
      return {
        title: `${m} is in great shape`,
        consequence: `Built well and largely complete. Safe to demo and safe to build on.`,
        timeToFix: time,
      };
    case 'coverage-gap':
      return {
        title: `${m} hasn’t been graded yet`,
        consequence: `No one has reviewed it, so we can’t say how good it is. Run a review to get a baseline before shipping.`,
        timeToFix: time,
      };
    case 'dependency-bottleneck':
      return {
        title: `${m} is holding everything up`,
        consequence: `Lots of other features are waiting on ${m} to finish. Until it lands, the rest of the project can’t move at full speed — this is the single highest-leverage fix.`,
        timeToFix: time,
      };
  }
}

function timeToFix(insight: CorrelatedInsight): string {
  if (insight.severity === 'positive') return 'no action needed';
  if (insight.priority <= 1) return 'about 1–2 days to address';
  if (insight.priority <= 3) return 'a few hours to address';
  if (insight.priority <= 5) return 'a small fix — under an hour';
  return 'minor cleanup when convenient';
}

// ─── Headline + paragraph ────────────────────────────────────────────────────

function buildHeadline(health: ProjectHealthSummary, criticalCount: number, riskCount: number): string {
  const verdict = healthPhrase(health.overallScore);
  if (criticalCount > 0) {
    return `Project is ${verdict} — ${criticalCount} item${criticalCount === 1 ? '' : 's'} need urgent attention.`;
  }
  if (riskCount > 0) {
    return `Project is ${verdict} — a handful of risks worth watching.`;
  }
  return `Project is ${verdict}.`;
}

function buildParagraph(
  health: ProjectHealthSummary,
  briefs: ModuleBrief[],
  risks: RiskBrief[],
): string {
  if (briefs.length === 0) {
    return 'There isn’t enough data yet to brief on. Run a quality review or two and a fresh scan, then come back.';
  }

  const strongest = [...briefs].sort((a, b) => b.score - a.score)[0];
  const weakest = [...briefs].sort((a, b) => a.score - b.score)[0];

  const parts: string[] = [];
  parts.push(`Overall the project is ${healthPhrase(health.overallScore)} (${health.overallScore} out of 100).`);

  if (strongest && strongest.score >= 70) {
    parts.push(`${strongest.label} is the strongest area.`);
  }

  if (weakest && weakest.score < 55 && weakest.moduleId !== strongest?.moduleId) {
    parts.push(`${weakest.label} is the weakest — ${weakest.detail ?? 'it needs the most attention'}`);
  }

  const critical = risks.find((r) => r.tone === 'critical');
  if (critical) {
    parts.push(`The most urgent risk: ${critical.consequence}`);
  } else if (risks.length > 0) {
    parts.push(`${risks.length} smaller risk${risks.length === 1 ? '' : 's'} to keep an eye on, none blocking right now.`);
  } else {
    parts.push('No urgent risks flagged.');
  }

  return parts.join(' ');
}

// ─── Public builder ──────────────────────────────────────────────────────────

export function buildProducersBrief(
  insights: CorrelatedInsight[],
  health: ProjectHealthSummary,
): ProducersBrief {
  const moduleBriefs: ModuleBrief[] = health.moduleScores.map((ms) => {
    const score = ms.breakdown.combined;
    return {
      moduleId: ms.moduleId,
      label: ms.label,
      score,
      tone: toneForScore(score),
      headline: `${ms.label} is ${healthPhrase(score)}`,
      detail: detailFor(ms.breakdown),
    };
  });

  // Filter out 'positive' insights from risks; they become highlights instead.
  const negatives = insights.filter((i) => i.severity !== 'positive');
  const positives = insights.filter((i) => i.severity === 'positive');

  const risks: RiskBrief[] = negatives.map((insight) => {
    const r = describeRisk(insight);
    return {
      id: insight.id,
      moduleId: insight.moduleId,
      moduleLabel: insight.moduleLabel,
      tone: toneForSeverity(insight.severity),
      title: r.title,
      consequence: r.consequence,
      timeToFix: r.timeToFix,
    };
  });

  // Highlights: strong modules from positive insights, dedup by moduleId.
  const highlightIds = new Set(positives.map((p) => p.moduleId));
  const highlights = moduleBriefs.filter((m) => highlightIds.has(m.moduleId));

  const criticalCount = risks.filter((r) => r.tone === 'critical').length;
  const riskCount = risks.length;

  return {
    headline: buildHeadline(health, criticalCount, riskCount),
    paragraph: buildParagraph(health, moduleBriefs, risks),
    moduleBriefs,
    risks,
    highlights,
  };
}
