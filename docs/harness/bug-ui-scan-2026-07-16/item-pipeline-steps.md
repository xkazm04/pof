# Item Pipeline Steps — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Test Gate always reports PASS regardless of upstream quality
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/layout-lab/steps/itemsSteps.ts:411
- **Scenario**: Click "Produce" on the Test Gate step for any item, even one whose Economy is wildly off-curve, whose Attributes are incomplete, or whose Animations/VFX never produced. `produce: () => ({ data: { checks: DEFAULT_GATE_CHECKS, pass: true } })` unconditionally hard-codes `pass: true` — there is no read of any sibling artifact or actual check evaluation.
- **Root cause**: The step's `produce()` fabricates a passing result instead of deriving it from the entity's real state; nothing in the pipeline can ever fail this gate once a user clicks the button.
- **Impact**: The UI (ItemGate.tsx) renders a full green "PASS" checklist and a fabricated success log (`[gate] rules ........ PASS` etc.) for every item unconditionally — classic success theater. Since `UE Packaging`'s accept only requires 6 assets and doesn't check the gate, and the gate itself can't fail, a badly-tuned or incomplete item can sail through the entire pipeline showing all-green acceptance badges.
- **Fix sketch**: Derive `pass` from actual sibling-step acceptance (via `ctx: CheckerContext`) — e.g. require all upstream `ITEM_STEP_SPECS[...].accept(...).status === 'pass'` before setting `pass: true`; otherwise return `pass: false` with a per-check breakdown.

### 2. `slug()` collides distinct item names onto the same UE asset path
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout-lab/steps/itemsSteps.ts:8-10
- **Scenario**: Two catalog items named `"Iron Sword"` and `"Iron-Sword"` (or `"Iron_Sword"`, or differing only by a symbol/space) both pass through `slug()`, which strips every non-alphanumeric character: both become `"IronSword"`. `base()` and `itemAsset()` then generate the identical path `/Game/Items/IronSword/...` for both entities.
- **Root cause**: `slug` treats all non-alnum characters as equivalent (deleted), with no distinguishing separator or uniqueness check (e.g. by entity id).
- **Impact**: Art/mesh/material/anim/VFX/SFX/packaging steps for the second item silently overwrite the first item's UE assets at produce/package time (or, in the read-only preview, both items show identical `✓ /Game/Items/IronSword/...` confirmations even though they're different rows) — a state-corruption time bomb that only surfaces once the catalog has two similarly-named items.
- **Fix sketch**: Fall back to (or append) the entity id when the sanitized slug collides with another entity's slug, or reject/warn on catalog item creation when slugs collide.

### 3. Economy view's "in band"/"OUTLIER" indicator can disagree with the Acceptance gate
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/layout-lab/steps/ItemEconomy.tsx:22-27
- **Scenario**: An item is tuned with `power` outside its ±10% tier band but `cost` happens to sit inside 0.8–1.2× of `expectedPrice(power)` (i.e. correctly priced for its *own*, out-of-band, power). `priceOk = tuned && priceInBand(c, power)` is true, so `hi = t.ok` and the "Outliers" panel says "None flagged · price/power inside the band" in green — while `ITEM_STEP_SPECS['Economy'].accept()` (itemsSteps.ts:328-334) requires `powerInBand(power, target) && priceInBand(cost, power)` and would render the Acceptance badge as `fail`.
- **Root cause**: The View only re-implements half of the two-part gate condition (price-band) and never calls `powerInBand`, even though the itemsSteps.ts header comment explicitly states the two math sites were unified "so the in-band / OUTLIER badge can never disagree with the derived gate."
- **Impact**: A user sees a green "in band" readout in the main Economy panel directly above a red/failing Acceptance chip for the same step — a confusing, self-contradicting UI that undermines trust in the gate.
- **Fix sketch**: Compute `ok = tuned && powerInBand(power, target) && priceInBand(cost, power)` in ItemEconomy.tsx and drive both `hi` and the Outliers text off that combined boolean, matching `accept()`.

### 4. Tooltip/Compare view never reads the artifact Produce actually writes
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout-lab/steps/ItemIntegration.tsx:42,48-58
- **Scenario**: Run Produce on the "Tooltip / Compare" step. `itemsSteps.ts`'s `produce()` (lines 390-403) writes a rich, entity-derived `data.tooltip` object (`displayName`, `typeLine`, `statBlock`, `affixLines`, `flavor`, `compareRule`) that `accept()` reads to judge pass/pending. But `ItemTooltip` (ItemIntegration.tsx) never destructures `art.data.tooltip` at all — it renders a module-level hard-coded `stats` array (`Damage 34`, `Attack Speed 1.1/s`, ...) and a static `"Uncommon · Weapon"` line for every entity, regardless of whether Produce has run or what it wrote.
- **Root cause**: The View component was left on its old stub shape from before the "Judge-fleet fix 2026-07-07" (per the itemsSteps.ts comment) that upgraded `produce()`'s payload; the component update didn't ship with it.
- **Impact**: The Acceptance chip can show "pass" (tooltip has 3+ stat rows, 1+ affix line, compare on) while the actual on-screen tooltip card and compare list are frozen, entity-agnostic placeholders that never change — the View can never regress OR reflect real content, silently diverging from both Produce and Acceptance.
- **Fix sketch**: Replace the hard-coded `stats`/`"Uncommon · Weapon"` literals with `art?.data?.tooltip` fields (`displayName`, `typeLine`, `statBlock`, `affixLines`, `flavor`) and fall back to an explicit empty-state only when `tooltip` is absent.

