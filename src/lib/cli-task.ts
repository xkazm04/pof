/**
 * Unified CLI task abstraction.
 *
 * Every CLI invocation — checklist run, quick action, ask-claude, feature fix,
 * feature review — is represented as a CLITask. The TaskFactory methods handle
 * context injection and prompt assembly so callers never build prompts manually.
 */

import type { SubModuleId } from '@/types/modules';
import type { ProjectContext } from '@/lib/prompt-context';
import {
  buildProjectContextHeader,
  getModuleDomainContext,
  getModuleName,
} from '@/lib/prompt-context';
import type { FeatureDefinition } from '@/lib/feature-definitions';
import { buildEvalPrompt, type EvalPass } from '@/lib/evaluator/module-eval-prompts';

// ── Task callback system ────────────────────────────────────────────────────

/**
 * Structured callback descriptor — replaces embedded curl commands.
 *
 * When a task has a callback, the prompt tells Claude to emit a JSON block
 * wrapped in a `@@CALLBACK:<id>` marker. The terminal intercepts the output,
 * validates the JSON, merges `staticFields`, and POSTs it to `url`.
 */
export interface TaskCallback {
  /** Unique callback ID (auto-generated) */
  id: string;
  /** API endpoint to POST results to */
  url: string;
  /** HTTP method (default POST) */
  method: 'POST' | 'PATCH';
  /** Static fields merged into the payload before submission (e.g. moduleId) */
  staticFields: Record<string, unknown>;
  /** Human-readable description of the expected JSON shape for the prompt */
  schemaHint: string;
}

let _callbackCounter = 0;

/** In-memory callback registry — keyed by callback ID */
const _callbackRegistry = new Map<string, TaskCallback>();

/** Register a callback and return its ID. */
export function registerCallback(cb: Omit<TaskCallback, 'id'>): string {
  const id = `cb-${Date.now()}-${++_callbackCounter}`;
  const entry: TaskCallback = { ...cb, id };
  _callbackRegistry.set(id, entry);
  return id;
}

/** Look up a registered callback by ID. Returns undefined if not found. */
export function getCallback(id: string): TaskCallback | undefined {
  return _callbackRegistry.get(id);
}

/** Remove a callback after it has been resolved. */
export function removeCallback(id: string): void {
  _callbackRegistry.delete(id);
}

/**
 * Build the prompt section that tells Claude how to submit structured results.
 * Replaces the old embedded curl commands with a marker-based system.
 */
function buildCallbackSection(cb: TaskCallback): string {
  const staticNote = Object.keys(cb.staticFields).length > 0
    ? `\nThe following fields will be added automatically — do NOT include them:\n${Object.entries(cb.staticFields).map(([k, v]) => `- \`${k}\`: \`${JSON.stringify(v)}\``).join('\n')}`
    : '';

  return `## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
\`\`\`
@@CALLBACK:${cb.id}
{
${cb.schemaHint}
}
@@END_CALLBACK
\`\`\`
${staticNote}

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds`;
}

/**
 * Extract a callback payload from assistant output text.
 * Returns { callbackId, payload } if found, or null.
 */
export function extractCallbackPayload(text: string): { callbackId: string; payload: string } | null {
  const match = text.match(/@@CALLBACK:(cb-[^\s\n]+)\s*\n([\s\S]*?)\n\s*@@END_CALLBACK/);
  if (!match) return null;
  return { callbackId: match[1], payload: match[2].trim() };
}

/**
 * Resolve a callback: parse the payload, merge static fields, POST to the URL.
 * Returns the API response. Removes the callback from the registry on success.
 */
