/**
 * Pre-built workflow templates for common multi-step operations.
 *
 * Templates use '$MODULE' as a placeholder for the target moduleId.
 * The store hydrates these into concrete WorkflowDefinitions at runtime.
 */

import type { WorkflowTemplate, DAGNode } from '@/types/task-dag';

// ── Helper to build node IDs ─────────────────────────────────────────────────

let _counter = 0;
function nid(prefix: string): string {
  _counter++;
  return `${prefix}-${_counter}`;
}

// ── 1. Full Module Audit ─────────────────────────────────────────────────────

function fullModuleAuditNodes(): DAGNode[] {
  _counter = 0;
  const reviewId = nid('review');
  const fixPartialId = nid('fix-partial');
  const checklistId = nid('checklist-validate');

  return [
    {
      id: reviewId,
      label: 'Feature Review',
      moduleId: '$MODULE',
      taskType: 'feature-review',
      prompt: '',
      dependsOn: [],
      parallelGroup: undefined,
      retryPolicy: { maxRetries: 1, delayMs: 5000, backoffMultiplier: 2 },
    },
    {
      id: fixPartialId,
      label: 'Fix Partial Features',
      moduleId: '$MODULE',
      taskType: 'feature-fix',
      prompt: 'Review the feature matrix results from the previous review. For each feature marked "partial", implement the missing functionality based on the nextSteps field. Work through all partial features methodically.',
      dependsOn: [reviewId],
      retryPolicy: { maxRetries: 1, delayMs: 5000, backoffMultiplier: 2 },
    },
    {
      id: checklistId,
      label: 'Validate Checklist',
      moduleId: '$MODULE',
      taskType: 'checklist',
      prompt: 'Run through the roadmap checklist for this module. Verify each item is complete based on the code that exists. Mark items as done if they pass inspection.',
      dependsOn: [fixPartialId],
    },
  ];
}

// ── 2. Quick Fix Pipeline ────────────────────────────────────────────────────

function quickFixPipelineNodes(): DAGNode[] {
  _counter = 0;
  const reviewId = nid('review');
  const fixId = nid('fix');
  const buildId = nid('build-verify');

  return [
    {
      id: reviewId,
      label: 'Quick Feature Scan',
      moduleId: '$MODULE',
      taskType: 'feature-review',
      prompt: '',
      dependsOn: [],
    },
    {
      id: fixId,
      label: 'Fix Issues',
      moduleId: '$MODULE',
      taskType: 'feature-fix',
      prompt: 'Based on the review results, fix the most critical issues found. Focus on features that are "partial" with quality score <= 2. Prioritize compilation and basic functionality.',
      dependsOn: [reviewId],
      retryPolicy: { maxRetries: 2, delayMs: 3000, backoffMultiplier: 2 },
    },
    {
      id: buildId,
      label: 'Build Verification',
      moduleId: '$MODULE',
      taskType: 'quick-action',
      prompt: 'Run the UE5 build command and verify the project compiles without errors. Report any remaining warnings.',
      dependsOn: [fixId],
      retryPolicy: { maxRetries: 1, delayMs: 5000, backoffMultiplier: 2 },
    },
  ];
}

// ── 3. Ship Readiness Check ──────────────────────────────────────────────────

function shipReadinessNodes(): DAGNode[] {
  _counter = 0;
  const reviewId = nid('review');
  const checklistId = nid('checklist');
  const buildId = nid('build');

  return [
    {
      id: reviewId,
      label: 'Full Feature Review',
      moduleId: '$MODULE',
      taskType: 'feature-review',
      prompt: '',
      dependsOn: [],
      retryPolicy: { maxRetries: 1, delayMs: 5000, backoffMultiplier: 2 },
    },
    {
      id: checklistId,
      label: 'Checklist Verification',
      moduleId: '$MODULE',
      taskType: 'checklist',
      prompt: 'Run through every checklist item for this module. Mark each as complete or incomplete. Provide a final readiness percentage.',
      dependsOn: [reviewId],
    },
    {
      id: buildId,
      label: 'Clean Build Test',
      moduleId: '$MODULE',
      taskType: 'quick-action',
      prompt: 'Run a clean build of the project. Verify zero errors and catalog any warnings. Report ship-readiness status.',
      dependsOn: [reviewId],
      parallelGroup: 'verify',
    },
  ];
}

// ── 4. Review and Fix (Simple 2-Step) ────────────────────────────────────────

