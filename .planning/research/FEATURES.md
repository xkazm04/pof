# Feature Research

**Domain:** Density-aware adaptive panel/workspace UIs (Dzin integration into PoF)
**Researched:** 2026-03-14
**Confidence:** HIGH (Dzin source code inspected directly; ecosystem patterns well-established)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that a density-aware panel prototype must have to feel functional and coherent. Missing any of these makes the prototype feel broken rather than early.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Tri-density rendering (micro/compact/full)** | Core value proposition -- panels must render meaningfully at 3 distinct densities with appropriate content reduction | MEDIUM | Dzin already provides `PanelDensity` type, `DensityProvider`, `useDensity()` hook, and `PanelFrame` with density-aware chrome. Implementation is per-panel content adaptation logic. |
| **Layout template switching** | Users need to see the same panels rearranged across different compositions (split-2, grid-4, studio, etc.) | LOW | Dzin has 8 templates built. Need UI controls to switch between them and wire up `DzinLayout` / `useLayout`. |
| **Automatic density assignment from slot size** | Density should be computed from available slot pixels, not manually set -- this IS the "density-aware" promise | LOW | `assignSlotDensity()` already exists. Just needs to be wired through `resolveLayout()`. |
| **Panel registry with metadata** | Each panel needs type, label, role, sizeClass, complexity, densityModes -- the layout engine uses this to make assignment decisions | LOW | `createRegistry()` + `PanelDefinition` type exist. Need to author PoF-specific panel definitions (one per AbilitySpellbook section). |
| **Graceful content degradation per density** | At micro: badge/icon + 1-2 numbers. At compact: key data, no charts. At full: everything. Users expect progressive disclosure, not clipping. | HIGH | This is the hard work -- each of the ~10 AbilitySpellbook sections needs 3 rendering modes. No shortcut; must be hand-authored per panel. |
| **Consistent theming across densities** | Panels at all densities must share the same visual language (colors, spacing rhythm, border treatment) | MEDIUM | Dzin uses `data-dzin-*` attributes + CSS custom properties. Must bridge to PoF's Tailwind/chart-colors system. `DZIN_TOKENS` exists for base tokens. |
| **Panel header chrome scaling** | Headers should show title+icon+actions at full, title+icon at compact, nothing at micro | LOW | `PanelFrame` already implements this exact behavior. |
| **Viewport-responsive template selection** | On narrow viewports, complex layouts (studio, triptych) should be disallowed; stack fallback for mobile | LOW | `VIEWPORT_BREAKPOINTS`, `getAllowedLayouts()`, `clampLayoutToViewport()` already exist. |
| **Container-based (not viewport-based) density** | Density must respond to the panel's actual slot size, not the browser viewport. Two panels at different sizes should have different densities simultaneously. | LOW | Dzin's architecture already does this -- `assignSlotDensity()` takes `slotWidthPx`/`slotHeightPx` per slot, not viewport width. |

### Differentiators (Competitive Advantage)

