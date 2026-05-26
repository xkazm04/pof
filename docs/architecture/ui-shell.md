# UI Shell — `/layout` Homepage & Composition Screen

The `/layout` lab is the production homepage of the PoF app. It is a full-screen catalog pipeline
studio: a Category→Catalog→Entity tree drives a vertical pipeline timeline, and each selected step
opens a work canvas whose produce output is persisted to SQLite and verified by a server-backed
rollup strip.

---

## Key files

| File | Role |
|------|------|
| `src/app/page.tsx` | Root page; `useSyncExternalStore(popstate, readShellPref)` switches between `NewHome` and `AppShell` |
| `src/lib/ecw/shell-pref.ts` | `readShellPref()` / `writeShellPref()` — `?legacy=1` URL flag or `localStorage['pof.shell']` |
| `src/components/layout-lab/NewHome.tsx` | Thin wrapper: calls `usePofBridge()` then renders `<LayoutLab />` |
| `src/components/layout-lab/LayoutLab.tsx` | Top-level shell: header bar, Catalogs/Canon toggle, Light/Studio-Dark theme toggle, `<LabBridgeStrip>` |
| `src/components/layout-lab/Baseline.tsx` | 3-column composition screen: tree / pipeline timeline / work canvas; all produce→persist→render logic |
| `src/components/layout-lab/CatalogTree.tsx` | Category→Catalog→Entity collapsible tree (left column) |
| `src/components/layout-lab/steps/index.ts` | `getStepComponent(catalogId, stepName)` — looks up the `STEP_REGISTRY` |
| `src/components/layout-lab/steps/ArchetypeStep.tsx` | Generic renderer for any registered `StepSpec`; drives View + CliProduce + Acceptance |
| `src/components/layout-lab/PipelineRollup.tsx` | Per-step status strip + config-complete summary + "Run deferred gates" drain button |
| `src/components/layout-lab/LabBridgeStrip.tsx` | Compact UE bridge status dot+label; reads `usePofBridgeStore` (display-only) |
| `src/components/layout-lab/labPipelineStore.ts` | Zustand persisted store (`pof-lab-pipeline`); `produce/fail/resetEntity/hydrateEntity`; module-level `_labSync` function pointer |
| `src/components/layout-lab/labArtifactClient.ts` | `fetchArtifacts`, `postArtifact`, `drainGates` — thin wrappers around `/api/pipeline-artifacts` |
| `src/components/layout-lab/canonStore.ts` | Zustand store for project canon rules; seeded from `CANON_SEED`, refreshed from `/api/project-rules` |
| `src/components/layout-lab/theme.ts` | `LIGHT` (Blueprint) and `DARK` (Studio Dark) `LabTheme` tokens; `LAB_THEMES` array |
| `src/components/layout-lab/CanonView.tsx` | Full-screen canon rule editor (game / art / project categories) |

---

## How it works

### 1. Page entry — shell selection (`src/app/page.tsx` : 15–24)

```
useSyncExternalStore(
  popstate listener,         // subscribe
  readShellPref,             // client snapshot
  () => 'ecw'                // SSR snapshot (always 'ecw')
)
```

`readShellPref()` checks `?legacy=1` first, then `localStorage['pof.shell']`; everything else
resolves to `'ecw'`, which renders `<NewHome />`. The `?legacy=1` path renders `<AppShell />` (the
old 7-category sidebar shell). The "Legacy shell" button in `LayoutLab` calls `writeShellPref('legacy')`,
pushes the query param, and fires a synthetic `popstate` event so the store re-reads without a
full navigation.

### 2. Bridge connection — `NewHome` (`src/components/layout-lab/NewHome.tsx`)

`NewHome` exists solely to call `usePofBridge()` at the correct React subtree root before
delegating to `<LayoutLab />`. Lab tests render `<LayoutLab />` directly and are unaffected.

### 3. Top-level shell — `LayoutLab` (`src/components/layout-lab/LayoutLab.tsx`)

Renders a `100vh` flex column:

- **Header bar**: monospace `/layout · Blueprint baseline` label; **Catalogs** / **Canon**
  toggle (local `view` state); **Blueprint** / **Studio Dark** theme toggle (local `themeId` state);
  "Legacy shell" button; `<LabBridgeStrip t={theme} />`.
- **Body**: when `view === 'canon'` renders `<CanonView t={theme} />`; otherwise renders
  `<Baseline theme={theme} groups={groups} detail={detail} onSelectCatalog={setCatalogId} />`.

On mount, `useEffect(() => { hydrate(); }, [hydrate])` fetches the server's project canon rules into
`canonStore` (replaces the seed if the server responds).

