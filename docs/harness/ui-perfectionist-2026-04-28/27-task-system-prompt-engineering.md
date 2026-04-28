# UI Perfectionist — Task System & Prompt Engineering

> Context: Task System & Prompt Engineering (CLI Terminal & Task System)
> Files read: 8
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Chat overlay chrome reinvents SurfaceCard at level 3
- **Severity**: High
- **Category**: Component Architecture / Design System
- **File**: src/components/prototype/chat/ConversationShell.tsx:55-73
- **Scenario**: The floating Dzin overlay is built from a raw `motion.div` carrying a hand-rolled `rounded-xl border border-border shadow-2xl shadow-black/40 overflow-hidden` plus an inline `style={{ background: 'var(--surface-deep, #0a0a0f)' }}`. The title bar then layers `bg-surface/80 border-b border-border` directly. Meanwhile the design system already exposes `<SurfaceCard level={3}>` for elevated overlays (`bg-surface border border-border rounded-xl shadow-xl`).
- **Root cause**: The overlay shell predates (or ignores) `SurfaceCard` level 3 and falls back to ad‑hoc tokens, including a hardcoded `#0a0a0f` fallback that bypasses theme switching.
- **Impact**: The most visible chat surface in the app drifts from the canonical card style — radius (`rounded-xl` vs system's `rounded-xl` is fine, but shadow strength, background token, and border ownership differ). It also blocks any future theme reskin from reaching this panel.
- **Fix sketch**: Replace the outer `motion.div` chrome with a `motion(SurfaceCard)` (or wrap `SurfaceCard level={3}` in a motion wrapper) and drop the inline `background` style — let the `bg-surface*` token resolve via CSS variables. Move the title bar to a small `<ConversationTitleBar>` primitive so the same chrome can host non‑Dzin overlays (slash command palette, future agent panels).

## 2. SlashCommandMenu styled in CSS file while siblings use Tailwind utilities
- **Severity**: High
- **Category**: Visual Consistency / Design System
- **File**: src/components/prototype/chat/SlashCommandMenu.tsx:46-55, src/components/prototype/chat/chat.css:17-43
- **Scenario**: The slash command popover has zero Tailwind classes on its outer container — all visuals (position, border, radius, padding, hover, active state) live in `chat.css` under attribute selectors like `[data-dzin-chat-command-menu] [data-active='true']`. Active background is a literal `rgba(59, 130, 246, 0.15)` instead of the `bg-blue-500/15` pattern used everywhere else (e.g. WorkflowOrchestratorView uses `bg-cyan-500/15`).
- **Root cause**: A two-track styling strategy — Tailwind utilities for ConversationShell/ChatInput, BEM‑style attribute CSS for the menu and code blocks. The active item rgba color isn't tied to a CSS variable either.
- **Impact**: Two design languages cohabit one feature; theme tokens won't reach the menu's blue tints, hover transitions are inconsistent (CSS `0.1s ease` vs Tailwind `transition-colors`), and any other "command palette" surface elsewhere can't be unified with this one.
- **Fix sketch**: Promote the menu to Tailwind: `absolute bottom-full left-0 right-0 mb-1 bg-surface-deep border border-border rounded-lg overflow-hidden shadow-lg z-10`, items as `px-3 py-2 text-sm hover:bg-blue-500/10 data-[active=true]:bg-blue-500/15`. Delete those CSS blocks. Then extract a `<CommandPalette>` primitive shared between the slash menu and any future Cmd‑K palette.

## 3. Workflow node status palette diverges from chart-color tokens
- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/evaluator/WorkflowOrchestratorView.tsx:30-38
- **Scenario**: `STATUS_STYLE` hardcodes Tailwind color names per status (`text-cyan-400 / bg-cyan-400/10`, `text-green-400 / bg-green-400/10`, `text-red-400 / bg-red-400/10`, `text-amber-400 / bg-amber-400/10`). The sibling `DependencyGraph` (the other DAG view in the evaluator) imports `STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_BLOCKER` from `@/lib/chart-colors` so all status surfaces stay tokenized.
- **Root cause**: WorkflowOrchestratorView was authored without consuming `chart-colors`, so the same semantic states (running/completed/failed/queued) are encoded with different literals than the dependency graph beside it.
- **Impact**: Two DAG-style views in the same module render identical concepts in subtly different hues; future palette tweaks (colorblind mode, brand reskin) would need two edits and will desync. The `text-text-muted/50` / `bg-text-muted/5` for `pending` and `skipped` is also two distinct opacities for visually identical states.
- **Fix sketch**: Replace literal classes with semantic helpers from `chart-colors` (e.g. `STATUS_SUCCESS`, `STATUS_WARNING`) and merge `pending` and `skipped` into one shared style. Introduce a small `STATUS_TOKENS: Record<DAGNodeStatus, { fg, bg }>` derived from those helpers — same shape, but tokens flow through. Reuse it in `DependencyGraph` legend so both DAGs share the key.

## 4. Module tag selector reimplements a chip/pill component inline
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/evaluator/WorkflowOrchestratorView.tsx:261-278
- **Scenario**: 12+ module IDs are rendered as buttons with bespoke classes: `px-2.5 py-1 rounded-lg text-2xs font-medium border transition-colors` plus a hand-coded selected/unselected branch. The same view also uses `<Badge>` for counts and the active workflow's "Paused" pill. There is no `<Chip>`/`<Tag>` primitive, and the active state's `bg-cyan-500/15 border-cyan-500/30 text-cyan-400` triple is duplicated again at line 270 and again at line 283 for the start button.
- **Root cause**: A multi-select chip primitive was never extracted; the active-cyan chord is copy-pasted across three controls.
- **Impact**: Selected-module styling (`bg-cyan-500/15`), Start button styling (`bg-cyan-500/10`), and Resume button styling (cyan border) all drift in opacity tier; a palette change requires hunting 3+ literals; raw IDs like `arpg-character` are shown in chips with no readable label or truncation safety on small panels.
- **Fix sketch**: Extract `<SelectableChip active label moduleId onToggle>` that uses MODULE_LABELS for the visible text. Define a single `ACCENT_CYAN` mixin (e.g. `bg-cyan-500/15 border-cyan-500/30 text-cyan-400`) and reuse for chip-active, start-button-idle, and resume-button. Add `flex-wrap` overflow control with a `+N more` collapse for narrow panes.

## 5. Title-bar drag handle has no keyboard or focus affordance
- **Severity**: Medium
- **Category**: Accessibility-as-polish / Responsive
- **File**: src/components/prototype/chat/ConversationShell.tsx:65-73, src/components/prototype/chat/useChatOverlay.ts:53-96
- **Scenario**: The overlay can only be moved/resized via pointer events (`onPointerDown`). The title bar has `cursor-grab` but no `role`, no `tabIndex`, no arrow-key drag, and the four resize handles are bare 8 px strips with no focus ring. On touch the resize strips are 8 px tall — under the WCAG 24 px target.
- **Root cause**: Drag/resize was wired straight to pointer handlers without the keyboard parity layer the rest of the app uses for moveable panels.
- **Impact**: Keyboard-only users can't reposition the chat, and the resize edges are effectively invisible until a pointer hovers them — a polish miss for the most prominent floating surface.
- **Fix sketch**: Make the title bar `role="toolbar"` with `tabIndex={0}` and bind Arrow keys (with Shift for 10 px nudges) to `setState`. Bump resize-strip touch hit boxes to ≥16 px via negative margins (visual size unchanged) and add a subtle 1 px hover indicator using the existing `border-border-bright` token. Same `MIN_*/MAX_*` constants in `useChatOverlay.ts` should be exported as named tokens — they're currently magic numbers (320/600/400/800) duplicated nowhere else but worth promoting once a second resizable panel lands.

## 6. ChatMessages auto-scroll runs on every length change with no "user scrolled up" detection
- **Severity**: Medium
- **Category**: Polish / Responsive
- **File**: src/components/prototype/chat/ChatMessages.tsx:71-88
- **Scenario**: `useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length])` fires on every new message, regardless of where the user has scrolled. There is no "jump to latest" affordance, no separator between days/sessions, and the empty state is a single line of muted text with no illustration or call to action.
- **Root cause**: Minimum-viable streaming UX — no scroll-anchor logic, no `isAtBottom` ref check.
- **Impact**: A user reading earlier history gets yanked to the bottom each time the assistant streams a token; new-message indicators (the "↓ N new" pattern most chat UIs use) are absent. Empty state misses an opportunity to surface the slash-command discovery hint.
- **Fix sketch**: Track `isAtBottomRef` from the scroll container; only auto-scroll when already pinned to bottom, otherwise show a floating `↓ N new messages` pill (reuse `Badge` + `bg-blue-500/15`). Upgrade the empty state to a centered `<EmptyState>` (already a primitive in the app per DependencyGraph imports) with a "Try /help" hint pointing at the slash command system.

## 7. ChatInput textarea height ceiling and Send button affordance are off-system
- **Severity**: Medium
- **Category**: Visual Consistency / Polish
- **File**: src/components/prototype/chat/ChatInput.tsx:19-24, 79-87, src/components/prototype/chat/chat.css:45-57
- **Scenario**: `max-height: 96px` is duplicated in JS (`Math.min(textarea.scrollHeight, 96)`) and CSS (`max-height: 96px`). The Send button is a plain icon with no background, no border, no disabled visual beyond text color and `cursor-not-allowed` — it disappears against the input frame at rest. There's no Shift+Enter hint, no character count, and no streaming/cancel state for in-flight requests.
- **Root cause**: Two sources of truth for the autosize ceiling, and the send affordance was minimized too far.
- **Impact**: Drift risk when one side changes; the Send button reads as decorative until you hover it; users learning slash commands have no on-screen reminder of Shift+Enter for newlines.
- **Fix sketch**: Centralize `MAX_INPUT_PX = 96` in a constant consumed by both JS and a CSS custom property. Give Send a real shape (`p-2 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 disabled:border-border disabled:text-text-muted`). Add a one-line muted hint row when the input is focused: `Enter to send · Shift+Enter newline · / for commands`.

## 8. Magic z-index 9000 and ad-hoc edge margin in overlay layer
- **Severity**: Low
- **Category**: Design System
- **File**: src/components/prototype/chat/ConversationShell.tsx:39, 55, src/components/prototype/chat/useChatOverlay.ts:7-12
- **Scenario**: Both the toggle button and the overlay use `z-[9000]` (no shared token), and `EDGE_MARGIN = 24` plus a magic `- 56` (presumably to clear the FAB) live only inside `useChatOverlay`. The slash menu uses `z-index: 10` in CSS — a different stacking context, fine, but undocumented.
- **Root cause**: No project-wide z-index ladder or overlay spacing constant.
- **Impact**: Future overlays (modals, toasts, tooltips) will collide or have to guess at safe values; the `- 56` will silently desync if the FAB size ever changes.
- **Fix sketch**: Add a tiny `Z_INDEX = { fab: 9000, overlay: 9000, palette: 9100 }` and `OVERLAY = { edge: 24, fabHeight: 56 }` export in `@/lib/constants` (already used here for `MOTION`). Replace literals. Worth doing while only one consumer exists.
