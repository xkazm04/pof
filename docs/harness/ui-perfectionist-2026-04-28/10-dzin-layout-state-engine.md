# UI Perfectionist — Dzin Layout & State Engine

> Context: Dzin Layout & State Engine (Core Engine (aRPG))
> Files read: 13
> Total: 6 — Critical: 0, High: 2, Medium: 3, Low: 1

## 1. `DZIN_TOKENS` map drifts from the actual CSS variables in `default.css`

- **Severity**: High
- **Category**: Design System tokens / Source-of-truth drift
- **File**: src/lib/dzin/core/theme/tokens.ts:4-46 (cross-ref src/lib/dzin/core/theme/default.css:11-53; src/lib/dzin/core/theme/state.css:49,72)
- **Scenario**: `tokens.ts` is the documented "available CSS custom property tokens" reference for theme consumers. But `state.css` already uses `var(--dzin-accent, #06b6d4)` for the LLM highlight ring and the typewriter cursor with hard-coded fallback colors, and the panel header sets `--dzin-panel-header-height: 28px` inline at compact density without that override being in the tokens map. There is no panel-header-height token entry distinguishing compact vs full, and there is no token for the panel-header height *override* even though it is varied per density.
- **Root cause**: Tokens, default theme CSS, and density CSS are three independent files with no compile-time link; the registry is maintained by hand.
- **Impact**: Theme authors who use `DZIN_TOKENS` for autocomplete will silently miss the surface bands `--dzin-surface-2`/`--dzin-surface-3` that exist in CSS, the `--dzin-panel-header-height` override semantics, and the implicit cyan `#06b6d4` fallback. Custom themes that only override `--dzin-accent` won't realize the cursor and LLM glow have a baked default that breaks if `--dzin-accent` is unset.
- **Fix sketch**: Add a `tokens.spec.ts` test that parses `default.css` and asserts every `--dzin-*` declared variable appears as a value in `DZIN_TOKENS` and vice-versa. Remove the hard-coded `#06b6d4` fallbacks in `state.css` (lines 49, 72) — if `--dzin-accent` is part of the contract, trust it. Add `panelHeaderHeightCompact` to the token map or document that header height is mutated via the cascade.

## 2. PanelFrame has no `:focus-visible` / focused-region styling and no token for it

- **Severity**: High
- **Category**: Accessibility-as-polish / Component Architecture
- **File**: src/lib/dzin/core/panel/PanelFrame.tsx:52-85; src/lib/dzin/core/theme/default.css:125-134
- **Scenario**: The frame is `role="region"` with `aria-label={title}` — a landmark — but neither the `[data-dzin-panel]` rule nor any density variant defines `:focus-visible`, `:focus-within`, or any "active region" treatment. The token map *does* declare `--dzin-border-focus` (cyan) but it is never consumed in `default.css`. Keyboard users tabbing through panel actions get no signal which region owns focus.
- **Root cause**: The focus token was reserved but its rule was never written, and nothing in `PanelFrame.tsx` sets `tabIndex` or surfaces a focus boundary.
- **Impact**: Keyboard navigation across multi-panel layouts (the whole point of the resolver) is invisible. Users with motor or attention impairments lose place when arrow-keying between sibling panels' actions, especially at compact density where the 28px header offers tiny target affordance already.
- **Fix sketch**: Add `[data-dzin-panel]:focus-within { box-shadow: inset 0 0 0 1px var(--dzin-border-focus); }` to `default.css`. Optionally accept an `interactive?: boolean` prop on `PanelFrame` that, when true, sets `tabIndex={-1}` so the region itself is focus-targetable for skip-link patterns. Audit that the LLM highlight `box-shadow` in `state.css:49` and the new focus shadow do not collide visually — stack via `outline` for one of them.

## 3. Panel-header height is hard-coded at 28px / 36px in the density rules but the matching token is never re-pointed

