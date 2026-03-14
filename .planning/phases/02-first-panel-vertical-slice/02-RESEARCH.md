# Phase 2: First Panel Vertical Slice - Research

**Researched:** 2026-03-14
**Domain:** Dzin panel integration, density-aware rendering, React component refactoring
**Confidence:** HIGH

## Summary

Phase 2 takes the Dzin infrastructure from Phase 1 and proves the full integration pattern by rendering one AbilitySpellbook section (Core) as a Dzin panel at all three density levels. The work involves: (1) creating a CorePanel component that reads density via `useDensity()` and renders micro/compact/full views, (2) registering it with a complete `PanelDefinition` in a central registry file, (3) building a `/prototype` page that hosts the panel in a `DzinLayout` with density controls, and (4) wiring real data from `useFeatureMatrix('arpg-combat')` through props.

The existing code is well-structured for this. The `CoreSection` function (AbilitySpellbook.tsx lines 519-569) already receives `featureMap` and `defs` as props via the `SectionProps` interface. The refactoring is straightforward: extract the rendering logic into a new density-aware component that delegates to the existing shared components (`SharedFeatureCard`, `PipelineFlow`, `SectionLabel`, `SurfaceCard`) for full density, and provides new micro/compact views. The `DzinLayout` component automatically wraps each slot in a `DensityProvider`, so the panel just reads `useDensity()` and renders accordingly.

The prototype page needs two testing modes: Override (force density directly via buttons) and Resize (snap container to preset widths, letting `assignSlotDensity()` pick density automatically based on pixel thresholds). This proves both the manual override path (via `PanelDirective.density`) and the auto-density assignment path.

**Primary recommendation:** Create a self-contained `CorePanel.tsx` that switches on `useDensity()`, register it with full `PanelDefinition` metadata in `src/lib/dzin/panel-definitions.ts`, and build a minimal `/prototype` page with `DzinLayout` + mode-switching control bar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Micro: Icon (Cpu) + pipeline progress indicator (e.g., "3/6" with mini progress bar) -- smallest possible footprint
- Compact: Key stats list with ASC feature status colored dot, 4 connection items with status indicators, pipeline step count at bottom, header "Core -- AbilitySystem"
- Full: Existing CoreSection content (description card, feature card, connections grid, GAS pipeline, GAS architecture explorer) refactored to accept data via props -- visual output identical
- Density transitions: Instant swap, no animation (DENS-13 is Phase 4)
- Panel registration: Fully descriptive PanelDefinition with ALL fields filled -- sets gold standard template
- Central registry file: `src/lib/dzin/panel-definitions.ts`
- Domain string: `"arpg-combat"`
- Prototype page: DzinLayout grid with single Core panel, minimal header with title + density controls
- Single control bar with mode toggle: Override (density buttons) vs Resize (preset size buttons)
- No debug info overlay
- Direct URL only (`/prototype`), no navigation link
- Props from parent: prototype page fetches data via `useFeatureMatrix`, passes `featureMap` and `defs` as props
- Real hooks from start: calls `useFeatureMatrix('arpg-combat')` with live data
- Core-specific prop interface (`CorePanelProps`) -- each panel defines its own typed props

### Claude's Discretion
- IO schema design for PanelDefinition inputs/outputs -- pick what is most useful for LLM wiring
- Whether ASC connections and GAS pipeline data is derived from feature matrix or kept as panel-internal constants
- Exact preset size pixel values for resize mode buttons
- Control bar styling and layout details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DENS-01 | AbilitySpellbook Core section registered as Dzin panel with full PanelDefinition | Registry pattern documented; PanelDefinition interface fully mapped; demo panels show registration pattern |
| DENS-02 | Core panel renders at micro (icon+count), compact (stats list), full (existing rich view) | Density switching pattern documented; useDensity() hook provides density; PanelFrame handles chrome |
| DENS-12 | Density automatically assigned per-slot based on pixel dimensions via assignSlotDensity() | assignSlotDensity() algorithm documented; threshold configuration via densityModes; resize mode proves this |
| INTG-01 | /prototype route hosts the Dzin demo page, isolated from existing PoF module views | Next.js App Router page at src/app/prototype/page.tsx; no nav links needed |
| INTG-02 | Panels consume data from PoF's existing hooks via props | useFeatureMatrix returns features/summary; featureMap built from features array; SectionProps interface documented |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x | Component rendering | Project standard |
| framer-motion | 11.x | Content animations in full density | Already used by AbilitySpellbook |
| lucide-react | latest | Icons (Cpu, etc.) | Project standard icon library |
| Dzin core | vendored | Density context, layout, registry, panel frame | Phase 1 installed at src/lib/dzin/core/ |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/chart-colors | - | MODULE_COLORS, STATUS_* colors | All colored indicators |
| @/components/ui/SurfaceCard | - | Card containers | Full density view cards |
| @/hooks/useFeatureMatrix | - | Feature matrix data | Data source for panel |
| @/lib/feature-definitions | - | MODULE_FEATURE_DEFINITIONS | Feature def metadata |

