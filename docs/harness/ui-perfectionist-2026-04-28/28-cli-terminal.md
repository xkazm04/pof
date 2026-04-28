# UI Perfectionist — CLI Terminal

> Context: CLI Terminal (CLI Terminal & Task System)
> Files read: 11
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Three card primitives (ErrorCard, BuildSummaryCard, WarningAggregator) reimplement the same scaffold three different ways
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/cli/ErrorCard.tsx:80-86, src/components/cli/BuildSummaryCard.tsx:18-27, src/components/cli/WarningAggregator.tsx:24-25
- **Scenario**: ErrorCard, BuildSummaryCard, and WarningAggregator are all `motion.div`s with identical `mx-2 my-1 rounded border ... overflow-hidden` shells, severity-coded border/bg pairs, and chevron expand toggles — but each spells the styling differently. ErrorCard uses `border-status-red-strong bg-status-red-subtle` from a `SEVERITY_STYLES` map; BuildSummaryCard hand-codes `border-green-500/30 bg-green-500/[0.05]` vs. `border-status-red-strong bg-red-500/[0.05]`; WarningAggregator hand-codes `border-yellow-500/20 bg-yellow-500/[0.03]`. Three sibling cards, three opacity scales (`/05`, `/[0.05]`, `/[0.03]`), three border scales (`/30`, status tokens, `/20`).
- **Root cause**: No shared `<DiagnosticCard severity="error|warning|success">` primitive — each card was built independently. Severity → bg/border mapping lives inline in each file.
- **Impact**: Yellow warning bg differs in opacity between WarningAggregator (`/[0.03]`) and ErrorCard's warning variant (`/5`); green success bg in BuildSummaryCard doesn't match any token used elsewhere; future severity tweaks must be made in 3+ files. Expand affordance (chevron + button row) is duplicated row-for-row.
- **Fix sketch**: Extract `<DiagnosticCard severity expandable header footer>` in `src/components/cli/_shared/DiagnosticCard.tsx`. Centralize a `SEVERITY_TOKENS` map (error/warning/success/info) returning `{ border, bg, badge, icon, color }` once and consume from all three cards. Drive opacity from existing `OPACITY_5/8/12/20` constants instead of inline `/[0.05]` literals.

## 2. CLI_COLORS Tailwind classes interpolated into `hover:` and `disabled:hover:` produce broken selectors at build time
- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/cli/InlineTerminal.tsx:130, src/components/cli/TerminalHeader.tsx:66, src/components/cli/ErrorCard.tsx:184, src/components/cli/ErrorCard.tsx:208, src/components/cli/WarningAggregator.tsx:120
- **Scenario**: Multiple components write `hover:${CLI_COLORS.error}` and `disabled:hover:${CLI_COLORS.prompt}` where `CLI_COLORS.error` resolves to a multi-token string like `"text-red-400"`. Tailwind's JIT cannot scan template-literal-composed selectors, and even if the class string makes it into the DOM, the produced `disabled:hover:text-red-400` is one class only when `CLI_COLORS.prompt` is a single token — the moment it's e.g. `"text-blue-400 font-medium"` (or contains a space) the whole selector silently breaks. Today the X button in InlineTerminal and the disabled Fix button in ErrorCard rely on these.
- **Root cause**: Token constants designed for static usage are being string-concatenated into dynamic Tailwind class names.
- **Impact**: Hover red on the Close (X) button, hover blue-300 on disabled Fix buttons, and the Trash button's hover-error state can fail to apply (no JIT scan) leading to dead hover states. Inconsistent across light/dark refactors.
- **Fix sketch**: Either (a) export `CLI_COLORS` as a static class-name map with full literals (`error: 'text-red-400'`, `errorHover: 'hover:text-red-400'`) and use `${CLI_COLORS.errorHover}`, or (b) replace these with named utility classes (`hover:text-status-error`) backed by Tailwind theme. Add an ESLint rule (`no-restricted-syntax`) banning template-literal `hover:${...}` patterns.

