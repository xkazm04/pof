# Level & Materials Authoring — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Fresh-mount Material Configurator generates a "Metal" material with Metallic=0
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/content/materials/MaterialParameterConfigurator.tsx:160`
- **Scenario**: User opens the Configure tab and clicks "Generate Master Material — Metal" without first clicking any surface chip (Metal is already pre-selected, so there is no reason to click it).
- **Root cause**: Per-surface defaults (`getDefaultMetallic('metal')` = 1, `getDefaultRoughness('metal')` = 0.2) are applied only inside `selectSurface` (lines 184-193), which never runs for the initial `useState<SurfaceType>('metal')`. `paramValues` starts as `{}`, so both the sliders and `handleGenerate`'s fallback (`paramValues[p.name] ?? p.defaultValue`, line 209) use the generic `BASE_PARAMS` defaults: Roughness 0.5, Metallic 0.
- **Impact**: Wrong results — the generated UE5 prompt declares "Surface type: Metallic (PBR metal workflow)" while shipping `Metallic: default=0`, producing a master material that renders as a dielectric (plastic). The UI also displays these wrong values as if they were the Metal defaults, so the user has no cue anything is off until the material looks wrong in-engine.
- **Fix sketch**: Initialize state with a lazy initializer that mirrors `selectSurface`: `useState(() => ({ Roughness: getDefaultRoughness('metal'), Metallic: getDefaultMetallic('metal') }))`, or call a shared `applySurfaceDefaults(surface)` from both the initializer and `selectSurface` so the two paths cannot diverge.

## 2. Style-transfer "Analyze" never looks at the image — image-only analyses return hardcoded stone/gray defaults presented as extracted properties
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/style-transfer/route.ts:33`
- **Scenario**: User uploads a screenshot of e.g. gold armor with no (or a vague) text description and clicks "Analyze Reference". The UI spinner says "Analyzing visual properties...", then renders a color palette, surface type, and confidence as analysis of that image.
- **Root cause**: `analyzeFromDescription` is a keyword matcher over the *text description only*; `imageDataUrl` is reduced to a boolean (`hasImage`) that merely adds +0.15 confidence (line 70). With no matching keywords, the result is always `surfaceType: 'stone'`, the hardcoded gray palette `['#808080', ...]`, and 55%+ "confidence". The in-scope component (`MaterialStyleTransfer.tsx:216-218, 246-276`) sells the opposite contract: "Upload a reference screenshot to generate matching UE5 materials", a Compare mode showing "Reference" vs "Analyzed Properties", and a suggestion that literally promises "more accurate color palette extraction" from an upload — extraction that never happens anywhere.
- **Impact**: Wrong results dressed as success — image-driven users get stone/gray parameters for any image, see swatches presented as "Color Palette" of their reference, refine them, and generate a material that cannot match the screenshot. No signal distinguishes a real match from the fallback.
- **Fix sketch**: Either wire the image into a real vision pass, or be honest in the contract: when `matchCount === 0` and the only input is an image, return a low-confidence result flagged `source: 'text-heuristic'` and have the UI label the palette/properties "estimated from description — image not yet analyzed" instead of the current extraction claims.

