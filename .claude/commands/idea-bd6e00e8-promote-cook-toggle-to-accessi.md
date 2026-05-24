Execute this requirement immediately without asking questions.

## REQUIREMENT

# Promote cook toggle to accessible Switch primitive

## Metadata
- **Category**: code_quality
- **Effort**: High (3/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 3:33:04 PM

## Description
The Toggle in CookSettingsPanel.tsx hides the checkbox with sr-only but the visual switch has no role, aria-checked, focus-visible ring, or keyboard cues � it is invisible to screen readers and barely reachable by keyboard. Extract it into src/components/ui/Switch.tsx with role=switch, aria-checked, aria-describedby pointing at the description div, focus-visible:ring-2 ring-violet-500/40 ring-offset-2 ring-offset-surface, and Space/Enter handlers. Then reuse it for the Stage / Archive / Run-After-Build inline checkboxes in ProfileEditor and the Iterative / Cook-on-the-fly toggles. Same module, design-system win.

## Reasoning
The packaging page has ~10 binary toggles that today fail a basic a11y audit and lack a visible focus state. A shared Switch primitive fixes accessibility for everyone, gives the design system a polished interaction (60fps thumb translate, focus halo, keyboard activation), and removes three near-duplicate toggle implementations across the file.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Build & Packaging Pipeline

**Description**: UE5 cook/package pipeline: build profiles, preflight checks, cook executor, smoke tests, version manager, and UAT command generation with a build-history store and comparison UI.
**Related Files**:
- `src/components/modules/game-systems/PackagingView.tsx`
- `src/components/modules/game-systems/CookSettingsPanel.tsx`
- `src/components/modules/game-systems/BuildComparison.tsx`
- `src/lib/packaging/cook-executor.ts`
- `src/lib/packaging/build-profiles.ts`
- `src/lib/packaging/build-profiles-db.ts`
- `src/lib/packaging/preflight.ts`
- `src/lib/packaging/smoke-test.ts`
- `src/lib/packaging/version-manager.ts`
- `src/lib/packaging/uat-command-generator.ts`
- `src/lib/packaging/build-history-store.ts`
- `src/lib/ue5-bridge/build-pipeline.ts`
- `src/lib/ue5-bridge/build-queue.ts`
- `src/app/api/packaging/execute/route.ts`
- `src/app/api/packaging/preflight/route.ts`
- `src/app/api/packaging/smoke-test/route.ts`
- `src/app/api/packaging/profiles/route.ts`
- `src/app/api/packaging/history/route.ts`
- `src/hooks/useBuildPipeline.ts`

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