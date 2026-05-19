# `arpg-combat` — vertical-slice readiness

## 1. One-line purpose
Melee attack ability (`GA_MeleeAttack`) with hit detection, combo system, damage application via GAS, and death flow to enable player-vs-enemy combat.

## 2. Files of record
- **UI — CombatActionMap (Flow, Hits, Feedback, Metrics tabs):** `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx:1-165` — feature catalog and 4-tab combat choreography UI
- **UI — CombatChoreographyEditor (encounter/wave simulator):** `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx:1-150` — spatial grid, wave manager, tuning sliders, UE5 export
- **UI — DamagePipelineDiagram:** `src/components/modules/core-engine/unique-tabs/DamagePipelineDiagram/index.tsx` — damage flow visualization
- **API route:** `src/app/api/combat-simulator/route.ts` — combat simulation backend
- **Store slice:** `src/stores/combatSimulatorStore.ts:1-50` — combat scenario state (Zustand)
- **Module registry entry:** `src/lib/module-registry.ts:456-464` — 'arpg-combat' module config with quickActions & checklist
- **Feature definitions:** `src/lib/feature-definitions.ts:202-211` — 8 features with dependency graph
- **Evaluator prompts:** `src/lib/evaluator/module-eval-prompts.ts:116-132` — structure/quality/performance checks
- **Prompt builders (if any):** _(none)_

## 3. Vertical-slice relevance
Required UE5 artifact: **`GA_MeleeAttack` ability that plays the attack montage, hit-detects via trace on notify, applies `GE_Damage` to target's ASC**

Acceptance bullets:
- [ ] `GA_MeleeAttack` ability exists, grabs animation montage, executes on LMB input
- [ ] Hit detection uses TSet dedup during anim notify window; applies damage via GAS to hit targets
- [ ] Enemy Health ≤ 0 triggers `State.Dead` tag, plays death montage, destroys actor
- [ ] Loot pickup actor spawns at enemy death location (cross-module with arpg-loot)

## 4. Current state
Harness marks arpg-combat as **7/8 checklist complete, 3.8/5 quality**. The module is nearly complete: 6 features fully implemented, 1 partial. Flow/Hits/Feedback/Metrics tabs are functional in the PoF UI. CombatChoreographyEditor allows spatial wave setup and UE5 export. The core gap is validation that `GA_MeleeAttack` properly deduplicates hits and that death flow fully blocks abilities via `State.Dead` tag.

## 5. Gaps blocking the slice
- (severity: M) (blocking: Y) (category: behavior-bug) — Hit deduplication may not persist across multiple hits per swing if TSet cleared mid-notify. Notes: `src/lib/evaluator/module-eval-prompts.ts:123`.
- (severity: M) (blocking: Y) (category: behavior-bug) — Death flow must use `State.Dead` tag to block all abilities, not just disable input. Notes: `src/lib/evaluator/module-eval-prompts.ts:122`, `src/lib/feature-definitions.ts:209`.
- (severity: S) (blocking: N) (category: testId-missing) — CombatActionMap lacks testId scaffold for Playwright. Notes: `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx:63-165` has no `pof-module-arpg-combat` testIds on interactive elements.
- (severity: S) (blocking: N) (category: ui-missing) — DamagePipelineDiagram exists but is not integrated into the `arpg-combat` UI tabs; only referenced generically in core-engine. Notes: `src/components/modules/core-engine/unique-tabs/DamagePipelineDiagram/index.tsx`.

## 6. testId touchpoints
| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| CombatChoreographyEditor/index.tsx | motion.div root | `pof-module-arpg-combat-choreography-editor` | `data-testid="combat-choreography-editor"` only | Not aligned to naming convention; needs `pof-module-arpg-combat-*` prefix |
| CombatActionMap/index.tsx | FlowTab / HitsTab / FeedbackTab | `pof-module-arpg-combat-flow-*`, `pof-module-arpg-combat-hits-*`, `pof-module-arpg-combat-feedback-*` | No | Playwright will need to inspect DOM for button/slider text fallback |

---

*Note: No Playwright-touched UI controls have comprehensive testId coverage in this module yet. The choreography editor has a single generic testId. Integration with the vertical slice will require testId injection or DOM inspection.*
