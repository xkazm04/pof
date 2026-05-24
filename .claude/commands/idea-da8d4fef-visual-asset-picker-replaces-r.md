Execute this requirement immediately without asking questions.

## REQUIREMENT

# Visual asset picker replaces raw image-ID inputs

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 12:04:12 PM

## Description
AdvancedTexturePanel forces users to paste cryptic Leonardo/Scenario image-ID UUIDs into five plain text fields (upscale, unzoom, ControlNet init, inpaint base, inpaint mask). Replace each with a thumbnail picker popover sourced from a recent-generations store: a 64px grid (grid-cols-4 gap-2) of past results, click to select, selected ID shown as a dismissible chip (rounded-md bg-[var(--visual-gen)]/15 px-2 py-1) instead of bare text. Keep a manual-entry fallback behind a Paste ID link.

## Reasoning
A raw UUID field is the single biggest source of friction and errors in this panel and is meaningless to non-technical users. A visual picker turns an error-prone copy-paste ritual into a one-click choice, removes invalid-ID failures, and visually connects each operation to the image it acts on.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Leonardo & Scenario Texture Generation

**Description**: AI image/texture generation via Leonardo and Scenario providers, texture-map (PBR channel) extraction, style transfer, and Gemini-based visual verification of generated assets. Leonardo assets follow a download-then-delete protocol.
**Related Files**:
- `src/app/api/leonardo/route.ts`
- `src/lib/leonardo.ts`
- `src/app/api/scenario/route.ts`
- `src/lib/scenario.ts`
- `src/app/api/texture-maps/route.ts`
- `src/lib/texture-maps.ts`
- `src/app/api/style-transfer/route.ts`
- `src/lib/prompts/style-transfer.ts`
- `src/lib/prompts/visual-check.ts`
- `src/app/api/verify/visual/route.ts`
- `src/lib/visual-verification-db.ts`
- `src/lib/visual-gen/providers.ts`
- `src/lib/visual-gen/asset-sources.ts`
- `src/components/modules/visual-gen/asset-forge/AssetForgeView.tsx`
- `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx`
- `src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx`
- `src/app/api/visual-gen/generate/route.ts`

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