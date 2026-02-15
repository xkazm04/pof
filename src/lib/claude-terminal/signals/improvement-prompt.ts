/**
 * Improvement Prompt Builder — Creates the prompt for the meta-agent
 * that fixes detected patterns in the POF codebase.
 *
 * Unlike normal mode (native Claude tools on UE5 projects), the improvement
 * agent targets the POF app codebase itself using Read/Edit/Write/Bash.
 */

import type { Pattern } from './signal-types';

// ============ Codebase Context ============

const CODEBASE_CONTEXT = `
## Codebase Structure (POF — UE5 Game Dev Tool)

- **Database**: SQLite via better-sqlite3, schema in \`src/lib/db.ts\`
- **CLI skills**: \`src/components/cli/skills/\` — Skill definitions for game dev domains
- **CLI prompt builder**: \`src/components/cli/skills/index.ts\` — \`buildSkillsPrompt()\` that steers the CLI
- **CLI service**: \`src/lib/claude-terminal/cli-service.ts\` — Spawns Claude Code process
- **API routes**: \`src/app/api/\` — Next.js API route handlers
- **Signal types**: \`src/lib/claude-terminal/signals/signal-types.ts\` — Signal taxonomy
- **UE5 build parser**: \`src/components/cli/UE5BuildParser.ts\` — MSVC/Clang/UBT output parsing
- **Task queue**: \`src/components/cli/useTaskQueue.ts\` — Manages task execution + SSE
- **Task registry**: \`src/components/cli/taskRegistry.ts\` — Cross-tab task coordination
`.trim();

// ============ Category-specific Guidance ============

const CATEGORY_GUIDANCE: Record<string, string> = {
  schema: `For schema issues:
1. Check the SQLite schema in \`src/lib/db.ts\` — verify the column exists
2. If a migration is needed, update the schema initialization in db.ts
3. Ensure the CLI skill description matches the actual DB columns
4. Update \`buildSkillsPrompt()\` if it references wrong columns`,

  prompt: `For prompt issues:
1. Read \`src/components/cli/skills/index.ts\` — find the incorrect reference
2. Cross-reference with actual tool capabilities
3. Fix the tool name, parameter, or column reference in the skill prompt
4. Ensure skill descriptions match their actual behavior`,

  tooling: `For tooling issues:
1. Check if the skill exists in \`src/components/cli/skills/\`
2. If missing, create it following the pattern of existing skills
3. Register it in the skills index
4. Add it to \`buildSkillsPrompt()\` in skills/index.ts`,

  build: `For UE5 build issues:
1. Check the error code (MSVC Cxxxx, LNKxxxx, Clang error)
2. Read the relevant C++ source or header file
3. Fix the compilation error — missing includes, type mismatches, linker issues
4. Run the build again to verify the fix`,

  performance: `For performance issues:
1. Check if multiple sequential tool calls could be replaced with a single step
2. Consider if the prompt could be more specific to reduce steps
3. Look for missing batch operations in the API layer`,
};

// ============ Main Builder ============

/**
 * Build the improvement prompt for the meta-agent.
 * This prompt instructs Claude to fix specific detected patterns using
 * full codebase access (Read/Edit/Write/Bash).
 */
export function buildImprovementPrompt(patterns: Pattern[]): string {
  const patternDescriptions = patterns.map((p, i) => {
    const lines = [
      `### Pattern ${i + 1}: ${p.type} (severity: ${p.severity}, seen ${p.count}x)`,
      p.toolName ? `- **Tool**: ${p.toolName}` : '',
      p.errorMessage ? `- **Error**: ${p.errorMessage.slice(0, 300)}` : '',
      p.suggestedFix ? `- **Suggested fix**: ${p.suggestedFix}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');

  // Collect unique categories for targeted guidance
  const categories = [...new Set(patterns.map(p => p.category))];
  const guidance = categories
    .map(cat => CATEGORY_GUIDANCE[cat])
    .filter(Boolean)
    .join('\n\n');

  return `You are a code improvement agent for the POF app (UE5 game development tool). Your job is to fix specific issues detected during CLI usage.

## Detected Patterns

${patternDescriptions}

${CODEBASE_CONTEXT}

## Category-Specific Guidance

${guidance}

## Instructions

1. Read the relevant files for each pattern
2. Fix the root cause — make minimal, focused changes
3. After all fixes, run \`npx tsc --noEmit\` to verify no type errors
4. Summarize what you changed in a structured list

## Constraints

- ONLY fix the listed patterns — do not refactor unrelated code
- Keep changes minimal and focused
- If a DB schema change is needed, update \`src/lib/db.ts\` initialization
- If adding a new skill, register it in \`skills/index.ts\` and update the CLI prompt
- Do not modify test files unless the pattern specifically involves tests
- For UE5 build errors, focus on the C++ source fix, not the build system
`;
}