## 3. Concurrent Blender previews on two patterns cross-wire spinner and result state
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/content/materials/MaterialPatternCatalog.tsx:215`
- **Scenario**: User expands Water Surface, clicks "Preview in Blender" (a multi-second `/api/blender-mcp/execute` round trip), then expands Fire/Embers and clicks its preview while the first is still in flight. Only the in-flight pattern's own button is disabled (`isBlenderPreviewing = blenderPreviewing === pattern.id`); every other pattern's preview button stays clickable.
- **Root cause**: `blenderPreviewing` and `blenderResult` are two singleton state atoms with no request identity. Request B overwrites `blenderPreviewing`; whichever request settles first runs `finally { setBlenderPreviewing(null) }`, clearing the spinner for the one still running. The later `setBlenderResult` wins regardless of which request it belongs to, so an old request's result can replace the newer one (shown under the old pattern's card) while the in-flight request shows no progress at all. Two scripts also execute concurrently in the shared Blender scene.
- **Impact**: Wrong/misleading output — spinner disappears while a preview is still running, the surviving result message can belong to the wrong (stale) request, and the success/error of the user's latest action is silently discarded.
- **Fix sketch**: Track a request id (`useRef` counter) captured per invocation and ignore `setBlenderPreviewing(null)`/`setBlenderResult` from stale ids; or simpler, disable *all* preview buttons while any preview is in flight (matching `PostProcessStackBuilder`'s single-preview model).

## 4. Applying a preset silently discards the user's custom effect ordering
- **Severity**: Low
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/stores/postProcessStudioStore.ts:173`
- **Scenario**: In the Post-Process Recipe Studio the user reorders effects with the up/down controls (e.g. moves Fog above Bloom), then clicks a preset card like "Film Noir" to try its parameter values.
- **Root cause**: `applyPreset` rebuilds the stack from `cloneEffects(DEFAULT_EFFECTS)`, so priorities revert to definition order even though presets only define `enabledEffects` + parameter `overrides`, never ordering. The design assumes a preset is a full stack replacement, while the reorder UI implies ordering is an independent user-owned dimension. (Related drift: `moveEffect` at line 160 keeps `activePresetId` set, while `setEffectEnabled`/`setEffectParam` clear it — so a reordered stack still claims to be the pristine preset, and `generateCode` sends that preset name to the prompt.)
- **Impact**: Silent loss of user arrangement — the curated order feeding the priority-sorted C++ generation resets with no warning or undo, and the generated prompt can mislabel a modified stack as the named preset.
- **Fix sketch**: In `applyPreset`, start from the *current* effects (`cloneEffects(get().effects)`) and apply `enabled` + overrides while preserving each effect's existing `priority`; and clear `activePresetId` in `moveEffect` for consistency with the other mutators.

## UI findings

## 5. Two clashing visual languages inside the Materials tab strip
- **Severity**: High
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/content/materials/MaterialPatternCatalog.tsx:260`
- **Scenario**: Switching tabs within the same Materials module flips the entire design language: Configure and Style use the app design system (`bg-surface`, `text-text`, sentence case, `MODULE_COLORS`), while Patterns, Post-Process, and Hierarchy (plus `BiomeScatterPanel.tsx:90` in level-design) render a hardcoded `#03030a` sci-fi terminal theme — violet-900 borders, glow shadows, uppercase mono copy like "EXECUTE WATER SURFACE SYNTHESIS" and "GRAPH_STATUS: 0/3 NODES_COMPILED".
- **Root cause**: The terminal-styled panels hardcode hex colors and bespoke shells instead of the shared `SurfaceCard`/token system used by their sibling tabs and by the evaluator's `PostProcessStudioView`, which covers the same post-process domain in plain design-system styling.
- **Impact**: The module feels like two different products; hardcoded `#03030a`/violet values bypass theming, and the jargon-heavy uppercase copy ("PRIORITY_ROUTING_LOCKED") costs scanability for no informational gain.
- **Fix sketch**: Pick one language per module (the design system), extract a shared panel shell + generate-button component (the same `${color}15` background / `${color}30` border pattern is hand-copied in 6+ places), and keep the sci-fi flavor, if desired, as accents (header chip, status line) rather than a full divergent theme.

