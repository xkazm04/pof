# Architecture Research: Dzin Integration into PoF

**Domain:** Headless panel framework integration into existing Next.js module system
**Researched:** 2026-03-14
**Confidence:** HIGH (based on direct source analysis of both codebases)

## System Overview

```
+-----------------------------------------------------------------------+
|  /prototype route (Next.js App Router)                                |
|                                                                       |
|  +-------------------------------+  +------------------------------+  |
|  | PoF Layer                     |  | Dzin Layer                   |  |
|  |                               |  |                              |  |
|  |  Zustand stores               |  |  PanelRegistry               |  |
|  |  (moduleStore, etc.)    ------+--+-> PanelDefinitions           |  |
|  |                               |  |                              |  |
|  |  chart-colors.ts              |  |  DzinLayout                  |  |
|  |  SurfaceCard, _shared    -----+--+-> PanelFrame                 |  |
|  |                               |  |  DensityProvider             |  |
|  |  Tailwind CSS 4               |  |                              |  |
|  |  globals.css vars        -----+--+-> dzin-pof-theme.css         |  |
|  |                               |  |  (overrides --dzin-* tokens) |  |
|  +-------------------------------+  +------------------------------+  |
+-----------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `src/lib/dzin/` | Vendored Dzin core source (copy of `@dzin/core`) | Direct source copy, no npm package. Imported via `@/lib/dzin` |
| `src/lib/dzin-panels/` | PoF-specific Dzin panel definitions + components | Each AbilitySpellbook section becomes a panel component with density-aware rendering |
| `src/lib/dzin-panels/registry.ts` | PoF panel registry instance | Calls `createRegistry()` and registers all combat panels |
| `src/app/prototype/page.tsx` | Demo route entry point | Next.js page rendering the Dzin prototype |
| `src/components/prototype/` | Prototype page components | Layout switcher, density controls, comparison toggle |
| `dzin-pof-theme.css` | Theme bridge CSS | Overrides `--dzin-*` tokens to map to PoF's `--surface`, `--border`, `--text` variables |

## Recommended Project Structure

```
src/
+-- lib/
|   +-- dzin/                          # Vendored @dzin/core source (copied verbatim)
|   |   +-- density/                   # DensityProvider, useDensity
|   |   +-- layout/                    # DzinLayout, useLayout, templates, resolver
|   |   +-- panel/                     # PanelFrame
|   |   +-- registry/                  # createRegistry, types
|   |   +-- theme/                     # tokens.ts, default.css, state.css
|   |   +-- types/                     # panel.ts (PanelDensity, PanelRole, etc.)
|   |   +-- index.ts                   # Re-exports (same as @dzin/core index)
|   |   +-- state/                     # State engine (copy but not used in prototype)
|   |   +-- intent/                    # Intent system (copy but not used in prototype)
|   |   +-- chat/                      # Chat system (copy but not used in prototype)
|   |   +-- llm/                       # LLM transport (copy but not used in prototype)
|   |   +-- demo/                      # Demo panels (optional, useful for testing)
|   +-- dzin-panels/                   # PoF-specific panel implementations
|       +-- registry.ts               # createRegistry() + register all combat panels
|       +-- definitions.ts            # PanelDefinition objects for each section
|       +-- panels/                    # Panel components (one per AbilitySpellbook section)
|       |   +-- CorePanel.tsx
|       |   +-- AttributesPanel.tsx
|       |   +-- TagsPanel.tsx
|       |   +-- AbilitiesPanel.tsx
|       |   +-- EffectsPanel.tsx
|       |   +-- TagDepsPanel.tsx
|       |   +-- EffectsTimelinePanel.tsx
|       |   +-- DamageCalcPanel.tsx
|       |   +-- TagAuditPanel.tsx
|       |   +-- LoadoutPanel.tsx
|       +-- index.ts                   # Re-exports
+-- app/
|   +-- prototype/
|       +-- page.tsx                   # Demo route (server component wrapping client)
+-- components/
|   +-- prototype/
|       +-- PrototypeShell.tsx         # Main client component for /prototype
|       +-- LayoutSwitcher.tsx         # Dropdown/tabs to switch layout templates
|       +-- DensityControls.tsx        # Manual density override controls
|       +-- ComparisonView.tsx         # Side-by-side old vs Dzin view
+-- styles/
    +-- dzin-pof-theme.css             # Theme bridge (--dzin-* mapped to PoF vars)
