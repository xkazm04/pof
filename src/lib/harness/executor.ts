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

import { spawn } from 'child_process';
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
@@HARNESS_RESULT
{
  "areaId": "${area.id}",
  "completed": true,
  "features": [
    { "name": "<feature name>", "status": "pass|fail", "quality": <1-5>, "notes": "<brief notes>" }
  ],
  "filesCreated": ["<list of new files>"],
  "filesModified": ["<list of modified files>"],
  "learnings": ["<patterns or gotchas discovered>"],
  "summary": "<1-2 sentence summary of what was built>"
}
@@END_HARNESS_RESULT
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
  const match = output.match(/@@HARNESS_RESULT\s*\n([\s\S]*?)\n\s*@@END_HARNESS_RESULT/);
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

  return new Promise<ExecutorResult>((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'claude.cmd' : 'claude';
    const args = ['-p', '-', '--output-format', 'stream-json', '--verbose'];

    if (config.skipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    if (config.bareMode) {
      args.push('--bare');
    }

    if (config.allowedTools.length > 0) {
      args.push('--allowedTools', config.allowedTools.join(','));
    }

    const proc = spawn(command, args, {
      cwd: ctx.projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
    });

    let fullOutput = '';
    /** Accumulated assistant text extracted from stream-json messages */
    let assistantText = '';
    let sessionId: string | undefined;
    let costUsd: number | undefined;
    let exitCode: number | null = null;
    const errors: string[] = [];

    // Send prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;

      // Parse stream-json lines to extract assistant text and metadata
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === 'system' && parsed.subtype === 'init' && parsed.session_id) {
            sessionId = parsed.session_id;
          }
          if (parsed.type === 'result') {
            if (parsed.cost_usd) costUsd = parsed.cost_usd;
            // The result message may also contain the final text
            if (parsed.result?.text) assistantText += parsed.result.text;
          }
          // Extract text from assistant messages
          if (parsed.type === 'assistant') {
            const content = parsed.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === 'text' && block.text) {
                  assistantText += block.text;
                  if (onOutput) onOutput(block.text);
                }
              }
            }
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) errors.push(text);
    });

    // Timeout
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      errors.push(`Session timed out after ${config.sessionTimeoutMs}ms`);
    }, config.sessionTimeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      exitCode = code;

      // Detect what was touched by scanning the extracted assistant text
      const combinedOutput = assistantText || fullOutput;
      const touchedCpp = /\.(h|cpp|hpp|cc)/.test(combinedOutput);
      const touchedGameplay = /(UGameplayAbility|UAbilitySystemComponent|ACharacter|APlayerController|APawn)/
        .test(combinedOutput);
      const touchedUI = /\.(tsx|jsx|css)/.test(combinedOutput) || /Widget|HUD|UMG/.test(combinedOutput);

      resolve({
        completed: code === 0,
        sessionId,
        durationMs: Date.now() - startTime,
        assistantOutput: assistantText || fullOutput,
        touchedCpp,
        touchedGameplay,
        touchedUI,
        exitCode,
        costUsd,
        errors: errors.length > 0 ? errors : undefined,
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      errors.push(err.message);
      resolve({
        completed: false,
        durationMs: Date.now() - startTime,
        assistantOutput: fullOutput,
        touchedCpp: false,
        touchedGameplay: false,
        touchedUI: false,
        exitCode: null,
        errors,
      });
    });
  });
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
