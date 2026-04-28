# UI Perfectionist — UE5 & POF Bridge

> Context: UE5 & POF Bridge (Project Setup & UE5 Bridge)
> Files read: 6 (5 panel .tsx + ConnectionStatusBadge)
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Three independent ad‑hoc "action button" primitives reinvented per panel
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:254-262, 390-398, 483-491, 717-735; LiveStateSyncPanel.tsx:225-244; BidirectionalStateSyncPanel.tsx:440-456, 515-535, 710-723; LiveCodingPanel.tsx:162-177, 474-491; BridgeEndpointHealth.tsx:255-266
- **Scenario**: Every panel renders a "tinted action button" with the same construction: `flex items-center gap-1.5 px-2.5/3 py-1/1.5 rounded-md/lg text-xs font-bold border transition-colors disabled:opacity-40` plus inline `style={{ borderColor: \`${COLOR}40\`, backgroundColor: \`${COLOR}${OPACITY_10/15}\`, color: COLOR }}`. The same pattern is duplicated 15+ times across the five panels for Connect / Disconnect / Compile / Hot-Patch / Teleport / Search / Call etc.
- **Root cause**: No shared `<TintedButton color radius?>` (or `<ActionButton tone="emerald|orange|cyan|error">`) primitive — every panel constructs the exact same tinted-border + tinted-bg + tinted-text triple by hand from `chart-colors` constants.
- **Impact**: Drift is already visible — some buttons use `rounded-md`, others `rounded-lg`; `px-2.5 py-1` vs `px-3 py-1.5` vs `px-2 py-1`; some use `OPACITY_10` for bg, others `OPACITY_15`, others raw `40` hex; `text-xs font-bold` vs `text-xs font-medium`. A future tone tweak (e.g. WCAG contrast pass on emerald-on-emerald-tint) requires a 15+ site grep.
- **Fix sketch**: Extract `<TintButton tone="emerald" size="sm|md" icon={Wifi}>Connect</TintButton>` in `src/components/ui/`. Map `tone` → color constant internally. Centralize the `border ${color}40 / bg ${color}${OPACITY_10} / text ${color}` formula and the `px/py/rounded/font` size tokens. Replace all 15+ inline call sites; this kills the next-largest consistency risk in the bridge surface.

## 2. Connection-status pill is shared but two panels invented their own "LIVE" / "Live" badges anyway
- **Severity**: High
- **Category**: Visual Consistency
- **File**: src/components/modules/project-setup/BidirectionalStateSyncPanel.tsx:394-405; LiveStateSyncPanel.tsx:183 (uses `label="Live"` override); LiveCodingPanel.tsx:151-158 (text-only "Connected — Live Coding enabled"); src/components/ui/ConnectionStatusBadge.tsx:17-23
- **Scenario**: `ConnectionStatusBadge` is the canonical pill (dot + pulse + label), already used by UE5RemoteController, LiveStateSyncPanel, and BridgeEndpointHealth. But BidirectionalStateSyncPanel re-rolls a custom pulsing `LIVE` pill with its own framer-motion `animate={{ opacity: [0.7, 1, 0.7] }}`, distinct visual (uppercase text, `Radio` icon, 2s breath); LiveCodingPanel emits its connected/unavailable status as raw inline `<span style={{ color: STATUS_SUCCESS }}>` text in the description line.
- **Root cause**: The shared badge wasn't extended to support an "icon prefix" or a "live/streaming" variant, so panels needing more visual energy (or less) bypassed it.
- **Impact**: Three different visual languages for "this stream is alive": pulsing-dot pill (canonical), pulsing-text pill (Bidirectional), plain-color text (LiveCoding). Users reading two panels side-by-side cannot pattern-match "is this thing live?" from a glance.
- **Fix sketch**: Add a `variant?: 'pill' | 'pulse' | 'text'` and `icon?: LucideIcon` prop to `ConnectionStatusBadge`. Replace BidirectionalStateSyncPanel's custom motion span with `<ConnectionStatusBadge status="connected" label="LIVE" icon={Radio} variant="pulse" />`. Replace LiveCodingPanel's inline `<span style>` with the same component (variant text). One source of truth for "is connected" iconography.

