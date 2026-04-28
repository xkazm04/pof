# UI Perfectionist — Layout & Navigation

> Context: Layout & Navigation (App Shell & Shared Infrastructure)
> Files read: 17
> Total: 10 — Critical: 0, High: 4, Medium: 5, Low: 1

## 1. Module Renderer has no Suspense/skeleton boundary — every module fends for itself

- **Severity**: High
- **Category**: Component Architecture / Loading-states
- **File**: src/components/layout/ModuleRenderer.tsx:200-274
- **Scenario**: When a user clicks a sub-module, the renderer mounts the component inside `motion.div` and a fade veil. There is no `<Suspense>` boundary and no skeleton. Heavy modules (R3F Asset Viewer, Material Lab, Procedural Engine) thus appear as a blank background until they finish hydrating, while lighter modules pop in instantly — producing inconsistent perceived performance across the shell.
- **Root cause**: The renderer treats all `MODULE_COMPONENTS` as synchronous and only animates a 1-frame opacity veil. There is no shared loading contract between shell and module.
- **Impact**: The shell feels laggy and inconsistent — the highest-leverage UX inconsistency in this surface, because every module inherits it. Modules invent their own skeletons (or none), violating Visual Consistency.
- **Fix sketch**: Wrap each `<Component />` (and `<SpecialComponent />`) in a single `<Suspense fallback={<ModuleSkeleton accentColor={category.accentColor} />}>` defined alongside `ModuleErrorBoundary`. The skeleton can mirror `ModuleShell` chrome (header bar height, pulse for icon + 2 lines + grid). Keep the veil for switch crossfade, but stop relying on it as a loading affordance. Document a single `ModuleBoundary` that pairs ErrorBoundary + Suspense so all modules get identical chrome.

## 2. SidebarL1 active indicator math is fragile and uses hard-coded magic numbers

- **Severity**: High
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/layout/SidebarL1.tsx:8-12, 35-42
- **Scenario**: The sliding active accent bar at the left edge is positioned with `BUTTON_STRIDE = 44` and `TOP_OFFSET = 22`, derived by hand from `h-10 + gap-1 + py-3`. If anyone changes the button size, gap, or vertical padding, the indicator silently desyncs from the active button — an extremely common drift point.
- **Root cause**: The indicator is not anchored to the button via DOM measurement (`getBoundingClientRect` / `useRef`). It uses pixel constants tied to Tailwind class numbers two layers away.
- **Impact**: A single-line Tailwind change in this file or its sibling can produce a "1-2px off" indicator that survives review because it's still visible, eroding chrome polish.
- **Fix sketch**: Either (a) use a `ref` per button and a `ResizeObserver` to read `offsetTop`/`offsetHeight` of the active button on mount/resize, or (b) move the indicator into the active button itself as `::before` and let layout do the work. Option (b) is the cleaner refactor and also handles `prefers-reduced-motion` automatically.

## 3. CLI tab "active" border-top adds 2px and shifts non-active tabs vertically

- **Severity**: High
- **Category**: Visual Consistency / Polish
- **File**: src/components/layout/CLITabBar.tsx:62-72
- **Scenario**: Active tabs use `border-t-2` while inactive tabs have no top border. Switching tabs causes a 2px vertical content jump because tab heights diverge. In dense tab rows, the row visibly twitches as the user clicks between tabs.
- **Root cause**: `border-t-2` adds layout height instead of replacing a transparent equivalent. Inactive tabs need a transparent 2px top border to reserve the same box.
- **Impact**: Subtle but obvious jank — the kind of micro-jitter that defines "polished" vs "not". App-shell-level visibility on every CLI session switch.
- **Fix sketch**: Add `border-t-2 border-t-transparent` to the base classes; only swap the color when active (e.g., `isActive ? 'border-t-[color]' : 'border-t-transparent'`). Then the box stays still and only the color animates.

## 4. Activity Feed "Read all" and dismiss buttons lack visible focus rings