### Alternatives Considered
None -- all tools are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/prototype/
    page.tsx                     # /prototype route (server component wrapper)
  components/modules/core-engine/dzin-panels/
    CorePanel.tsx                # Density-aware panel component
  lib/dzin/
    panel-definitions.ts         # Central PoF panel registry
```

### Pattern 1: Density-Switched Panel Component
**What:** A panel component that reads density from context and renders different views.
**When to use:** Every Dzin panel follows this pattern.
**Example:**
```typescript
// Source: Dzin demo panels (DataListPanel.tsx)
'use client';

import { useDensity } from '@/lib/dzin/core';
import { PanelFrame } from '@/lib/dzin/core';
import type { CorePanelProps } from './types';

export function CorePanel({ featureMap, defs }: CorePanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Core" icon={<Cpu className="w-4 h-4" />}>
      {density === 'micro' && <CoreMicro featureMap={featureMap} defs={defs} />}
      {density === 'compact' && <CoreCompact featureMap={featureMap} defs={defs} />}
      {density === 'full' && <CoreFull featureMap={featureMap} defs={defs} />}
    </PanelFrame>
  );
}
```

### Pattern 2: PanelDefinition Registration
**What:** Each panel registered with full metadata in a central file.
**When to use:** Every PoF panel must be registered here.
**Example:**
```typescript
// Source: Dzin registry types (src/lib/dzin/core/registry/types.ts)
import { createRegistry } from '@/lib/dzin/core';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';

export const pofRegistry = createRegistry();

pofRegistry.register({
  type: 'arpg-combat-core',
  label: 'Core -- AbilitySystem',
  icon: 'Cpu',
  defaultRole: 'primary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: 'GAS pipeline status and ASC connection diagram',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['View AbilitySystemComponent setup status', 'Check GAS pipeline completion'],
  inputs: [
    { name: 'featureMap', type: 'object', description: 'Map of feature names to FeatureRow data', required: true },
    { name: 'defs', type: 'object', description: 'Feature definition metadata array', required: true },
  ],
  outputs: [
    { name: 'onFeatureSelect', type: 'string', description: 'Emits selected feature name for cross-panel filtering' },
  ],
  densityModes: {
    micro: { minWidth: 80, minHeight: 60, description: 'Cpu icon with pipeline progress badge (e.g. 3/6)' },
    compact: { minWidth: 200, minHeight: 160, description: 'ASC status, 4 connection indicators, pipeline count' },
    full: { minWidth: 400, minHeight: 300, description: 'Full CoreSection with feature card, connections grid, GAS pipeline, architecture explorer' },
  },
  component: CorePanel as React.ComponentType<Record<string, unknown>>,
});
```

### Pattern 3: Prototype Page with Dual-Mode Controls
**What:** A page that tests both density override and auto-density via resize.
**When to use:** The /prototype page specifically.
**Example:**
```typescript
// Prototype page uses DzinLayout with PanelDirective
const directives: PanelDirective[] = [
  {
    type: 'arpg-combat-core',
    density: overrideMode ? selectedDensity : undefined, // undefined = auto
  },
];

// In override mode: directive.density is set explicitly
// In resize mode: directive.density is undefined, container width triggers
//   assignSlotDensity() which reads densityModes thresholds
```

### Pattern 4: Data Flow via Props
**What:** Prototype page fetches data with hooks, passes to panel as props.
**When to use:** All PoF panels consume data via props, not internal hooks.
**Example:**
```typescript
// Prototype page
const { features } = useFeatureMatrix('arpg-combat');
const featureMap = useMemo(() => {
  const map = new Map<string, FeatureRow>();
  for (const f of features) map.set(f.featureName, f);
  return map;
}, [features]);

