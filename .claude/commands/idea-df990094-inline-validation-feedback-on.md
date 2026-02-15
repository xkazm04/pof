Execute this requirement immediately without asking questions.

## REQUIREMENT

# Inline validation feedback on SetupWizard inputs

## Metadata
- **Category**: ui
- **Effort**: Unknown (N/A/3)
- **Impact**: Unknown (N/A/3)
- **Scan Type**: delight_designer
- **Generated**: 2/15/2026, 7:23:58 PM

## Description
SetupWizard.tsx silently disables the Launch button via canProceed without explaining what is missing. Add inline validation states to each field: project name gets a red border and helper text when empty or containing invalid path characters, project path shows a green checkmark when validated or red X with reason on failure, UE version dropdown shows a subtle info note about version-specific behavior. Use the existing border-bright/status-red-medium design tokens.

## Reasoning
First-run experience sets the tone for the entire product. A disabled button with no explanation is the most common UX antipattern in forms -- users stare at a grayed-out button with no idea why it wont activate. Adding validation feedback turns confusion into confidence and reduces setup abandonment to near zero.


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