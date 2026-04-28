# UI Perfectionist — Gameplay Subsystems

> Context: Gameplay Subsystems (Game Systems)
> Files read: 7 (5 views + quest-generator + types + factory + SurfaceCard glob)
> Total: 7 — Critical: 0, High: 3, Medium: 3, Low: 1

> Note on the brief's premise: 4 of 5 sibling *View.tsx files (Input, Physics, SaveLoad, Multiplayer) are 3-line one-liners delegating to `createSimpleModuleView(moduleId)` — there are no duplicated page headers, no settings rows, no inline charts in those four. The "five sibling views" smell does not exist as described. The real surface is DialogueView (500 lines, the lone outlier) plus the quest-generator pipeline. Findings reflect what is actually in scope.

## 1. DialogueView is a structural outlier vs. its 4 siblings

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/game-systems/DialogueView.tsx:56-99 vs. InputView.tsx:1-3, PhysicsView.tsx:1-3, SaveLoadView.tsx:1-3, MultiplayerView.tsx:1-3
- **Scenario**: Four of the five Gameplay Subsystem views are 3-line wrappers around `createSimpleModuleView(moduleId)`, rendering only `<ReviewableModuleView>`. DialogueView, in contrast, hand-rolls a tab switcher (`generator | checklist`), then mounts `<QuestGeneratorPanel>` on the first tab and `<ReviewableModuleView>` on the second — fully duplicating the factory's prop wiring (lines 86-96). When a future sibling (e.g. PhysicsView) needs a custom panel, the codebase has no idiom: each author either copies DialogueView's tab block or ships another 500-line bespoke file.
- **Root cause**: `createSimpleModuleView` only handles the zero-extension case. There is no `createTabbedModuleView({ extraTabs: [{ id, label, icon, render }] })` companion, so the moment a module needs one extra tab the factory is abandoned wholesale.
- **Impact**: Every future "module + custom panel" view will reinvent the tab bar, accent stripe, and `mod`/`cat` null-guard, drifting tab styling across the suite. The shared checklist/quick-actions surface becomes a copy-paste target instead of a guaranteed primitive.
- **Fix sketch**: Add `createTabbedModuleView(moduleId, tabs)` next to `createSimpleModuleView` in `src/components/modules/shared/`. It owns the tab bar (with a single `activeBorderColor={cat.accentColor}` rule), renders the standard `<ReviewableModuleView>` as the default tab, and slots caller-supplied tabs alongside. DialogueView shrinks to `createTabbedModuleView('dialogue-quests', [{ id: 'generator', label: 'Quest Generator', icon: Sparkles, render: () => <QuestGeneratorPanel/> }])`.

## 2. Tab bar uses inline `style={{ borderColor: ACCENT }}` instead of CSS custom property

- **Severity**: High
- **Category**: Design System
- **File**: src/components/modules/game-systems/DialogueView.tsx:63-71, 77, 80
- **Scenario**: The active-tab underline color is applied via inline `style={{ borderColor: ACCENT }}`, where `ACCENT = MODULE_COLORS.systems`. The `tabClass` already returns Tailwind `border-b-2` for the active state, so half the styling is in className and half in JS — and the inactive tab gets `border-b-2` too (it inherits via the same class string check) but with no border color, producing a transparent 2px reservation that may or may not collapse correctly across browsers. Every consumer that wants a different accent must thread a second prop or fork the function.
- **Root cause**: No `--tab-accent` CSS variable convention; the file imports `MODULE_COLORS` directly instead of using the category's `cat.accentColor` (which is already passed elsewhere — line 92).
- **Impact**: Tab styling cannot be centralized into a `<TabBar accent={...} />` primitive without rewriting the inline-style escape hatch. Hover/focus rings (currently absent) cannot inherit the accent from a single source.
- **Fix sketch**: Set `style={{ ['--tab-accent' as string]: cat.accentColor }}` on the tab container, then use `border-[color:var(--tab-accent)]` on the active button (Tailwind 4 supports arbitrary CSS-var color values). Drop the `tabStyle()` helper entirely. Bonus: the same variable can drive a `focus-visible:ring-[color:var(--tab-accent)]` rule that's currently missing.

## 3. Difficulty pip palette uses CSS-var fallback chain that may never resolve

- **Severity**: High
- **Category**: Design System
- **File**: src/components/modules/game-systems/DialogueView.tsx:332-338
- **Scenario**: `DIFFICULTY_COLORS` is `['var(--accent-green, #22c55e)', 'var(--accent-green, #84cc16)', 'var(--accent-yellow, #eab308)', 'var(--accent-orange, #f97316)', 'var(--accent-red, #ef4444)']`. Note Lv1 and Lv2 both reference `--accent-green` but with **different fallbacks** (`#22c55e` vs `#84cc16`). If the project actually defines `--accent-green` in its theme tokens, Lv1 and Lv2 render identically and the gradient collapses; if it doesn't, the fallbacks differ and the gradient works. The author has clearly contradicted themselves — only one branch can be correct.
- **Root cause**: Reaching for theme variables ad hoc instead of declaring a proper `--difficulty-{1..5}` ramp in the design tokens. The other module colors in the same file go through `MODULE_COLORS` / `chart-colors`, but difficulty pips bypass that registry.
- **Impact**: Difficulty visualisation is the single most information-dense control in the quest panel. If Lv1 and Lv2 collapse to one color, players cannot distinguish 1-pip-green from 2-pip-green quests at a glance — the pip count becomes the sole signal, defeating the color ramp.
- **Fix sketch**: Add `DIFFICULTY_RAMP` to `src/lib/chart-colors.ts` as a 5-tuple of named tokens (e.g. `[STATUS_SUCCESS, ACCENT_LIME, ACCENT_YELLOW, ACCENT_ORANGE, STATUS_ERROR]`) and import it. Delete the CSS-var fallback chain. Verify the ramp at Lv1→Lv5 has monotonically increasing hue/saturation in the actual rendered theme.