- **Severity**: High
- **Category**: Accessibility-as-polish
- **File**: src/components/layout/ActivityFeedPanel.tsx:165-178, 263-265, 411-417
- **Scenario**: The header's "Read all" button, the close X, the per-card dismiss button, and the per-event "Fix" button all rely on `transition-colors` and `hover:bg-*` — none of them carry `focus-visible:ring-*` classes. Sidebar L1, SidebarL2, and TopBar all *do* carry focus rings, so the feed reads as a second-class surface for keyboard users.
- **Root cause**: This component pre-dates the `focus-visible` ring convention used elsewhere; it was never retrofitted.
- **Impact**: Keyboard users tabbing through the feed see no indicator on most controls. App-shell consistency suffers: the chrome treats focus states differently in different panels.
- **Fix sketch**: Add the project-standard `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-1 focus-visible:ring-offset-surface-deep` to all four button groups. Same convention as `SidebarL1.tsx:55-56` and `TopBar.tsx:233`.

## 5. EventBusDevTools panel ignores `useReducedMotion` and uses a spring slide

- **Severity**: Medium
- **Category**: Accessibility-as-polish / Motion
- **File**: src/components/layout/EventBusDevTools.tsx:99-104
- **Scenario**: The dev-tools side panel always slides in with a spring (`damping: 30, stiffness: 400`). Other panels in this surface (`SidebarL2`, `TopBar` dropdown, `GlobalSearchPanel`) all branch on `useReducedMotion` and either fade or skip animation. This panel is the only outlier and triggers on Ctrl+Shift+E for every dev session.
- **Root cause**: The motion config was hard-coded; `useReducedMotion` was never wired in.
- **Impact**: Users with `prefers-reduced-motion` get a forceful spring slide every time they open the dev tools — a small but unambiguous a11y regression and a consistency drift inside the shell.
- **Fix sketch**: Mirror the pattern from `SidebarL2.tsx:55, 133-142` and `GlobalSearchPanel.tsx:149-155`: branch initial/animate on `prefersReduced`, falling back to `{ opacity }` transitions with `duration: 0` when reduced.

## 6. Welcome / "Select a category" empty state is a bare `<p>` — no shell-grade treatment

- **Severity**: Medium
- **Category**: Polish / Visual Consistency
- **File**: src/components/layout/ModuleRenderer.tsx:182-198
- **Scenario**: When no module is selected, the renderer shows centered text only ("Welcome to POF" / "Select a module from the sidebar"). Every other empty state in the shell (ActivityFeedPanel inbox-zero with icon tile, EventBus zero state with `Zap` icon) uses the project's empty-state pattern — icon-in-bordered-tile + heading + body. This top-level empty state is the user's first impression after setup, and it is the *least* polished surface.
- **Root cause**: It pre-dates the empty-state pattern that emerged in sibling panels.
- **Impact**: Inconsistency between the most-visible empty state and every secondary one. New users get a sterile screen.
- **Fix sketch**: Mirror `ActivityFeedPanel.tsx:184-192`: 12×12 rounded-xl border tile with the `Gamepad2` (matches AppShell loading) or the active category's icon, an `<h3>` heading, then the existing `<p>`. When `activeCategory` is set but no submodule, surface the active category accent color in the icon tile to reinforce the navigation context.

## 7. Top-bar `h-11` vs sidebar L2 header `py-3` produce a half-pixel header alignment drift

- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/layout/TopBar.tsx:215; src/components/layout/SidebarL2.tsx:146
- **Scenario**: TopBar is fixed at `h-11` (44px). The L2 sidebar header (`px-3 py-3` around a `text-xs` h2) computes to ~40px tall. The two horizontal rules — TopBar bottom border and L2 header bottom border — therefore do not align across the corner formed where the sidebar meets the top bar's bottom edge — visible as a small jog.
- **Root cause**: The two headers were sized independently with `h-11` vs vertical padding, with no shared token.
- **Impact**: The top-left "L" intersection of TopBar/L2 is the highest-traffic visual junction in the app and any misalignment here reads as low-quality chrome.
- **Fix sketch**: Either pin the L2 header to the same height (`h-11 flex items-center px-3` and drop `py-3`), or extract a `--shell-header-h` CSS var (default 44px) and use `h-[var(--shell-header-h)]` in both. Verify with the Plan-button row, which currently sets the height implicitly via the 6×6 button.

