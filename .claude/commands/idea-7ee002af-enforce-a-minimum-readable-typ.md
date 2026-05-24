Execute this requirement immediately without asking questions.

## REQUIREMENT

# Enforce a minimum readable type scale in data panels

## Metadata
- **Category**: ui
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: delight_designer
- **Generated**: 5/24/2026, 4:22:29 PM

## Description
These tabs lean heavily on text-2xs, text-[10px] and mono+uppercase+tracking-[0.15em] for substantive labels (ZoneMap zone chips and tick labels, AttrBar values, DebugDashboard legends, PowerBudgetRadar captions). Promote any text-2xs/[10px] that carries real information to the existing text-xs token, and drop wide letter-spacing on multi-word strings so they stop looking cramped. Reserve micro sizes only for decorative/unit suffixes.

## Reasoning
Sub-11px tracked uppercase text fails WCAG legibility and is the single biggest readability gap across the context — it hurts every user and especially non-technical ones (Globalization goal). Standardizing on the existing token scale is low-risk, visually cleaner, and compounds across ~30 files.


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

2. Verify: `npx tsc --noEmit` (fix any type errors)

Begin implementation now.