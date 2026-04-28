# UI Perfectionist — UI Primitives & Shared Infrastructure

> Context: UI Primitives & Shared Infrastructure (App Shell & Shared Infrastructure)
> Files read: 22
> Total: 10 — Critical: 0, High: 4, Medium: 5, Low: 1

## 1. Button has no `disabled` styling, no `loading` state, no `icon` slot, and missing semantic variants — consumers fork it as `WizardButton`
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/ui/Button.tsx:6-39
- **Scenario**: The shared `Button` exposes only `solid | outline | ghost | glass` variants and `sm | md | lg` sizes. It silently passes `disabled` through to the DOM but adds no `opacity`/`cursor-not-allowed` styles, has no `loading` prop, no built-in icon slot, and offers no semantic intent (`primary | danger | warning | info`). The project-setup wizard already responded to this gap by inventing a parallel `WizardButton` (src/components/modules/project-setup/WizardButton.tsx:1-66) with `primary | warning | info` variants, `loading`, `loadingLabel`, `icon`, `disabled:opacity-40 disabled:cursor-not-allowed`. That fork is clearly the correct API — but it lives outside `components/ui/` and is unreachable to the rest of the app.
- **Root cause**: The primitive's variant list is style-only (visual treatments), not semantic-intent. Loading + disabled + icon are universally needed but the primitive ships without them, so callers either reinvent or omit accessibility cues entirely.
- **Impact**: Buttons across the codebase look inconsistent when disabled (some get no visual feedback at all), and async actions either lack spinners or duplicate the `Loader2` import dance. Two divergent button surfaces (`Button`, `WizardButton`) is exactly the design-system drift the harness flagged.
- **Fix sketch**: Promote `WizardButton`'s API into `components/ui/Button.tsx`: add `intent?: 'primary' | 'danger' | 'warning' | 'info'` orthogonal to the existing visual `variant`, add `loading`, `loadingLabel`, `leftIcon`, `rightIcon`, and bake in `disabled:opacity-40 disabled:cursor-not-allowed`. Have `WizardButton` re-export `Button` with curated defaults (or delete it). Keep `aria-busy={loading}` for SR users.

## 2. `Tooltip` has no keyboard/focus support, no escape-to-dismiss, no portal, no positioning logic, and no role attributes
- **Severity**: High
- **Category**: Accessibility / Component Architecture
- **File**: src/components/ui/Tooltip.tsx:10-23
- **Scenario**: The Tooltip primitive opens on `onMouseEnter` only — keyboard-focused triggers can never reveal the tip. There is no `role="tooltip"` on the popup, no `aria-describedby` wiring to the trigger, no `Escape` handler, no portal (so `overflow:hidden` ancestors clip it), and `top: bottom-full` is hardcoded with no flip-on-collision. `TruncateWithTooltip.tsx:75` correctly sets `role="tooltip"` — the base `Tooltip` does not.
- **Root cause**: Tooltip was scaffolded as a hover-only span, not as an accessible disclosure. The pattern was never extended even though `TruncateWithTooltip` (in the same folder) demonstrates the missing pieces.
- **Impact**: Every tooltip in the app is invisible to keyboard users and screen readers — a WCAG 2.1.1 (Keyboard) and 1.4.13 (Content on Hover or Focus) failure. Tooltips inside scrollable cards get visually clipped.
- **Fix sketch**: Add `onFocus`/`onBlur` to mirror hover behavior, generate a stable id and link via `aria-describedby` on the trigger clone, set `role="tooltip"` on the popup, listen for `Escape` to close while focused, and either use a portal or document-relative positioning with collision detection. Make `side?: 'top'|'bottom'|'left'|'right'` a prop (already present in `TruncateWithTooltip`).

