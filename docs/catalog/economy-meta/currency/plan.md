# Currency — Catalog Pipeline Brief

**Category:** Economy / Meta · **Catalog:** `currencies` (new) · **Description:** A spendable resource type in the economy.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Gold** — the seeded `currencies` entity `id: 'currency-gold'` (categoryPath `['Standard']`); the primary soft currency, the universal medium of exchange.

**Status (this session):** Real UE artifacts produced (currency schema + wallet component + economy gate) — 9/14 steps covered by reuse or production, 2 partial, 3 are gaps. The gate is authored + arithmetic-traced but its headless run is **deferred** (documented blocker). Honest dispositions below; findings at the bottom.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief & Role  
  _agent: Designer · **produced**: Gold = the primary **soft** currency, the world's common medium of exchange. Earned from combat/quests/exploration/vendor-sales; spent on consumables/repairs/gear/crafting/fees. Fantasy = "the coin that makes the world turn." Ships uncapped / no-decay by default (cap & decay are per-currency knobs)._
- [x] 2. Source/Sink Mapping  
  _agent: Designer/Balancer · **reuse** `src/lib/economy/definitions.ts`: 6 faucets (enemy/elite/boss kill, quest reward, vendor loot-sale, chest) + 9 sinks (health/mana potions, repair, vendor gear, crafting, enchant, stash, waypoint, death). Gold **is** this model's currency. UE seam: faucets call `UARPGWalletComponent::AddCurrency`, sinks call `SpendCurrency`._
- [x] 3. Cap & Decay Rules  
  _agent: Designer · **produced**: `FARPGCurrencyDef.Cap` (0 = uncapped) + `DecayPerDay` (0..1). The gate asserts cap-clamp (120) and a 10%/day decay (120 → 108). Gold itself ships uncapped/no-decay; the knobs exist + are exercised._
- [x] 4. Conversion Rules (to/from other currencies)  
  _agent: Designer · **produced (mechanism) / partial (content)**: `UARPGWalletComponent::Convert` uses the `BaseUnitValue` ratio, atomic on failure; the gate proves 1 Shard = 100 Gold + a rejected over-conversion. ⚠️ no second currency is seeded yet (catalog has only Gold) — conversion **content** is a gap._
- [x] 5. Inflation / Sink Balancing Sim  
  _agent: Balancer · **reuse** the app **Economy Simulator** (`sub_inventory/economy-simulator`, `EconomySimulatorView`): runs the faucet/sink flows across agents × levels × hours → Gold inflation/net-flow curve. This **is** the per-currency balancing engine; no new sim needed._
- [ ] 6. Icon 2D Art  
  _agent: Concept2D · ⚠️ **partial**: producible via the Leonardo 2D dispatch (not run this session) and 🔗 the `icon-sets` catalog (a "Currency Icons" family). Bind via `presentationLink('icon', 'currency-gold')`._
- [ ] 7. Gain VFX  
  _agent: VFX · ⚠️ **GAP** + 🔗: no Niagara authoring pipeline (same gap as Fireball). A "Coin Pickup Sparkle" belongs in the `vfx` catalog; bind via `presentationLink('vfx', …)`._
- [ ] 8. Gain SFX  
  _agent: Audio · ⚠️ **GAP** + 🔗: the `import_audio_set` dispatch + `audio` catalog can import a coin-pickup SFX set; none authored. Bind via `presentationLink('sfx', …)`._
- [ ] 9. Wallet UI Integration  
  _agent: UI · ⚠️ **partial**: the `OnCurrencyChanged(id, newBalance, delta)` delegate **is** the UI data hook (Blueprint-assignable). A HUD currency readout binds to 🔗 `hud-elements` via `presentationLink('hud', …)`; no widget authored this session._
- [ ] 10. Localization (name, plural)  
  _agent: Writer · ⚠️ **GAP**: no localization/string-table system (same gap Fireball hit). `DisplayName` / `DisplayNamePlural` on `FARPGCurrencyDef` are the future keys (`Currency_Gold_Name` / `_Plural`)._
- [x] 11. Anti-Exploit Validation  
  _agent: QA · **produced**: the component rejects non-positive Add/Spend, makes Spend **atomic** on insufficient funds, and clamps Add to the cap. The gate asserts overspend-rejected, negative-rejected, and balance-unchanged-after-reject. (Guards are server-authoritative.)_
- [x] 12. Telemetry Hooks  
  _agent: QA · **produced**: `OnCurrencyChanged` broadcasts `(currencyId, newBalance, signedDelta)` on every balance change — the single hook for analytics + UI. The gate counts broadcasts (≥ 4 on credit/spend/capped-credit/decay)._