```

### Structure Rationale

- **`src/lib/dzin/`:** Vendored as a local library under `lib/` following PoF's convention for domain-specific logic directories (like `ue5-bridge/`, `claude-terminal/`). Copied verbatim so Dzin source can be iterated on without cross-repo linking. The `@/lib/dzin` import alias works naturally.
- **`src/lib/dzin-panels/`:** Separated from `dzin/` because these are PoF-specific panel implementations, not generic Dzin framework code. Each panel wraps existing PoF visualization logic (radar charts, pipeline flows, feature cards) inside a `PanelFrame`.
- **`src/app/prototype/`:** Isolated route per PROJECT.md requirement. Does not touch the existing `page.tsx` SPA or its module system.
- **`src/components/prototype/`:** Client components for the demo page, following PoF's component organization by domain.
- **`src/styles/dzin-pof-theme.css`:** Single CSS file that bridges Dzin's token system to PoF's existing variables. Imported in the prototype route only.

## Architectural Patterns

### Pattern 1: Theme Bridge via CSS Custom Property Override

**What:** Override Dzin's `--dzin-*` CSS custom properties to reference PoF's existing `--surface`, `--border`, `--text` variables. Dzin's default.css sets fallback values; the bridge CSS overrides them.

**When to use:** Always. This is the primary integration mechanism for visual consistency.

**Trade-offs:** Clean separation (Dzin source untouched), but requires maintaining the mapping. PoF's color system uses both CSS variables and JS constants (`chart-colors.ts`), so the bridge only covers structural colors; accent colors for individual panels still come from `chart-colors.ts` via inline styles.

**Example:**
```css
/* src/styles/dzin-pof-theme.css */

/* Scope overrides to the prototype container to avoid global conflicts */
[data-dzin-layout] {
  --dzin-surface-1: var(--background);       /* #0a0a1a */
  --dzin-surface-2: var(--surface);          /* #111128 */
  --dzin-surface-3: var(--surface-hover);    /* #1a1a3a */

  --dzin-border: var(--border);              /* #1e1e3a */
  --dzin-border-focus: var(--core);          /* #3b82f6 */

  --dzin-text-primary: var(--text);          /* #e0e4f0 */
  --dzin-text-secondary: var(--text-muted);  /* #7d82a8 */
  --dzin-text-muted: var(--text-muted);      /* #7d82a8 */

  --dzin-accent: var(--systems);             /* #8b5cf6 (combat accent) */
  --dzin-accent-muted: var(--border-bright); /* #2e2e5a */

  --dzin-panel-bg: var(--surface);
  --dzin-panel-border: var(--border);
  --dzin-panel-header-bg: var(--surface-deep);

  --dzin-radius-sm: 4px;
  --dzin-radius-md: 6px;
  --dzin-radius-lg: 8px;
}
```

### Pattern 2: Panel-as-Extracted-Section

**What:** Each of AbilitySpellbook's 10 sections becomes a standalone Dzin panel component. The panel reads density from `useDensity()` and renders different levels of detail accordingly.

**When to use:** For every section being converted. This is the core decomposition pattern.

**Trade-offs:** Duplicates some rendering logic from AbilitySpellbook initially. But the density-awareness is the entire value proposition -- each panel gracefully degrades from full (all detail) to compact (summary) to micro (badge/icon only).

**Example:**
```typescript
// src/lib/dzin-panels/panels/AttributesPanel.tsx
import { useDensity, PanelFrame } from '@/lib/dzin';
import { RadarChart } from '@/components/modules/core-engine/unique-tabs/_shared';
import { MODULE_COLORS } from '@/lib/chart-colors';

