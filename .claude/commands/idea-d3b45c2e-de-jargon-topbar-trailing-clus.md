Execute this requirement immediately without asking questions.

## REQUIREMENT

# De-jargon TopBar trailing cluster

## Metadata
- **Category**: ui
- **Effort**: High (3/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 3:42:42 PM

## Description
The right side of TopBar shows: SearchTrigger, ProjectStats (raw 'completed/total' fraction), PofBridgeIndicator ('Bridge v?', 'Bridge...', 'Bridge err'), a hardcoded 'UE5 + C++' label, and NotificationBadge ('9+'). For a non-technical user this is alphabet soup. Refactor: drop 'UE5 + C++' (already shown in the project switcher), rename 'Bridge' to 'Editor link' with a plain-English tooltip ('Connected to the running UE5 editor'), and reframe ProjectStats as a single right-aligned chip 'X of Y tasks done � Z modules complete' (single readable sentence, tabular-nums for the numbers, no separate widgets). Add a subtle horizontal divider (1px, border-color) between the Editor-link chip and the bell to create rhythm. Keep total horizontal width ? 320px on 1440px screens to avoid crowding.

## Reasoning
The TopBar right cluster currently looks like a developer dashboard, not a product. Plainer language and one consolidated stats chip is far more legible at a glance and directly supports the Globalization goal of being understandable to non-technical users. The bonus is that fewer micro-widgets create visual calm in the most-seen surface of the app.

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