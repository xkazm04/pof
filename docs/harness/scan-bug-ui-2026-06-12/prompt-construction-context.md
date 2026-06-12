# Prompt Construction & Context — Bug + UI scan (2026-06-12)

> Total: 8 findings (4 bug, 4 ui)

Scope note: the scope file lists `src/lib/knowledge/index.ts`, which does not exist — the knowledge layer is `ue-gotchas.ts`, `binary-content.ts`, `ue-known-assets.ts`, `wiring-requirements.ts`, all read in its place. Dedup against the 2026-06-09 index confirmed: prior #1 (`markResolved` cross-module wipe) is fixed (module-scoped UPDATE + API validation); prior #2 (LIMIT-before-scoring), #3 (UTC-as-local timestamps), #4 (MSVC major/minor) are still present and are NOT re-reported. The UI lens covers the context's only UI surface: the forge `PromptInspector` (renders `auditPromptString` from scoped `prompt-builder.ts`) and its sibling forge components that consume `ability-forge.ts`.

## Bug findings (new since 2026-06-09)

## 1. Room codegen builds C++ class names from raw room names — only whitespace is stripped
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/prompts/level-design.ts:38`
- **Scenario**: A user names a room "Crypt #2" or "Boss-Arena (East)" in the level flow editor (`RoomDetailPanel.tsx:96` is a free-text input) and clicks generate. The prompt instructs: "Create a spawn manager class … (e.g., `ACrypt#2SpawnManager`)".
- **Root cause**: `A${room.name.replace(/\s+/g, '')}SpawnManager` strips only whitespace. Every sibling builder (menu-flow.ts:73, level-design.ts:239, material-patterns.ts:40) strips `[^a-zA-Z0-9]` — this one call site diverged, so `#`, `-`, `(`, accents, and emoji flow straight into a C++ identifier the model is told to create.
- **Impact**: The generated code fails to compile (or the model silently renames the class, after which `buildSyncCheckPrompt`'s doc-vs-code comparison and `linkedFiles` tracking no longer match the documented name). Either way the design-to-code sync promise breaks for any punctuated room name.
- **Fix sketch**: Extract one shared `toCppIdentifier(name, fallback)` helper (strip non-alphanumerics, prefix if digit-leading, fallback when empty) and use it here and in the sibling builders. Never inline ad-hoc sanitizers in prompt text.

## 2. Screen/zone enum identifiers can collide, go empty, or start with a digit
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/prompts/menu-flow.ts:124`
- **Scenario**: A user creates screens named "Pause Menu" and "PauseMenu!" (free-text input, `MenuFlowDiagram.tsx:770`), or a screen named "2PlayerLobby", or one named only with symbols. The `EMenuScreenType` line renders "One entry per screen: PauseMenu, PauseMenu, 2PlayerLobby, " — duplicate entries, a digit-leading identifier (invalid C++), and an empty entry.
- **Root cause**: `s.name.replace(/[^a-zA-Z0-9]/g, '')` is injective-looking but isn't: distinct display names map to the same (or empty) identifier, and nothing enforces the C++ rule that identifiers can't start with a digit. Same pattern at `level-design.ts:239` (`EWorldZone` values) and `menu-flow.ts:73`, where an all-symbol screen name yields class `UWidget` — colliding with UE's real `UWidget`.
- **Impact**: The prompt instructs the model to author an enum/class set that cannot compile (duplicate or invalid enumerators), or that shadows an engine class. The failure surfaces later as a build error attributed to the model, then gets recorded into error memory as a recurring "syntax" failure the system itself caused.
- **Fix sketch**: In the shared `toCppIdentifier` helper (finding 1), dedupe with a numeric suffix (`PauseMenu`, `PauseMenu2`), prefix digit-leading results (`_2PlayerLobby` or `Screen2PlayerLobby`), and substitute a fallback like `Screen<N>` for empty results before rendering enum/class lists.

## 3. `getEnginePath` hardcodes the Launcher install path while its docstring claims source-build support
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/prompt-context.ts:65-69`
- **Scenario**: A project uses a source-built engine or a Launcher install on any non-default location (D: drive, non-English Program Files). Every prompt's "## Build Command" points at `C:\Program Files\Epic Games\UE_X.Y\...\UnrealBuildTool.exe`, and the injected Rules say "ALWAYS verify the build compiles … If the build fails, read the error, fix the code, and rebuild — do not give up."
- **Root cause**: The docstring states "Supports both installed builds (Epic Games Launcher) and source builds," but the implementation unconditionally returns the default Launcher path; only the version segment varies. `ProjectContext` has no engine-path field, so no caller can correct it. Bonus edge: `getEnginePath("5")` returns `...\UE_5`, a folder Launcher never creates.
- **Impact**: On any non-default machine, every generated task ends in a guaranteed-failing build command plus an explicit instruction to keep retrying — a retry storm that burns CLI tokens, and the resulting "cannot find UnrealBuildTool" failures get fingerprinted into error memory as `other`-category noise, degrading relevance scoring for real errors.
- **Fix sketch**: Add `enginePath?: string` to `ProjectContext` (settings-backed), falling back to the derived Launcher path; or probe common roots once at scan time and persist into `DynamicProjectContext`. Fix the docstring either way so the assumption is visible.

## 4. Inventory prompt emits dangling empty bullets for disabled interactions
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/prompts/inventory.ts:159-160`
- **Scenario**: A user unchecks "Shift-Click Split" and "Ctrl-Click Move" (or both are off by default config edits) and generates. The `UInventoryScreenWidget` spec renders two literal `- ` bullets with no text; lines 148-149 similarly leave indented whitespace-only lines under `UInventorySlotWidget`.
- **Root cause**: The template interpolates the conditional INSIDE an always-rendered bullet (`- ${cond ? 'text' : ''}`) instead of conditionally rendering the whole line, so the bullet marker survives when the content doesn't.
- **Impact**: The model receives an empty requirement bullet in a numbered "Required Files" spec — it either invents a requirement to fill it or mirrors the malformed list into its output. Low individual cost, but it is deterministic prompt corruption in the standard path.
- **Fix sketch**: Build the bullet lists with `[cond && '- Handles Shift+Click …', cond2 && '- Handles Ctrl+Click …'].filter(Boolean).join('\n')` so disabled interactions emit nothing, matching how `interactionLabels` is already built at line 84.

## UI findings

## 5. "Try again" after a failed refinement silently regenerates from scratch — and the instruction is already gone
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_ability/forge/index.tsx:151`
- **Scenario**: A user iterates an ability through several refinements, types "add a 2s stun", and the API call fails (timeout, parse error). The error card's primary "Try again" button fires `handleGenerate()` — a fresh one-shot forge from the original description — not the failed refinement. Meanwhile `RefineBar.tsx:26` cleared the instruction input optimistically on submit, so the user can't even re-send it manually without retyping.
- **Root cause**: `ForgeErrorCard`'s `onRetry` is hardwired to `handleGenerate` regardless of whether the failure came from `handleGenerate` or `handleRefine`; the component has no notion of "what failed". `RefineBar` clears its input before the request settles.
- **Impact**: Error recovery destroys work-in-progress: on success of the wrong retry, `result` is replaced by a brand-new ability and `baseline` is cleared, discarding the refinement chain the user built (recoverable only by hunting through the history panel). The button label ("Try again") actively lies about what it does.
- **Fix sketch**: Track the last failed operation (`{ kind: 'generate' } | { kind: 'refine'; instruction }`) in state and have `onRetry` replay it. In `RefineBar`, clear the input only after `onRefine` resolves (make it async) or restore the instruction on failure.

## 6. Prompt Inspector's missing-required vs missing-optional chips differ only by color
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_ability/forge/PromptInspector.tsx:74-93`
- **Scenario**: A prompt is missing a required section. The chip strip shows present chips green with a Check icon, but "missing (required)" amber and "not used (optional)" zinc chips are bare text — the one state the feature exists to surface (missing required) has no non-color cue, and the explanation lives only in a mouse-only `title` tooltip.
- **Root cause**: `chipStyle()` encodes the three states purely in background/border/text color; only the `present` state got an icon. WCAG 1.4.1 (Use of Color) — amber-vs-zinc at 11px is also hard to distinguish for deuteranopia.
- **Impact**: Colorblind and keyboard users can't tell a broken prompt (missing required) from a deliberately slim one (optional unused) at a glance, undermining the "one-glance signal" the component's own comment promises.
- **Fix sketch**: Render an `AlertTriangle` (or `X`) icon on missing-required chips mirroring the existing Check, and append visually-hidden text (`<span className="sr-only">missing, required</span>`) so the state survives without the title tooltip.

## 7. ForgeErrorCard's status icon doesn't get the card's tone color
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/core-engine/sub_ability/forge/ForgeErrorCard.tsx:63`
- **Scenario**: Any forge error appears. The title, border, background, and primary buttons are all tinted with `tone` (red, or amber for api-key-missing), but the leading icon — the largest signal element — renders in the inherited page text color (near-white).
- **Root cause**: `<Icon size={18} className="flex-shrink-0 mt-0.5" />` sets no color; lucide icons use `currentColor` and nothing in the ancestor chain sets it, so the carefully built tone system (every other element uses `withOpacity(tone, …)`) skips the icon.
- **Impact**: The error card reads as half-styled; the amber "set up the AI key" variant loses its strongest at-a-glance differentiator from the red failure variants.
- **Fix sketch**: `<Icon size={18} className="flex-shrink-0 mt-0.5" style={{ color: tone }} />`.

## 8. Refine input has no accessible label
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_ability/forge/RefineBar.tsx:46-54`
- **Scenario**: A screen-reader user tabs into the refine input. It announces only the placeholder ('e.g. "make it AoE and cut mana cost 30%"') — an example, not a name — and once the user types, sighted users also lose all indication of what the field is, since the only nearby heading is a decorative `SectionHeader`.
- **Root cause**: The `<input>` has `placeholder` but no `aria-label` / associated `<label>`; placeholders are not labels (disappear on input, exempt from contrast minimums, unreliably announced).
- **Impact**: The primary interaction loop of the forge (iterating an ability) is unnamed for assistive tech, and the example text masquerading as a label is a known usability anti-pattern.
- **Fix sketch**: Add `aria-label="Refinement instruction"` to the input (one line), or wire the existing `SectionHeader` text via `aria-labelledby`. Apply the same check to `ForgeInput`'s textarea.
