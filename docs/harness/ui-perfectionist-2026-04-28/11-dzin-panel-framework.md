# UI Perfectionist — Dzin Panel Framework

> Context: Dzin Panel Framework (Core Engine (aRPG))
> Files read: 16
> Total: 6 — Critical: 0, High: 3, Medium: 2, Low: 1

## 1. `DZIN_SPACING.compact` is missing the `card` / `gap` / `sectionMb` / `contentMt` tokens that `full` defines

- **Severity**: High
- **Category**: Design System / Token Coverage
- **File**: src/lib/dzin/animation-constants.ts:116-136
- **Scenario**: `DZIN_SPACING` is the single source of truth for "Standardized spacing tokens for dzin panels," yet only `full` exposes the full set (`wrapper`, `card`, `gap`, `gridGap`, `sectionMb`, `contentMt`, `pipelineMt`). `compact` exposes `wrapper` + `divider` only, and `micro` exposes only `wrapper`. The 80+ panels under `src/components/modules/core-engine/dzin-panels/` consume these tokens at three densities, so the missing keys force every compact-density panel to either inline magic numbers or drop the section/card structure entirely. The grep for `DZIN_SPACING` returns 85 files, so the drift is system-wide.
- **Root cause**: The token set was defined opportunistically — whatever `full` happened to need at the time the constant was first authored. Compact and micro never got their parallel set.
- **Impact**: Compact density across ~80 panels will use ad-hoc paddings/gaps (`p-2`, `gap-2`, `mb-2` literals), so visual rhythm differs panel-to-panel at the very density most users see in side panels. Designers can't tune compact spacing globally — they must touch every panel.
- **Fix sketch**: Make the shape of all three density buckets symmetric: declare `card`, `gap`, `gridGap`, `sectionMb`, `contentMt` for `compact` (e.g. `p-2`, `gap-1.5`, `gap-2`, `mb-1.5`, `mt-1.5`) and at least `card`, `gap` for `micro`. Mark the type with `as const satisfies Record<'micro'|'compact'|'full', SpacingTokens>` so TS flags any panel that reaches for a missing token. Then sweep the 80+ panels for `p-2`/`gap-2`/`mb-2` literals and route them through the token.

## 2. `VALID_LAYOUTS` Set duplicates `LayoutTemplateId` union — drifts silently

- **Severity**: High
- **Category**: Design System / Single Source of Truth
- **File**: src/lib/dzin/advisor/slashCommands.ts:88-90
- **Scenario**: The slash-command handler validates layout names against a hand-typed `Set<string>` of 8 strings. `LayoutTemplateId` (src/lib/dzin/core/layout/types.ts:17-25) and `LAYOUT_ORDER` (src/lib/dzin/core/layout/templates.ts:154) already enumerate the same 8 ids. The advisor system instruction (advisorTools.ts:131) hand-types them again, and the `compose_workspace` tool's `enum` (advisorTools.ts:51) hand-types them a fourth time. Adding/removing a layout requires four synchronized edits.
- **Root cause**: Each file built its own list at authorship time rather than importing `LAYOUT_ORDER` and deriving a runtime set + the help text from it.
- **Impact**: The "/layout" command and the LLM's `compose_workspace` tool can fall out of sync with the actual rendered templates — user-facing "Try: …" message and Gemini's enum will both lie if a layout id is added or renamed. Slash help and advisor system prompt both list `studio` but already differ in ordering.
- **Fix sketch**: Import `LAYOUT_ORDER` and define `const VALID_LAYOUTS = new Set<LayoutTemplateId>(LAYOUT_ORDER)` (typed, not `Set<string>`). Build the help-string and the Gemini `enum` array from the same `LAYOUT_ORDER` (`enum: [...LAYOUT_ORDER]`). One edit point, type-checked.

## 3. Panel-type aliases and PoF panel enum diverge — slash commands accept panels Gemini can't compose, and vice versa

- **Severity**: High
- **Category**: Component Architecture / Cross-surface contract
- **File**: src/lib/dzin/advisor/slashCommands.ts:16-78 vs src/lib/dzin/advisor/advisorTools.ts:12-23
- **Scenario**: `PANEL_TYPE_ALIASES` resolves ~70+ user-facing aliases into ~70 panel ids (combat, character, inventory, world, eval, content, …). `POF_ADVISOR_FUNCTION_DECLARATIONS` exposes only the 10 `arpg-combat-*` panels to Gemini. The user can `/show character-overview` and the workspace will render it, but the LLM advisor literally cannot mention or rearrange it via `compose_workspace` — its enum doesn't list the type. Conversely the Gemini system prompt (advisorTools.ts:114-128) describes panels by id, but the `panels` JSON-string parameter accepts free-form types not validated against any registry.
- **Root cause**: Two parallel "what panels exist" lists were authored at different times — the ARPG-combat scope (advisorTools) and the full registry (slashCommands). Neither derives from `pofRegistry`.
- **Impact**: Inconsistent UX: chat suggestions only ever propose combat panels even when the user's workspace is showing inventory/world/save panels. The LLM can compose unknown-to-it panel types when the user says "open enemy bestiary" but cannot do it itself proactively. Feels like two different systems sharing one chat input.
- **Fix sketch**: Derive `POF_PANEL_TYPES` from `pofRegistry.list().map(d => d.type)` at module load (or generate the full `system instruction` string from registry descriptions). Validate `compose_workspace.panels[].type` against that registry on the server before dispatching. Then the slash-command alias map becomes purely a label-shortener over a registry-grounded set.

