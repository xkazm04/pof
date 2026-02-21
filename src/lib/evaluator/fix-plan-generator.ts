/**
 * Fix plan generator — converts evaluation findings into executable CLI prompts.
 */

import type { EvalFinding, FindingSeverity } from './finding-collector';
import type { ProjectContext } from '@/lib/prompt-context';
import { buildProjectContextHeader } from '@/lib/prompt-context';
import { MODULE_LABELS } from '@/lib/module-registry';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FixPlan {
  id: string;
  findingId: string;
  moduleId: string;
  moduleLabel: string;
  title: string;
  severity: FindingSeverity;
  effort: string;
  /** The full CLI prompt ready for execution */
  prompt: string;
  /** Short summary for UI display */
  summary: string;
}

// ─── Generator ───────────────────────────────────────────────────────────────

/**
 * Generate an executable fix plan from a single finding.
 */
export function generateFixPlan(
  finding: EvalFinding,
  ctx: ProjectContext,
): FixPlan {
  const header = buildProjectContextHeader(ctx, {
    includeBuildCommand: true,
    includeRules: true,
    extraRules: [
      'Focus on the specific issue described below. Do not refactor unrelated code.',
      'After fixing, verify the build compiles successfully.',
    ],
  });

  const fileSection = finding.file
    ? `\n## Target File\n- ${finding.file}${finding.line ? ` (around line ${finding.line})` : ''}\n\nStart by reading this file to understand the current implementation.`
    : '';

  const prompt = `${header}
${fileSection}

## Issue to Fix
**Module**: ${MODULE_LABELS[finding.moduleId] ?? finding.moduleId}
**Category**: ${finding.category}
**Severity**: ${finding.severity}

${finding.description}

## Suggested Fix
${finding.suggestedFix}

## Instructions
1. ${finding.file ? `Read ${finding.file} to understand the current code` : 'Locate the relevant source files for this module'}
2. Implement the suggested fix above
3. Ensure the fix doesn't break any existing functionality
4. Verify the build compiles after changes`;

  return {
    id: `fix-${finding.id}`,
    findingId: finding.id,
    moduleId: finding.moduleId,
    moduleLabel: MODULE_LABELS[finding.moduleId] ?? finding.moduleId,
    title: truncate(finding.description, 80),
    severity: finding.severity,
    effort: finding.effort,
    prompt,
    summary: finding.suggestedFix,
  };
}

/**
 * Generate fix plans for all findings in a module, sorted by severity.
 */
export function generateModuleFixPlans(
  findings: EvalFinding[],
  ctx: ProjectContext,
): FixPlan[] {
  const severityOrder: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  return findings
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .map((f) => generateFixPlan(f, ctx));
}

/**
 * Generate a batch fix plan that addresses multiple findings at once.
 * Groups findings from the same file for efficient fixing.
 */
export function generateBatchFixPlan(
  findings: EvalFinding[],
  moduleId: string,
  ctx: ProjectContext,
): FixPlan | null {
  if (findings.length === 0) return null;

  const header = buildProjectContextHeader(ctx, {
    includeBuildCommand: true,
    includeRules: true,
    extraRules: [
      'Fix all issues listed below in order of severity.',
      'After fixing all issues, verify the build compiles successfully.',
    ],
  });

  // Group findings by file for efficient work
  const byFile = new Map<string, EvalFinding[]>();
  for (const f of findings) {
    const key = f.file ?? '__general__';
    const arr = byFile.get(key) ?? [];
    arr.push(f);
    byFile.set(key, arr);
  }

  let issueList = '';
  let idx = 1;
  for (const [file, fileFindings] of byFile) {
    const fileLabel = file === '__general__' ? 'General' : file;
    issueList += `\n### ${fileLabel}\n`;
    for (const f of fileFindings) {
      issueList += `${idx}. **[${f.severity.toUpperCase()}]** ${f.description}\n   Fix: ${f.suggestedFix}\n`;
      idx++;
    }
  }

  const prompt = `${header}

## Module: ${MODULE_LABELS[moduleId] ?? moduleId}
## Batch Fix — ${findings.length} Issues

Fix all of the following issues in order of severity:
${issueList}

## Instructions
1. Work through each issue in the order listed (critical first)
2. For each file, read it first, then apply all fixes for that file before moving on
3. After fixing all issues, verify the build compiles`;

  return {
    id: `batch-fix-${moduleId}-${Date.now()}`,
    findingId: `batch-${moduleId}`,
    moduleId,
    moduleLabel: MODULE_LABELS[moduleId] ?? moduleId,
    title: `Fix ${findings.length} issues in ${MODULE_LABELS[moduleId] ?? moduleId}`,
    severity: findings[0]?.severity ?? 'medium',
    effort: findings.length > 5 ? 'large' : findings.length > 2 ? 'medium' : 'small',
    prompt,
    summary: `Batch fix for ${findings.length} findings across ${byFile.size} file(s)`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}