Features that make this feel like a next-generation workspace rather than just "panels in a grid." These align with the prototype's goal of proving Dzin elevates PoF's UIs.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Animated density transitions** | When a panel's density changes (e.g., layout switch causes slot resize), content morphs smoothly rather than popping. This is the "wow" factor. | HIGH | Requires framer-motion `AnimatePresence` + `layout` animations coordinated with density context changes. Must handle content replacement (micro->full adds elements) without jank. |
| **Animated layout transitions** | Switching between templates (split-2 to grid-4) should animate panel positions smoothly, not jump-cut | HIGH | CSS Grid transitions are limited. Likely needs `layout` prop from framer-motion on slot containers, or FLIP animation technique. |
| **Layout template picker UI** | Visual minimap-style selector showing template shapes (like Figma's layout options) -- click to switch | MEDIUM | Custom component showing template thumbnails. Enhances discoverability. Could be a toolbar or dropdown with visual previews. |
| **Side-by-side comparison mode** | Toggle between current AbilitySpellbook and Dzin-powered version on the same data. Proves the value proposition directly. | MEDIUM | Two render paths for same data. Could be split-screen or tab toggle. Important for prototype evaluation. |
| **Panel-to-panel data wiring** | Selecting an entity in one panel filters/highlights related data in companion panels (e.g., select ability -> effect timeline filters to that ability) | HIGH | Dzin has `PanelPropSchema` inputs/outputs and `PanelDataSlice` for entity/filter/highlight. But runtime wiring needs a lightweight pub/sub or shared context per composition. |
| **Density override controls** | Per-panel manual density override (force a panel to compact even if slot could fit full) | LOW | `PanelDirective` already supports `density` override. Need a small UI affordance (density toggle button in panel chrome). |
| **Hungarian algorithm panel assignment** | Panels automatically assigned to optimal slots based on role/size/complexity scoring rather than manual placement | LOW | `hungarianSolve()`, `scorePanelForSlot()`, `assignPanelsToSlots()` already implemented. This is Dzin's key differentiator vs dockview/react-resizable-panels. |
| **Domain-scoped panel filtering** | Show only panels relevant to current context (e.g., "combat" domain filters out non-combat panels) | LOW | `PanelDefinition.domains` + `registry.getByDomain()` already exist. Need UI for domain switching. |
| **Composition presets** | Named panel+layout combos (e.g., "Ability Overview" = Core + Attributes + Abilities in split-3, "Debug View" = Damage Calc + Effect Timeline + Tag Audit in grid-4) | MEDIUM | Not built in Dzin yet. Need a preset definition format + switcher UI. Very valuable for the "curated workspace" feel. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately NOT build in this prototype. Some are explicitly out of scope per PROJECT.md; others are traps that derail panel framework prototypes.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Drag-and-drop panel rearrangement** | Every panel framework demo has it. Feels essential. | Massive implementation cost (drag handles, drop zones, reflow logic, edge cases with nested grids). Dockview/react-resizable-panels took years to get right. Not needed to validate density adaptation. | Use layout template switching instead. Proves composability without DnD complexity. |
| **User-resizable panel dividers** | Power users expect resize handles between panels (like VS Code). | Conflicts with density-aware auto-sizing. If users manually resize, the density engine's slot-based assignment becomes incoherent. Also high complexity (resize handles, min/max constraints, persistence). | Let the layout engine assign sizes. Offer layout template switching as the coarse-grained control. |
| **Floating/detachable panels** | IDE users expect panels that pop out into separate windows. | Requires portal rendering, z-index management, window.open() for popout, cross-window state sync. Orthogonal to density validation. | Keep all panels in-grid. Density adaptation within grid slots is the focus. |
| **LLM/AI intent routing** | Dzin has an intent system (compose, navigate, manipulate) with LLM hooks. Tempting to demo. | PROJECT.md explicitly defers this. Intent routing requires LLM integration, prompt engineering, and testing -- a separate validation track. Mixing it in clouds density evaluation. | Skip entirely. Validate density + layout first. Intent routing is a future milestone. |
| **Chat-driven panel composition** | Dzin has `createChatStore`, slash commands, message system. Natural to include. | Also explicitly out of scope. Chat UI adds significant surface area unrelated to proving density adaptation works. | Skip entirely. |
| **Undo/redo for layout changes** | Dzin has `createUndoStack` with full undo/redo. Feels like table stakes. | PROJECT.md explicitly marks this out of scope. Undo/redo needs careful state management and testing. Not needed to evaluate density rendering. | Skip for prototype. Note it exists in Dzin for future use. |
| **Persistent layout state** | Users expect their layout choices to survive page reload. | Adds localStorage/DB persistence logic, migration concerns, and edge cases (what if panel definitions change?). Premature for a prototype. | In-memory only. Layout resets on refresh. Acceptable for a demo. |
| **Multi-module panel support** | Tempting to demo panels from multiple PoF modules (combat + animation + loot). | PROJECT.md scopes to arpg-combat AbilitySpellbook only. Multi-module adds cross-module data dependencies, more panel definitions, and scope creep. | Single module (AbilitySpellbook). If that works, expanding to other modules is a separate effort. |
| **Responsive breakpoint-based layouts** | Standard responsive design -- change layout at 768px, 1024px, etc. | Conflicts with container-based density. Dzin's approach is deliberately per-slot, not per-viewport. Viewport breakpoints are only used to filter available templates, not to control density. | Use Dzin's `clampLayoutToViewport()` for template filtering. Density stays slot-based. |

## Feature Dependencies

```
Panel Registry (definitions)
    |
    +--requires--> Tri-density rendering (panels must know their density modes)
    |                   |
    |                   +--requires--> Graceful content degradation (the actual render work)
    |
    +--requires--> Layout template switching (registry feeds the layout engine)
                        |
                        +--requires--> Automatic density assignment (density computed after layout)
                        |
                        +--enhances--> Animated layout transitions
                        |
                        +--enhances--> Layout template picker UI

Consistent theming
    +--requires--> Panel header chrome scaling (PanelFrame needs themed styles)
    +--requires--> Graceful content degradation (all densities share theme)

Animated density transitions --enhances--> Tri-density rendering
Animated layout transitions --enhances--> Layout template switching

Side-by-side comparison --requires--> Tri-density rendering (need working Dzin panels to compare)
                         --requires--> Layout template switching (need working layouts)

Panel-to-panel data wiring --enhances--> Graceful content degradation
                            --requires--> Panel Registry (needs input/output schema)

Composition presets --requires--> Panel Registry
                     --requires--> Layout template switching
                     --enhances--> Layout template picker UI

Drag-and-drop --conflicts--> Automatic density assignment (manual sizing breaks auto-density)
User-resizable dividers --conflicts--> Automatic density assignment (same reason)
```

### Dependency Notes

- **Panel Registry requires Tri-density rendering:** Definitions include `densityModes` with per-density min dimensions and descriptions. Meaningless without panels that actually render differently.
- **Layout template switching requires Panel Registry:** `resolveLayout()` needs registered panels to score and assign to slots.
- **Automatic density assignment requires Layout template switching:** Density is computed from slot pixel dimensions, which come from the resolved layout.
- **Animated density transitions enhances Tri-density rendering:** Not required for validation, but transforms the experience from "functional" to "polished."
- **Drag-and-drop conflicts with Automatic density assignment:** Manual panel placement/sizing undermines the engine's slot-based density computation. Pick one model.
- **Composition presets requires both Registry and Layout switching:** Presets are named combinations of panel directives + template ID -- both must work first.

## MVP Definition

### Launch With (v1 -- Prototype)

Minimum viable to validate: "Can Dzin make PoF's dense game-dev UIs adaptive and polished?"

- [ ] **Panel Registry with ~10 AbilitySpellbook panel definitions** -- one per section (Core, Attributes, Tags, Abilities, Effects, Tag Deps, Effect Timeline, Damage Calc, Tag Audit, Loadout)
- [ ] **Tri-density rendering for all panels** -- each panel renders meaningfully at micro/compact/full
- [ ] **Layout template switching** -- at least 4 templates work (split-2, grid-4, primary-sidebar, studio)
- [ ] **Automatic density assignment** -- panels auto-adapt density based on slot dimensions
- [ ] **Consistent theming** -- Dzin CSS tokens bridged to PoF dark theme + chart-colors
- [ ] **Panel header chrome** -- PanelFrame styled for PoF
- [ ] **Prototype route** -- `/prototype` page hosts everything

### Add After Validation (v1.x)

Features to add once core density rendering is working and evaluated.

- [ ] **Animated density transitions** -- trigger: core panels work but density changes feel jarring
- [ ] **Animated layout transitions** -- trigger: template switching works but feels abrupt
- [ ] **Layout template picker UI** -- trigger: users struggle to discover available layouts
- [ ] **Side-by-side comparison** -- trigger: need to present prototype to stakeholders for go/no-go
- [ ] **Composition presets** -- trigger: specific panel combos emerge as useful during evaluation
- [ ] **Density override controls** -- trigger: auto-density occasionally makes wrong choice

### Future Consideration (v2+)

Features to defer until the prototype validates and full Dzin adoption is decided.

- [ ] **Panel-to-panel data wiring** -- requires defining a runtime pub/sub model for cross-panel communication
- [ ] **Domain-scoped panel filtering** -- only relevant when multiple modules adopt Dzin
- [ ] **LLM intent routing** -- explicitly deferred per PROJECT.md
- [ ] **Chat-driven composition** -- explicitly deferred per PROJECT.md
- [ ] **Undo/redo** -- exists in Dzin but not needed for density validation
- [ ] **Layout persistence** -- nice-to-have once panels are production-ready
- [ ] **Drag-and-drop rearrangement** -- only if the template-switching model proves insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tri-density rendering | HIGH | HIGH | P1 |
| Graceful content degradation | HIGH | HIGH | P1 |
| Panel Registry definitions | HIGH | LOW | P1 |
| Layout template switching | HIGH | LOW | P1 |
| Automatic density assignment | HIGH | LOW | P1 |
| Consistent theming (Dzin-to-PoF bridge) | HIGH | MEDIUM | P1 |
| Panel header chrome | MEDIUM | LOW | P1 |
| Prototype route (`/prototype`) | HIGH | LOW | P1 |
| Viewport-responsive template selection | MEDIUM | LOW | P1 |
| Animated density transitions | HIGH | HIGH | P2 |
| Animated layout transitions | HIGH | HIGH | P2 |
| Layout template picker UI | MEDIUM | MEDIUM | P2 |
| Side-by-side comparison | MEDIUM | MEDIUM | P2 |
| Composition presets | MEDIUM | MEDIUM | P2 |
| Density override controls | LOW | LOW | P2 |
| Panel-to-panel data wiring | HIGH | HIGH | P3 |
| Domain-scoped filtering | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for prototype launch -- validates density adaptation
- P2: Should have, add during polish pass -- elevates from "works" to "impressive"
- P3: Nice to have, future milestone -- requires additional architectural decisions

## Competitor Feature Analysis

| Feature | Dockview | react-resizable-panels | Cloudscape | SAP Fiori | Dzin (PoF) |
|---------|----------|----------------------|------------|-----------|------------|
| Density modes | No | No | 2 (comfortable/compact) | 2 (cozy/compact) | 3 (micro/compact/full) |
| Auto-density from size | No | No | No (user toggle) | No (user toggle) | Yes (slot-based computation) |
| Layout templates | No (freeform dock) | No (split-based) | N/A | N/A | 8 predefined templates |
| Drag-and-drop | Yes | No | N/A | N/A | No (by design) |
| Resizable dividers | Yes | Yes | N/A | N/A | No (by design) |
| Panel assignment algorithm | No (manual) | No (manual) | N/A | N/A | Hungarian algorithm |
| LLM-readable manifest | No | No | No | No | Yes (serialized registry) |
| Headless (style-agnostic) | No (CSS bundled) | Mostly | N/A | No (SAP theme) | Yes (data attributes) |

**Key insight:** Dockview and react-resizable-panels solve a different problem (user-controlled docking/resizing). Cloudscape and SAP Fiori solve density as a global user preference toggle. Dzin is unique in computing density per-slot automatically. This is the differentiator worth validating.

## Sources

- Dzin source code: `C:\Users\kazda\kiro\studio-story\packages\dzin\core\src\` (direct inspection, HIGH confidence)
- PoF AbilitySpellbook: `src/components/modules/core-engine/unique-tabs/AbilitySpellbook.tsx` (direct inspection)
- [Dockview](https://dockview.dev/) -- zero-dependency docking layout manager
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) -- accessible split-view layouts
- [Cloudscape Content Density](https://cloudscape.design/foundation/visual-foundation/content-density/) -- AWS design system density modes
- [SAP Fiori Content Density](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/visual/cozy-compact) -- cozy/compact modes
- [Material Design 3 Density](https://m3.material.io/foundations/layout/understanding-layout/density) -- density configuration
- [Balancing Information Density - LogRocket](https://blog.logrocket.com/balancing-information-density-in-web-development/) -- density patterns
- [Designing for Data Density - Paul Wallas](https://paulwallas.medium.com/designing-for-data-density-what-most-ui-tutorials-wont-teach-you-091b3e9b51f4) -- density design principles

---
*Feature research for: Dzin density-aware panel integration into PoF*
*Researched: 2026-03-14*
