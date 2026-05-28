Execute this requirement immediately without asking questions.

## REQUIREMENT

# One-click Design Story: shareable stakeholder pitch

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/26/2026, 8:08:31 PM

## Description
exportGDDAsMarkdown already assembles the full project narrative, but a .md file is an engineer artifact. Add a one-click export that turns the synthesized GDD into a polished, self-contained web pitch (and PDF) a publisher, investor or new teammate can read with zero context: hero stats, rendered system diagrams, the roadmap, and a plain-language status. First sprint step: add an export-pitch action to /api/game-design-doc that returns a styled single-page HTML built from the existing sections and stats, exposed as a new option beside the Export .md button.

## Reasoning
Every studio constantly needs to explain what the game is and how far along it is to people outside the codebase. Turning internal tracking data into an instant, beautiful external-facing pitch makes the product something users proudly share, and it serves non-technical audiences directly. Most of the content pipeline already exists.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: GDD Compliance & Design Doc

**Description**: Synthesize and check the Game Design Document: GDD synthesis, compliance scoring against the design intent, and the in-app design-doc viewer. Spans gdd-compliance/synthesizer libs, the gdd-compliance store, and its API.
**Related Files**:
- `src/lib/gdd-compliance.ts`
- `src/lib/gdd-synthesizer.ts`
- `src/types/gdd-compliance.ts`
- `src/stores/gddComplianceStore.ts`
- `src/components/modules/evaluator/GDDComplianceView.tsx`
- `src/components/modules/evaluator/GameDesignDocView.tsx`
- `src/app/api/gdd-compliance/route.ts`
- `src/app/api/game-design-doc/route.ts`
- `src/hooks/useGameDesignDoc.ts`
- `src/hooks/useDesignDocument.ts`

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