## 6. Configurator surface/output/feature selectors expose no selected state to assistive tech
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/content/materials/MaterialParameterConfigurator.tsx:275`
- **Scenario**: A screen-reader or keyboard user tabs through the 8 surface-type buttons, 2 output-type buttons, and 6 feature toggles. Selection is conveyed only by inline color/border styles (and a color-filled dot for features), so every control announces as a plain unnamed-state button.
- **Root cause**: The buttons set `style` based on `isActive` but never `aria-pressed`/`role="radio"`. The pattern exists 20 lines up — the Explain and Glossary toggles in the same file correctly use `aria-pressed`/`aria-expanded`, and `PostProcessStackBuilder`'s switches use `role="switch" aria-checked` — but the three core selection groups drifted.
- **Impact**: Users of assistive tech cannot tell which surface, output type, or features are selected — the primary inputs of the whole configurator — and color-only state also fails low-vision users.
- **Fix sketch**: Add `aria-pressed={isActive}` to feature toggles and `role="radiogroup"`/`role="radio" aria-checked` (or `aria-pressed`) to the surface and output groups; add a non-color cue (check icon or bold border already present — pair it with the aria state).

## 7. Configurator and style-transfer range sliders are unlabeled with no visible thumb/focus state
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/content/materials/MaterialParameterConfigurator.tsx:407`
- **Scenario**: Tabbing to a parameter slider (Roughness, IOR, ...) gives no visible focus indication, and `appearance-none` plus the bare gradient track leaves no styled thumb to grab; screen readers announce an unnamed slider because the label is an unassociated sibling `<span>`. Same for `AdjustSlider` in `MaterialStyleTransfer.tsx:617`.
- **Root cause**: The inputs lack `aria-label` and any focus/thumb styling; the polished pattern already exists in `PostProcessStudioView.tsx`'s `ParamSlider` (aria-label, custom thumb, focus ring mirroring `.focus-ring`) but was not reused.
- **Impact**: Keyboard users cannot see which slider they are adjusting; screen-reader users do not know what the slider controls; precision dragging suffers without a visible thumb.
- **Fix sketch**: Reuse `StyledSlider` (already used by `PBREditor`) or the PP `ParamSlider` pattern: `aria-label={p.label}`, a visible thumb, and a focus ring tied to the surface accent color.

## 8. Style-transfer "Compare" toggle is a dead end for description-only analyses
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/content/materials/MaterialStyleTransfer.tsx:221`
- **Scenario**: User analyzes from a text description only (no image — a supported flow: "optional with image, required without"). The Compare button appears next to the header once `analysis` exists; clicking it visibly activates (cyan state) but nothing changes, because the compare panel renders only inside the `imageDataUrl` branch of the drop zone (lines 246-276).
- **Root cause**: The button's render condition (`analysis`) is broader than the feature's actual precondition (`analysis && imageDataUrl`); there is also no empty-state explaining what Compare needs. Adjacent polish gaps in the same file: the clear-image X button (line 256) has no `aria-label`, and palette hex tooltips (line 386) are hover-only, unreachable by keyboard.
- **Impact**: Users click a control that silently does nothing — the exact "I clicked and nothing happened" pattern this module was previously dinged for on the Analyze path.
- **Fix sketch**: Gate the button on `analysis && imageDataUrl` (or disable it with a title "Upload a reference image to compare"); add `aria-label="Remove reference image"` to the X; surface the hex value via `title` on a focusable swatch.

## 9. Post-Process Studio layout breaks down at narrow widths (fixed 7-column presets, non-wrapping toolbar, rigid 3-column grid)
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/modules/evaluator/PostProcessStudioView.tsx:378`
- **Scenario**: On a half-screen window or smaller laptop, the preset gallery's hardcoded `grid-cols-7` crushes each card to an unreadable sliver (name + description both `truncate` to a few characters), the header row (resolution selector + Explain + A/B + Generate, line 149) overflows without wrapping, and the `grid-cols-3` main area (line 300) squeezes the GPU breakdown column.
- **Root cause**: No responsive breakpoints anywhere in the view — all three grids/rows assume a wide viewport, unlike sibling panels (e.g. `MaterialPatternCatalog`'s `flex-col xl:flex-row` search bar) that already wrap.
- **Impact**: Preset names/descriptions become illegible and the primary Generate button can be pushed out of reach precisely on the split-screen layouts a UE5 developer is likely to use next to the editor.
- **Fix sketch**: `grid-cols-3 sm:grid-cols-4 xl:grid-cols-7` for presets, `flex-wrap` on the header controls row, and `grid-cols-1 xl:grid-cols-3` (stack GPU panels below on narrow widths) for the main area.
