# UI Perfectionist — Module Registry & Feature Graph (instance 2)

> Context: Module Registry & Feature Graph (Module System & Navigation)
> Files read: 7 (UI components + sampled non-UI)
> Total: 8 — Critical: 0, High: 3, Medium: 4, Low: 1

## 1. Inline `style={{ width, height }}` for tiny dots is widespread drift from Tailwind tokens
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/shared/ContextHealthBadge.tsx:139-145, 178-185, 290-299
- **Scenario**: The pulse-dot, static-field rows, and `ScanRow` all build small circular indicators using inline `style={{ width: 6, height: 6 }}` and `style={{ width: 5, height: 5 }}` plus inline `backgroundColor`. Three visually equivalent indicators are spelled out three different ways in one file (6px, 5px, 5px) and they reach for raw pixel numbers rather than Tailwind size utilities.
- **Root cause**: No shared `<StatusDot size="sm|xs" tone="success|warn|error|muted" />` primitive exists, so each consumer reaches for inline style with magic numbers.
- **Impact**: Three subtly different dot sizes inside one tooltip (6px button vs 5px rows) creates visual jitter the eye notices but can't name. New contributors will keep cloning the pattern, multiplying drift.
- **Fix sketch**: Extract a `StatusDot` primitive in `shared/` taking `size: 'xs' | 'sm' | 'md'` and `tone` mapped to status tokens (`STATUS_SUCCESS`, `MODULE_COLORS.content`, etc.). Replace the three inline-styled spans. Use Tailwind `w-1.5 h-1.5` / `w-2 h-2` and a small util class for glow rather than raw pixel `style`.

## 2. Color values bypass the design-token system via inline `style` and `var(--…)` arbitrary values
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/shared/ContextHealthBadge.tsx:191,219,272,297; src/components/modules/shared/FetchError.tsx:89-127
- **Scenario**: `ContextHealthBadge` mixes JS color constants (`STATUS_SUCCESS`, `MODULE_COLORS.content`) inline with raw `var(--text-muted)` strings. `FetchError` does not even use the Tailwind theme classes — it writes `text-[var(--text-primary)]`, `bg-[var(--bg-secondary)]`, `border-[var(--border-primary)]` with the arbitrary-value bracket syntax everywhere. Yet `ReviewableModuleView` and `RecommendedNextBanner` use the named utilities `text-text`, `text-text-muted`, `bg-surface`, `border-border` from the configured Tailwind theme.
- **Root cause**: Two parallel token systems coexist: the named Tailwind theme tokens and direct `var(--…)` references. `FetchError` was clearly authored before/outside the theme conventions used by sibling files.
- **Impact**: Token migrations or dark-mode adjustments must be made twice; the `var(--text-primary)` vs `text-text` mismatch is invisible in the editor but means any rename breaks one set silently. Also, `FetchError` references variable names (`--text-primary`, `--bg-secondary`, `--border-primary`) that don't appear in any other file in scope, suggesting they may not even be defined and are falling back to inherited colors.
- **Fix sketch**: Standardize `FetchError.tsx` on the Tailwind theme tokens already used by `ReviewableModuleView` (`text-text`, `text-text-muted`, `bg-surface`, `border-border`). Audit `globals.css` to confirm the `--text-primary` / `--bg-secondary` / `--border-primary` chain is wired (likely they are aliases — but the inconsistency is itself the issue). Lint rule: ban arbitrary-value `text-[var(--token)]` syntax in favour of named tokens.