## 4. Reward and category pills reimplement the same chip primitive

- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/modules/game-systems/DialogueView.tsx:382-387 (category pill), 423-426 (reward pill), 244-254 (coherence note row)
- **Scenario**: The category badge (`text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded`, color + 15-hex bg) and reward badge (`text-2xs px-1.5 py-0.5 rounded font-medium`, color + `withOpacity(c, OPACITY_10)`) are visually identical chip patterns with two different opacity sources — one hard-coded (`${catCfg.color}15`) and one through the `withOpacity` helper. They differ only by font weight (`font-bold` vs `font-medium`) and opacity quantum (~8% vs 10%).
- **Root cause**: No `<Pill color={...} variant="solid|soft">` primitive in `src/components/ui/`. Each consumer hand-builds the same `text-2xs px-1.5 py-0.5 rounded` recipe and picks an opacity by feel.
- **Impact**: Category pills are slightly more saturated than reward pills sitting two rows apart in the same card — readers perceive the categorisation as "more important" purely from a styling accident, not intent. Future labels will drift further.
- **Fix sketch**: Extract `<Pill color tone="solid"|"soft" weight="medium"|"bold">` to `src/components/ui/Pill.tsx`. Standardize on `withOpacity(c, OPACITY_10)` for the soft tone (drop the `${color}15` literal). Replace both call sites and the dialogue-choice green text on lines 489-494 (which is a third half-baked variant — colored text without the soft chip background).

## 5. Quest summary metric cards lose their accent color when count is zero

- **Severity**: Medium
- **Category**: Visual Consistency / Polish
- **File**: src/components/modules/game-systems/DialogueView.tsx:233-236
- **Scenario**: The 5 category metric cards each render `<SurfaceCard … border-l-2 style={{ borderLeftColor: cfg.color }}>`, then the count is shown with `style={{ color: count > 0 ? cfg.color : 'var(--text-muted)' }}`. Result: when a category has 0 quests, the left border stays bright (Bounty-orange, Main-pink etc.) but the "0" is gray — the colored stripe screams "look here!" while the content says "nothing here." The 5 cards get visually noisy in the common empty state (most generations produce <5 categories populated).
- **Root cause**: Two different conventions for "empty state" — the border ignores the count, the text doesn't.
- **Impact**: The metrics row becomes a colorful zero-bar instead of a glanceable signal. Users learn to ignore the colored stripes because they don't track real data.
- **Fix sketch**: Apply the same predicate to the border: `borderLeftColor: count > 0 ? cfg.color : 'var(--border)'`. Or, better, dim the entire card with `opacity-50` when `count === 0` and keep both the border and text colored — empty categories then read as "muted but identifiable."

## 6. Quest generator missing skeleton/empty-list separation; collapse animation has no FLIP guard

- **Severity**: Medium
- **Category**: Polish / Missing States
- **File**: src/components/modules/game-systems/DialogueView.tsx:198-203, 267-285, 392-454
- **Scenario**: Three issues stack here: (1) The loading state at lines 198-203 only renders the first time (`loading && !result`); a regenerate-while-result-exists run shows the spinner only on the button, with no skeleton over the stale list — users see old quests during a 5-10s LLM call and may not realise generation is in progress. (2) The empty list (line 268-270) lives **inside** the staggered motion container, so the empty card animates in with the same `staggerChildren: 0.06, delayChildren: 0.35` as a populated list — adding ~400ms before "no quests" appears. (3) Quest cards animate `height: 0 → 'auto'` with `framer-motion` (line 394-399), which on long descriptions produces a measurable layout thrash because Framer can't FLIP-cache `auto`.
- **Root cause**: Staggered list and empty card share one motion wrapper; loading state branches on `!result` instead of `loading` directly.
- **Impact**: Regenerate feels broken; empty state feels sluggish; long quest expansions visibly snap.
- **Fix sketch**: (1) During `loading && result`, overlay a `pointer-events-none opacity-50` skeleton on the list, or render `<RefreshCw className="animate-spin"/>` next to each existing quest header. (2) Move the empty `<SurfaceCard>` outside the `motion.div` so it renders immediately. (3) Use `react-resizable-panels` style or `useMeasure` + `motion.div animate={{ height: measured }}` instead of `'auto'` to give Framer a numeric target.

## 7. Generator status messaging duplicates `text-text-muted` strings; quest "no result" empty state and "no quests after generation" empty state look identical

- **Severity**: Low
- **Category**: Visual Consistency
- **File**: src/components/modules/game-systems/DialogueView.tsx:191-196 vs. 267-270
- **Scenario**: The pre-generation empty state (lines 191-196) and the post-generation no-quests-found empty state (lines 268-270) both render a centered `text-text-muted` paragraph in a `SurfaceCard level={2}`. The first has a Scroll icon; the second has no icon at all. They differ in copy but the visual silhouette is so similar that users who regenerate on a sparse project can't tell whether anything happened.
- **Root cause**: No shared `<EmptyState icon title body />` primitive; each location ad hocs its own `text-center` block.
- **Impact**: Users mistake "generation produced 0 quests" for "I haven't clicked Generate yet" and click again, then wait for another 10s only to see the same screen.
- **Fix sketch**: Extract `<EmptyState icon title description />` and apply distinct icons (Scroll for "ready to generate", AlertCircle for "no quests found") plus distinct titles. Reuse this primitive in the quest-generator state branches and any future module that needs a zero-state.