## 3. `motion.ts` ships four overlapping motion-config systems — DURATION, SPRING, MOTION_CONFIG, ANIMATION_PRESETS — with conflicting numbers
- **Severity**: High
- **Category**: Design System / Consistency
- **File**: src/lib/motion.ts:1-75
- **Scenario**: Four parallel taxonomies for the same thing live in one file: `DURATION` (0.12/0.22/0.45 + ease `[0.16,1,0.3,1]`), `SPRING` (snappy=300/25, gentle=200/20), `MOTION_CONFIG` (standard=0.3/`[0.22,1,0.36,1]`, spring=400/30, micro=0.15), and `ANIMATION_PRESETS` (entrance=0.3, fill=0.7, spring=300/20, stagger). `EASE_OUT = [0.16,1,0.3,1]` and `MOTION_CONFIG.standard.ease = [0.22,1,0.36,1]` are *different* easing curves both presented as the canonical entrance ease. `SPRING.snappy = 300/25` vs `MOTION_CONFIG.spring = 400/30` vs `ANIMATION_PRESETS.spring = 300/20` are three different "snappy" springs. `STAGGER.fast=0.04`, `MOTION_CONFIG.stagger=0.06`, `ANIMATION_PRESETS.stagger.default=0.05` — three different stagger increments.
- **Root cause**: The token file accreted instead of being refactored — each new feature added another preset object rather than reconciling with the existing one.
- **Impact**: Animations look subtly different across the app depending on which preset the author imported. The 42 files using `MOTION_CONFIG`/`ANIMATION_PRESETS` plus the rest using `DURATION`/`SPRING` cannot be visually consistent because the source-of-truth disagrees with itself.
- **Fix sketch**: Pick ONE: keep `DURATION`+`SPRING`+`STAGGER`+`EASE_OUT`+`EASE_FILL` (the most-used), delete `MOTION_CONFIG` and `ANIMATION_PRESETS`, and codemod the 14 files that import them. If the deprecated objects must stay temporarily, mark with `@deprecated` JSDoc and have them point to the canonical token (e.g. `MOTION_CONFIG.standard = { duration: DURATION.base, ease: EASE_OUT }`).

## 4. Hierarchy of card primitives is unclear: `Card` is a thin re-export, `SurfaceCard` is the real one, no headed `Card.Header/.Body/.Footer` slots
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/ui/Card.tsx:1-3, src/components/ui/SurfaceCard.tsx:1-39
- **Scenario**: `Card.tsx` is a 3-line `export { SurfaceCard as Card } from './SurfaceCard'`, and a grep across `src` finds zero importers of `@/components/ui/Card` while `SurfaceCard` has 1242 occurrences. The primitive itself is intentionally minimal (good) but offers no `Card.Header`, `Card.Body`, `Card.Footer`, `Card.Title` subcomponents — so every consumer hand-rolls `<div className="px-4 py-3 border-b ...">` for headers (inconsistent paddings, divider treatments). `accent` takes a free-form Tailwind class string (`"border-l-blue-400"`) instead of a color — defeats the typed-color discipline used everywhere else (`accentColor: string` hex in Button/EmptyState/StatStrip).
- **Root cause**: The primitive solved "outer container" but not the internal layout grammar that consumers actually need; the `Card` re-export was created as a migration shim and never resolved.
- **Impact**: Each module renders card headers with slightly different paddings, type weights, and divider opacities — visible as a "lots of cards but each one feels different" inconsistency. The unused re-export confuses search/auto-imports.
- **Fix sketch**: Either (a) delete `Card.tsx` and standardize on `SurfaceCard`, or (b) make `Card` the canonical export and mark `SurfaceCard` deprecated — pick one. Add `SurfaceCard.Header`, `.Body`, `.Footer` compound subcomponents with shared paddings (`px-4 py-3`) and a typed `divider` variant. Change `accent?: string` from "Tailwind class" to a hex/CSS-var color and apply via inline `borderLeftColor` style for parity with the rest of the system.