export async function resolveCallback(
  callbackId: string,
  rawPayload: string,
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const cb = _callbackRegistry.get(callbackId);
  if (!cb) return { success: false, error: `Unknown callback: ${callbackId}` };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return { success: false, error: 'Invalid JSON in callback payload' };
  }

  // Merge static fields (they take precedence — prevents prompt injection overriding moduleId etc.)
  const body = { ...parsed, ...cb.staticFields };

  try {
    const res = await fetch(cb.url, {
      method: cb.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) {
      _callbackRegistry.delete(callbackId);
      return { success: true, data: json.data };
    }
    return { success: false, error: json.error || 'API returned failure' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

// ── Task types ──────────────────────────────────────────────────────────────

export type CLITaskType =
  | 'checklist'
  | 'quick-action'
  | 'ask-claude'
  | 'feature-fix'
  | 'feature-review'
  | 'module-scan';

export interface CLITask {
  type: CLITaskType;
  /** The raw user/system prompt (before context injection) */
  prompt: string;
  /** Module this task belongs to */
  moduleId: SubModuleId;
  /** Human-readable label for the CLI tab */
  label: string;
  /** Called when the task stream completes */
  onComplete?: (success: boolean) => void;
}

/**
 * Extended checklist task — carries the checklist item id for progress tracking.
 */
export interface ChecklistTask extends CLITask {
  type: 'checklist';
  itemId: string;
  appOrigin: string;
}

/**
 * Extended feature-fix task — carries file paths and quality metadata.
 */
export interface FeatureFixTask extends CLITask {
  type: 'feature-fix';
  featureName: string;
  status: string;
  nextSteps: string;
  filePaths: string[];
  qualityScore: number | null;
  appOrigin: string;
}

/**
 * Extended feature-review task — carries feature definitions and callback URL.
 */
export interface FeatureReviewTask extends CLITask {
  type: 'feature-review';
  moduleLabel: string;
  features: FeatureDefinition[];
  appOrigin: string;
}

/**
 * Extended module-scan task — runs eval passes (structure/quality/performance).
 */
export interface ModuleScanTask extends CLITask {
  type: 'module-scan';
  passes: EvalPass[];
  previousFindings?: string;
  appOrigin: string;
}

// ── Prompt assembly ─────────────────────────────────────────────────────────

/**
 * Assembles the final enriched prompt for a CLITask.
 *
 * This is the single code path for all prompt building. Every task type
 * gets the project context header + domain context. Specialised task types
 * add their own sections.
 */
export function buildTaskPrompt(task: CLITask, ctx: ProjectContext): string {
  switch (task.type) {
    case 'checklist': {
      const ct = task as ChecklistTask;
      const header = buildProjectContextHeader(ctx);
      const domainContext = getModuleDomainContext(task.moduleId);
      const domainSection = domainContext
        ? `\n\n## Domain Context\n${domainContext}`
        : '';

      const cbId = registerCallback({
        url: `${ct.appOrigin}/api/checklist/complete`,
        method: 'POST',
        staticFields: {
          moduleId: task.moduleId,
          itemId: ct.itemId,
          projectPath: ctx.projectPath,
        },
        schemaHint: '  "completed": true',
      });

      return `${header}${domainSection}\n\n## Task\n${task.prompt}\n\n${buildCallbackSection(getCallback(cbId)!)}`;
    }

    case 'quick-action':
    case 'ask-claude': {
      const header = buildProjectContextHeader(ctx);
      const domainContext = getModuleDomainContext(task.moduleId);
      const domainSection = domainContext
        ? `\n\n## Domain Context\n${domainContext}`
        : '';
      return `${header}${domainSection}\n\n## Task\n${task.prompt}`;
    }

    case 'feature-fix': {
      const ft = task as FeatureFixTask;
      const header = buildProjectContextHeader(ctx);
      const domainContext = getModuleDomainContext(task.moduleId);
      const domainSection = domainContext
        ? `\n\n## Domain Context\n${domainContext}`
        : '';
      const fileSection =
        ft.filePaths.length > 0
          ? `\n\n## Relevant Files\n${ft.filePaths.map((fp) => `- ${fp}`).join('\n')}\n\nStart by reading these files to understand the current implementation.`
          : '';
      const qualityNote =
        ft.qualityScore != null ? ` (current quality: ${ft.qualityScore}/5)` : '';

      const cbId = registerCallback({
        url: `${ft.appOrigin}/api/feature-matrix`,
        method: 'PATCH',
        staticFields: {
          moduleId: ft.moduleId,
          featureName: ft.featureName,
          status: 'improved',
        },
        schemaHint: '  "completed": true',
      });

      return `${header}${domainSection}\n${fileSection}\n\n## Task: Improve "${ft.featureName}"\n\nCurrent status: **${ft.status}**${qualityNote}\n\n### What needs to be done\n${ft.nextSteps}\n\nImplement all the improvements listed above. Work through them methodically — read existing code first, then make targeted changes. The goal is to bring this feature to production quality (5/5).\n\n### Completion\n\nAfter you have completed **all** improvements and verified they compile correctly, mark the feature as improved.\n\n${buildCallbackSection(getCallback(cbId)!)}`;
    }

    case 'feature-review': {
      const rt = task as FeatureReviewTask;
      const moduleName = getModuleName(ctx.projectName);
      const header = buildProjectContextHeader(ctx, {
        includeBuildCommand: false,
        includeRules: false,
      });
      const domainContext = getModuleDomainContext(task.moduleId);
      const domainSection = domainContext
        ? `\n\n## Domain Context\n${domainContext}`
        : '';
      const featureList = rt.features
        .map((f, i) => `${i + 1}. **${f.featureName}** [${f.category}]: ${f.description}`)
        .join('\n');

      const cbId = registerCallback({
        url: `${rt.appOrigin}/api/feature-matrix/import`,
        method: 'POST',
        staticFields: {
          moduleId: task.moduleId,
        },
        schemaHint: `  "reviewedAt": "<ISO timestamp>",
  "features": [
    {
      "featureName": "<exact name from list>",
      "category": "<category>",
      "status": "implemented|partial|missing|unknown",
      "description": "<your description of what exists>",
      "filePaths": ["Source/path/to/File.h"],
      "reviewNotes": "<brief explanation>",
      "qualityScore": <1-5 or null if missing>,
      "nextSteps": "<concrete actions to reach pro quality>"
    }
  ]`,
      });

      return `${header}${domainSection}

## Task: Feature Review for "${rt.moduleLabel}"

Scan the project source code and determine the implementation status of each feature listed below.

### Features to Check
${featureList}

### Instructions
1. For each feature, search Source/${moduleName}/ for relevant C++ classes, headers, and config.
2. Determine the status:
   - **implemented**: Feature is fully present and functional code exists
   - **partial**: Some parts exist but incomplete (e.g., class exists but methods are empty)
   - **missing**: No evidence of this feature in the codebase
   - **unknown**: Cannot determine
3. Record file paths (relative to project root) that contain the implementation.
4. Write brief review notes explaining your assessment.
5. Assign a **qualityScore** from 1 to 5 measuring production readiness:
   - **1**: Stub / placeholder only — no real logic
   - **2**: Basic skeleton — compiles but lacks core behavior
   - **3**: Functional — works for basic cases, needs polish
   - **4**: Solid — handles edge cases, good structure, minor gaps
   - **5**: Pro / production-grade — robust, optimized, follows UE best practices
   For missing features, use \`null\`.
6. Write **nextSteps**: a concise list of what is needed to reach quality 5 (pro-grade mechanics). Focus on concrete actions: missing methods, unhandled edge cases, performance gaps, UE best practices not yet followed. For features already at 5, write "None — production ready." For missing features, describe what needs to be built from scratch.

### Rules
- Do NOT modify any project files — this is a read-only review.
- Do NOT use TodoWrite or Task/Explore tools.
- Do NOT write any files to disk — submit results using the callback format below.

Include ALL features from the list, even if missing. Use the EXACT featureName strings.

${buildCallbackSection(getCallback(cbId)!)}`;
    }

    case 'module-scan': {
      const st = task as ModuleScanTask;
      const moduleName = getModuleName(ctx.projectName);
      const sourcePath = `Source/${moduleName}/`;
      const passPrompts = st.passes.map((pass) =>
        buildEvalPrompt({
          moduleId: task.moduleId,
          pass,
          projectName: ctx.projectName,
          moduleName,
          sourcePath,
        }),
      );
      const combinedPassPrompt = passPrompts.join('\n\n---\n\n');
      const previousSection = st.previousFindings
        ? `\n\n## Previous Findings (for context)\nThese issues were found in a previous scan. Focus on NEW issues or verify whether these have been fixed:\n${st.previousFindings}`
        : '';

      const cbId = registerCallback({
        url: `${st.appOrigin}/api/module-scan/import`,
        method: 'POST',
        staticFields: {
          moduleId: task.moduleId,
        },
        schemaHint: `  "findings": [
    {
      "pass": "structure|quality|performance",
      "category": "string",
      "severity": "critical|high|medium|low",
      "file": "relative/path.h or null",
      "line": null,
      "description": "what the issue is",
      "suggestedFix": "specific fix",
      "effort": "trivial|small|medium|large"
    }
  ]`,
      });

      return `${combinedPassPrompt}${previousSection}

${buildCallbackSection(getCallback(cbId)!)}`;
    }

    default:
      return task.prompt;
  }
}

// ── Task factory ────────────────────────────────────────────────────────────

export const TaskFactory = {
  /** Create a task from a roadmap checklist "Run" button */
  checklist(moduleId: SubModuleId, itemId: string, prompt: string, label: string, appOrigin: string): ChecklistTask {
    return { type: 'checklist', moduleId, itemId, prompt, label, appOrigin };
  },

  /** Create a task from a quick-action button click */
  quickAction(moduleId: SubModuleId, prompt: string, label: string): CLITask {
    return { type: 'quick-action', moduleId, prompt, label };
  },

  /** Create a task from the "Ask Claude" free-text input */
  askClaude(moduleId: SubModuleId, prompt: string, label: string): CLITask {
    return { type: 'ask-claude', moduleId, prompt, label };
  },

  /** Create a task from a feature review "Fix" button */
  featureFix(
    moduleId: SubModuleId,
    feature: { featureName: string; status: string; nextSteps: string; filePaths: string[]; qualityScore: number | null },
    label: string,
    appOrigin: string,
  ): FeatureFixTask {
    return {
      type: 'feature-fix',
      moduleId,
      prompt: feature.nextSteps,
      label,
      featureName: feature.featureName,
      status: feature.status,
      nextSteps: feature.nextSteps,
      filePaths: feature.filePaths,
      qualityScore: feature.qualityScore,
      appOrigin,
    };
  },

  /** Create a task for feature review (single module or batch) */
  featureReview(
    moduleId: SubModuleId,
    moduleLabel: string,
    features: FeatureDefinition[],
    appOrigin: string,
    label: string,
  ): FeatureReviewTask {
    return {
      type: 'feature-review',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      moduleLabel,
      features,
      appOrigin,
    };
  },

  /** Create a task for module scan (structure/quality/performance eval) */
  moduleScan(
    moduleId: SubModuleId,
    passes: EvalPass[],
    appOrigin: string,
    label: string,
    previousFindings?: string,
  ): ModuleScanTask {
    return {
      type: 'module-scan',
      moduleId,
      prompt: '', // assembled by buildTaskPrompt
      label,
      passes,
      appOrigin,
      previousFindings,
    };
  },
};
