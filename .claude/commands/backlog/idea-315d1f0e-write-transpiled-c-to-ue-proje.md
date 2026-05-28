Execute this requirement immediately without asking questions.

## REQUIREMENT

# Write transpiled C++ to UE project with dry-run

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/26/2026, 8:06:34 PM

## Description
Add a Write to Project action that saves the generated header and source into the correct Source/<Module> folder, reusing the project path from projectStore and the fs access pattern already in ue5-source-parser. Before writing, show a dry-run diff against any existing file on disk and require confirmation, so nothing is overwritten blindly. This closes the loop from transpile to real game code instead of leaving clipboard copy as the only output.

## Reasoning
Output is currently clipboard-only, forcing a manual paste into the editor for every class. Migration tools like jscodeshift, Rector, and codemod all write to disk with a preview or dry-run, which is the expected workflow for code generation. The app already reads the UE project from disk, so the write path is a natural and high-value extension.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Blueprint Transpiler & C++ Codegen

**Description**: Translate between Blueprint and UE5 C++: the Blueprint parser/explainer/glossary, the transpiler view, GAS codegen, replication scaffolding, and a C++ semantic parser for round-trip import. Spans blueprint/codegen libs, the transpiler module, and its API.
**Related Files**:
- `src/lib/blueprint-parser.ts`
- `src/lib/blueprint-explainer.ts`
- `src/lib/blueprint-glossary.ts`
- `src/lib/blueprint-jargon.ts`
- `src/lib/gas-codegen.ts`
- `src/lib/replication-scaffolder.ts`
- `src/lib/cpp-semantic-parser.ts`
- `src/lib/state-machine-validator.ts`
- `src/lib/ue5-source-parser.ts`
- `src/types/blueprint.ts`
- `src/hooks/useBlueprintTranspiler.ts`
- `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx`
- `src/app/api/blueprint-transpiler/route.ts`

**Post-Implementation**: After completing this requirement, evaluate if the context description or file paths need updates. Use the appropriate API/DB query to update the context if architectural changes were made.

## Recommended Skills

- **compact-ui-design**: Use `.claude/skills/compact-ui-design.md` for high-quality UI design references and patterns

## Notes

This requirement was generated from an AI-evaluated project idea. No specific goal is associated with this idea.

## DURING IMPLEMENTATION

- Use `get_memory` MCP tool when you encounter unfamiliar code or need context about patterns/files
- Use `report_progress` MCP tool at each major phase (analyzing, planning, implementing, testing, validating)
- Use `get_related_tasks` MCP tool before modifying shared files to check for parallel task conflicts

## AFTER IMPLEMENTATION

1. Log your implementation using the `log_implementation` MCP tool with:
   - requirementName: the requirement filename (without .md)
   - title: 2-6 word summary
   - overview: 1-2 paragraphs describing what was done
   - category: one of feature/bugfix/refactor/performance/security/infrastructure/ui/docs/test
   - patternsApplied: comma-separated patterns used (e.g. "repository pattern, debounce, memoization")

2. Check for test scenario using `check_test_scenario` MCP tool
   - If hasScenario is true, call `capture_screenshot` tool
   - If hasScenario is false, skip screenshot

3. Verify: `npx tsc --noEmit` (fix any type errors)

Begin implementation now.