# `arpg-loot` — vertical-slice readiness

## 1. One-line purpose
Spawn one `AARPGWorldItem` pickup actor at enemy death location via loot-table roll, without requiring inventory integration.

## 2. Files of record
- **UI:** `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/design.tsx:1-50` — Loot table editor & affix panel
- **API routes (if any):** _(none)_
- **Prompt builders (if any):** _(none)_
- **Module registry entry:** `src/lib/module-registry.ts:227-236` — ARPG_CHECKLISTS for arpg-loot (8 checklist items al-1 to al-8)
- **Store slice (if any):** _(none)_
- **Feature definitions:** `src/lib/feature-definitions.ts:231-239` — 7 feature definitions (UARPGLootTable, Weighted selection, AARPGWorldItem, Loot drop on death, Item pickup, Loot feedback, Chest actors)
- **Evaluator prompts (if any):** `src/lib/evaluator/module-eval-prompts.ts:171-187` — Structure, quality, performance checks for loot tables and world items

## 3. Vertical-slice relevance
Required UE5 artifact: **One loot-table data asset; on enemy death, spawn one `AARPGWorldItem` pickup at the death location**

Acceptance bullets:
- [ ] Create `UARPGLootTable` data asset with weighted item entries (checklist items al-1, al-3)
- [ ] On enemy death, roll loot table and spawn `AARPGWorldItem` actor at death location (al-4, al-5)
- [ ] `AARPGWorldItem` displays mesh/nameplate but does **not** require inventory interaction for the slice (al-6 modified)

## 4. Current state
Module is 0/2 checklist items complete and scored 2.3/5 quality. The harness shows 5 feature definitions (UARPGLootTable, Weighted selection, AARPGWorldItem, Loot drop on death, Item pickup) but evaluator notes 2 features are blocked by cross-module dependencies. The checklist items (al-1 through al-8) provide full implementation steps including loot table creation, weighted rolling, world item spawning, and pickup mechanics—but currently assume inventory component integration.

## 5. Gaps blocking the slice
- **Inventory dependency conflict:** `feature-definitions.ts:14` lists `arpg-loot` prerequisites as `['arpg-inventory', 'arpg-combat']`, and feature `Item pickup` (line 236) depends on `arpg-inventory::UARPGInventoryComponent`. However, `arpg-inventory` is out of scope for the vertical slice.

**Open question for sub-project B (REQUIRED):** The slice requires only "spawn pickup actor on enemy death" without full inventory. **Minimal cheat-path:** Modify checklist items al-5 and al-6 to:
- **al-5:** "Spawn `AARPGWorldItem` actor at enemy death with a simple cleanup timer (auto-destroy after 60s); no inventory call."
- **al-6 (cheat variant):** "On player overlap with `AARPGWorldItem`, play '+gold' particle effect and destroy the actor (simulating pickup without inventory component)."

Alternatively, prompts must explicitly note that al-6 pickup is **deferred** until `arpg-inventory` is implemented, and the slice only tests al-1 through al-5 (drop generation and world spawn).

## 6. testId touchpoints
| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| `LootTableVisualizer/design.tsx` | Loot editor UI | `pof-module-arpg-loot-editor` | No | Would allow Playwright to inspect/configure loot tables |
| _(no Playwright-touched controls in this module)_ | — | — | — | Loot drop is event-driven; all pickup logic is backend (UE5 C++). |

---

**Critical finding:** Feature-definitions list `arpg-inventory` as a blocking prerequisite, but `arpg-inventory` is out of vertical-slice scope. The prompts (al-5, al-6) assume inventory integration. A **prompt-defect** gap exists: minimal cheat-path (spawn/destroy world item without inventory) must be documented in the module prompts before the slice can proceed without creating the inventory system.
