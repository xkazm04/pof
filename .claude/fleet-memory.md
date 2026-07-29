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
- [2026-07-24] [visual-gen] DELIVERED: Qwen-Image 2D-gen runner (text-in-image niche beside Leonardo) + QWEN_CRITIQUE_FALLBACKS env for the VL quota chain.
- [2026-07-24] [visual-gen] DECISION: qwen-image-* is generation-only (no VQA) — image recognition stays on the Qwen-VL seam anim-critique/qwen.ts; never route recognition through qwen-image.
- [2026-07-24] [game-systems] DELIVERED: AITestingSandbox scenario cards now carry honest run state — pure runFreshness.ts derives never-run/stale/current from lastRunAt vs updatedAt (UTC-safe SQLite parse, 60s tolerance) and the card shows a last-run stamp, a glyph+word Stale chip, and a note so a "Passed" pill can't read as live truth after an edit.
- [2026-07-24] [shared] CONVENTION: SQLite `datetime('now')` columns (updated_at etc.) reach the client as naive-UTC "YYYY-MM-DD HH:MM:SS" — normalize to UTC before `new Date()` when comparing them with JS ISO stamps, or the diff skews by the local offset.
- [2026-07-24] [evaluator] DELIVERED: DependencyGraph no longer shows a failed all-statuses fetch as the "no feature data yet" empty state (InlineErrorRetry + aria-live loading), and zoom now magnifies via a centred viewBox instead of a CSS scale() that cropped the graph inside overflow-hidden.
- [2026-07-24] [charts] CONVENTION: zoom an SVG by narrowing its viewBox, never `transform: scale()` — a scaled element keeps its layout box, so it crops inside an overflow-hidden container instead of magnifying.
- [2026-07-24] [project-setup] DELIVERED: BlueprintInspector now renders the previously-discarded BlueprintEntry.crossReferences as a counted section (bridge already returned it); note the panel is still not mounted by any parent view.
- [2026-07-24] [visual-gen/asset-forge] DELIVERED: failed generation jobs got a Retry (useForgeStore.retryJob re-runs the original MCP/local-runner/placeholder path from inputs already on the job) and the previously write-only promptHistory now surfaces as a "Recent prompts" recall row in PromptBuilder.
- [2026-07-24] [scene-composer] DELIVERED: SceneTree stopped faking "No scene loaded" on refresh failure (store keeps last scene + lastError → InlineErrorRetry + aria-live triad, visible Refresh button), deletes now go through ConfirmDialog, and rows became listbox/option with focus rings (fixing invalid nested <button>).
- [2026-07-24] [evaluator] DELIVERED: EconomySimulatorView's three hand-rolled bar charts (Gold Flow, Gini+histogram, Supply/Demand) are now keyboard/SR accessible — each bar is a focusable role=img with an aria-label, tooltips show on focus (group-focus-within) not just hover, .focus-ring, plus one sr-only series summary per chart.
- [2026-07-24] [evaluator] DELIVERED: WorkflowOrchestratorView ActiveWorkflowPanel now groups the DAG node list by module (per-module done/running/failed counts + collapsible sections that auto-collapse when a module is fully terminal) instead of one flat unordered list; single-module runs render flat as before.
- [2026-07-24] [material-lab] DELIVERED: MaterialPreview now renders normal/metallic/roughness maps (data maps in NoColorSpace, albedo sRGB) + honors normalStrength via normalScale, with per-texture GPU disposal on change/unmount — the preview no longer only shows albedo.
- [2026-07-24] [core-engine/ability] DELIVERED: deleted the dead blueprint/_orphan/ tree (~1.9k LOC of duplicate GAS editors superseded by live blueprint/* siblings) and promoted the only imported member, SimulationSandbox, to first-class blueprint/SimulationSandbox/.
- [2026-07-24] [game-systems] DELIVERED: BlueprintTranspiler C++ output now renders via shared CodeViewer (Shiki highlighting + copy/download), dropping the bespoke Copy button and the copiedHeader/copiedSource/onCopy prop chain threaded through index/TranspilePane.
- [2026-07-24] [core-engine/progression] DELIVERED: repointed the 4 live sub_progression/_internals components (XpTableGenerator, DRCodeGenerator, EncounterTTKSimulator, PrestigePreview) off the stale _internals/progression-data.ts onto the canonical _shared/data.ts, so the whole tab reads one dataset (exported XP DataTable now carries all 15 level rewards, not 8).
- [2026-07-24] [core-engine/bestiary] DELIVERED: enemy stat comparison is honest — ComparisonPanel shows "— not defined" (no bar, no fabricated diff) for stats an enemy lacks and averages only over peers that carry the stat; the card avg tick is suppressed for labels pooled across the two incompatible stat vocabularies.
- [2026-07-24] [game-systems] DELIVERED: DialogueView quest generator output no longer dead-ends — per-quest + whole-batch JSON copy (shared CopyButton) and a provenance-stamped .json download, with the QuestCard header un-nested (toggle + copy as siblings, aria-expanded/controls).
- [2026-07-24] [evaluator] DELIVERED: CrashAnalyzerView triage list is keyboard/SR operable (role=listbox + role=option rows with aria-selected and Enter/Space), pattern cards expand via a real aria-expanded button, and close/disclosure controls got names + focus rings.
- [2026-07-24] [a11y] CONVENTION: never wrap a row containing DecoratedCrashText/CrashTerm in a <button> (it renders tooltip buttons) — put the disclosure semantics on a dedicated chevron button instead.
- [2026-07-24] [game-systems] DELIVERED: AIBehaviorView test-suite mutations stopped failing silently — failed create keeps the typed input, failed delete/'mark running' name themselves, all via one shared InlineErrorRetry banner with an action-specific Retry.
- [2026-07-24] [core-engine/character] DELIVERED: Feel Playground is no longer a dead end — hand-tuned curves survive sub-tab navigation via a seed-stamped session cache (playground/curve-session.ts) and an Apply via CLI action dispatches the 11 derived UPROPERTY values to ARPGCharacterBase.
- [2026-07-24] [project-setup] DELIVERED: BlueprintInspector is now mounted in ProjectSetupModule (gated on hasProject, dims like ProjectFilesPanel) — superseding the "not mounted" note above; LiveStateSyncPanel, BridgeEndpointHealth, BidirectionalStateSyncPanel and BridgeDoctor remain orphaned.
- [2026-07-29] [judge-harness] DELIVERED: scripts/judge/ab-probe.ts + abRunner.ts (Task 4 of judge-harness-rebaseline) — sequential, resumable (ab-results.json append-per-cell) A/B probe measuring stripNonContent+includeNested's effect on judged scores; writes nothing to judge_verdicts, no draws spent, verified via temporary reverted stubs since payload.ts/includeNested/spendMeter.ts aren't in this worktree yet.
- [2026-07-29] [judge-harness] DECISION: this worktree's HEAD predates the judge spend-metering refactor (no src/lib/judge/spendMeter.ts, judge-run.ts still --output-format text) that already exists at base commit 9f181312 — integrate/typecheck Task 4 against a branch built on 9f181312+, not this worktree alone.
