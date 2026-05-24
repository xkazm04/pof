Execute this requirement immediately without asking questions.

## REQUIREMENT

# Replace opaque image-ID fields with a visual asset picker

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 12:26:16 PM

## Description
AdvancedTexturePanel asks users to paste raw Leonardo image id strings and pick ControlNet preprocessors by numeric code such as 67, 19 and 21. Replace the text inputs with a thumbnail picker of recent generations, and swap numeric codes for labeled options with short tooltips like Style Reference - match the look or Depth - match the 3D shape. Add one line of inline help per tile.

## Reasoning
Pasting opaque IDs and memorizing numeric codes is expert-only and blocks non-technical users, directly conflicting with the Globalization goal. A visual picker plus plain language turns a developer utility into something anyone can operate confidently.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Material Lab & Post-Process Studio

**Description**: PBR material editor with biome textures and material-pattern prompts, plus the post-process studio for tuning camera effects with a GPU-cost estimator. Backed by material-db and postProcessStudioStore.
**Related Files**:
- `src/components/modules/visual-gen/material-lab/MaterialLabView.tsx`
- `src/components/modules/visual-gen/material-lab/AdvancedTexturePanel.tsx`
- `src/components/modules/visual-gen/material-lab/PBREditor.tsx`
- `src/components/modules/visual-gen/material-lab/MaterialPreview.tsx`
- `src/app/api/visual-gen/materials/route.ts`
- `src/lib/visual-gen/material-db.ts`
- `src/lib/visual-gen/biome-textures.ts`
- `src/lib/prompts/material-configurator.ts`
- `src/lib/prompts/material-patterns.ts`
- `src/lib/post-process-studio/effects.ts`
- `src/lib/post-process-studio/presets.ts`
- `src/lib/post-process-studio/gpu-estimator.ts`
- `src/app/api/post-process-studio/route.ts`
- `src/lib/prompts/post-process.ts`
- `src/stores/postProcessStudioStore.ts`
- `src/components/modules/evaluator/PostProcessStudioView.tsx`

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