## 5. `chart-colors.ts` opacity tokens are inconsistent in granularity and have a footgun: numeric label != actual percent
- **Severity**: Medium
- **Category**: Design System
- **File**: src/lib/chart-colors.ts:75-120
- **Scenario**: The opacity scale exposes 19 named tokens (`OPACITY_0 … OPACITY_90`) including off-grid values like `OPACITY_22`, `OPACITY_37`, `OPACITY_56`, `OPACITY_87`. Several names are subtly wrong: `OPACITY_2 = '05'` (decodes to ~2%, value `05` is hex `5/255 ≈ 2%` — fine), `OPACITY_3 = '08'` (hex `08/255 = 3.1%`), `OPACITY_4 = '0a'` (hex `0a/255 = 3.9%`) — the human-named percent and the actual hex byte don't always match cleanly, e.g. `OPACITY_37 = '60'` is actually `96/255 = 37.6%` so close, but `OPACITY_22 = '38'` is `56/255 = 21.96%`. A fresh contributor reading `OPACITY_37` will reasonably assume "37%" is a round number and trust it for math.
- **Root cause**: The scale was reverse-engineered from existing magic numbers in components (each component picked a hex it liked, then a token was created to label it). Result: 19 nearly-overlapping tokens (`OPACITY_30 = '4d'` and `OPACITY_37 = '60'` are 7% apart visually).
- **Impact**: Hard for designers to tell `OPACITY_30` from `OPACITY_37` from `OPACITY_40` at a glance, encourages "pick whichever was here before" rather than principled choice. The redundant `BORDER_DEFAULT/HOVER/SUBTLE` semantic aliases are the right pattern but only cover 3 of 19 cases.
- **Fix sketch**: Cull to a 6-stop scale (`5 / 10 / 20 / 40 / 60 / 80`) plus the existing semantic aliases (`BORDER_DEFAULT`, `BORDER_HOVER`, `BG_SUBTLE`, `BG_MEDIUM`, `GLOW_FAINT`). Mark off-grid tokens `@deprecated` with a "use BORDER_HOVER instead" hint. Long term: replace string suffix concatenation with a `rgba()` helper that takes a number 0-1 and short-circuits the footgun.

