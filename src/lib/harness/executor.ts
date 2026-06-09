/**
 * Executor — spawns Claude Code CLI sessions to implement module areas.
 *
 * Each session gets:
 * 1. Project context header (UE5 paths, build commands, rules)
 * 2. Domain context for the target module
 * 3. Full area spec (checklist items + features to implement)
 * 4. Progress context from previous sessions
 * 5. Learnings from AGENTS.md
 *
 * Uses `claude -p` (Agent SDK CLI) with structured JSON output.
 * One area = one session = coherent block of work with 1M context.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SUB_MODULES } from '@/lib/module-registry';
import type { SubModuleDefinition, ChecklistItem } from '@/types/modules';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import {
  buildProjectContextHeader,
  getModuleDomainContext,
} from '@/lib/prompt-context';
import type { ProjectContext } from '@/lib/prompt-context';
import { spawnClaudeSession, wrapHarnessResult, HARNESS_RESULT_REGEX } from './claude-session';
import type {
  ExecutorConfig,
  ExecutorResult,
  GamePlan,
  ModuleArea,
  ProgressEntry,
} from './types';

// ── Prompt Assembly ─────────────────────────────────────────────────────────

function buildAreaPrompt(
  area: ModuleArea,
  plan: GamePlan,
  progress: ProgressEntry[],
  ctx: ProjectContext,
  agentsMd: string,
  themeDirective?: string,
): string {
  const sections: string[] = [];

  // 1. Project context
  sections.push(buildProjectContextHeader(ctx, {
    includeBuildCommand: true,
    includeRules: true,
  }));

  // 1b. Theme directive — injected before domain context so it colors everything
  if (themeDirective) {
    sections.push(`## Creative Direction

**IMPORTANT — Apply this theme to ALL implementations in this session:**

${themeDirective}

Every class name, variable name, data table entry, gameplay tag, and comment should reflect this theme where appropriate. Use thematic naming (e.g. "Lightsaber" not "Sword", "ForceAbility" not "MagicSpell") while keeping UE5 conventions (A, U, F prefixes). Existing generic ARPG code should be adapted to fit the theme.`);
  }

  // 2. Domain context
  const domain = getModuleDomainContext(area.moduleId);
  if (domain) {
    sections.push(`## Domain Context\n${domain}`);
  }

  // 3. Accumulated learnings
  if (agentsMd.trim()) {
    sections.push(`## Learnings from Previous Sessions\n${agentsMd}`);
  }

  // 4. Progress summary (last 10 entries for context, not bloating)
  const recentProgress = progress.slice(-10);
  if (recentProgress.length > 0) {
    const progressText = recentProgress.map(e =>
      `[iter-${e.iteration}] ${e.timestamp} | ${e.areaId} | ${e.outcome.toUpperCase()}\n  ${e.summary}`,
    ).join('\n');
    sections.push(`## Recent Progress\n${progressText}`);
  }

  // 5. Area specification — the main task
  const moduleDef = SUB_MODULES.find((m: SubModuleDefinition) => m.id === area.moduleId);
  const featureDefs = MODULE_FEATURE_DEFINITIONS[area.moduleId] ?? [];
  const checklist = moduleDef?.checklist ?? [];

  // Get relevant checklist items — use description only, not full prompt (avoids bloating)
  const relevantChecklist = checklist.filter((c: ChecklistItem) => area.checklistItemIds.includes(c.id));
  const checklistSection = relevantChecklist.length > 0
    ? relevantChecklist.map((item: ChecklistItem, i: number) =>
      `${i + 1}. **${item.label}** (${item.id}): ${item.description}`,
    ).join('\n')
    : 'No checklist items defined — implement based on feature descriptions below.';

  // Get relevant features
  const relevantFeatures = featureDefs.filter(f => area.featureNames.includes(f.featureName));
  const featureSection = relevantFeatures.length > 0
    ? relevantFeatures.map(f => {
      const deps = f.dependsOn?.length ? ` (depends on: ${f.dependsOn.join(', ')})` : '';
      return `- **${f.featureName}** [${f.category}]: ${f.description}${deps}`;
    }).join('\n')
    : '';

  // Feature status from previous attempts
  const featureStatusSection = area.features
    .filter(f => f.status !== 'pending')
    .map(f => {
      const statusIcon = f.status === 'pass' ? 'PASS' : f.status === 'fail' ? 'FAIL' : f.status.toUpperCase();
      const quality = f.quality != null ? ` (quality: ${f.quality}/5)` : '';
      const reason = f.failReason ? ` — ${f.failReason}` : '';
      return `- ${f.name}: ${statusIcon}${quality}${reason}`;
    }).join('\n');

  sections.push(`## Task: Implement "${area.label}"

**Module:** ${area.moduleId}
**Description:** ${area.description}

Review and improve the existing implementation of this area. Read the source files, assess quality, fix issues, and add missing functionality.

### Checklist
${checklistSection}

${featureSection ? `### Features\n${featureSection}` : ''}

${featureStatusSection ? `### Previous Status\n${featureStatusSection}` : ''}

### Rules
1. **Read existing code first** — check Source/ for what already exists
2. **Follow UE5 conventions** — UCLASS, UPROPERTY, UFUNCTION macros
3. **Fix issues you find** — improve quality, add missing functionality
4. **Leave clean state** — no broken builds

### Completion
When done, output a summary in this exact format:

\`\`\`
${wrapHarnessResult(`{
  "areaId": "${area.id}",
  "completed": true,
  "features": [
    { "name": "<feature name>", "status": "pass|fail", "quality": <1-5>, "notes": "<brief notes>" }
  ],
  "filesCreated": ["<list of new files>"],
  "filesModified": ["<list of modified files>"],
  "learnings": ["<patterns or gotchas discovered>"],
  "summary": "<1-2 sentence summary of what was built>"
}`)}
\`\`\`
`);

  return sections.join('\n\n');
}

// ── Result Parsing ──────────────────────────────────────────────────────────

export interface ParsedAreaResult {
  areaId: string;
  completed: boolean;
  features: Array<{
    name: string;
    status: 'pass' | 'fail';
    quality: number;
    notes: string;
  }>;
  filesCreated: string[];
  filesModified: string[];
  learnings: string[];
  summary: string;
}

export function parseAreaResult(output: string): ParsedAreaResult | null {
  const match = output.match(HARNESS_RESULT_REGEX);
  if (!match) return null;

  try {
    return JSON.parse(match[1].trim()) as ParsedAreaResult;
  } catch {
    return null;
  }
}

// ── CLI Execution ───────────────────────────────────────────────────────────

/**
 * Execute a Claude Code session for a module area.
 * Spawns `claude -p` with the assembled prompt and captures output.
 */