export function AttributesPanel({ features }: { features: FeatureRow[] }) {
  const density = useDensity();

  return (
    <PanelFrame title="Attributes" icon={<BarChart3 size={14} />}>
      {density === 'micro' && (
        <div>{features.length} attrs</div>
      )}
      {density === 'compact' && (
        <div>
          {features.map(f => <FeatureChip key={f.name} feature={f} />)}
        </div>
      )}
      {density === 'full' && (
        <div>
          <RadarChart data={radarData} color={MODULE_COLORS.core} />
          {features.map(f => <FeatureCard key={f.name} feature={f} />)}
        </div>
      )}
    </PanelFrame>
  );
}
```

### Pattern 3: Directive-Driven Composition

**What:** The prototype page declares which panels to show as an array of `PanelDirective` objects. `DzinLayout` resolves these against the selected template, assigns panels to slots, and computes density per slot based on available space.

**When to use:** For the prototype page's layout rendering. User switches templates via a dropdown; the directive array stays the same.

**Trade-offs:** Declarative and composable (the whole point of Dzin). However, the layout resolver uses a Hungarian algorithm for optimal assignment, which is powerful but can produce unexpected placements if panel roles and template slot preferences are not aligned well. Careful definition of `defaultRole` and `sizeClass` in panel definitions is critical.

**Example:**
```typescript
// src/components/prototype/PrototypeShell.tsx
import { DzinLayout, createRegistry } from '@/lib/dzin';
import { combatRegistry, COMBAT_DIRECTIVES } from '@/lib/dzin-panels';

function PrototypeShell() {
  const [template, setTemplate] = useState<LayoutTemplateId>('grid-4');

  return (
    <DzinLayout
      directives={COMBAT_DIRECTIVES}
      registry={combatRegistry}
      options={{ preferredTemplate: template }}
      renderPanel={(assignment) => {
        const def = combatRegistry.get(assignment.panelType);
        if (!def) return null;
        const Panel = def.component;
        return <Panel features={features} />;
      }}
    />
  );
}
```

### Pattern 4: Data Flow via Props, Not Dzin State Engine

**What:** For the prototype, panel data comes from PoF's existing Zustand stores (via hooks like `useFeatureMatrix`) and is passed as props to panel components. Dzin's state engine, intent system, and chat system are copied but not wired up.

**When to use:** For this prototype milestone. The state engine, undo/redo, and LLM integration are future milestones if the prototype succeeds.

**Trade-offs:** Simpler integration (panels are just React components receiving props), but does not exercise Dzin's state synchronization or intent routing. This is deliberate -- PROJECT.md explicitly scopes out intent/LLM/undo for this milestone.

## Data Flow

### Panel Rendering Flow

```
User selects layout template (e.g. "grid-4")
    |
    v
PrototypeShell passes PanelDirective[] + preferredTemplate to DzinLayout
    |
    v
useLayout() calls resolveLayout():
    1. Scores each template against directives
    2. Uses Hungarian algorithm to assign panels to slots
    3. Computes slot dimensions from CSS Grid fractions + container size
    4. Assigns density per slot based on spatial budget
    |
    v
DzinLayout renders CSS Grid container
    |
    v
For each SlotAssignment:
    - Wraps in DensityProvider(density)
    - Calls renderPanel(assignment)
        |
        v
    Panel component reads density via useDensity()
    Panel component reads data from PoF Zustand stores (via hooks)
    Panel renders inside PanelFrame with density-appropriate content
```

### Data Source Flow

```
PoF Zustand Stores (moduleStore, featureMatrixStore)
    |  (read via hooks: useFeatureMatrix, useModuleStore selectors)
    v