## 3. Inconsistent "section disclosure" header pattern across the bridge panels
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/project-setup/LiveCodingPanel.tsx:332-358, 388-403, 498-513; LiveStateSyncPanel.tsx:293-307, 374-393, 437-447; BidirectionalStateSyncPanel.tsx:482-504, 561-572, 654-664, 734-751, 788-813; BridgeEndpointHealth.tsx:359-390
- **Scenario**: Every collapsible section repeats the same skeleton: `<button class="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/3 transition-colors" aria-expanded ...>{open ? ChevronDown : ChevronRight}<Icon />{label}{badge}</button>` — written ~12 times across four panels. Each instance also re-implements the colored-icon + colored-uppercase-label + count-pill triple by hand.
- **Root cause**: No `<DisclosureSection title icon color count badge>` primitive. Section headers are pure copy-paste, with subtle drift: some pass `aria-controls`, some don't; some wrap the body in `AnimatePresence + motion.div height:auto` (Bidirectional), others toggle with raw conditional render (LiveCoding/LiveStateSync); some put the count pill on the right via `ml-auto`, others inline.
- **Impact**: Animations are inconsistent (some sections animate height, some pop in instantly). Accessibility is uneven — `aria-controls` is sometimes absent. Future a11y or motion-reduce work has to touch ~12 sites.
- **Fix sketch**: Build `<DisclosureSection id title icon color count={n} badgeNode? defaultOpen?>{children}</DisclosureSection>`. Standardize on `AnimatePresence + height: auto` for the body (with `prefers-reduced-motion` guard). Wire `aria-expanded`/`aria-controls` once. Replace all ~12 copies — a single `motion-reduce` pass then covers every section in the bridge module.

## 4. Hot-Patch pipeline stepper is bespoke; should be a reusable PipelineStepper primitive
- **Severity**: High
- **Category**: Component Architecture / Design System
- **File**: src/components/modules/project-setup/LiveCodingPanel.tsx:228-271 (PIPELINE_STEPS, phaseIndex, phaseColor, phaseLabel + render)
- **Scenario**: LiveCodingPanel renders a 4-step pipeline (Write → Compile → Verify → Done) with active/past/failed states, ArrowRight separators, color-coded step icons, and a status pill summarizing the active phase. The logic (phase ordering array, phase-to-color map, phase-to-label map, isPast/isActive/isFailed derivation) is ~80 lines of bespoke code in the panel.
- **Root cause**: The "ordered phase pipeline with colored progress" UI is genuinely useful UX but hand-built once. Verification engine and build-pipeline both produce phase streams in the same shape — they will eventually want the same widget.
- **Impact**: The current implementation has a subtle bug seam: when `patchPhase === 'complete'`, `isPast` is forced true for *all* steps via the `|| patchPhase === 'complete'` clause, which means the icon for the active step gets `CheckCircle2` rather than the step's own icon — fine for "Done" but inconsistent with the `isActive` branch. More importantly, no other phase-driven panel can reuse it.
- **Fix sketch**: Extract `<PipelineStepper steps={[{id,label,icon,color}]} currentPhaseId failed? />` to `src/components/ui/`. Internalize the past/active/failed derivation. Accept a typed phase order. Then the verification-engine and build-pipeline panels can adopt it. Re-test the `complete` edge case while extracting.

## 5. Hex-with-opacity-suffix tokens are mixed with `OPACITY_*` constants — drift is already inconsistent
- **Severity**: Medium
- **Category**: Design System
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:74,76,99,101,232,258,394,475,543 (raw `${COLOR}15`, `${COLOR}40`, `${COLOR}50`, `rgba(255,255,255,0.06)`); LiveStateSyncPanel.tsx:332,337,340 (raw `${ACCENT_CYAN}15`); BidirectionalStateSyncPanel.tsx & LiveCodingPanel.tsx (use `${COLOR}${OPACITY_15}` constants); BridgeEndpointHealth.tsx (uses constants consistently)
- **Scenario**: Newer panels (LiveCoding, Bidirectional, BridgeEndpointHealth) use named `OPACITY_8/10/15/20` constants from `chart-colors`. UE5RemoteController and parts of LiveStateSyncPanel still concatenate raw hex pairs (`${ACCENT}15`, `${ACCENT}40`, `${ACCENT}50`, `${color}60`), and additionally hard-code rgba `rgba(255,255,255,0.06)`, `rgba(255,255,255,0.08)`, `rgba(0,0,0,0.4)`.
- **Root cause**: The `OPACITY_*` token system was introduced after UE5RemoteController and LiveStateSyncPanel were written, and they were never migrated. The rgba hard-codes pre-date even the hex-suffix convention.
- **Impact**: Three syntaxes co-exist for the same concept. `${ACCENT}50` (UE5RemoteController:101) and `${ACCENT}40` (UE5RemoteController:76) have no equivalent in `OPACITY_*`, so a token sweep would miss them. Designers tweaking the opacity scale cannot use grep on `OPACITY_`.
- **Fix sketch**: Add `OPACITY_30/40/50/60` to `chart-colors` if the steps are intentional, else snap callers to the existing 4-step scale. Migrate UE5RemoteController and LiveStateSyncPanel to use the constants. Replace the three rgba hard-codes with semantic CSS vars (`--border-subtle`, `--border-faint`, `--scrim-1` etc.) — they appear to encode "border tier" not literal color.