## 8. SearchTrigger dispatches a synthetic Ctrl+K KeyboardEvent instead of toggling state directly

- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/layout/TopBar.tsx:667-685; src/components/layout/GlobalSearchPanel.tsx:46-58
- **Scenario**: Clicking the search pill in the top bar fires a synthetic keyboard event with `ctrlKey: true`, which `GlobalSearchPanel` then catches in its global listener. Anyone listening to keyboard events at a higher level (e.g., a future a11y screen-reader bridge or `useKeyboardShortcuts`) receives a phantom Ctrl+K. This is an architectural smell that bites later when adding command palettes or modal stacking.
- **Root cause**: There is no shared store/handle to imperatively open the search panel from outside the component.
- **Impact**: Brittle coupling; risk of double-handling; users on macOS with custom Ctrl-bound system shortcuts may see edge cases. Also obscures the open/close source in dev tools.
- **Fix sketch**: Lift `open` into a small zustand store (e.g., `useGlobalSearchStore`) with `toggle()`, or expose an event-bus channel `nav.openSearch`. Replace the `dispatchEvent` call with `useGlobalSearchStore.getState().toggle()`. Keep the Ctrl+K listener on the panel; the trigger calls the same toggle.

## 9. ModuleErrorBoundary "Retry" button bypasses the standard focus-ring style and renders edge-to-edge inside the boundary

- **Severity**: Medium
- **Category**: Accessibility-as-polish / Visual Consistency
- **File**: src/components/layout/ModuleErrorBoundary.tsx:67-81
- **Scenario**: The Retry/Copy buttons use `border-border-bright`, `border-border` etc. but no `focus-visible:ring`. The error-details disclosure (`<button>` at line 86-95) is also unfocusable-looking. Because this is the worst-case shell state, polish here is critical for trust.
- **Root cause**: Same retrofit gap as ActivityFeedPanel.
- **Impact**: When users actually hit an error boundary they get inconsistent focus indication, which hurts the recovery flow's perceived reliability.
- **Fix sketch**: Add the standard focus ring tokens to all three buttons. Consider also constraining the error message `<pre>` height to `max-h-40` (already present) but making the scrollbar styling match the rest of the app's overflow patterns. Add `aria-live="assertive"` to the heading region so screen readers announce the boundary trigger.

## 10. ResizeHandle (CLI bottom panel) ships a hard-coded `boxShadow` and isn't keyboard-resizable

- **Severity**: Low
- **Category**: Accessibility-as-polish
- **File**: src/components/layout/ResizeHandle.tsx:40-52
- **Scenario**: The bottom-panel resize handle is mouse-only — no `role="separator"`, no `aria-valuenow`, no arrow-key resize. Compare with `SidebarL2.tsx:218-230` which models the proper ARIA. Also, it carries an inline `boxShadow: '0 -2px 4px rgba(0,0,0,0.3)'` rather than a token, making it visually inconsistent with the rest of the bordered chrome that uses 1px borders only.
- **Root cause**: This handle was authored before the L2 resize handle's a11y treatment landed.
- **Impact**: Keyboard users cannot resize the CLI panel. The shadow is the only inset shadow in the layout layer.
- **Fix sketch**: Adopt the L2 handle's ARIA pattern (`role="separator"`, `aria-orientation="horizontal"`, `aria-valuenow/min/max`, `aria-label="Resize CLI panel"`). Drop the inline `boxShadow` in favor of `border-t border-border` on the panel above (already present). Add a `keydown` handler for `ArrowUp`/`ArrowDown` that calls `onResize(±8)`.