## 3. Inline `onMouseEnter`/`onMouseLeave` background swaps for a button instead of `:hover`
- **Severity**: High
- **Category**: polish
- **File**: src/components/modules/shared/FetchError.tsx:101-114
- **Scenario**: The Retry button manually mutates `e.currentTarget.style.backgroundColor` on mouse-enter/leave to fake a hover state, because the base background is set inline via `statusBg(color, 0.08)` and Tailwind's `:hover` modifier can't reach it.
- **Root cause**: The button's color is dynamic (varies with `errorType`), so the author fell back to imperative DOM mutation instead of either CSS variables or a small set of variant classes.
- **Impact**: No keyboard-focus visual (focus-visible doesn't trigger the JS handler), no touch device fallback, and the hover flicker if a re-render happens mid-transition. Also, no `transition` on this button despite the `transition-colors` class — the inline-style change isn't animated.
- **Fix sketch**: Set the button background via a CSS custom property: `style={{ '--btn-bg': statusBg(color, 0.08), '--btn-bg-hover': statusBg(color, 0.20) }}` and a class `bg-[var(--btn-bg)] hover:bg-[var(--btn-bg-hover)] focus-visible:ring-2`. Restores keyboard focus styling and lets Tailwind's transition take effect.

## 4. Tooltip arrow border edge appears chipped due to `rotate-45` on a single-side-bordered square
- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/shared/ContextHealthBadge.tsx:279-281
- **Scenario**: The tooltip arrow is an 8×8 square rotated 45° with `border-l border-t`. Because it sits at `-top-1` (4px above) the body, the corner of the square pokes above the tooltip body and the unbordered right/bottom edges meet the body's top edge at a slight visible seam where colours differ.
- **Root cause**: Classic CSS-arrow trick is sensitive to subpixel positioning on non-integer DPRs; `-top-1` (4px) on a `√128/2 ≈ 5.66px` half-diagonal leaves ~1.6px of un-bordered diamond exposed.
- **Impact**: Slight visual blemish at the tooltip pointer — the kind of thing a UI perfectionist notices instantly. Also, `bg-surface-deep` arrow over a parent on a different background reveals the seam.
- **Fix sketch**: Either move the arrow to `-top-[5px]` (or `-top-1.5`) and clip the bottom half via `clip-path: polygon(0 0, 100% 0, 0 100%)` so only the bordered triangle shows; or use an SVG triangle filled with `bg-surface-deep` stroke `border-bright`. Both eliminate the diagonal seam.

## 5. `RecommendedNextBanner` rebuilds the same hover-tooltip pattern that `ContextHealthBadge` already implements
- **Severity**: Medium
- **Category**: component-architecture
- **File**: src/components/modules/shared/RecommendedNextBanner.tsx:82-95; src/components/modules/shared/ContextHealthBadge.tsx:157-282
- **Scenario**: `PrerequisitePill` builds an in-component CSS-driven hover tooltip (`group-hover:opacity-100`, custom delay, position math). `ContextHealthBadge` builds a different — Framer-driven — tooltip in the same shared folder. Different positioning logic, different timing, different arrow treatment, both labelled "tooltip".
- **Root cause**: No shared `<Tooltip>` primitive — each component invents its own.
- **Impact**: Two adjacent tooltips on the same page will animate, position, and dismiss differently. Maintenance burden is duplicated, and a11y semantics (which `ContextHealthBadge` partially has via `aria-label`, but `PrerequisitePill`'s tooltip lacks `role="tooltip"` and isn't tied to the button via `aria-describedby`).
- **Fix sketch**: Extract a `Tooltip` primitive (Radix UI tooltip or a thin custom one) used by both. Standardize delay (200ms open, 0ms close), positioning (top by default, with collision detection), and arrow rendering. Wire `aria-describedby` and `role="tooltip"` once.

## 6. Toast notification uses `absolute` positioning that breaks on small or non-positioned parents
- **Severity**: Medium
- **Category**: responsive
- **File**: src/components/modules/shared/ReviewableModuleView.tsx:423-439
- **Scenario**: The success/error toast is rendered with `className="absolute bottom-4 right-4"` inside the module's flex container. It's inside the same div that contains the slide-over panel and overlay; if a future layout change makes the parent non-relative, the toast will jump to the viewport. Also, since it's `absolute` (not `fixed`), it scrolls with the overflow container — feedback can scroll out of view while the user is reviewing further down the page.
- **Root cause**: Toasts are typically `fixed` to the viewport so they remain visible regardless of scroll position; this one is bound to the module shell.
- **Impact**: User scrolls down to read content, triggers an action that toasts, never sees confirmation. Inconsistent with how `sonner` (already in stack per project description) handles toasts globally.
- **Fix sketch**: Replace this ad-hoc toast with `sonner`'s `toast.success` / `toast.error`. Removes ~16 lines of bespoke styling, gets stacking, dismissal, and viewport pinning for free, and aligns with the rest of the app's toasts.

## 7. Quick Actions toggle button uses `display: none` via inline style instead of conditional render
- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/shared/ReviewableModuleView.tsx:367-374
- **Scenario**: The right-edge tab to open Quick Actions is always rendered but hidden via `style={{ ..., display: panelCollapsed ? undefined : 'none' }}`. There is no fade/slide transition tied to it, so when the panel opens the tab snaps out and when it closes it snaps back in. The slide-over panel itself transitions smoothly via `transition-transform duration-300`, but the tab does not.
- **Root cause**: Mixing inline `display: none` with a sibling that uses CSS transforms — the two animate on different mechanisms (one instant, one smooth), creating asymmetry.
- **Impact**: Opening feels smooth, closing feels jarring as the tab pops in mid-panel-slide-out. Small but noticeable on every interaction.
- **Fix sketch**: Render the tab unconditionally, animate it with `translate-x-full opacity-0 pointer-events-none` when panel is open and the same `duration-300 ease-out` so it slides off the right edge in sync with the panel sliding in. Or wrap in `<AnimatePresence>` with a short exit animation.

## 8. `MiniProgressArc` is hard-coded to amber instead of taking the module accent
- **Severity**: Low
- **Category**: visual-consistency
- **File**: src/components/modules/shared/RecommendedNextBanner.tsx:29-66
- **Scenario**: The "unmet prerequisite" pill uses an amber theme — fair, since it's a warning. But the mini-arc inside it is fixed to `text-amber-500/25` track and `text-amber-400` bar. Meanwhile the recommended-next pill uses `accentColor` (the per-module color). If a future caller wants to render `MiniProgressArc` outside an amber context, they'd have to fork it.
- **Root cause**: The arc was inlined for one usage and didn't generalize its color.
- **Impact**: Reusability is capped to amber contexts, which violates the "shared/" folder's reusability promise.
- **Fix sketch**: Pass `trackClassName` and `barClassName` (or a single `tone: 'warn' | 'accent' | 'neutral'`) so the arc is theme-able. Keep amber as the default for backwards compatibility.