## 6. JSON viewers, history rows, log rows, and "empty state" placeholders are duplicated across panels
- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:85-116 (JsonViewer), 528-534 (empty state), 549-602 (history rows); LiveCodingPanel.tsx:514-549 (history rows), 516-518 (empty state); LiveStateSyncPanel.tsx:280-286, 396-397 (empty states); BidirectionalStateSyncPanel.tsx:461-473 (empty state), 846-868 (log rows)
- **Scenario**: `JsonViewer` is a polished local sub-component in UE5RemoteController only — the other panels would benefit (the bidirectional sync log shows raw `JSON.stringify` truncated to 30 chars instead). History/log row layouts are re-implemented per panel with subtle differences: UE5RemoteController uses a status dot + action + duration + time, LiveCodingPanel uses dot + time + filename + phase pill + duration, BidirectionalStateSyncPanel uses time + direction badge + level icon + category + message. Three "empty state" patterns (icon at 30% opacity + heading + sub-line) are reimplemented.
- **Root cause**: Local sub-components inside panel files instead of `src/components/ui/`. Cross-panel reuse never considered.
- **Impact**: Visual inconsistency in adjacent surfaces — the user opens a "history" disclosure in UE5RemoteController and a "history" disclosure in LiveCodingPanel and gets noticeably different row anatomies. Empty states have inconsistent vertical rhythm (`py-12` vs `py-8` vs inline `py-1`).
- **Fix sketch**: Extract `<JsonViewer>` and `<EmptyState icon title subtitle action?>` to `src/components/ui/`. Define a `<TimelineRow timestamp tone label badge metrics>` for the history/log family. Use them across all three panels.

## 7. Form input fields are reinvented in every panel; only UE5RemoteController has an `InputField` wrapper
- **Severity**: Medium
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:118-135 (local InputField); LiveCodingPanel.tsx:412-421, 429-438, 447-455, 461-469 (raw `<input>` and `<textarea>` x4); LiveStateSyncPanel.tsx:107-114, 119-125, 258-269 (raw `<input>` x3); BidirectionalStateSyncPanel.tsx:602-632, 678-705 (raw `<input>` x7)
- **Scenario**: UE5RemoteController extracts an `InputField label value onChange placeholder mono` pattern. Every other panel writes `<label htmlFor="…" class="text-2xs font-bold text-text-muted uppercase tracking-wider">…</label><input class="w-full text-xs font-mono px-2 py-1 rounded bg-surface-deep border border-border/40 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50" />` from scratch — and they drift: `text-2xs` label vs `text-xs` label, `px-2 py-1` vs `px-2 py-1.5` vs `px-2.5 py-1.5`, `bg-surface-deep` vs `bg-background`, `focus:border-blue-500/50` vs `focus:border-[color:var(--focus-border)]`.
- **Root cause**: `InputField` was scoped local to one file rather than promoted to shared UI.
- **Impact**: ~14 raw inputs across four panels with three different focus colors (literal blue-500, CSS var `--focus-border`, none) and two different background tokens. A11y/focus styling cannot be standardized centrally.
- **Fix sketch**: Promote `InputField` (and a sibling `TextAreaField`) to `src/components/ui/`. Standardize on `--focus-border` (already used in newer panels). Migrate all panels to it.

## 8. Mini SVG viewport "minimap" has no axis labels, no scale legend, and silently clamps off-screen positions
- **Severity**: Low
- **Category**: Polish / Affordances
- **File**: src/components/modules/project-setup/LiveStateSyncPanel.tsx:330-365
- **Scenario**: The viewport section renders a 200×60 SVG showing camera (x,y) location + yaw direction as a dot with a 10-unit heading line. It has a faint cyan grid but no axis labels, no scale annotation (the `±50000 UU` range is hard-coded in code only), and silently clamps the dot to `[4,196] × [4,56]` so a camera at (200000, 0) renders at the right edge identically to (50000, 0).
- **Root cause**: Quick-implementation: the fixed clamp prevents render bugs but is invisible to the user.
- **Impact**: The minimap pretends to be a position indicator but lies about positions outside the (±50k UU) box. Users can't tell when the dot has saturated.
- **Fix sketch**: Add a small "X / Y range: ±50000 UU" caption beneath, or render the camera dot with a different stroke (e.g. dashed ring) when its true position is outside the clamp range — add a one-line conditional in the SVG. Optionally label the cardinal directions (N/E/S/W) at the corners.