## 4. `DENSITY_CONFIG` defines a `wide` preset but no panel registration uses it

- **Severity**: Medium
- **Category**: Design System / Dead token
- **File**: src/lib/dzin/animation-constants.ts:91-96, src/lib/dzin/panel-definitions.ts (252 occurrences of `DENSITY_CONFIG.standard|fallback`, 0 of `.wide`)
- **Scenario**: `DENSITY_CONFIG.wide` is documented as the canonical preset for "Timeline / horizontal panels (~500px wide at full density)." A grep across the registrations shows 252 spreads of `DENSITY_CONFIG.standard.*` and zero of `DENSITY_CONFIG.wide.*`. Several panels that obviously want wide thresholds (effect timeline, combo chain, pipeline diagrams) instead override individual `minHeight` numbers (e.g. `panel-definitions.ts:330-331`).
- **Root cause**: The `wide` preset was added to the design system but never adopted; per-panel one-off overrides (`minHeight: 400`, `minHeight: 280`) accumulated instead.
- **Impact**: Density thresholds for timeline-style panels are inconsistent (each panel picks its own number), defeating the point of a canonical preset. The token reads as alive but is dead — future maintainers will be unsure whether to keep, extend, or delete it.
- **Fix sketch**: Audit every panel that today carries an inline `minHeight`/`minWidth` override and migrate the obvious wide candidates (any panel whose icon is `Activity`/`LineChart`/timeline) to spread `DENSITY_CONFIG.wide.*`. If after the audit `wide` still has no consumers, delete it from the constant — dead design tokens are worse than no token.

## 5. `IntentResult.description` is overloaded as both human prose and a side-effect command channel

- **Severity**: Medium
- **Category**: Component Architecture / Side-effect coupling
- **File**: src/lib/dzin/core/intent/bus.ts:43-51, handlers/system.ts:22-52
- **Scenario**: Resolved `IntentResult.description` is documented as a human-readable string (`"Switch layout to studio"`, `"Resize panel p1 to compact"`) that is presumably surfaced in toasts/history. But the bus inspects it for the literal strings `'undo'` / `'redo'` and routes those into `stateEngine.undo()` / `redo()` instead of patch dispatch. `'clear'` and `'toggle-chat'` are passed through with empty patches — silent no-ops in the engine but presumably handled by some UI listener via the event subscription. So the field is simultaneously (a) i18n-bound user prose and (b) a magic-string command bus.
- **Root cause**: A dispatch escape-hatch was added in-band rather than as a discriminated `result.action` field.
- **Impact**: Any future i18n / phrasing tweak ("Undone successfully") silently breaks the undo path. Subscribers who read `description` for toast text will surface raw command tokens like `"toggle-chat"` to users.
- **Fix sketch**: Add `effect?: 'undo' | 'redo' | 'clear' | 'toggle-chat'` to `IntentResult` (resolved variant) and switch the bus on it. Keep `description` for prose only. Update `system.ts` handler to set both fields (`effect: 'undo', description: 'Undone'`).

## 6. `useIntent` parses bus snapshot via `JSON.parse` on every store change

- **Severity**: Low
- **Category**: Polish / Performance
- **File**: src/lib/dzin/core/intent/hooks.tsx:60-75, src/lib/dzin/core/intent/bus.ts:63-66
- **Scenario**: The bus serializes its snapshot to JSON on every dispatch, and the React hook parses that JSON on every consumer render. The snapshot already contains the full `lastEvent` (intent + result), so on a typical drag-resize stream this is a hot path: every pointermove dispatches a manipulate intent → bus serializes → all `useIntent` consumers parse. Compare with `chat/hooks.ts` which correctly uses an integer `getVersion()` for O(1) snapshot comparison.
- **Root cause**: The bus snapshot was modeled as a JSON string (presumably to satisfy `useSyncExternalStore`'s referential-equality requirement) instead of an immutable object reused when unchanged or — better — a version counter.
- **Impact**: Drag-resize at 60fps allocates a stringified-then-parsed `IntentEvent` per frame per consumer. Not catastrophic at current scale but trivial to fix.
- **Fix sketch**: Mirror the chat store: `bus.getVersion(): number`, increment on dispatch, expose `bus.getLastEvent()` as plain getter. The hook calls `useSyncExternalStore(subscribe, getVersion, getVersion)` and reads pending/lastEvent via direct getters. Drop `JSON.stringify` / `JSON.parse` entirely.