## 3. Magic-number sizing on textarea and resize handle drifts from the design-system spacing scale
- **Severity**: Medium
- **Category**: Polish / Magic Numbers
- **File**: src/components/cli/TerminalInput.tsx:42-56, src/components/cli/InlineTerminal.tsx:95-102
- **Scenario**: TerminalInput hand-tunes `mt-[5px]`, `mt-[3px]`, `height: '20px'`, `maxHeight: '88px'`, and `leading-[20px]`. InlineTerminal's resize handle uses `w-[3px] h-[3px]` dots that grow to `w-1 h-1` on hover. None of these come from spacing tokens — they're pixel-perfect adjustments to compensate for icon-vs-text baseline misalignment.
- **Root cause**: Lack of a baseline-aligned input primitive; the `>` prompt glyph needs an awkward `mt-[5px]` offset because `text-xs font-mono` doesn't share the textarea's line-box.
- **Impact**: Any future Tailwind v4 spacing scale change (e.g. moving `text-xs` from 12/16 to 12/18) silently breaks the alignment. The `88px` max-height (4 lines × 20px + chrome) is undocumented and will desync if line-height changes. Bottom Send/Square buttons sit at `mt-[3px]` independently of the textarea, so the column-alignment is fragile.
- **Fix sketch**: Replace `mt-[5px]` / `mt-[3px]` with `items-center` + a wrapping flex row that aligns icon to text baseline naturally, or extract a `<TerminalLineRow>` primitive. Promote `20`, `88`, and `4` (lines) to named constants (`TERMINAL_INPUT_LINE_HEIGHT`, `TERMINAL_INPUT_MAX_LINES`) at top of file. Use `min-h-/max-h-` Tailwind utilities backed by the spacing scale.

## 4. Empty state and prompt-suggestion chips duplicate ChipButton scaffolding three times in the same module
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/cli/TerminalOutput.tsx:697-712, src/components/cli/SuggestedActions.tsx:238-253, src/components/cli/SuggestedActions.tsx:163-173
- **Scenario**: Three places render the same "accent-colored pill button": the empty-state STARTER_PROMPTS chips (TerminalOutput), the suggested-action chips (SuggestedActions), and the Undo button in UndoSnackbar. All three repeat the exact `style={{ color: accentColor, backgroundColor: withOpacity(accentColor, OPACITY_8), border: '1px solid ' + withOpacity(accentColor, OPACITY_20) }}` pattern with different paddings (`px-2.5 py-1` vs `px-2 py-0.5`) and radii (`rounded-full` vs `rounded-md` vs `rounded`).
- **Root cause**: No `<AccentChip>` / `<AccentPill>` primitive in this module despite three obvious consumers. SuggestedActions also renders entity tags in TerminalOutput.tsx with yet a fourth variant of the same recipe (different opacity tokens — `OPACITY_8/12` instead of `OPACITY_8/20`).
- **Impact**: Visual drift: the same accent color produces 4 different chip silhouettes across the terminal, making them feel like unrelated affordances. The opacity pair `(8, 20)` vs `(8, 12)` is a deliberate-looking choice that's actually inconsistency.
- **Fix sketch**: Extract `<AccentChip variant="pill|md|sm" accentColor>` to `src/components/cli/_shared/AccentChip.tsx`. Define exactly two opacity-pair recipes (subtle, prominent) and forbid ad-hoc values. Replace all four call sites; the EntityTags chip can also adopt this primitive with its semantic color override.

## 5. Inline `style={{ color: ... }}` for icon tinting bypasses the theme in ~25 places, blocking theme switching
- **Severity**: High
- **Category**: Design System
- **File**: src/components/cli/TerminalHeader.tsx:47, 62, 84; src/components/cli/TerminalInput.tsx:42, 63; src/components/cli/InlineTerminal.tsx:109-115; src/components/cli/TerminalOutput.tsx:684, 752, 769; src/components/cli/SuggestedActions.tsx:229, 242
- **Scenario**: Across the module, every accent/status icon is colored via inline `style={{ color: MODULE_COLORS.core }}` rather than Tailwind classes. This is a deliberate pattern for per-session accent coloring (which is correct) — but it's also used for static UI chrome like the title-bar Terminal icon, the Send button, the Working… spinner, and the unseen-count text. These don't need to vary per session.
- **Root cause**: Mixing per-session dynamic accent (legitimate inline style) with static brand chrome (should be a class) under one mental model.
- **Impact**: Theme/contrast adjustments at the CSS-variable layer (e.g. high-contrast mode, light theme) can't override icon colors that are set via inline style with hex strings from `MODULE_COLORS.core`. Print/screenshot-with-different-theme produces stuck colors. Also makes it impossible to write a `:hover` rule that brightens the icon since inline style wins.
- **Fix sketch**: Audit all `style={{ color: MODULE_COLORS.* }}` sites. Where the color is *static* (title-bar icon, Send button arrow, Working spinner) replace with a Tailwind class like `text-accent` backed by the theme. Reserve inline style strictly for the dynamic per-session `accentColor` prop — and document this distinction in a comment at the top of `TerminalOutput.tsx`.

