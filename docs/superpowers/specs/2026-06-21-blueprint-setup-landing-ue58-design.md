# Blueprint setup landing + UE 5.8 — design

**Date:** 2026-06-21
**Branch:** feature/vlm-critique-tier (work isolated to the files below)
**Status:** approved, executing

## Problem

The homepage (`/`) renders the Blueprint catalog lab (`NewHome` → `LayoutLab`) by
default, but it never gates on whether a project is loaded — the lab shows even
with no project. The only "no project loaded" landing is `SetupWizard`
(`src/components/modules/project-setup/SetupWizard.tsx`), which today renders
**only inside the legacy shell** (`AppShell`, via `?legacy=1`) and is still styled
with the **old** design tokens (`bg-background`, `accent-setup`, `bg-surface`…).
Its UE version switcher offers only 5.5 / 5.6 / 5.7 — no 5.8, even though the
5.7→5.8 engine upgrade is complete.

## Goals

1. Migrate the `SetupWizard` "landing route" into the **Blueprint** visual identity
   (matching the `/3d` studio precedent, `Studio3D.tsx`).
2. Extend the UE version switcher to include **UE 5.8** as the new "latest", and
   make `5.8.0` the default selected version.
3. **Gate the new homepage**: `/` shows the Blueprint `SetupWizard` when no project
   is loaded, otherwise the lab (new behavior — previously it skipped straight to
   the lab).

Non-goals: touching the legacy shell's other screens; building a multi-step wizard;
adding 5.8 to unrelated version references elsewhere in the app.

## Design

### 1. UE 5.8 version switcher
In `SetupWizard.tsx`, `UE_VERSIONS` becomes:

| value   | label | note                     |
|---------|-------|--------------------------|
| 5.5.4   | 5.5   | best AI coverage         |
| 5.6.1   | 5.6   | web search for newer APIs|
| 5.7.3   | 5.7   | stable  *(was "latest")* |
| 5.8.0   | 5.8   | latest  *(new)*          |

`projectStore` default `ueVersion`: `5.7.3` → `5.8.0` (initial state **and**
`resetProject`'s reset block). The existing version-hint logic
(`startsWith('5.5') ? 'Full AI training data' : 'Web search for UE <mm> API changes'`)
is unchanged and now reads "UE 5.8" for the default.

### 2. Blueprint restyle (reuse the lab UI kit)
Mirror `Studio3D.tsx`: the `SetupWizard` root gets `data-theme="blueprint"`,
`className={labFontVars}`, and `data-lab-root` (so `.focus-ring` picks up the
Blueprint accent). The surface is rebuilt with `--lab-*` tokens and the lab UI kit
from `@/components/layout-lab/ui` (`Button`, `Panel`, `Input`, `Chip`):

- Full-screen centered card on the Blueprint floor (`var(--lab-bg)`), with the
  24px engineering **grid background** (`var(--lab-grid-image)`/`--lab-grid-size`).
- Logo/title in IBM Plex Mono uppercase; blueprint-blue accent (`var(--lab-accent)`).
- Version **pills**: lab `Button`s with `active` reflecting the selected version.
- Existing/Fresh **tabs**, project **rows** (a `Panel`/`Button` list), and the
  name **`Input`** all re-themed; sharp corners, no glass (Blueprint tokens give 0
  radius / no blur automatically).
- **All logic preserved**: detect-projects scan, version filtering, open-existing,
  start-fresh, name validation.
- **Every `data-testid` preserved**: `pof-setup-wizard-version-pill-<value>`,
  `pof-setup-wizard-tab-existing|fresh`, `pof-setup-wizard-project-item-<slug>`,
  `pof-setup-wizard-project-name-input`, `pof-setup-wizard-create-btn`.

Consequence (intended): the wizard now renders Blueprint inside the legacy shell
too — consistent with the migration.

### 3. Homepage gate (`NewHome.tsx`)
The gate lives in `NewHome` (not `page.tsx`) so that `page.test.tsx`, which mocks
`NewHome`, stays green, and it mirrors `AppShell`'s internal gate:

```tsx
usePofBridge();                                  // always called (hook order)
const isSetupComplete = useProjectStore(s => s.isSetupComplete);
const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
if (!hydrated) return <div style={{height:'100vh', background:'var(--lab-bg)'}} data-theme="blueprint" />;
return isSetupComplete ? <LayoutLab/> : <SetupWizard/>;
```

The hydration guard avoids an SSR-vs-localStorage flash (SSR sees the default
`isSetupComplete=false`; client may rehydrate to `true`). `/layout`
(`src/app/layout/page.tsx` → `LayoutLab`) stays **ungated** — the project-agnostic
dev lab is unchanged.

### 4. Keep the e2e suite green (required consequence of #3)
`/` is the e2e suite's entry to the lab: `global-setup.ts` and ~15 specs
(`gotoLab()`, the catalog walker, arpg slices, combat-loop, wiring-smoke,
infra-testids, texture-pass…) `goto('/')` and wait for `harness-lab-ready` with
**no project**. Gating `/` would otherwise abort the whole run. Centralized fix,
no per-spec edits:

- **`e2e/global-setup.ts`**: run the identity-guard + warm-up against **`/layout`**
  (ungated, same `LayoutLab` + `harness-lab-ready` marker). After it passes, seed
  `localStorage['pof-project'] = { state: { …, isSetupComplete: true }, version: 0 }`
  for the run origin and write a Playwright **storageState** file
  (`e2e/.auth/project-seeded.json`).
- **`playwright.config.ts`**: `use.storageState = './e2e/.auth/project-seeded.json'`,
  so every context (incl. raw `goto('/')` specs) starts with a completed project →
  `/` renders the lab exactly as before.
- **`.gitignore`**: ignore `e2e/.auth/` (generated per run).

Seed payload keeps `projectName`/`projectPath` empty (lab is project-agnostic) and
only flips `isSetupComplete: true` + `ueVersion: '5.8.0'`, so the lab renders
identically to today. No existing e2e tests the no-project flow, so seeding is safe.

### 5. Tests (TDD)
- **`src/__tests__/components/project-setup/SetupWizard.test.tsx`** (new): renders 4
  version pills including **UE 5.8**; the 5.8 pill is selected by default; clicking a
  pill updates the store; Existing tab lists detected projects (mocked
  `/api/filesystem/browse`); Fresh tab validates name + create dispatches
  `setProject`/`completeSetup`.
- **`src/__tests__/components/layout-lab/NewHome.test.tsx`** (new): with
  `isSetupComplete=false` renders the (mocked) SetupWizard; with `true` renders the
  (mocked) LayoutLab. `usePofBridge`/`SetupWizard`/`LayoutLab` mocked.
- `projectStore.test.ts`: unaffected (it sets `ueVersion` explicitly in `beforeEach`).

## Risks

- An e2e spec that explicitly `localStorage.clear()`s at start would re-trigger the
  gate. None do today; if one is added, it must re-seed.
- storageState file is regenerated by `global-setup` each run; a failed global-setup
  aborts the run anyway (its existing contract), so a stale/missing seed never
  silently mis-tests.

## Files touched

- `src/components/modules/project-setup/SetupWizard.tsx` (restyle + 5.8)
- `src/stores/projectStore.ts` (default version)
- `src/components/layout-lab/NewHome.tsx` (gate)
- `e2e/global-setup.ts`, `playwright.config.ts`, `.gitignore` (e2e seed)
- `src/__tests__/components/project-setup/SetupWizard.test.tsx` (new)
- `src/__tests__/components/layout-lab/NewHome.test.tsx` (new)