function reviewAndFixNodes(): DAGNode[] {
  _counter = 0;
  const reviewId = nid('review');
  const fixId = nid('fix');

  return [
    {
      id: reviewId,
      label: 'Feature Review',
      moduleId: '$MODULE',
      taskType: 'feature-review',
      prompt: '',
      dependsOn: [],
    },
    {
      id: fixId,
      label: 'Auto-Fix All',
      moduleId: '$MODULE',
      taskType: 'feature-fix',
      prompt: 'Based on the feature review results, fix every feature that is not at quality 5. Work through them in dependency order. Verify the build compiles after each fix.',
      dependsOn: [reviewId],
      retryPolicy: { maxRetries: 2, delayMs: 5000, backoffMultiplier: 2 },
    },
  ];
}

// ── Template Registry ────────────────────────────────────────────────────────

const now = new Date().toISOString();

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'full-module-audit',
    name: 'Full Module Audit',
    description: 'Review all features, fix partial implementations, then validate with checklist. The most thorough workflow.',
    icon: 'ClipboardCheck',
    moduleScope: 'single',
    nodes: fullModuleAuditNodes(),
    defaults: {
      retryPolicy: { maxRetries: 1, delayMs: 5000, backoffMultiplier: 2 },
    },
    estimatedMinutesPerModule: 15,
    createdAt: now,
  },
  {
    id: 'quick-fix-pipeline',
    name: 'Quick Fix Pipeline',
    description: 'Fast scan, fix critical issues, verify build. Best for iteration when you know what needs fixing.',
    icon: 'Wrench',
    moduleScope: 'single',
    nodes: quickFixPipelineNodes(),
    defaults: {
      retryPolicy: { maxRetries: 2, delayMs: 3000, backoffMultiplier: 2 },
    },
    estimatedMinutesPerModule: 8,
    createdAt: now,
  },
  {
    id: 'ship-readiness',
    name: 'Ship Readiness Check',
    description: 'Full review + parallel checklist and build verification. Use before merging or shipping.',
    icon: 'Rocket',
    moduleScope: 'single',
    nodes: shipReadinessNodes(),
    defaults: {
      retryPolicy: { maxRetries: 1, delayMs: 5000, backoffMultiplier: 2 },
    },
    estimatedMinutesPerModule: 12,
    createdAt: now,
  },
  {
    id: 'review-and-fix',
    name: 'Review & Fix',
    description: 'Simple two-step: review features then auto-fix everything below quality 5.',
    icon: 'Zap',
    moduleScope: 'single',
    nodes: reviewAndFixNodes(),
    defaults: {
      retryPolicy: { maxRetries: 2, delayMs: 5000, backoffMultiplier: 2 },
    },
    estimatedMinutesPerModule: 10,
    createdAt: now,
  },
];

// ── Template hydration ───────────────────────────────────────────────────────

/**
 * Hydrate a template into a concrete workflow definition for specific module(s).
 * Replaces '$MODULE' placeholder with actual moduleId(s).
 * For multi-module workflows, duplicates the DAG per module with unique IDs.
 */
export function hydrateTemplate(
  template: WorkflowTemplate,
  moduleIds: string[],
): { id: string; name: string; description: string; nodes: DAGNode[]; moduleIds: string[] } {
  if (moduleIds.length === 1) {
    const moduleId = moduleIds[0];
    const nodes = template.nodes.map((n) => ({
      ...n,
      id: `${moduleId}::${n.id}`,
      moduleId: n.moduleId === '$MODULE' ? moduleId : n.moduleId,
      dependsOn: n.dependsOn.map((d) => `${moduleId}::${d}`),
      conditionalNext: n.conditionalNext
        ? {
            onSuccess: n.conditionalNext.onSuccess?.map((d) => `${moduleId}::${d}`),
            onFailure: n.conditionalNext.onFailure?.map((d) => `${moduleId}::${d}`),
          }
        : undefined,
    }));

    return {
      id: `${template.id}--${moduleId}`,
      name: `${template.name}: ${moduleId}`,
      description: template.description,
      nodes,
      moduleIds: [moduleId],
    };
  }

  // Multi-module: create parallel branches per module
  const allNodes: DAGNode[] = [];
  for (const moduleId of moduleIds) {
    for (const n of template.nodes) {
      allNodes.push({
        ...n,
        id: `${moduleId}::${n.id}`,
        moduleId: n.moduleId === '$MODULE' ? moduleId : n.moduleId,
        dependsOn: n.dependsOn.map((d) => `${moduleId}::${d}`),
        parallelGroup: n.parallelGroup
          ? `${moduleId}::${n.parallelGroup}`
          : moduleId,
        conditionalNext: n.conditionalNext
          ? {
              onSuccess: n.conditionalNext.onSuccess?.map((d) => `${moduleId}::${d}`),
              onFailure: n.conditionalNext.onFailure?.map((d) => `${moduleId}::${d}`),
            }
          : undefined,
      });
    }
  }

  return {
    id: `${template.id}--multi-${Date.now()}`,
    name: `${template.name}: ${moduleIds.length} modules`,
    description: template.description,
    nodes: allNodes,
    moduleIds,
  };
}
