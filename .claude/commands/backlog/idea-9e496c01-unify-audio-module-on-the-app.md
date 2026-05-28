Execute this requirement immediately without asking questions.

## REQUIREMENT

# Unify audio module on the app design system

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/26/2026, 8:05:14 PM

## Description
Three components (AudioEventCatalog, AudioScenePainter chrome, AudioPipelineDiagram) use a hardcoded cyberpunk-amber look (bg-[#03030a], raw amber/blue utilities, rgba() shadows) while the shell, code-gen, library, and property panels use semantic tokens (text-text, bg-surface, MODULE_COLORS.content, SurfaceCard). Migrate the three outliers onto the shared tokens and SurfaceCard, normalize the type scale to the app xs floor, and strip the hardcoded hex that also breaks the no-hardcoded-hex ESLint rule.

## Reasoning
Switching tabs currently teleports the user between two unrelated visual worlds, which reads as unfinished rather than premium. One coherent system makes the whole module feel polished, easier to theme, and far simpler to maintain.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Audio Generation & Scenes

**Description**: Generate and catalog game audio: audio event catalogs, scene painting, spatial audio generation, and audio code generation, persisted as audio sets/assets/scenes. Spans the content/audio module, audio libs, and the audio APIs.
**Related Files**:
- `src/components/modules/content/audio/AudioView.tsx`
- `src/components/modules/content/audio/AudioEventCatalog.tsx`
- `src/components/modules/content/audio/AudioScenePainter.tsx`
- `src/components/modules/content/audio/AudioCodeGenPanel.tsx`
- `src/components/modules/content/audio/AudioLibraryPanel.tsx`
- `src/components/modules/content/audio/AudioPropertyPanel.tsx`
- `src/components/modules/content/audio/AudioPipelineDiagram.tsx`
- `src/lib/audio-gen/registry.ts`
- `src/lib/audio-gen/types.ts`
- `src/lib/audio-asset-db.ts`
- `src/lib/audio-scene-db.ts`
- `src/lib/spatial-audio-generator.ts`
- `src/types/audio-asset.ts`
- `src/types/audio-scene.ts`
- `src/app/api/audio-gen/route.ts`
- `src/app/api/audio-scene/route.ts`
- `src/app/api/audio-asset/route.ts`
- `src/app/api/spatial-audio-generate/route.ts`
- `src/lib/prompts/audio-events.ts`
- `src/lib/prompts/audio-scene.ts`

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