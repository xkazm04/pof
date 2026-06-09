/**
 * One-click "Fix this" plumbing for Game Director findings.
 *
 * Turns a read-only playtest finding into an actionable repair task: maps the
 * finding to the most relevant sub-module and assembles the `feature` payload
 * that {@link TaskFactory.featureFix} consumes — pre-populating the prompt with
 * the finding's title, description, suggestedFix, relatedModule and gameTimestamp.
 *
 * Pure (no React / DOM) so it is unit-testable and importable from either the
 * SessionDetail FindingsList or the FindingsExplorer.
 */

import type { PlaytestFinding, FindingCategory } from '@/types/game-director';
import { SUB_MODULE_IDS, type SubModuleId } from '@/types/modules';
import { CATEGORY_LABELS } from '@/lib/game-director-styles';

/** The `feature`-shaped payload accepted by {@link TaskFactory.featureFix}. */
export interface FindingFixFeature {
  featureName: string;
  status: string;
  nextSteps: string;
  filePaths: string[];
  qualityScore: number | null;
}

/**
 * When a finding has no (or an unrecognized) `relatedModule`, fall back to the
 * sub-module most likely to own its category so the fix task still lands in a
 * sensible domain context. `arpg-polish` is the catch-all for cross-cutting work.
 */
const CATEGORY_TO_MODULE: Partial<Record<FindingCategory, SubModuleId>> = {
  'visual-glitch': 'materials',
  'animation-issue': 'arpg-animation',
  'gameplay-feel': 'arpg-combat',
  'ux-problem': 'arpg-ui',
  'performance': 'arpg-polish',
  'crash-bug': 'arpg-polish',
  'level-pacing': 'arpg-world',
  'audio-issue': 'audio',
  'save-load': 'arpg-save',
  'ai-behavior': 'arpg-enemy-ai',
  'positive-feedback': 'arpg-polish',
};

const FALLBACK_MODULE: SubModuleId = 'arpg-polish';

const SUB_MODULE_SET = new Set<string>(SUB_MODULE_IDS);

/**
 * Resolve the sub-module a fix task should be attributed to. Prefers the
 * finding's `relatedModule` when it names a real sub-module; otherwise derives
 * one from the finding category, finally falling back to the polish catch-all.
 */
export function findingFixModuleId(finding: Pick<PlaytestFinding, 'relatedModule' | 'category'>): SubModuleId {
  const related = finding.relatedModule;
  if (related && SUB_MODULE_SET.has(related)) {
    return related as SubModuleId;
  }
  return CATEGORY_TO_MODULE[finding.category] ?? FALLBACK_MODULE;
}

/**
 * Assemble the `feature` payload for `TaskFactory.featureFix` from a finding.
 * The finding's title becomes the work item; its description, suggested fix, and
 * observation metadata (related module, game timestamp, severity, category) are
 * folded into `nextSteps` so the dispatched CLI prompt carries full context.
 */
export function buildFindingFixFeature(finding: PlaytestFinding): FindingFixFeature {
  const lines: string[] = [];

  const description = finding.description.trim();
  if (description) lines.push(description);

  const suggested = finding.suggestedFix.trim();
  if (suggested) {
    if (lines.length) lines.push('');
    lines.push(`**Suggested fix:** ${suggested}`);
  }

  const meta: string[] = [];
  if (finding.relatedModule) meta.push(`related module: ${finding.relatedModule}`);
  if (finding.gameTimestamp != null) meta.push(`observed at game time ${finding.gameTimestamp}s`);
  meta.push(`severity: ${finding.severity}`);
  meta.push(`category: ${CATEGORY_LABELS[finding.category] ?? finding.category}`);
  if (meta.length) {
    if (lines.length) lines.push('');
    lines.push(`_Context — ${meta.join(' · ')}._`);
  }

  const categoryLabel = CATEGORY_LABELS[finding.category] ?? finding.category;

  return {
    featureName: finding.title,
    status: `${finding.severity} ${categoryLabel} finding from AI playtest`,
    nextSteps: lines.join('\n'),
    filePaths: [],
    qualityScore: null,
  };
}

/** Stable per-finding CLI session key so each finding gets its own repair tab. */
export function findingFixSessionKey(findingId: string): string {
  return `gd-fix-${findingId}`;
}
