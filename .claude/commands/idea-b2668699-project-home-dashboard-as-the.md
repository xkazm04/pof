Execute this requirement immediately without asking questions.

## REQUIREMENT

# Project Home dashboard as the default landing view

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:18:42 PM

## Description
When no module is selected the ModuleRenderer shows only Welcome to POF / Select a category. Replace that dead space with a Project Home overview, mirroring Linear inbox, GitHub repo home, and Jira dashboards. Aggregate the data the app already computes: overall checklist completion, modules needing attention, recent CLI activity from the activity feed, and a prominent Next Best Action call-to-action. Make Home a first-class destination reachable from the logo and via the command palette.

## Reasoning
Without a landing page users have no sense of where the project stands or what to do next, which hurts both orientation and momentum. A home dashboard answers where am I and what is next at a glance, directly supporting the goal of being understandable to non-technical users, and reuses existing ProjectStats, activity feed, and NBA building blocks.

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

Use Claude Code skills as appropriate for implementation guidance. Check `.claude/skills/` directory for available skills.

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