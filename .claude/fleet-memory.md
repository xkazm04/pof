# Fleet Shared Memory

One line per entry, append-only, newest last. This file is the cross-session
memory for parallel Claude sessions working in this repo: **key decisions,
deliveries, and reusable conventions only** — never logs, never file dumps.
Cap: keep the file under ~200 lines; when it grows past that, the oldest
DELIVERED lines are the ones to prune (decisions and conventions outlive them).

Format (one line, no wrapping):

```
- [YYYY-MM-DD] [area] KIND: one sentence
```

KIND is one of:
- `CONVENTION` — a reusable pattern or primitive future sessions should follow
- `DECISION` — a choice with a reason that others must not silently contradict
- `DELIVERED` — a completed piece of work worth knowing about

## Entries

- [2026-07-24] [shared] CONVENTION: use the shared Tooltip primitive (src/components/ui / shared) instead of title= attributes for hover help.
- [2026-07-24] [a11y] CONVENTION: loading/error/empty states use live regions (aria-live=polite) and honest copy — no silent spinners, no fake-empty on fetch failure.
- [2026-07-24] [a11y] CONVENTION: interactive lists/filmstrips get listbox/option roles with keyboard navigation; visible focus rings are required.
- [2026-07-24] [catalog+pipelines] DELIVERED: 30-session fleet sweep polished status/*, catalog/*, all *Pipeline* views (retry-able failures, truthful counts, ARIA roles, keyboard operability).
- [2026-07-24] [components] DELIVERED: 13-session fleet sweep improved catalog, cli, harness, status, modules, animations, experiment-lab, studio-3d, blender-mcp, bridge-doctor, layout, shared, ui areas (merged to master 7e4f4bce).
- [2026-07-24] [game-systems] DELIVERED: SquadChoreographyEditor UE5 code preview now uses shared CodeViewer (Shiki+copy/download); sliders + formation buttons got aria-label/aria-valuetext/aria-pressed.
- [2026-07-24] [animations] DELIVERED: StateMachineEditor graph nodes are keyboard-movable (arrow nudge/Shift-coarse, Delete, Esc) and its C++ output panel now renders via the shared CodeViewer (dropping a hardcoded hex + duplicate copy plumbing).
- [2026-07-24] [game-systems] DELIVERED: EQSPipelineDiagram flow-bar chips now jump/expand their stage card, per-pipeline Expand/Collapse all, shared ChartLegend stage-kind key, and a note surfacing UE5 cost-sorted test execution where it differs from authored order.
- [2026-07-24] [game-systems] DELIVERED: SquadChoreographyEditor formation diagram is keyboard-operable — forward-vector handle is an arrow-key role=slider with bearing readout, squad members are a roving-tabindex listbox driving the same glyph highlight.
- [2026-07-24] [core-engine/combat] DELIVERED: sub_combat sub-tab bar got ARIA tablist/tab + roving-tabindex arrow/Home/End nav (panel role=tabpanel), and the Polish tuner sliders got accessible names, aria-valuetext and a visible focus ring.
- [2026-07-24] [audio] DELIVERED: AudioCodeGenPanel un-nested its copy button (invalid button-in-button) and now renders generated UE5 C++ via shared CodeViewer; AudioView tab strip got WAI-ARIA tablist/tab semantics with arrow-key + Home/End navigation.
- [2026-07-24] [materials] DELIVERED: MaterialParameterConfigurator toggles got aria-pressed + focus rings + a check-glyph selected cue (no hue-only state), configurator/style-transfer sliders got accessible names, aria-valuetext and a named reset, and style-transfer uploads now report why a file was rejected instead of dropping it silently.
- [2026-07-24] [evaluator] DELIVERED: PerformanceProfilingView got retryable/dismissible errors (InlineErrorRetry) + aria-live async status, honest "Top 10 of N" table counts with show-all toggles, and keyboard-reachable frame-time bars with an sr-only chart summary.
- [2026-07-24] [project-setup] DELIVERED: LiveStateSyncPanel got honest per-status pre-snapshot copy in an aria-live region, Tooltip/aria-label/focus-ring on all controls, and a submit-form watch editor with per-watch update stamps.
- [2026-07-24] [level-design] CONVENTION: SVG canvases can't use the box-shadow focus-ring utilities — draw an explicit dashed rect/circle gated on `:focus-visible` and give nodes roving tabindex + listbox/option roles.
- [2026-07-24] [level-design] DELIVERED: LevelFlowEditor is keyboard/SR operable (arrows navigate, Shift+arrows nudge, Enter/L/Delete/Esc), deletes are two-step (armed links, ConfirmDialog with link count for rooms), Blender status is an aria-live region with dismiss/retry.
- [2026-07-24] [core-engine/loot] DELIVERED: all 6 unlabeled sub_loot range sliders (pity threshold, AI-designer level/affix weights, drops-per-hour level, workbench item level/magnitude) got aria-label + aria-valuetext + .focus-ring.
- [2026-07-24] [evaluator] DELIVERED: CombatSimulatorView run lifecycle now announced via aria-live status + errors use shared InlineErrorRetry (role=alert + scoped retry); all five title= hover hints moved to the shared Tooltip primitive.
- [2026-07-24] [models] DELIVERED: AssetInventory asset cards are keyboard-operable (button/region roles, Enter/Space expand, Escape collapse, focus-ring-outline) and the previously dead sort state is now a real Name/Type/Size/Modified control row.
- [2026-07-24] [ui-hud] DECISION: UIHudView now mounts the five previously-unreachable panels as two composite tabs (HUD Theme, Damage Numbers) — do not re-orphan them.
- [2026-07-24] [ui-hud] DELIVERED: InventoryGridDesigner + HudThemeEditor section strips are real WAI-ARIA tablists (role/aria-selected/aria-controls, roving tabindex, Arrow/Home/End, focus-ring).
- [2026-07-24] [inventory] DELIVERED: sub_inventory (outside catalog/) form controls got programmatic labels (useId+htmlFor / aria-label + slider aria-valuetext) and loot-filter icon buttons got accessible names plus aria-pressed/aria-expanded state.
- [2026-07-24] [game-director] DELIVERED: findings filter chips now carry per-severity counts + clear-filters escape hatch, failed triage writes surface a retry banner (note editor preserved), and HealthTrendChart got role=img summary + sr-only data table.