// DzinLayout renderPanel callback
renderPanel={(assignment) => {
  const def = registry.get(assignment.panelType);
  if (!def) return null;
  const Panel = def.component;
  return <Panel featureMap={featureMap} defs={defs} />;
}}
```

### Anti-Patterns to Avoid
- **Hooks inside panel components:** Panel components must NOT call `useFeatureMatrix` directly. Data comes via props from the parent page. This keeps panels pure and testable.
- **Animating density transitions:** Phase 2 uses instant mount/unmount. Do NOT add framer-motion `AnimatePresence` around density switches -- that is Phase 4 (DENS-13).
- **Generic base props:** Do NOT create a generic `DzinPanelProps` base interface. Each panel defines its own typed props (`CorePanelProps`). The `PanelDefinition.component` field uses `ComponentType<Record<string, unknown>>` for registry typing only.
- **Multiple registry instances:** Create ONE `pofRegistry` singleton in `panel-definitions.ts`. Do not create per-panel or per-page registries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Density context | Custom context provider | `useDensity()` from `@/lib/dzin/core` | DzinLayout already wraps slots in DensityProvider |
| Panel chrome (header, body) | Custom wrapper divs | `PanelFrame` from `@/lib/dzin/core` | Handles density-aware header visibility, data attributes for CSS |
| Container resize observation | Manual ResizeObserver | `useLayout()` hook (inside DzinLayout) | Debounced observer, auto density recalc built in |
| Density assignment from pixels | Manual threshold checks | `assignSlotDensity()` | Reads panel's `densityModes` config, falls back to sensible defaults |
| Panel registration | Manual Map | `createRegistry()` | Type-safe, domain queries, serialization support |

**Key insight:** Dzin's layout pipeline (templates -> scoring -> slot assignment -> spatial estimation -> density assignment) handles everything. The prototype page only needs to provide directives and a renderPanel callback.

## Common Pitfalls

### Pitfall 1: DzinLayout containerRef and Viewport Sizing
**What goes wrong:** DzinLayout uses `useLayout()` which defaults to observing `document.documentElement`. If the prototype page doesn't constrain the layout container height, the layout fills the viewport and density always resolves to 'full'.
**Why it happens:** The viewport is large enough to always meet 'full' thresholds (400x300).
**How to avoid:** For resize mode, wrap the DzinLayout in a container div with controlled width/height. Pass a `containerRef` via `options` to `DzinLayout` so ResizeObserver measures the container, not the viewport.
**Warning signs:** Density never changes when switching resize presets.

### Pitfall 2: PanelDirective density Override vs Auto
**What goes wrong:** Setting `density` on the PanelDirective in override mode works, but the layout resolver still calls `assignSlotDensity()`. Since `explicitDensity` takes precedence in `assignSlotDensity()`, this is fine -- but if you forget to clear the density override when switching to resize mode, auto-density won't work.
**Why it happens:** The `PanelDirective.density` field is optional. When present, it overrides auto-density.
**How to avoid:** In resize mode, ensure `directive.density` is `undefined` (not just falsy).
**Warning signs:** Resize mode doesn't change density.

### Pitfall 3: useFeatureMatrix Auto-Seed Effect
**What goes wrong:** `useFeatureMatrix` has an auto-seed side effect (lines 107-112) that runs when features is empty. On first load of the prototype page, this may cause a double-render: loading -> empty -> seed -> loading -> data.
**Why it happens:** The hook seeds the feature matrix on first load if no data exists for the module.
**How to avoid:** This is expected behavior. Show a loading state (`isLoading` flag) and don't render the panel until data is available. The existing `LoadingSpinner` component handles this.
**Warning signs:** Brief flash of micro density (empty state) before data loads.

### Pitfall 4: TypeScript Typing of Panel Component in Registry
**What goes wrong:** `PanelDefinition.component` is typed as `ComponentType<Record<string, unknown>>`, but `CorePanel` has specific props (`CorePanelProps`). Direct assignment may cause type errors.
**Why it happens:** The registry is generic -- it doesn't know each panel's specific props.
**How to avoid:** Cast when registering: `component: CorePanel as ComponentType<Record<string, unknown>>`. In the `renderPanel` callback, you already know which panel you're rendering and can pass the correct typed props.
**Warning signs:** TypeScript errors on `pofRegistry.register()`.

### Pitfall 5: Missing 'use client' Directive
**What goes wrong:** Components using hooks (`useDensity`, `useState`) fail if they don't have the `'use client'` directive.
**Why it happens:** Next.js App Router defaults to server components.
**How to avoid:** Add `'use client'` to: CorePanel.tsx, panel-definitions.ts (if it imports components), and the prototype page.tsx (since it uses hooks). Alternatively, the prototype page can be a server component that imports a client component wrapper.
**Warning signs:** "useState/useEffect not allowed in Server Components" error.

### Pitfall 6: GAS Pipeline Step Count for Micro View
**What goes wrong:** The micro view needs a progress indicator like "3/6". This requires computing how many pipeline steps are "complete" from the feature data.
**Why it happens:** The GAS pipeline steps in AbilitySpellbook are static constants (`['ASC', 'AttributeSet', 'Tags', 'GameplayAbility', 'GameplayEffect', 'Execution']`), but completion status comes from feature matrix data.
**How to avoid:** The "Core" section has `featureNames: ['AbilitySystemComponent']` -- only 1 feature. For the micro progress bar, compute completion across ALL section feature names (all 10 sections), or scope to core-relevant pipeline steps. Recommendation: derive from the feature statuses of ASC-related features in the defs array, counting `implemented` + `improved` as complete.
**Warning signs:** Progress always shows 0/6 or 1/1.

## Code Examples

### CorePanel Props Interface
```typescript
// Source: Derived from AbilitySpellbook SectionProps (line 1822)
import type { FeatureRow } from '@/types/feature-matrix';