### 5. UE Packaging always fabricates a "complete" 6-asset manifest, bypassing upstream dependency checks
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/layout-lab/steps/itemsSteps.ts:419-423
- **Scenario**: Click Produce on "UE Packaging" immediately after creating an item, before Icon/Mesh/Material/Animations/VFX have ever been produced. `produce()` unconditionally builds `assets = [DT_Items row, T_<slug>_Icon, SM_<slug>, MI_<slug>, A_<slug>_Equip, NS_<slug>_Use]` from the slug alone — it never checks whether those upstream artifacts (or their `ueAssets`) actually exist.
- **Root cause**: `produce()` synthesizes the expected filenames from the naming convention instead of reading the actual upstream step artifacts/`ueAssets` it claims to reference ("Row references the icon texture, mesh, ... produced by the earlier steps" per ItemGate.tsx:63).
- **Impact**: `accept()` (itemsSteps.ts:424-427) only checks `assets.length >= 6`, so Packaging shows a full green "6 assets" pass and "all dependencies resolved" (ItemGate.tsx:64) even when the referenced icon/mesh/material never actually exist in the UE project — a silent-failure gap between the claimed manifest and the real UE content state.
- **Fix sketch**: Have `produce()` accept the entity's other step artifacts (via `ctx`) and only list an asset once its owning step's acceptance is `pass`; surface the gap in `packagingCopy` instead of assuming completeness.

## UI findings

### 6. Text inputs remove the focus outline with no replacement focus style
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/layout-lab/steps/controls.tsx:22,29
- **Scenario**: Tab to any `LabTextarea` or `LabInput` (used across every step's Produce panel — brief text, direction fields, etc.) using only the keyboard.
- **Root cause**: Both components set `outline: 'none'` inline and supply no `:focus`/`:focus-visible` box-shadow, border-color change, or ring as a substitute.
- **Impact**: Keyboard users get no visible indication which field is focused, failing WCAG 2.4.7 (Focus Visible) and making the whole Produce flow hard to drive without a mouse.
- **Fix sketch**: Add a `:focus-visible` style (e.g. `borderColor: t.ink` + a subtle box-shadow ring) via a shared class instead of relying on inline `outline: none`.

### 7. LabButton has no hover, active, or focus feedback beyond a static disabled state
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/layout-lab/steps/controls.tsx:10-17
- **Scenario**: Every "Produce" button across all 7 Item steps is this one shared `LabButton`. Hovering, focusing via keyboard, or pressing it shows literally no visual change — only `disabled` toggles `opacity`/`cursor`.
- **Root cause**: The style object is static and only branches on `disabled`; there's no `:hover`/`:active`/`:focus-visible` treatment and no `transition` property, so even a future state change would snap instead of animate.
- **Impact**: Every primary action button in the Items pipeline reads as inert/unresponsive, undermining the perception that a click was registered, and keyboard-focus is invisible here for the same reason as finding #6.
- **Fix sketch**: Add a small `transition: 'background 120ms, opacity 120ms'` plus hover/focus-visible variants (e.g. darken/lighten `t.ink`/`t.accentBg` on hover, a focus ring matching #6's fix) — ideally via a shared CSS class so all Produce buttons update together.

### 8. Hard-coded hex colors bypass the theme token system in generative-step previews
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout-lab/steps/ItemArt.tsx:110,129; src/components/layout-lab/steps/ItemIntegration.tsx:17-18
- **Scenario**: The Material preview sphere's default gradient (`radial-gradient(circle at 35% 30%, #e6c98a, #8a5a2b)`), the per-map `SWATCH` palette (`Albedo: '#b08d57'`, `Normal: '#8088ff'`, `ORM: '#9a9a4a'`), and the Inventory grid's "star" cell gradient (`linear-gradient(135deg,#8a5a2b,#d8a657)`) plus its `color: '#fff'` are all literal hex values instead of `t.*` theme tokens (the file even has an `eslint-disable no-restricted-syntax` acknowledging this).
- **Root cause**: These are asset-preview placeholder swatches, deliberately exempted from the design-system lint rule, but the exemption means they never adapt to the active `LabTheme` (light/dark/glass variants).
- **Impact**: In a dark or high-contrast theme variant these swatches can clash with the surrounding panel (e.g. the white `★` on a mid-brown gradient may lose contrast against certain panel backgrounds), and the same physical color inconsistently represents "gold/bronze" across three different components with three different literal values (`#8a5a2b` reused, `#b08d57`/`#d8a657` diverging) instead of one shared constant.
- **Fix sketch**: Promote the repeated bronze/gold placeholder value to a single named constant (e.g. `ITEM_PLACEHOLDER_BRONZE`) shared by ItemArt.tsx and ItemIntegration.tsx, and verify contrast of the `★` glyph against it in both theme modes.

### 9. Fixed-column CSS grids have no responsive fallback for narrow viewports
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout-lab/steps/ItemIntegration.tsx:15; src/components/layout-lab/steps/ItemArt.tsx:118
- **Scenario**: The Inventory grid (`gridTemplateColumns: 'repeat(5, 1fr)'`, 15 cells) and the Material texture-map grid (`repeat(2,1fr)`) are laid out with fixed column counts and no `minmax()`/media-query/`auto-fit` adaptation.
- **Root cause**: Column counts are hard-coded rather than responsive (e.g. `repeat(auto-fit, minmax(56px, 1fr))`), so the grid's cell size is entirely dictated by the parent panel's width.
- **Impact**: On a narrow panel (mobile viewport or a docked/narrow lab pane) the 15-cell inventory grid squeezes each cell very small, hurting legibility of the "★" glyph and touch target size; this is a layout that only ever tested well at typical desktop panel widths.
- **Fix sketch**: Switch to `repeat(auto-fit, minmax(Npx, 1fr))` for both grids so cell count adapts to available width, with a `min-width` floor sized for touch targets.