## 6. `Badge` is missing `info`, `neutral`, `subtle`, and `live` variants — and has no size/intent props, forcing inline style overrides
- **Severity**: Medium
- **Category**: Design System / Missing Variants
- **File**: src/components/ui/Badge.tsx:3-22
- **Scenario**: Badge offers only `default | success | warning | error`. The codebase needs at least: `info` (currently a different Badge import in StatusChecklist/ToolingBootstrapPanel uses `variant="info"` against a non-shared Badge), `neutral`/`muted`, `live` (with pulsing dot — currently every consumer rolls their own), and `count` (numeric badges — see InteractivePill's count pill at lines 86-99 which is functionally a Badge but inlined). There is no size prop (every Badge is the same `text-2xs px-1.5`), no `dot` prop, and no `accent` color override — `style={{ color }}` gets sprinkled in callers.
- **Root cause**: Initial cut covered the four CSS-color states (success/warning/error/default) and stopped; downstream needs (info, count badges, live status) have been solved one-off.
- **Impact**: At least three badge-shaped components reinvent the primitive (InteractivePill count pill, ConnectionStatusBadge dot-with-text, the various "expansion"/"hardcoded"/"loctext" status pills in LocalizationPipelineView). Visual inconsistency in tone, padding, and font-weight.
- **Fix sketch**: Add `info`, `neutral`, `accent` (free hex) variants; add `size?: 'xs' | 'sm'`; add `dot?: boolean` for leading-dot style; add `pulse?: boolean` (delegates to `ConnectionStatusBadge`'s framer animation). Have `ConnectionStatusBadge` and InteractivePill's count chip consume Badge instead of re-rolling.

## 7. `InteractivePill` and `MultiInteractivePill` have weak a11y: no `role="tablist"/"tab"`, no `aria-pressed`, no keyboard arrow navigation, and no focus-visible ring
- **Severity**: Medium
- **Category**: Accessibility
- **File**: src/components/ui/InteractivePill.tsx:48-105, 113-154
- **Scenario**: Both pill components render plain `<button>` rows with `focus:outline-none` and no replacement focus ring (compare to `Button` which sets `focus-visible:ring-2 focus-visible:ring-accent-strong`). Single-select `InteractivePill` doesn't expose `role="tablist"` + `role="tab"` + `aria-selected`, and multi-select `MultiInteractivePill` doesn't set `aria-pressed`. Neither supports arrow-key navigation between pills (a tablist convention), and `MultiInteractivePill` uses an inline CSS-var fallback `'var(--surface-3, rgba(255,255,255,0.06))'` (line 92) — a magic surface token defined nowhere else.
- **Root cause**: Designed as a "Framer Motion slide indicator" first; a11y was never added. The `focus:outline-none` is a polish reflex but no replacement was provided.
- **Impact**: Users navigating with keyboard get no visible focus indicator and no SR announcement of selected state — fails WCAG 2.4.7 (Focus Visible) and 4.1.2 (Name, Role, Value). Used in 7 places (ScreenFlowMap, HudCompositor, CrashAnalyzer, etc.) so the regression surface is wide.
- **Fix sketch**: Replace `focus:outline-none` with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2` matching Button. Add `role="tablist"` on the wrapper, `role="tab"` + `aria-selected={isActive}` on each button (single) or `aria-pressed` (multi). Add roving-tabindex arrow-key handler. Replace the `var(--surface-3, fallback)` with a defined token.

## 8. `MarkdownProse` uses unsanitized regex-based markdown→HTML and renders via `dangerouslySetInnerHTML`
- **Severity**: Medium
- **Category**: Polish (security-as-polish) / Component Architecture
- **File**: src/components/ui/MarkdownProse.tsx:11-125
- **Scenario**: `markdownToHtml` runs `escapeHtml` on inline text, then injects `<strong>`, `<em>`, `<code>`, `<pre>` via string concatenation, finally rendering with `dangerouslySetInnerHTML`. Any future regex change (e.g. supporting links `[label](url)`) trivially introduces XSS via crafted Claude output. There's also no `<a>` rendering at all — markdown links display as raw `[text](url)` characters, a polish miss for a primitive named "Prose".
- **Root cause**: Built to be "intentionally minimal" (per the file's own header comment) and avoid pulling in `marked`/`remark`. That's defensible, but the surface is publicly named and broadly used.
- **Impact**: The current regex set is escape-safe by accident: `<strong>$1</strong>` operates on escaped text. Add link or image support and the next maintainer will inject raw HTML. No keyboard-selectable code blocks (no `tabindex`), no copy-button slot. Headers map `#` → `<h3>` (level+2) which collides with parent page heading hierarchy.
- **Fix sketch**: Either swap to `marked` + `DOMPurify` (≈10kb gzip), or document the no-link/no-image constraint loudly and add a runtime assertion that the input contains no raw `<` after escape. Render headers as `<h{level+offset}>` with an explicit `headingOffset` prop instead of hardcoding `+2`. Add link support via `[text](url)` regex with explicit `https?:` validation.

## 9. `EmptyState` action API is closed over `{label, onClick, color}` — no support for icons, loading, or disabled, and no destructive intent
- **Severity**: Medium
- **Category**: Component API / Polish
- **File**: src/components/ui/EmptyState.tsx:13-78
- **Scenario**: The `action` and `secondaryAction` props are typed as a fixed shape (`{label, onClick, color?}`), so callers cannot pass an icon, a loading state, or a `disabled` flag. The primary action also force-uses `variant="outline"` size `lg` regardless of context — there's no way to render a solid "primary" CTA in an empty state. CTAs that need confirmation, disabled-during-network, or icons all have to bypass `EmptyState` and roll their own.
- **Root cause**: The API was designed for the "click to scan / click to learn more" empty states first seen and never generalized.
- **Impact**: Most empty states either don't bother with actions (because the API is too narrow) or build a parallel empty-state component to bypass it.
- **Fix sketch**: Replace `action: {label, onClick, color}` with `action?: ReactNode` (caller passes a fully-formed `<Button>`). Or expand the shape with `icon`, `loading`, `disabled`, `variant?: 'solid'|'outline'`. Recommend the first — primitive composition over closed shapes.

## 10. `GradientText` defaults force `font-bold` and have no `prefers-reduced-transparency` consideration; `as` enum is fixed
- **Severity**: Low
- **Category**: Polish
- **File**: src/components/ui/GradientText.tsx:16-34
- **Scenario**: `GradientText` hard-codes `font-bold` into the className (line 25), so consumers wanting a gradient on a regular-weight subtitle have to override (`className="font-normal"` only works because Tailwind specificity favors later classes — fragile). The `as` prop enumerates `'span'|'h1'|'h2'|'h3'|'p'|'div'` — no `'h4'|'h5'|'h6'|'strong'|'em'` even though heading hierarchy commonly needs those.
- **Root cause**: Encoded the most-common usage shape (bold gradient hero text) as the only shape.
- **Impact**: Minor — workaroundable, but each override is a smell. Heading semantics suffer when authors pick `h3` because `h4` isn't allowed.
- **Fix sketch**: Drop `font-bold` from the className (let consumers control weight). Broaden `as` to include all heading levels and inline emphasis tags, or accept `as: keyof JSX.IntrinsicElements`.
