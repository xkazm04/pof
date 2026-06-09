# Bug Hunt — App Shell & Navigation
> Total: 4
> Severity: 0 critical, 2 high, 2 medium, 0 low

## 1. Hydration gate never waits for persist rehydration → flash of Setup Wizard
- **Severity**: high
- **Category**: state-corruption
- **File**: src/components/layout/AppShell.tsx:56-77
- **Scenario**: A returning user (setup already complete, `pof-project` in localStorage) reloads the page. The skeleton fades out, and for one or more frames the real shell renders `<SetupWizard />` instead of their project, then snaps to the correct shell once Zustand persist finishes loading.
- **Root cause**: The comment says "Wait for Zustand persist to rehydrate from localStorage", but `useSyncExternalStore(() => () => {}, () => true, () => false)` does no such thing. The subscribe function is a no-op that never notifies, `getSnapshot` returns `true` unconditionally, and `getServerSnapshot` returns `false`. So `hydrated` is merely "we are on the client" — it flips to `true` on the *first* client render. Meanwhile `useProjectStore` persist middleware rehydrates **asynchronously**; on that first client render `isSetupComplete` still holds its store default (`false`, projectStore.ts:67). The gate therefore reveals the shell while the store is still un-rehydrated, branching on stale defaults.
- **Impact**: UX degradation — a visible flash of the onboarding wizard (or the wrong shell) on every reload for configured users; any other component that reads persisted state during this window also renders default/empty content, and effects that fire on mount (file watcher, bridge auto-connect) run against placeholder state.
- **Fix sketch**: Make the gate actually track rehydration. Subscribe to the persist API (`useProjectStore.persist.onFinishHydration` / `hasHydrated()`) via `useSyncExternalStore`, or set `skipHydration` + manual `rehydrate()` and only render the branch once hydration has truly completed. The boolean that controls "show real UI" must be derived from persist state, not from "am I on the client".

## 2. `beforeunload` guard never sets `returnValue` → close warning silently doesn't fire
- **Severity**: high
- **Category**: silent-failure
- **File**: src/components/layout/AppShell.tsx:43-53
- **Scenario**: A long CLI build/codegen task is streaming (`session.isRunning === true`). The user hits Ctrl+W / closes the tab / refreshes. In Chromium-family browsers the confirmation dialog does not appear, the tab closes, and the in-flight task (and its unsaved output) is lost without any prompt.
- **Root cause**: The handler calls `e.preventDefault()` but never assigns `e.returnValue`. Per the HTML spec a `beforeunload` prompt is triggered by a non-empty `returnValue` (and historically Chrome *only* honored `returnValue`, ignoring bare `preventDefault()`). The design assumption — "calling preventDefault is enough to warn the user" — is false on the dominant engine, so the safety net is success-theater: it looks like a guard but never engages.
- **Impact**: data loss — the entire purpose of the guard (don't let users discard running CLI work) is defeated for most users; they get no warning at all.
- **Fix sketch**: In the `hasRunning` branch set `e.preventDefault(); e.returnValue = '';` (and `return ''` for legacy Safari). Better: centralize an `useUnsavedGuard(predicate)` hook that always sets all three signals, so no future call site re-introduces this gap.

## 3. "Earlier this week" time bucket is unreachable on Sundays → week's events misfiled as "Older"
- **Severity**: medium
- **Category**: edge-case
- **File**: src/components/layout/ActivityFeedPanel.tsx:57-68
- **Scenario**: It is Sunday. Activity events generated Monday–Saturday of the same week should group under "Earlier this week". Instead they all collapse into "Older", and the "Earlier this week" section never renders that day.
- **Root cause**: `weekStart = todayStart - (now.getDay() * 86_400_000)`. On Sunday `getDay()` is `0`, so `weekStart === todayStart`. The classification chain then becomes `ts >= todayStart → "Today"`, `ts >= yesterdayStart → "Yesterday"`, `ts >= weekStart(=todayStart) → "Earlier this week"` — but any `ts >= todayStart` already returned "Today", so the third branch can never match, and everything older than yesterday falls through to "Older". The assumption that "week start is always strictly before yesterday" breaks for `getDay() === 0`. (Secondary defect: the fixed `86_400_000` ms arithmetic on a local-midnight timestamp is off by an hour across DST transitions, misclassifying events near midnight on those two days/year.)
- **Impact**: UX degradation — recent, relevant activity is mislabeled as "Older" one day a week, undermining the feed's time-grouping and making fresh items look stale.
- **Fix sketch**: Treat `getDay() === 0` as 7 days into the week (or use a date library / `Intl` with explicit week-start config) and compute period boundaries by constructing local `Date` objects (set hours to 0) rather than subtracting fixed millisecond constants, so DST and the Sunday wrap are both handled.

## 4. `useActiveModuleId` omits the `game-director` special category → inline terminal never shows there
- **Severity**: medium
- **Category**: logic-error
- **File**: src/hooks/useActiveModuleId.ts:14-19
- **Scenario**: A user maximizes a CLI tab whose `session.moduleId === 'game-director'` from the bottom bar while viewing the Game Director module. The terminal should dock inline under that module's content, but it never appears (and clicking the tab to "toggle minimize" from the bottom bar also misbehaves, because the active-module comparison never matches).
- **Root cause**: There are three independent declarations of "which categories render as special modules", and they disagree. `navigationStore` (line 10) and `ModuleRenderer` `SPECIAL_CATEGORIES` (line 120) both list `project-setup`, `evaluator`, **and** `game-director`; but `useActiveModuleId` hard-codes only `'project-setup'` and `'evaluator'`, falling through to `activeSubModule` (which is `null` for a special category). So `activeModuleId` is `null` on the Game Director page, `inlineSessionId = maximizedSession.moduleId === activeModuleId ? ...` (ModuleRenderer.tsx:156-159) is never satisfied, and `CLIBottomPanel.handleTabClick`'s `session.moduleId === activeModuleId` toggle logic is wrong for that module.
- **Impact**: UX degradation — inline terminals are silently unavailable on one whole top-level module, with confusing tab-toggle behavior, and the divergence is a latent landmine for any future special category added to only two of the three lists.
- **Fix sketch**: Eliminate the duplicated truth: export a single `SPECIAL_CATEGORY_IDS` set from `module-registry` (or `navigationStore`) and have `useActiveModuleId`, `ModuleRenderer`, and `navigationStore` all consume it. Then `useActiveModuleId` returns `activeCategory` whenever it is in that set, making the three components structurally incapable of disagreeing.