- [x] 13. Economy Test Gate  
  _agent: QA · **produced**: `Source/PoF/Test/Economy/VSCurrencyWalletTest.cpp` — `IMPLEMENT_SIMPLE_AUTOMATION_TEST` `Project.Functional Tests.PoF.Currency.WalletRules` (pure logic, **no map/PIE** — concurrency-safe, mirrors the Fireball effect-config gate). ⚠️ **headless run deferred**: the shared UE tree currently holds another session's uncommitted in-flight changes (`ARPGGameplayTags`, `ARPGEnemyCharacter`, a Burning test) + an active build — running now would race/clobber. Code matches the gate convention; all assertions hand-traced for arithmetic. Run: `UnrealEditor-Cmd PoF.uproject -ExecCmds="Automation RunTests Project.Functional Tests.PoF.Currency;Quit" -unattended -nopause -nullrhi -abslog=…`._
- [x] 14. UE Asset Packaging  
  _agent: Packager · **produced**: `Source/PoF/Economy/ARPGCurrencyTypes.h` (`FARPGCurrencyDef : FTableRowBase`) + `ARPGWalletComponent.h/.cpp` (committed to `pof-exp`). The `DT_Currencies` DataTable + Gold row is the `author-python` data step. App side: `CURRENCY_RECIPE` registered in `src/lib/catalog/recipe.ts`._

## PoF integration
- **Catalog:** `currencies` (registered Phase A); entity `id: 'currency-gold'`, module `arpg-inventory`.
- **Reuse:** `src/lib/economy/definitions.ts` (faucets/sinks/item prices) · the Economy Simulator (inflation sim) · `presentation-links.ts` (icon/vfx/sfx/hud bindings).
- **Produced (UE):** `FARPGCurrencyDef` · `UARPGWalletComponent` (Add/Spend/CanAfford/Convert/ApplyDailyDecay + `OnCurrencyChanged`) · `VSCurrencyWalletTest`.
- **Produced (app):** `CURRENCY_RECIPE` (`recipe.ts`) — drives `author-python → wire → verify` for any currency, gated on the economy test.
- **Gaps:** localization system · Niagara VFX authoring · SFX authoring · currency icon (Leonardo not run) · wallet HUD widget · a 2nd currency for conversion content · loot-drop → wallet wiring.

## Cross-catalog dependencies
- **`icon-sets` → Currency Icons** (icon), **`vfx` → Coin Pickup Sparkle** (gain VFX), **`audio` → Coin SFX set** (gain SFX), **`hud-elements` → Currency Readout** (wallet UI) — all shared **presentation** bindings, not per-currency work.
- **`vendors`** (buy = sink), **`crafting-recipes`** (craft cost = sink), **`items`** (`BaseValue` → sell-price faucet), **`loot-tables`** (gold drops = faucet), **`quests`** (reward = faucet) — Gold is the medium every economy-adjacent catalog transacts in.

## Session Findings
### Cross-catalog opportunities
- **Gold is the economy's common denominator.** Vendors, crafting-recipes, items (`BaseValue`→sell), loot-tables (gold drops), and quests (rewards) all transact in it. `UARPGWalletComponent::AddCurrency` / `SpendCurrency` is the **single faucet/sink seam** every economy-adjacent catalog should call — built once here, reused everywhere.
- **The app already owns Gold's full economy model.** `src/lib/economy/definitions.ts` (6 faucets + 9 sinks + item buy/sell) and the Economy Simulator (inflation/net-flow) **are** the "Source/Sink Mapping" and "Inflation Sim" steps for *every* currency. Currency CLIs should reuse this engine, not re-derive flows. A bridge from its `EconomyFlow` list → the wallet's registered faucet/sink call sites would close the design↔runtime loop.
- **Currency belongs on a component, not a GAS attribute.** A spendable balance is inventory-adjacent — it lives on `UARPGWalletComponent`, **not** as a `UARPGAttributeSet` attribute. This is the *inverse* of the Fireball "a GE == a status-effect (same artifact)" insight: not everything numeric should be a GAS attribute. Recorded so future economy rows don't bolt balances onto the attribute set.
- **Presentation reuse confirmed beyond Game-Assets.** Currency consumes `icon-sets` / `vfx` / `audio` / `hud-elements` via `presentationLink()` exactly as abilities/characters do — the shared-library binding convention holds for Economy/Meta rows too.

### Gaps / blockers for future sessions
- **Economy gate authored but not run headless this session.** The shared UE tree had another session's uncommitted changes (`ARPGGameplayTags`, `ARPGEnemyCharacter`, `VSStatusBurningEffectTest`) + an active build; the run was deferred to avoid a build race. Needs a clean editor rebuild to go green. (Same shared-tree-concurrency class as folder-03.)
- **No loot → wallet wiring yet.** `UARPGLootDropComponent` drops a gold *pickup* but no player wallet receives it (none exists). Wiring the first real faucet — a `UARPGWalletComponent` on the player + a pickup→`AddCurrency` hook — is the next runtime step.
- **Same presentation/localization gaps as Fireball.** No localization (`DisplayName`/`Plural` resolve nowhere), no Niagara VFX, no SFX authoring, no icon-gen run, no HUD widget. Currency reuses the *same* shared-infra investments — none are per-currency work.
- **Only Gold is seeded → conversion is mechanism-only.** `Convert()` was proven with a synthetic Shard. A real second currency (premium/shard) would give conversion real content plus a cross-currency balance concern for the simulator.