- **Severity**: Medium
- **Category**: Design System tokens / Magic numbers
- **File**: src/lib/dzin/core/theme/default.css:195-211
- **Scenario**: `--dzin-panel-header-height` is declared as `36px` in `:root`, then density rules write the literals `28px` and `36px` into `height` *and* shadow the variable: `height: 28px; --dzin-panel-header-height: 28px;`. There is no compact-specific token (`--dzin-panel-header-height-compact`) so a theme override has no clean way to change just compact's header without re-implementing the rule.
- **Root cause**: Density CSS was written value-first instead of token-first.
- **Impact**: Two magic numbers (`28px`, `36px`) duplicated four times across the file. Custom themes that grow header height (e.g. for accessibility / large-text) must override two density rules or a media query, defeating the purpose of one root token.
- **Fix sketch**: Add `--dzin-panel-header-height-compact: 28px` and `--dzin-panel-header-height-full: 36px` to `:root`, then have density rules set `height: var(--dzin-panel-header-height-compact)` etc. Remove the inline literals and the variable shadowing.

## 4. Density change announcement leaks initial mount and doesn't reset

- **Severity**: Medium
- **Category**: Accessibility-as-polish
- **File**: src/lib/dzin/core/panel/PanelFrame.tsx:42-50, 64-70
- **Scenario**: `setAnnouncement('Panel switched to ...')` runs on every density transition but never clears. The text persists in the `aria-live` region indefinitely after the transition. If a user later navigates to a panel via reading mode, the screen reader may re-announce a stale message, and the text remains queryable in the accessibility tree as if it were current state. There is also no debounce — rapid resize → density flip → density flip will queue duplicate announcements.
- **Root cause**: One-shot "transient announcement" pattern was implemented as persistent state.
- **Impact**: Verbose / confusing AT output; test-id-style tooling and DOM snapshot tests will pick up stale strings; minor noise during automated UI tests.
- **Fix sketch**: After `setAnnouncement(text)`, schedule `setTimeout(() => setAnnouncement(''), 1000)` and clear the timer on unmount. Skip the announcement on the initial render (track a `mountedRef`) — currently `prevDensityRef` is initialized to `density` so the *first* effect run is a no-op, which is correct, but density-prop overrides that flip on mount would still announce.

## 5. PanelFrame spreads arbitrary `...rest` props onto a `role="region"` div

- **Severity**: Medium
- **Category**: Component Architecture / Polish
- **File**: src/lib/dzin/core/panel/PanelFrame.tsx:37, 61
- **Scenario**: The signature accepts `PanelFrameProps & Record<string, unknown>` and spreads `{...rest}` onto the outer landmark element. Any caller can silently override `role`, `aria-label`, `data-dzin-panel`, or `data-dzin-density`, breaking the contract that the design-system CSS depends on (selectors target those exact attributes). Worse, the spread happens *before* the explicit `role`/`aria-label` props in JSX — no, actually, it happens *before*, so the explicit ones win — but the pattern is fragile against TS narrowing changes.
- **Root cause**: Permissive prop forwarding without a documented allowlist.
- **Impact**: Future contributor adds `aria-label` to `rest` and JSX-order dependence becomes load-bearing. Theming and accessibility regressions land silently because no test asserts the data attributes survive the spread.
- **Fix sketch**: Replace `Record<string, unknown>` with a curated `Pick<HTMLAttributes<HTMLDivElement>, 'id' | 'data-testid' | 'style'>` (or similar). Move the explicit attributes *after* the spread to be defensive regardless. Add a smoke test that `<PanelFrame role="article" />` does NOT clobber `role="region"`.

## 6. Two competing tokens for the same look (`--dzin-panel-bg` aliases `--dzin-surface-2`)

- **Severity**: Low
- **Category**: Design System tokens / Polish
- **File**: src/lib/dzin/core/theme/default.css:48-52
- **Scenario**: `--dzin-panel-bg: var(--dzin-surface-2)` and `--dzin-panel-header-bg: var(--dzin-surface-1)` create a second naming layer over the surface scale. Theme overrides that change `--dzin-surface-2` cascade through the panel; overrides that change `--dzin-panel-bg` directly only affect panels. Both spellings are exposed in `DZIN_TOKENS` with no documentation on which one to prefer for what.
- **Root cause**: Aliasing was added for component-specific overrides without writing the policy.
- **Impact**: Theme authors don't know which knob to turn; dual-source-of-truth bugs when one is overridden but not the other.
- **Fix sketch**: Add a one-paragraph comment block in `tokens.ts` (and a matching section header in `default.css`) stating the rule: *override `surface-*` to retheme globally; override `panel-*` only to break the alias for component-specific exceptions.* Optionally drop the redundant aliases entirely if no consumer uses them.