Default `catalogId` is `'items'`; `useLabCatalogData()` and `useLabDetail(catalogId)` supply the
`LabGroup[]` and `LabDetail | null` props.

### 4. Category→Catalog→Entity tree — `CatalogTree` (`src/components/layout-lab/CatalogTree.tsx`)

Left column of `Baseline`. Renders three levels:

1. **Category** heading (monospace, uppercase) — one per `LabGroup`.
2. **Catalog** row — `label` + `verified/total` count. `borderLeft: 3px solid t.ink` marks the
   selection. Clicking calls `onSelectCatalog`.
3. **Entity** rows — only shown when the catalog is selected; a 7 px lifecycle dot (ok/bad/muted)
   precedes the entity name. Clicking calls `onSelectEntity`.

### 5. Composition screen — `Baseline` (`src/components/layout-lab/Baseline.tsx`)

Three-column CSS grid `260px 320px 1fr`:

| Column | Content |
|--------|---------|
| Left 260 px | `<CatalogTree>` |
| Middle 320 px | Pipeline timeline: vertical connector line + step buttons; "Populate demo" / "Reset" buttons for the Items catalog |
| Right 1fr | Work canvas: `<PipelineRollup>` overlay + step heading + step component |

**Step source**: `getCatalogPipeline(detail.catalog.catalogId)` wins if the registry has a pipeline;
otherwise falls back to `detail.steps` (line 47–48). The `live` flag on each step button is set when
`getStepComponent(catalogId, step)` returns non-null, and is shown as a green dot.

### 6. Step-render precedence (work canvas, `Baseline.tsx` : 209–229)

```
const Bespoke = detail && entity ? getStepComponent(detail.catalog.catalogId, stepName) : null;
const spec = pipeline?.steps.find((s) => s.label === stepName) ?? null;

if (Bespoke && entity)
  → <Bespoke key={entity.id + ':' + stepName} t={t} entity={entity} step={stepName} />
else if (spec && entity)
  → <ArchetypeStep key={…} t={t} entity={entity} step={stepName} spec={spec} catalogId={…} />
else
  → placeholder <div> ("Work canvas for … not prototyped yet")
```

1. **Bespoke** (`getStepComponent`) — explicit hand-built component from `STEP_REGISTRY` in
   `steps/index.ts`. Currently the full 13-step Items pipeline is registered here.
2. **ArchetypeStep** — generic renderer driven by a `StepSpec` from the catalog pipeline registry.
   Renders a `<StepFrame>` with a `ViewPanel` (prose / table / checklist / manifest / graph / gallery)
   and a `<CliProduce>` that injects canon rules via `canonContextFor`.
3. **Placeholder** — plain panel with instructional text.

### 7. Server-backed produce→persist→render→rollup loop

#### Write-through (`Baseline.tsx` : 66–74)

On every `catalogId` change an effect calls `setLabSync(fn)`, binding a closure over `catalogId`:

```
setLabSync((entityId, step, art) => {
  const accept = resolveAccept(catalogId, step);
  const res = accept ? accept(art.data) : null;
  void postArtifact({ catalogId, entityId, step, data, ueAssets,
                      status: res?.status ?? 'pass',
                      tier:   res?.tier   ?? 'L0',
                      reason: res?.reason });
});
```

`_labSync` is a module-level function pointer in `labPipelineStore.ts` (line 91–92). When
`store.produce()` runs (line 51), it calls `_labSync?.(entityId, step, artifact)`, which fires
`postArtifact` → `POST /api/pipeline-artifacts`.

#### Hydrate on entity-open (`Baseline.tsx` : 78–89)

When `catalogId` or `entity.id` changes:

```
fetchArtifacts(catalogId, entity.id)  // GET /api/pipeline-artifacts?catalogId=…&entityId=…
  → setServerArts(…)                  // store verdicts for rollup overlay
  → hydrateEntity(entity.id, arts)    // add-only merge into labPipelineStore
```

`hydrateEntity` (store line 73–83) only adds steps that are not already present in the local cache;
it never overwrites or clears existing local state.

#### Rollup overlay (`Baseline.tsx` : 105–117)

After hydration, `artifacts: PipelineArtifact[]` is derived client-side: for each step that has a
local artifact, `resolveAccept` recomputes status/tier from the current data. If the local
recompute returns `'deferred'` (a Test Gate that has not run) but the server record has a real
`pass` or `fail`, the server verdict wins:

```
const status = localStatus === 'deferred'
  && srv && srv.status !== 'deferred' && srv.status !== 'pending'
  ? srv.status
  : localStatus;
```

