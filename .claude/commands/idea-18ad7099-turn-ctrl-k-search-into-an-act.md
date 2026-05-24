Execute this requirement immediately without asking questions.

## REQUIREMENT

# Turn Ctrl+K search into an action command palette

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:18:25 PM

## Description
The GlobalSearchPanel (Ctrl+K) currently only finds items and navigates to them. Extend it into a true command palette (the VS Code Cmd+Shift+P / Linear / Raycast pattern) that also lists runnable commands the app already has scattered across the UI: Switch Project, New Project, Rename Project, Rebuild Search Index, Toggle Activity Feed, Toggle Terminal, jump to any category. Add inline result actions (Run with Claude, Copy prompt, Mark complete) so a search hit can be acted on without leaving the palette, and surface recent/most-used commands when the query is empty.

## Reasoning
Every successful productivity tool centralizes its actions behind one keystroke, which makes the whole app discoverable and keyboard-driven. PoF has the actions and the panel already; unifying them removes hunting through the TopBar dropdown and memorizing Ctrl+1-5, and turns search results into a launchpad rather than a dead end. High leverage on infrastructure that already exists.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Application Shell & Project Setup

**Description**: Root layout, app shell with L1/L2 sidebars, top bar, module renderer, global search, and activity feed; plus the project-setup wizard (create/select UE project, path browser). Backed by projectStore, navigationStore, moduleStore.
**Related Files**:
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/SidebarL1.tsx`
- `src/components/layout/SidebarL2.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/layout/ModuleRenderer.tsx`
- `src/components/layout/GlobalSearchPanel.tsx`
- `src/components/layout/ActivityFeedPanel.tsx`
- `src/components/modules/project-setup/ProjectSetupModule.tsx`
- `src/components/modules/project-setup/SetupWizard.tsx`
- `src/components/modules/project-setup/CreateProjectPanel.tsx`
- `src/components/modules/project-setup/PathBrowser.tsx`
- `src/stores/projectStore.ts`
- `src/stores/navigationStore.ts`
- `src/stores/moduleStore.ts`
- `src/stores/activityFeedStore.ts`
- `src/services/ProjectModuleBridge.ts`
- `src/app/api/recent-projects/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/filesystem/scan-project/route.ts`

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