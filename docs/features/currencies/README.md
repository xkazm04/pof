# Currencies Pipeline

> Catalog ID `currencies` · Category Economy / Meta · `arpg-inventory` module · 7 steps · Tracks: logic, art-2d, vfx, audio, test
>
> *(source file is `currency.ts`; catalogId is `currencies`)*

**Purpose.** Models PoF's two-tier economy (ARPG-LAWS §10, canon `proj-economy` / `arpg-crafting-currency`): a soft currency (Gold) as the general medium of exchange and crafting-orb currencies (Transmute … Divine) whose effect IS a deterministic-ish item-affix mutation. The two ledgers never inter-convert freely. It realizes as `FARPGCurrencyDef` rows in `DT_Currencies`, with wallet operations routed through `UARPGWalletComponent::AddCurrency` / `SpendCurrency`.

## Target / starter entity
- **Gold** (`currency-gold`, Standard) — The primary soft currency.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 `minLength` brief ≥ 300 chars |
| 2 | Economy Rules | rules | DT_Currencies | L0 `fieldsPopulated` (kind/faucets/sinks/cap/conversionNote) + L2 `cppSymbolExists` FARPGCurrencyDef |
| 3 | Balance | balance | — | L0 `withinPercent` faucet/sink ratio within ±15% of 100 |
| 4 | Icon 2D Art | gallery | T_\<name\>_Icon | L1 `selected` (currency icon) |
| 5 | Wallet UI Integration | rules | WBP_Wallet | L0 `fieldsPopulated` (widget/format/position/hudBinding) |
| 6 | Test Gate | checklist | — | L3 `runtimeDeferred` VSCurrencyWalletTest |
| 7 | UE Packaging | manifest | DT_Currencies, T_\<name\>_Icon, WBP_Wallet, UARPGWalletComponent | L0 `minCount` ≥4 + L2 `cppSymbolExists` FARPGCurrencyDef |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `FARPGCurrencyDef` (steps 2 & 7).
- **DataTables / components:** `DT_Currencies` (FARPGCurrencyDef rows), `UARPGWalletComponent` (AddCurrency / SpendCurrency, OnCurrencyChanged), wallet widget `WBP_Wallet` spawned by `AARPGHUD`.
- **Runtime test** (`runtimeDeferred`): `VSCurrencyWalletTest` — earn adds, spend deducts, cap enforced when set, ledgers independent, UI updates.
- **No cross-catalog `links:`** are emitted, but wiring contracts declare dependencies on `vendors` (buy/sell/repair, vendor-laws), `crafting-recipes` (bench fees + orb consumption), `loot-tables` (orb drop weights), and `hud-elements` (wallet slot). No `seedRowPresent` check in this pipeline.

## Acceptance profile
Uses **L0 (data)** for brief, economy rules, balance, wallet UI, and the manifest, **L1 (human-selection)** for the icon gallery, **L2 (static UE source)** via the `FARPGCurrencyDef` symbol check, and **L3 (runtime-deferred)** for `VSCurrencyWalletTest`. Config-complete = all L0/L1/L2 pass and the Test Gate is `deferred` with the wallet-functional-test reason.

## Status & notes
Shortest of this batch (7 steps). Enforces the canon "no free Gold↔orb conversion" rule (separate ledgers in `UARPGWalletComponent`) and the orb scarcity ladder (Exalt/Divine ~80× rarer than Transmute, per `arpg-crafting-currency`). The Balance step pins faucet ≈110 vs sink ≈105 relative units = ~4.8% imbalance, well within the ±15% `proj-economy` envelope. No bridge-driven steps.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
