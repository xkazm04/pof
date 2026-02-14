/**
 * Unified CLI task abstraction.
 *
 * Every CLI invocation — checklist run, quick action, ask-claude, feature fix,
 * feature review — is represented as a CLITask. The TaskFactory methods handle
 * context injection and prompt assembly so callers never build prompts manually.
 */

import type { ProjectContext } from '@/lib/prompt-context';
import {
  buildProjectContextHeader,
  getModuleDomainContext,
  getModuleName,
} from '@/lib/prompt-context';
import type { FeatureDefinition } from '@/lib/feature-definitions';

// ── Task types ──────────────────────────────────────────────────────────────

export type CLITaskType =
  | 'checklist'
  | 'quick-action'
  | 'ask-claude'
  | 'feature-fix'
  | 'feature-review';

export interface CLITask {
  type: CLITaskType;
  /** The raw user/system prompt (before context injection) */
  prompt: string;
  /** Module this task belongs to */
  moduleId: string;
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
    case 'checklist':
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

      return `${header}${domainSection}\n${fileSection}\n\n## Task: Improve "${ft.featureName}"\n\nCurrent status: **${ft.status}**${qualityNote}\n\n### What needs to be done\n${ft.nextSteps}\n\nImplement all the improvements listed above. Work through them methodically — read existing code first, then make targeted changes. The goal is to bring this feature to production quality (5/5).`;
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
      const importUrl = `${rt.appOrigin}/api/feature-matrix/import`;

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
- Do NOT write any files to disk — send results directly via the API.

### Output

After completing your review, submit the results directly to the app database by running this Bash command.

Build a JSON object with this structure:
\`\`\`json
{
  "moduleId": "${task.moduleId}",
  "reviewedAt": "<ISO timestamp>",
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
  ]
}
\`\`\`

Include ALL features from the list, even if missing. Use the EXACT featureName strings.

**Submit directly via curl** — pipe the JSON through curl to avoid shell escaping issues:
\`\`\`
echo '<YOUR_COMPLETE_JSON_HERE>' | curl -s -X POST ${importUrl} -H "Content-Type: application/json" -d @-
\`\`\`

Replace \`<YOUR_COMPLETE_JSON_HERE>\` with the actual JSON object above. Use single quotes around the JSON to avoid shell escaping issues on Windows.

This is mandatory — the review is not complete until you see a \`{"success":true}\` response.`;
    }

    default:
      return task.prompt;
  }
}

// ── Task factory ────────────────────────────────────────────────────────────

export const TaskFactory = {
  /** Create a task from a roadmap checklist "Run" button */
  checklist(moduleId: string, itemId: string, prompt: string, label: string): ChecklistTask {
    return { type: 'checklist', moduleId, itemId, prompt, label };
  },

  /** Create a task from a quick-action button click */
  quickAction(moduleId: string, prompt: string, label: string): CLITask {
    return { type: 'quick-action', moduleId, prompt, label };
  },

  /** Create a task from the "Ask Claude" free-text input */
  askClaude(moduleId: string, prompt: string, label: string): CLITask {
    return { type: 'ask-claude', moduleId, prompt, label };
  },

  /** Create a task from a feature review "Fix" button */
  featureFix(
    moduleId: string,
    feature: { featureName: string; status: string; nextSteps: string; filePaths: string[]; qualityScore: number | null },
    label: string,
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
    };
  },

  /** Create a task for feature review (single module or batch) */
  featureReview(
    moduleId: string,
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
};