PrototypeShell (client component)
    |  (passes data as props)
    v
Panel Components (AttributesPanel, EffectsPanel, etc.)
    |  (render with density awareness)
    v
PanelFrame + Dzin CSS (data-dzin-* attributes styled by theme)
```

### Key Data Flows

1. **Store to Panel:** PoF Zustand stores are the single source of truth. Panel components receive data via props from the prototype shell, which uses existing hooks (`useFeatureMatrix`). No Dzin state engine involvement.
2. **Layout Resolution:** `DzinLayout` owns layout computation internally. The prototype shell controls it by passing `preferredTemplate` and `directives`. ResizeObserver tracks container dimensions for responsive density assignment.
3. **Theme Cascade:** CSS custom properties flow from PoF's `:root` vars through the `dzin-pof-theme.css` bridge to Dzin's `data-dzin-*` attribute selectors. No runtime theme object needed.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 module (prototype) | 10 panels in one registry, single route, manual directive arrays. Current design. |
| All PoF modules (20+) | Multiple registries per domain, directive builder utility, panel reuse across modules. Create `createModulePanels(subModuleId)` factory. |
| Full Dzin adoption | Wire Dzin state engine to Zustand (bidirectional sync adapter), enable intent system for LLM-driven composition, replace `ReviewableModuleView` tabs with Dzin layouts. |

### Scaling Priorities

1. **First bottleneck: Panel definition boilerplate.** Each panel needs a `PanelDefinition` (14 fields) plus a component. For 10 panels this is fine; for 100+ panels across all modules, create a `defineCombatPanel()` helper that infers defaults from PoF's existing module registry metadata.
2. **Second bottleneck: Theme token divergence.** If Dzin panels and traditional PoF components coexist long-term, the two color systems (CSS vars for Dzin, Tailwind classes for PoF) could drift. Mitigation: always derive Dzin tokens from PoF's `:root` vars, never set them independently.

## Anti-Patterns

### Anti-Pattern 1: Importing Dzin's default.css Globally

**What people do:** Import `@/lib/dzin/theme/default.css` in `globals.css` or `layout.tsx`.
**Why it's wrong:** Dzin's default theme sets `:root` variables with its own dark-mode palette (slate-based: `#0f172a`, `#1e293b`), which would override PoF's existing palette (indigo-based: `#0a0a1a`, `#111128`). This would break all non-Dzin components.
**Do this instead:** Only import `dzin-pof-theme.css` (the bridge file) and scope overrides to `[data-dzin-layout]`. Do NOT import `default.css` at all -- the bridge replaces it entirely.

### Anti-Pattern 2: Using Dzin State Engine for Prototype Data

**What people do:** Wire `createStateEngine()` to manage panel data, duplicating what Zustand already handles.
**Why it's wrong:** Zustand is PoF's source of truth. Duplicating state into Dzin's engine creates sync problems and doubles complexity for zero gain in this milestone.
**Do this instead:** Pass data from Zustand hooks as props. Dzin state engine is for future milestones when LLM-driven mutations need undo/redo and conflict resolution.

### Anti-Pattern 3: Modifying Vendored Dzin Source

**What people do:** Edit files under `src/lib/dzin/` to fix issues or add PoF-specific behavior.
**Why it's wrong:** Makes future Dzin updates (re-copy from source) painful. Drift becomes untraceable.
**Do this instead:** Extend via wrapper functions in `src/lib/dzin-panels/`. If Dzin itself needs a fix, make it upstream in the Dzin repo and re-copy.

### Anti-Pattern 4: Tailwind Classes Inside PanelFrame Children

