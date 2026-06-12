# Abilities & GAS System — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Authored "Cooldown" is silently codegen'd as a GameplayEffect *Period* (DoT tick), so cooldowns become periodic damage
- **Severity**: High
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/gas-codegen.ts:141` (also `src/lib/ability/effect-codegen-prompt.ts:17`, `src/lib/ability/spec.ts:37`)
- **Scenario**: A designer authors an effect in the GAS Blueprint Editor (the field is literally labeled "Cooldown", EffectTimelineEditor.tsx:143) or via a drafted spec (logic-prompts.ts:51 just says `cooldownSec`), e.g. an instant 50-damage strike with an 8s cooldown. They then open Code Gen, or dispatch "Generate C++" (`generate-gas-effects` → `buildGenerateAbilityBundlePrompt`).
- **Root cause**: `cooldownSec` has two contradictory meanings across modules. `deriveDefaultSpec` seeds the *ability cooldown* into it ("carrying the cooldown", spec.ts:30-37) and the editor UI calls it "Cooldown" — but every consumer emits it as a GE **Period**: `Period = FScalableFloat(8.0f)` in gas-codegen.ts:141-142 (and the live duplicate blueprint/codegen.ts:44-45), and `; period 8s` in `describeEffect`, where the bundle contract explicitly instructs "DoT tick, NOT ability cooldown". Meanwhile the `scalars.cooldown` parameter of `buildGenerateAbilityBundlePrompt` is accepted but never referenced — the real cooldown is dropped ("// TODO: cooldown GE").
- **Impact**: Wrong generated gameplay code with no warning: a one-shot ability with a cooldown becomes an effect that re-applies its damage every N seconds (an Instant GE with a Period is contradictory, so the codegen LLM "fixes" it into a periodic DoT), and the intended cooldown vanishes entirely.
- **Fix sketch**: Pick one meaning. Rename the field to `periodSec` in `EditorEffect` (and the editor label) or add a separate `cooldownSec` vs `periodSec`; have `describeEffect`/`generateEffectsCode` only emit Period for duration/infinite effects; actually use `scalars.cooldown` in the bundle prompt instead of the TODO.

## 2. Cross-tab spellbook search navigation never scrolls — the 250 ms scroll timer always loses to the 300 ms tab-exit animation
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/core-engine/sub_ability/index.tsx:66`
- **Scenario**: User opens the Ctrl+K palette while on the Core tab and selects a result on another tab (e.g. "Tag Audit" → tags tab). The tab switches, but the page stays scrolled to the top — the promised jump-to-section never happens. Same-tab results scroll fine.
- **Root cause**: `handleSearchNavigate` does `requestAnimationFrame` + `setTimeout(..., 250)` and then `querySelector('[data-section-id=…]')`. But the tab content is wrapped in `<AnimatePresence mode="wait">` whose exit transition is `duration: 0.3` (index.tsx:146): the new tab's DOM only mounts after the old tab finishes exiting (~300 ms+). At ~266 ms the selector finds nothing, and `el?.scrollIntoView` optional-chains into a silent no-op. (A section hidden by `VisibleSection` fails the same way.)
- **Impact**: The palette's primary function — deep-linking to a section — silently fails for every cross-tab result; users land at the top of the tab and must hunt manually, eroding trust in search.
- **Fix sketch**: Don't race the animation: poll with a short `requestAnimationFrame` loop (or `MutationObserver`) until `[data-section-id]` exists (bounded ~1 s), then scroll; or hoist a `pendingScrollTarget` state and scroll from a `useEffect`/`onAnimationComplete` of the entering tab.

