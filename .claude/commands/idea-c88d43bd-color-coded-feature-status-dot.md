Execute this requirement immediately without asking questions.

## REQUIREMENT

# Color-coded feature status dots in FeatureMatrix rows

## Metadata
- **Category**: ui
- **Effort**: Unknown (N/A/3)
- **Impact**: Unknown (N/A/3)
- **Scan Type**: delight_designer
- **Generated**: 2/15/2026, 7:26:15 PM

## Description
FeatureMatrix rows show status as a text label with subtle background tint, but at a glance the rows look visually identical because the text labels are small and the color differences are too subtle against the dark surface. Add a 6px solid color dot to the left of each row using the STATUS_CONFIG colors -- green for implemented, amber for partial, red for missing, gray for unknown. This creates an instant scannable column of color that lets users triage without reading text. Apply via a border-left-4 style on the row container.

## Reasoning
When triaging 20+ features, users need to spot missing and partial items in under 2 seconds. The current text-only status labels require sequential reading. A color-coded left border creates preattentive visual processing -- users can identify problem rows before consciously reading the labels, matching the pattern used in ErrorCard for severity.


## Recommended Skills

- **compact-ui-design**: Use `.claude/skills/compact-ui-design.md` for high-quality UI design references and patterns

## Notes

This requirement was generated from an AI-evaluated project idea. No specific goal is associated with this idea.

## AFTER IMPLEMENTATION

1. Log your implementation using the `log_implementation` MCP tool with:
   - requirementName: the requirement filename (without .md)
   - title: 2-6 word summary
   - overview: 1-2 paragraphs describing what was done

2. Verify: `npx tsc --noEmit` (fix any type errors)

Begin implementation now.