export async function executeArea(
  area: ModuleArea,
  plan: GamePlan,
  progress: ProgressEntry[],
  ctx: ProjectContext,
  config: ExecutorConfig,
  agentsMd: string,
  onOutput?: (chunk: string) => void,
  themeDirective?: string,
): Promise<ExecutorResult> {
  const prompt = buildAreaPrompt(area, plan, progress, ctx, agentsMd, themeDirective);
  const startTime = Date.now();

  const session = await spawnClaudeSession(prompt, {
    cwd: ctx.projectPath,
    allowedTools: config.allowedTools,
    skipPermissions: config.skipPermissions,
    bareMode: config.bareMode,
    verbose: true,
    timeoutMs: config.sessionTimeoutMs,
    onOutput,
  });

  // Detect what was touched by scanning the extracted assistant text
  const combinedOutput = session.output;
  const touchedCpp = /\.(h|cpp|hpp|cc)/.test(combinedOutput);
  const touchedGameplay = /(UGameplayAbility|UAbilitySystemComponent|ACharacter|APlayerController|APawn)/
    .test(combinedOutput);
  const touchedUI = /\.(tsx|jsx|css)/.test(combinedOutput) || /Widget|HUD|UMG/.test(combinedOutput);

  return {
    completed: session.exitCode === 0,
    sessionId: session.sessionId,
    durationMs: Date.now() - startTime,
    assistantOutput: session.output,
    touchedCpp,
    touchedGameplay,
    touchedUI,
    exitCode: session.exitCode,
    costUsd: session.costUsd,
    errors: session.errors.length > 0 ? session.errors : undefined,
  };
}

// ── State File I/O ──────────────────────────────────────────────────────────

export function readAgentsMd(statePath: string): string {
  const agentsPath = path.join(statePath, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    return fs.readFileSync(agentsPath, 'utf-8');
  }
  return '';
}

export function appendAgentsMd(statePath: string, learnings: string[]): void {
  if (learnings.length === 0) return;
  const agentsPath = path.join(statePath, 'AGENTS.md');
  const timestamp = new Date().toISOString().split('T')[0];
  const content = learnings.map(l => `- [${timestamp}] ${l}`).join('\n');

  if (fs.existsSync(agentsPath)) {
    fs.appendFileSync(agentsPath, `\n${content}\n`);
  } else {
    fs.writeFileSync(agentsPath, `# Harness Learnings\n\nPatterns and gotchas discovered during autonomous game development.\n\n${content}\n`);
  }
}