#### Drain deferred gates (`Baseline.tsx` : 92–102, `labArtifactClient.ts` : 38–45)

`runDrain` calls `drainGates(catalogId, entity.id)` → `POST /api/pipeline-artifacts/drain`, then
re-fetches and updates `serverArts`. The `<PipelineRollup>` "Run N deferred gates" button is shown
when `sum.deferred > 0` and an `onDrain` callback is provided.

#### `PipelineRollup` (`src/components/layout-lab/PipelineRollup.tsx`)

Mounted above the step heading in the work canvas. Calls `summarizeEntity(artifacts, steps.length)`
for `{ done, total, deferred, pending, highestTier, configComplete }`. Renders:

- Summary line: `X/Y pass · N deferred · N pending · highest <tier>` + optional `· CONFIG-COMPLETE`.
- "Run N deferred gates" button (only when `onDrain` provided and `sum.deferred > 0`).
- Per-step colored chips (ok / warn / bad / muted) with `step · tier` tooltip.

---

## Conventions / gotchas

### Shell-preference hydration trio (`src/app/page.tsx` : 15–22)

The root page uses `useSyncExternalStore` to read the shell preference without a `useEffect`:

```typescript
useSyncExternalStore(
  (cb) => { window.addEventListener('popstate', cb); return () => window.removeEventListener('popstate', cb); },
  readShellPref,   // client snapshot
  () => 'ecw'      // SSR snapshot — server always pretends 'ecw' to avoid mismatch
)
```

The Zustand persist hydration guard used in `AppShell` (legacy path) follows the same pattern with
a no-op subscribe: `useSyncExternalStore(() => () => {}, () => true, () => false)` — client always
`true`, SSR always `false`, preventing layout flicker on initial paint. Do not replace this with
`useEffect(() => setMounted(true))` — the `react-hooks/set-state-in-effect` ESLint rule errors on
that pattern.

### Theme tokens

`LabTheme` (`theme.ts`) is a typed struct of raw hex / rgba strings. It is intentionally **not**
derived from the app's `chart-colors` tokens — these panels are a bespoke design lab. The two
themes are:

| id | label | font-body | font-mono | grid |
|----|-------|-----------|-----------|------|
| `light` | Blueprint | Inter | IBM Plex Mono | 24 px blueprint grid |
| `dark` | Studio Dark | Inter | JetBrains Mono | none, `glass: true` |

`LAB_THEMES` is the source-of-truth array; `LayoutLab` maps over it to render theme buttons.

### ArchetypeStep canon injection

`ArchetypeStep` (line 15–24) maps `spec.archetype` → a fixed set of `RuleCategory[]`:

```typescript
const ARCHETYPE_CANON: Record<string, RuleCategory[]> = {
  brief:    ['game'],
  schema:   ['project', 'game'],
  balance:  ['project', 'game'],
  gallery:  ['art', 'game'],
  ...
};
```

`canonContextFor(canonRules, catalogId, categories)` prepends the matching rules to the CliProduce
prompt so every generic step receives relevant project/game laws without bespoke wiring.

### `labPipelineStore` — add-only hydration invariant

`hydrateEntity` checks `if (!merged[step])` before adding each step. This means server data can
backfill steps a new browser session has not produced yet, but a locally-produced step is never
silently overwritten by a stale server record. This is intentional.

### Items pipeline is the reference implementation

`STEP_REGISTRY` in `steps/index.ts` registers all 13 Items steps as bespoke components. All other
catalogs currently fall through to `ArchetypeStep` (when a `StepSpec` is registered) or the
placeholder. When building a new step, register a bespoke component in `STEP_REGISTRY` or author a
`StepSpec` in the catalog pipeline registry — the shell handles the rest.

### Concurrency

The `layout-lab` tree is edited by many parallel sessions. Re-read `labPipelineStore.ts` and
`Baseline.tsx` before editing them and use targeted `git add` — the store is module-level
singleton state (`setLabSync`), so a careless overwrite breaks the produce→persist loop for
every open entity.

---

## See also

- [Overview](overview.md) — top-level architecture
- [Catalog pipeline chassis](../catalog/index.md) — `StepSpec`, `getCatalogPipeline`, per-catalog
  pipeline registry, `resolveAccept`, acceptance tiers
- [L3/L4 live-UE runner](../catalog/L3-L4-RUNNER.md) — what `drainGates` triggers server-side
- [Runtime patterns](runtime-patterns.md) — `Lifecycle<T>`, `useSuspendableEffect`, LRU suspend,
  event bus