## 3. Search results for `Damage.*` tags route to the Tags tab with an `effects` section id that only exists on the Effects tab
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_ability/spellbook-search-index.ts:64`
- **Scenario**: User searches "Damage.Physical" (present in `TAG_DETAIL_MAP`, static and live) and selects it. The app switches to the **Tags** tab and never scrolls anywhere.
- **Root cause**: The two ternaries disagree: `tab = key.startsWith('Ability') ? 'abilities' : 'tags'` while `section = … key.startsWith('Damage') ? 'effects' : 'tags'`. For `Damage.*` keys the result is `{tab:'tags', sectionId:'effects'}` — but `data-section-id="effects"` is only rendered inside the `effects` tab (SpellbookTabContent.tsx:60), so even with bug #2 fixed the lookup can never match. The author clearly intended the tab to follow the section.
- **Impact**: An entire category of search results (all damage-type tags) navigates to the wrong tab and silently drops the scroll — a wrong-result bug in the palette.
- **Fix sketch**: Derive the tab from the section with the existing `sectionToTab()` helper instead of a second hand-rolled ternary: compute `section` first, then `add(…, sectionToTab(section), section, …)`.

## 4. /api/ability-spec POST persists unvalidated LLM-callback payloads; malformed effects crash downstream consumers later
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/ability-spec/route.ts:26`
- **Scenario**: A `draft-ability-spec` CLI task instructs Claude to POST `effects[]/tagRules[]` back via the @@CALLBACK (cli-task.ts:914-929). The model drifts from the schema hint — e.g. an effect element missing `modifiers`/`grantedTags`, or `magnitude` as a string. The route only checks `Array.isArray(body.effects)`, returns 200 "success", and upserts the junk into `ability_specs`.
- **Root cause**: The trust boundary validates the container, not the elements: `body.effects as EditorEffect[]` is a blind cast of LLM output. Every consumer then assumes the full shape — `describeEffect` does `e.modifiers.length` / `e.grantedTags.length` (effect-codegen-prompt.ts:12-15), so building the "Generate C++" bundle throws `TypeError: Cannot read properties of undefined`, and spec editors hydrated from `getSpec` inherit the same landmine. The corruption is persistent: every later GET faithfully replays it.
- **Impact**: Success theater at write time, crash at use time — the GAS codegen path dies on a spec the API said was saved fine, with no way to see why without inspecting the DB row.
- **Fix sketch**: Validate per element in POST (id/name strings, duration enum, numeric durationSec/cooldownSec, `modifiers` array of {attribute, operation enum, magnitude number}, `grantedTags` string[]; tagRules likewise) and 400 with the offending index. Belt-and-braces: make `describeEffect` tolerate missing arrays.

## 5. C++ codegen emits invalid identifiers from free-text names — `FGameplayTag Ability_Frost Nova;` compiles nowhere
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/gas-codegen.ts:111` (also `:135` and the live duplicate `blueprint/codegen.ts:33`)
- **Scenario**: In the Blueprint Editor's Loadout panel the user types an ability name with a space — "Frost Nova" (LoadoutEditor.tsx:69 is an unconstrained text input; effect names at EffectTimelineEditor.tsx:137 likewise). They open Code Gen and copy `GameplayTags.h` / `Effects.cpp` into the UE project.
- **Root cause**: `generateTagsHeader` builds `Ability.${s.abilityName}` and sanitizes only dots: `tag.replace(/\./g, '_')` → `FGameplayTag Ability_Frost Nova;`. `generateEffectsCode` interpolates raw names into `U${eff.name}::U${eff.name}()`. Neither strips spaces, hyphens, leading digits, or other non-identifier characters, and nothing in the editors constrains input. The "valid C++ out" assumption holds only for the seed data.
- **Impact**: Silently uncompilable generated code — the user discovers it as a C2059 wall in UE, far from the actual cause, undermining the editor's "exports C++ code" promise.
- **Fix sketch**: Add a `sanitizeIdentifier()` (strip/underscore non `[A-Za-z0-9_]`, prefix `_` if leading digit) applied in `generateTagsHeader`/`generateEffectsCode`; better, validate names in the editors and show inline errors so the displayed name and the generated identifier can't diverge invisibly.

## UI findings

## 6. Search palette is a modal without dialog semantics, focus trap, or global Escape
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_ability/SpellbookSearchPalette.tsx:78`
- **Scenario**: A keyboard/screen-reader user opens Ctrl+K. The overlay has no `role="dialog"`/`aria-modal`, so AT doesn't announce a modal context; pressing Tab walks focus out of the palette into the page behind the backdrop; and Escape only closes the palette while focus is inside the input (the only keydown handler), so after clicking a result row or the list area Escape does nothing.
- **Root cause**: The combobox wiring (roles, `aria-activedescendant`) is solid, but the modal shell around it was skipped — no dialog role, no focus trap, and key handling lives on the `<input>` instead of the dialog container.
- **Impact**: Keyboard users can strand focus behind a visually-blocking backdrop and lose the universal Escape-to-dismiss affordance; AT users get no modal announcement.
- **Fix sketch**: Add `role="dialog" aria-modal="true" aria-label="Spellbook search"` on the palette container, move `onKeyDown` (at least Escape) up to that container, and trap Tab within it (or use an existing focus-trap util); restore focus to the trigger button on close.