## 6. Streaming/idle state indicator is rendered three different ways across header, output footer, and InlineTerminal header
- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/cli/TerminalHeader.tsx:75-83, src/components/cli/TerminalOutput.tsx:751-756, src/components/cli/InlineTerminal.tsx:108-118
- **Scenario**: "Currently streaming" is shown in three places simultaneously: (1) TerminalHeader status bar shows `Loader2 + "Running"` in `CLI_COLORS.warning`; (2) TerminalOutput renders a separate `Loader2 + "Working..."` row at the bottom in `MODULE_COLORS.core` (blue); (3) InlineTerminal swaps the title-bar Terminal icon for a `Loader2` plus a `text-2xs` "running" pill in `MODULE_COLORS.setup` (different hue again). Three different colors, two different verbs ("Running" vs "Working"), three different sizes (`w-2.5 h-2.5`, `w-3 h-3`, `w-3 h-3`).
- **Root cause**: Each component grew its own streaming indicator; no shared `<StreamingPulse>` or single source of truth.
- **Impact**: The user sees the same boolean reflected in three visually inconsistent ways at once — feels noisy and uncoordinated, especially for accessibility users relying on consistent state cues. The verb mismatch ("Running" vs "Working") is jarring.
- **Fix sketch**: Pick one verb (suggest "Running") and one accent (`CLI_COLORS.warning` for status, since it overlaps with "in-progress"). Remove the redundant footer "Working..." row in TerminalOutput — the header already shows it. Or, extract `<StreamingIndicator size="xs|sm">` and use it in both InlineTerminal and TerminalHeader; drop the third variant.

## 7. Suggestion-chip dismiss state has 3 phases ('visible' / 'pending-undo' / 'dismissed') but only 2 visible UI states; missing announcement of the auto-expire countdown
- **Severity**: Medium
- **Category**: Missing States / Polish
- **File**: src/components/cli/SuggestedActions.tsx:142-177, 188-213
- **Scenario**: When the user dismisses suggestions, an undo snackbar appears for 5000ms then silently disappears. There's no progress indicator of the time remaining (no shrinking bar, no countdown), and no `aria-live` region — keyboard/screen-reader users get no signal that an action is recoverable. The Undo button is also styled as an "accent chip" (see finding #4) but the snackbar itself uses `border-b border-border bg-surface` rather than the suggestion bar's `border-b border-border bg-surface` — they happen to match, but neither has a distinct affordance from the suggestion strip itself.
- **Root cause**: Snackbar built as a static container without temporal feedback affordance.
- **Impact**: Users may not realize the action is undo-able for a finite window and miss it. The visual continuity with the suggestion strip means the dismissal feels half-complete instead of confirmed.
- **Fix sketch**: Add a thin progress bar at the bottom of UndoSnackbar that animates from `width: 100%` to `0%` over `UNDO_TIMEOUT_MS`. Add `role="status" aria-live="polite"` so it announces "Suggestions dismissed — Undo available for 5 seconds". Differentiate background slightly (e.g. `bg-surface-deep`) from the suggestions strip so the state change reads visually.

## 8. Selection toolbar position math has no viewport-edge clamping on the right side or below the visible scroll container
- **Severity**: Low
- **Category**: Responsive / Polish
- **File**: src/components/cli/TerminalOutput.tsx:262-299, 442-470
- **Scenario**: `SelectionToolbar` positions itself at `left: Math.max(8, state.x)` and `top: Math.max(0, state.y - 4)` with `transform: translateY(-100%)`. There's a left/top guard but no right-edge clamp — selecting text near the right edge of the terminal pushes the toolbar (~3 buttons + dividers, ~190px wide) off-screen. The hard-coded `- 80` to "center roughly" assumes a fixed toolbar width. There's also no clamping to the container's bottom for downward-flipping when there's no room above.
- **Root cause**: Centering math written before measuring the actual rendered toolbar; no `useLayoutEffect` to read `getBoundingClientRect` and adjust.
- **Impact**: In the compact terminal (often a narrow inline panel), selecting the right-half of a long log line covers the toolbar's right edge. Selecting at the top of the scroll container makes the toolbar render with `top: -4` and the `translateY(-100%)` puts it fully off-screen above.
- **Fix sketch**: After mount, measure the toolbar's `offsetWidth` and clamp `left` to `containerWidth - toolbarWidth - 8`. Detect if `state.y < toolbarHeight + 8` and flip to `top: state.y + lineHeight + 4` without the `-100%` transform. Replace the magic `-80` with the measured half-width.
