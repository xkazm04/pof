Execute this requirement immediately without asking questions.

## REQUIREMENT

# Auto-refreshing relative timestamps in activity feed

## Metadata
- **Category**: ui
- **Effort**: Unknown (N/A/3)
- **Impact**: Unknown (N/A/3)
- **Scan Type**: delight_designer
- **Generated**: 2/15/2026, 7:24:25 PM

## Description
ActivityFeedPanel renders time-ago strings from getTimePeriod at mount time but never refreshes them. Add a 60-second useInterval that bumps a counter state, causing time-ago values to recompute. Use the same formatTimeAgo pattern from TopBar.tsx for event timestamps within each section. This prevents stale Just now labels from persisting for hours without a page refresh.

## Reasoning
Stale timestamps undermine trust in the activity feed -- if every event says Just now, users stop believing the feed is real-time. Auto-refreshing timestamps are table stakes for any event timeline. The fix is a single useEffect with setInterval, touching no data model, purely cosmetic yet essential for perceived liveness.


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