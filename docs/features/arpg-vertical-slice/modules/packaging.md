# `packaging` — vertical-slice readiness

## 1. One-line purpose
PoF UI for creating Win64 Shipping build profiles, generating UAT BuildCookRun commands, and recording cook/package history with build metrics.

## 2. Files of record
- **UI (main):** `src/components/modules/game-systems/PackagingView.tsx:26-43` — module shell with Pipeline & Builds tabs
- **UI (profile selector & cook trigger):** `src/components/modules/game-systems/BuildConfigSelector.tsx:39-256` — profile CRUD, platform selector, **Package button handler (line 120–124)**
- **UI (profile card):** `src/components/modules/game-systems/PlatformProfileCard.tsx:40-205` — displays profile config, UAT command preview, **Package action button**
- **UI (cook settings panel):** `src/components/modules/game-systems/CookSettingsPanel.tsx:42-157` — toggles for PAK, compression, iterative cook, map selection, plugins
- **UI (build history dashboard):** `src/components/modules/game-systems/BuildHistoryDashboard.tsx:1–end` — lists past builds, trends, size comparison
- **API (profile management):** `src/app/api/packaging/profiles/route.ts:9-75` — GET/POST/DELETE profiles, generate-command action
- **API (history & versioning):** `src/app/api/packaging/history/route.ts:10-127` — record builds, bump version, query stats/trends
- **Prompt/command builder:** `src/lib/packaging/uat-command-generator.ts:7-127` — `generateUATCommand()` & `generatePackagePrompt()`
- **Module registry entry:** `src/lib/module-registry.ts:895-916`
- **Feature definitions:** `src/lib/feature-definitions.ts:404-411`
- **Store/persistence:** `src/lib/packaging/build-profiles-db.ts`, `build-history-store.ts`, `version-manager.ts` — local JSON storage for profiles & build records
- **Evaluator prompts:** _(none)_

## 3. Vertical-slice relevance
**Required UE5 artifact:** PoF packaging panel can cook + package a Win64 Shipping build that launches the level

Acceptance bullets:
- [x] Operator can select Win64 Shipping config in the PoF UI (BuildConfigSelector, line 30–35: predefined configs including "Shipping")
- [x] Operator can trigger a cook+package run from the PoF UI (PlatformProfileCard, line 92: onPackage button → calls handlePackage, line 120–124 in BuildConfigSelector)
- [ ] PoF surfaces real cook/package output (success/failure, path to .exe) — **BLOCKED: cook execution logic missing**
- [ ] PoF reports the path to the resulting .exe (needed for Playwright to verify launch) — **BLOCKED: depends on above**

## 4. Current state
PoF generates a complete UAT BuildCookRun command (uat-command-generator.ts:7–99) for Win64 Shipping and displays it in the UI (PlatformProfileCard, line 137–158). The Package button (line 92–99) dispatches the command via `useModuleCLI.sendPrompt()` to the CLI terminal, which **delegates execution to Claude's Bash tool**.

The PoF UI itself does **not execute** the cook/package; it only displays build profiles, generates the command string, and hands off to the CLI. History is recorded locally (BuildHistoryDashboard, line 83–198) but only as metadata (status, size, duration, output path) — no live streaming of cook output back to the UI. The .exe path would need to be manually captured from the Bash command output or from the final build record.

## 5. Gaps blocking the slice
- `api-missing`: PoF has no `/api/packaging/execute` endpoint that actually invokes UAT. Cook/package must be manually triggered via CLI terminal (not automated). Sub-project B must add: backend route to spawn child process running RunUAT.bat, stream stderr/stdout back to UI, record final build record with output path + size.
- `ui-missing`: PoF has no real-time console output panel in PackagingView. The CLI terminal appears in the bottom panel, but there is no dedicated UI element to surface cook status (progress %, current phase, warnings/errors) directly in the module. Sub-project B should add a CookProgress component.
- Playwright cannot automate this until the backend cook endpoint exists and PoF can report the .exe path programmatically.

## 6. testId touchpoints
| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| BuildConfigSelector.tsx | Add platform button | `pof-module-packaging-add-platform` | No | Platform selector (Win64, Linux, Mac, etc.) — needed for Playwright to select platform |
| BuildConfigSelector.tsx | Create profile button (Package) | `pof-module-packaging-start-cook` | No | Green Package button on each card (PlatformProfileCard, line 92–99) — Playwright clicks to trigger |
| PlatformProfileCard.tsx | Cook status badge | `pof-module-packaging-status` | No | Shows cook output (success/failure/in-progress) — needed to verify cook completion |
| BuildHistoryDashboard.tsx | Build output path | `pof-module-packaging-exe-path` | No | Displays path to .exe in expanded build row (line 135–139) — Playwright reads to extract executable path |
| BuildConfigSelector.tsx | Config selector (Shipping) | `pof-module-packaging-config-shipping` | No | Selects build config from dropdown (line 334: "Shipping" option) — needed to ensure Shipping is selected |