# `arpg-ui` — vertical-slice readiness

## 1. One-line purpose
Provides HUD widgets with health-bar binding to GAS attributes and floating damage numbers for combat feedback.

## 2. Files of record
- **UI:** `src/components/modules/content/ui-hud/UIHudView.tsx:1–100` — module navigation component (references checklist items au-1 through au-8)
- **UI:** `src/components/modules/content/ui-hud/EnemyHealthBarFSM.tsx:1–50` — state diagram showing fade-in/out behavior for enemy health bars (mapped to UE5 `UWidgetComponent`)
- **UI:** `src/components/modules/content/ui-hud/DamageNumberPalette.tsx:1–80` — element color reference (white/fire/ice/lightning/heal) for floating damage numbers
- **UI:** `src/components/modules/content/ui-hud/LowHealthPulse.tsx:1–360` — low-health pulsing bar state visualization
- **API routes (if any):** _(none)_
- **Prompt builders (if any):** _(none; arpg-ui prompts inlined in module-registry.ts)_
- **Module registry entry:** `src/lib/module-registry.ts:496–504` — module metadata; checklist items: `src/lib/module-registry.ts:237–246` (8 items: au-1 to au-8)
- **Store slice (if any):** _(none)_
- **Feature definitions:** `src/lib/feature-definitions.ts:240–249` — 8 features (Main HUD widget, GAS attribute binding, Enemy health bars, Ability cooldown UI, Inventory screen, Character stats screen, Floating damage numbers, Pause/settings menus)
- **Evaluator prompts (if any):** `src/lib/evaluator/module-eval-prompts.ts:188–204` — structure/quality/performance checks (HUD framework, attribute binding via delegates, inventory integration, pause logic, damage pooling)

## 3. Vertical-slice relevance
**Required UE5 artifact:** HUD widget with health bar bound to ASC `Health` attribute, plus floating damage numbers on hits.

Acceptance bullets:
- [ ] Main HUD widget displays player health bar (bound to `UARPGAttributeSet::Health / MaxHealth` via GAS delegates)
- [ ] Enemy floating health bar fades in on damage and fades out after 3 seconds idle (UWidgetComponent, Screen space)
- [ ] Floating damage numbers spawn at hit location with color coding (white=physical, red=fire, blue=ice, yellow=lightning)

## 4. Current state
Harness scenario marks this 8/8 checklist completion, "Needs review" status (not reviewed). PoF UI includes 8 detailed checklist items (au-1 through au-8) covering HUD setup, GAS binding, enemy bars, cooldown UI, inventory screen, character stats, floating damage, and pause menus. Components exist as React design/visualization tools (`EnemyHealthBarFSM` showing FSM diagram, `DamageNumberPalette` showing color reference) but are not codegen endpoints. Module prerequisites: depends on `arpg-gas` (HARD), `arpg-inventory` (CRITICAL DEPENDENCY FLAG — see section 5).

## 5. Gaps blocking the slice
- **(severity: S, blocking: Y)** **inventory-dependency conflict:** Feature definitions list `arpg-inventory` as a hard prerequisite for `arpg-ui` (`src/lib/feature-definitions.ts:15`), yet arpg-inventory is out of scope for the vertical slice. Inventory screen (`au-5`) and character stats (`au-6`) items depend on inventory component; floating damage and HUD items (`au-1`, `au-2`, `au-3`, `au-4`, `au-7`) do not. **CRITICAL: confirm whether PoF prompts/checklist allow operator to skip au-5 and au-6 (inventory/stats screens) and generate only the slice-relevant HUD elements (au-1, au-2, au-3, au-4, au-7). If prompts cannot isolate HUD-only items, flag as `prompt-defect` blocking sub-project B.**

## 6. testId touchpoints
| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `src/components/modules/content/ui-hud/UIHudView.tsx` | Module nav panel | `pof-module-arpg-ui` | Likely (follows convention) | Playwright clicks to enter module |
| `src/components/modules/content/ui-hud/DamageNumberPalette.tsx:39` | Color swatch panel | `damage-number-palette-panel` | Yes | Design reference, not interactive for slice |
| `src/components/modules/content/ui-hud/LowHealthPulse.tsx:211` | Health threshold slider | `health-pct-slider` | Yes | Design tool, not in slice flow |

arpg-ui module presents design/visualization components (FSM diagrams, color palettes, threshold editors) as PoF UI tools, not Playwright-driven checklist interaction points. Slice Playwright flow does not automate HUD or checklist UI in this module — UE5 artifacts are manually authored in-engine per prompts au-1 through au-7, then verified in packaged build.