## 7. Histogram tooltip floats in ~130px of dead space below the bars
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_ability/gas-balance/HistogramChart.tsx:21`
- **Scenario**: User hovers a TTK/DPS bar. The bars occupy only the top 64px of a `min-h-[200px]` container; the tooltip is anchored `bottom: barHeight + 6` — i.e. 70px above the *container's* bottom — so it appears detached, ~36px **below** the bars in the empty band, instead of above the hovered bar. Two-thirds of the chart panel is blank filler.
- **Root cause**: The tooltip math assumes the container is exactly bar-height-plus-padding tall; the `min-h-[200px]` added to the wrapper breaks that assumption, and nothing else fills the extra height.
- **Impact**: Tooltips read as belonging to nothing, the crosshair and tooltip are vertically disconnected, and the report wastes vertical space on every histogram.
- **Fix sketch**: Drop `min-h-[200px]` (or move it to the parent card), or anchor the tooltip to the bar row: position it `top: -tooltipOffset` relative to the bars container so it always sits just above the hovered bar.

## 8. Forge diff components hardcode zinc-* colors instead of the app's design tokens
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/core-engine/sub_ability/forge/CodeDiff.tsx:27`
- **Scenario**: Every other in-scope spellbook component uses the token classes (`text-text`, `text-text-muted`, `border-border`, `bg-surface-*`, `var(--text-muted)`), but `CodeDiff` uses `border-zinc-800`, `bg-zinc-900/80`, `bg-zinc-950/50`, `text-zinc-400/600`, and `AbilityDiff.tsx:52-97` uses `text-zinc-200/300/400/500/600` throughout.
- **Root cause**: The forge diff pair was written against raw Tailwind palette values rather than the theme variables the rest of the module standardized on.
- **Impact**: The "What changed" panel renders with subtly different greys/contrast than its sibling panels, and any future theme change (or light mode) leaves these two components visibly stuck on dark zinc — an app-wide consistency leak.
- **Fix sketch**: Map zinc usages to the existing tokens (`zinc-200/300` → `text-text`, `zinc-400/500` → `text-text-muted`, `zinc-600` → `text-text-muted/60`, `border-zinc-800` → `border-border`, `bg-zinc-900/950` → `bg-surface-deep` variants); no layout change needed.

## 9. Effects catalog controls are invisible to assistive tech: unlabeled icon-only pagination and stateless filter toggles
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_ability/effects/EffectsSection.tsx:124`
- **Scenario**: A screen-reader user lands on the Gameplay Effects panel: the prev/next pagers are bare `<ChevronLeft/>`/`<ChevronRight/>` buttons with no accessible name (announced as "button"), and the All/Instant/Duration/… filter buttons expose their pressed state only via opacity (no `aria-pressed`), so the active filter is unknowable without sight.
- **Root cause**: Icon-only buttons missing `aria-label`, and a toggle-group built from plain `<button>`s with purely visual state styling (`opacity-50` inactive also runs low-contrast for sighted users).
- **Impact**: Pagination and filtering — the panel's two interactions — are unusable or ambiguous for AT users; the dim inactive labels also skirt contrast minimums.
- **Fix sketch**: Add `aria-label="Previous page"`/`"Next page"` to the pagers and `aria-pressed={active}` to `TypeButton` (or wrap the group in `role="radiogroup"`); bump inactive TypeButton text from `opacity-50` to `opacity-70`-with-muted-token for contrast.

## 10. Long descriptive paragraphs set in uppercase + wide tracking, inconsistently across sibling sections
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/core-engine/sub_ability/core/CoreSection.tsx:19`
- **Scenario**: The Core intro panel renders a two-sentence explainer in `uppercase tracking-[0.15em]` mono, and EffectsTimelineSection.tsx:26 does the same for its description — while the equivalent description in EffectsSection.tsx:66 and all BalanceHealthReport body copy use normal sentence case (`TEXT_SCALE.body`).
- **Root cause**: The uppercase-tracked style is the module's *label/heading* treatment (SectionHeader, badges) but was applied to running body text in two places; there's no shared "panel description" primitive, so each section improvised.
- **Impact**: All-caps multi-line text with 0.15em tracking is measurably harder to read and makes sibling tabs look styled by different hands; the `IAbilitySystemInterface` inline code also loses its casing distinction inside an all-caps sentence.
- **Fix sketch**: Reserve uppercase/tracking for headers; switch both paragraphs to the `text-xs font-mono text-text-muted` (or `TEXT_SCALE.body`) sentence-case style already used in EffectsSection, ideally via a small shared `<PanelDescription>` to prevent re-divergence.