export interface CorePanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}
```

### Micro Density View
```typescript
// Source: User decision from CONTEXT.md
function CoreMicro({ featureMap, defs }: CorePanelProps) {
  const completed = defs.filter(d => {
    const status = featureMap.get(d.featureName)?.status;
    return status === 'implemented' || status === 'improved';
  }).length;
  const total = defs.length;

  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Cpu className="w-5 h-5 text-blue-400" />
      <div className="flex items-center gap-1 text-xs text-text-muted">
        <span className="font-mono font-bold text-text">{completed}/{total}</span>
        <div className="w-8 h-1.5 bg-surface-deep rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 rounded-full"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

### Compact Density View
```typescript
// Source: User decision from CONTEXT.md
const ASC_CONNECTIONS = ['AttributeSet', 'Tag Container', 'Abilities', 'Active Effects'];

function CoreCompact({ featureMap, defs }: CorePanelProps) {
  const ascStatus = featureMap.get('AbilitySystemComponent')?.status ?? 'unknown';

  return (
    <div className="space-y-2 p-2 text-xs">
      {/* ASC status */}
      <div className="flex items-center gap-2">
        <StatusDot status={ascStatus} />
        <span className="text-text font-medium">AbilitySystemComponent</span>
      </div>

      {/* Connection items */}
      {ASC_CONNECTIONS.map(conn => (
        <div key={conn} className="flex items-center gap-2 pl-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
          <span className="text-text-muted">{conn}</span>
        </div>
      ))}

      {/* Pipeline count */}
      <div className="text-text-muted border-t border-border/30 pt-1.5 mt-1.5">
        Pipeline: 6 steps
      </div>
    </div>
  );
}
```

### Resize Mode Container Approach
```typescript
// Source: Dzin useLayout (src/lib/dzin/core/layout/useLayout.ts)
// The container ref approach for resize mode
const containerRef = useRef<HTMLDivElement>(null);

// Preset widths for resize mode
const RESIZE_PRESETS = {
  Small: 160,   // Should trigger micro (below compact minWidth 200)
  Medium: 320,  // Should trigger compact (above 200, below full minWidth 400)
  Large: 800,   // Should trigger full (above 400)
};

// Apply preset by setting container width
<div ref={containerRef} style={{ width: selectedPreset }}>
  <DzinLayout
    directives={directives}
    registry={pofRegistry}
    renderPanel={renderPanel}
    options={{ containerRef, preferredTemplate: 'single' }}
  />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AbilitySpellbook sections call hooks internally | Sections receive data as props (SectionProps) | Already the pattern | Clean extraction to Dzin panels |
| Viewport-based responsive design | Container-based density (per-slot px thresholds) | Dzin architecture | Each panel adapts independently |

**Deprecated/outdated:**
- None applicable -- Dzin is vendored and stable.

## Open Questions

1. **GAS Pipeline Progress Computation**
   - What we know: Micro view needs "X/Y" progress. The core section has 1 feature (`AbilitySystemComponent`). The GAS pipeline has 6 visual steps. There are ~12 features across all 10 sections.
   - What's unclear: Should progress show 1/1 (core section only), X/6 (mapped to pipeline steps), or X/12 (all features)?
   - Recommendation: Use `defs.length` as total and count `implemented`/`improved` as complete. The defs array is already passed as a prop and represents the actual feature definitions for the module. This gives a meaningful progress bar regardless of which features are scoped.

2. **Resize Mode containerRef vs CSS width override**
   - What we know: `useLayout` observes a containerRef with ResizeObserver. Setting a CSS width on the container should trigger resize.
   - What's unclear: Whether `estimateSlotDimensions()` uses the observed container width or the viewport width for density calculation.
   - Recommendation: Test both approaches. If `estimateSlotDimensions` uses viewport width, the resize mode may need to override density directly rather than relying on container width. Verify by checking `estimateSlotDimensions` implementation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (jsdom environment) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/__tests__/dzin/` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DENS-01 | CorePanel registered in pofRegistry with full PanelDefinition | unit | `npx vitest run src/__tests__/dzin/panel-registration.test.ts -x` | Wave 0 |
| DENS-02 | CorePanel renders micro/compact/full based on density context | unit | `npx vitest run src/__tests__/dzin/core-panel-density.test.tsx -x` | Wave 0 |
| DENS-12 | assignSlotDensity returns correct density for CorePanel thresholds | unit | `npx vitest run src/lib/dzin/core/layout/__tests__/density.test.ts -x` | Exists (Dzin vendored) |
| INTG-01 | /prototype page renders without errors | smoke | Manual -- Next.js page route test | Manual-only (Next.js routing) |
| INTG-02 | CorePanel receives featureMap/defs props and renders data | unit | `npx vitest run src/__tests__/dzin/core-panel-data.test.tsx -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/dzin/ -x`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/dzin/panel-registration.test.ts` -- covers DENS-01 (registry has panel, all fields populated)
- [ ] `src/__tests__/dzin/core-panel-density.test.tsx` -- covers DENS-02 (render at each density level, verify correct content)
- [ ] `src/__tests__/dzin/core-panel-data.test.tsx` -- covers INTG-02 (panel renders with real featureMap data)

## Sources

### Primary (HIGH confidence)
- `src/lib/dzin/core/registry/types.ts` -- PanelDefinition interface, all fields documented
- `src/lib/dzin/core/layout/density.ts` -- assignSlotDensity algorithm, threshold logic
- `src/lib/dzin/core/layout/useLayout.ts` -- ResizeObserver integration, containerRef support
- `src/lib/dzin/core/layout/resolver.ts` -- Full layout resolution pipeline
- `src/lib/dzin/core/panel/PanelFrame.tsx` -- Density-aware panel chrome
- `src/lib/dzin/core/demo/DataListPanel.tsx` -- Reference panel implementation pattern
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook.tsx` -- CoreSection (lines 519-569), SectionProps interface (line 1822)
- `src/hooks/useFeatureMatrix.ts` -- Feature data hook, return shape
- `src/lib/dzin/core/layout/templates.ts` -- Layout templates including 'single'

### Secondary (MEDIUM confidence)
- Phase 1 research and completed plans -- established patterns for CSS bridge, Tailwind variants

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in Phase 1
- Architecture: HIGH -- Dzin patterns directly observed in vendored source, demo panels provide working examples
- Pitfalls: HIGH -- derived from reading actual implementation code (useLayout, assignSlotDensity, resolver)
- Data flow: HIGH -- SectionProps and useFeatureMatrix interfaces read directly from source

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- vendored code, no external dependency changes)
