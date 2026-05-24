Execute this requirement immediately without asking questions.

## REQUIREMENT

# Plain-language decoder for cryptic effect params

## Metadata
- **Category**: user_benefit
- **Effort**: High (3/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:38:48 PM

## Description
Effect parameters surface raw UE names like SceneFringeIntensity, BloomThreshold, and FogHeightFalloff that mean nothing to non-technical users. Add an opt-in explain mode that pairs each param with an everyday-language description and a tiny visual cue (e.g. how much edges glow, film-camera color cast), driven by an extended metadata field on the existing PPStudioParam definitions.

## Reasoning
Canva and Notion succeed by hiding jargon behind plain-language controls and inline help. With the only open project goal being an app understandable by day-to-day non-technical users, demystifying these UE-specific terms directly advances that goal at very low risk.

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