**What people do:** Use Tailwind utility classes (`className="p-4 text-sm"`) inside density-aware panel bodies.
**Why it's wrong:** Density changes font-size and padding via Dzin's CSS (`data-dzin-density` attribute selectors). Tailwind classes with fixed sizes (`text-sm`, `p-4`) fight the density system.
**Do this instead:** Use relative units (`em`-based spacing), Dzin's `--dzin-space-*` tokens, or density-conditional rendering (render different markup per density level). Tailwind is fine for layout within a panel (flex, grid) but not for sizing that should respond to density.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| PoF Zustand stores to Dzin panels | Props (one-way, read-only) | Prototype shell reads stores via hooks, passes data as props to panel components |
| Dzin layout engine to panel rendering | `DzinLayout` render callback | `renderPanel(assignment)` is the only integration point between layout resolution and panel rendering |
| PoF theme to Dzin theme | CSS custom property cascade | `dzin-pof-theme.css` overrides `--dzin-*` tokens by referencing PoF's `:root` vars |
| PoF `chart-colors.ts` to panel accents | Direct JS import in panel components | Panel components import `MODULE_COLORS`, `STATUS_*` constants directly for charts and badges |
| Existing `_shared.tsx` components in panels | Direct import | Dzin panels reuse `RadarChart`, `TimelineStrip`, `PipelineFlow`, `SubTabNavigation` from the existing shared module |
| `/prototype` route to PoF app | None (isolated) | The prototype route is standalone; it does not integrate with AppShell, ModuleRenderer, or the navigation store |

### Dependency Chain (What Dzin Needs from PoF)

| Dzin Needs | PoF Provides | How |
|------------|-------------|-----|
| React 19 | Already in PoF | Peer dep satisfied |
| `fast-json-patch` | Not in PoF yet | `npm install fast-json-patch` (only runtime dep Dzin adds) |
| CSS custom properties | `globals.css` `:root` block | Bridge CSS maps `--dzin-*` to `--surface`, `--border`, `--text` |
| Panel data | Zustand stores | Hooks in prototype shell, props to panels |
| Visualization components | `_shared.tsx` exports | Direct import in panel components |

## Build Order

The suggested implementation sequence, based on dependency analysis:

| Step | What | Why First | Depends On |
|------|------|-----------|------------|
| 1 | Copy Dzin source to `src/lib/dzin/` | Foundation -- everything imports from here | Nothing |
| 2 | Install `fast-json-patch` | Dzin's only runtime dependency | Step 1 |
| 3 | Verify Dzin imports compile | Catch path/TypeScript issues early | Steps 1-2 |
| 4 | Create `dzin-pof-theme.css` | Visual foundation for all panels | Step 1 (needs token names) |
| 5 | Create panel registry + first panel definition | Validates registry API works in PoF context | Step 3 |
| 6 | Build one panel component (e.g. CorePanel) at all 3 densities | Proves density rendering works end-to-end | Steps 3-5 |
| 7 | Create `/prototype` route with `DzinLayout` | Proves layout engine + template switching works | Steps 4-6 |
| 8 | Build remaining 9 panel components | Expand coverage | Steps 6-7 (pattern established) |
| 9 | Add layout template switcher UI | User-facing template selection | Step 7 |
| 10 | Add density override controls | Manual density testing | Step 7 |
| 11 | Add comparison view (old vs Dzin) | Evaluation artifact | Steps 8-10 |
| 12 | Polish transitions and animations | Import `state.css`, tune enter/exit | Steps 8-11 |

## Sources

- Direct source analysis: `C:/Users/kazda/kiro/studio-story/packages/dzin/core/src/` (all modules)
- Direct source analysis: `C:/Users/kazda/kiro/pof/src/` (globals.css, chart-colors.ts, SurfaceCard.tsx, AbilitySpellbook.tsx, _shared.tsx)
- Dzin `package.json`: confirms `fast-json-patch` as only dependency, React 19 peer dep
- PoF `.planning/codebase/ARCHITECTURE.md` and `STRUCTURE.md`: confirmed layer boundaries, import conventions, module patterns

---
*Architecture research for: Dzin integration into PoF*
*Researched: 2026-03-14*
