# Phase 3: All Panels - Research

**Researched:** 2026-03-14
**Domain:** React component extraction, tri-density panel architecture, panel registry
**Confidence:** HIGH

## Summary

Phase 3 creates 9 additional Dzin panels from the existing AbilitySpellbook sections (Attributes, Tags, Abilities, Effects, Tag Deps, Effect Timeline, Damage Calc, Tag Audit, Loadout). Each panel follows the proven CorePanel pattern: `useDensity()` hook, switch on density level, three distinct views (micro/compact/full). All panels register in the existing `pofRegistry` with full `PanelDefinition` metadata.

The primary work is **extraction and adaptation** -- all full-density content already exists in `AbilitySpellbook.tsx` as private section functions. The research confirms that each section has static data constants co-located in the same file that must be extracted alongside the rendering logic. The shared `_shared.tsx` module provides reusable visualization components (RadarChart, TimelineStrip, PipelineFlow, FeatureCard, SectionLabel) that panels can import directly.

**Primary recommendation:** Follow the CorePanel pattern exactly. Each panel is a single file in `src/components/modules/core-engine/dzin-panels/`, exports a typed props interface, uses `PanelFrame` for chrome, and registers in `panel-definitions.ts`. Static data (constants, types) can live inside each panel file since they are small.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- REQUIREMENTS.md definitions (DENS-03 through DENS-11) are sufficient as-is -- no refinements needed
- Full density views reuse existing AbilitySpellbook visualizations (SVG, canvas, charts) -- extract and wrap, don't simplify
- Each panel receives featureMap for status info PLUS section-specific static data (tag trees, effect types, pipeline steps, etc.)
- Micro views allow variation -- most use icon + metric, but richer micro views permitted where the section naturally has a visual summary
- Minimal panel header: label text only, no icon, no accent bar -- let content speak
- Subtle chrome always visible at all densities: thin border at micro/compact/full, header only at compact+full
- Panel chrome must match PoF's dark theme (INTG-04) via the existing pof-bridge.css token mapping
- 3 plans of 3 panels each, grouped by complexity
- All 3 plans run in parallel (wave 1) -- CorePanel pattern is proven, no need for sequential validation
- Each plan creates 3 panel component files, registers them in pofRegistry, and adds tests
- No changes to /prototype page in Phase 3 -- stays showing single CorePanel
- New panels tested individually via their test files
- Panel files in `src/components/modules/core-engine/dzin-panels/` (same directory as CorePanel)
- All 9 panels registered in the existing `src/lib/dzin/panel-definitions.ts`
- Domain string: "arpg-combat" for all panels

### Claude's Discretion
- Exact grouping of panels into the 3 batches (suggested grouping above, but Claude can adjust if dependencies warrant)
- Per-panel prop interface design (each panel defines its own typed props, following CorePanelProps pattern)
- How to extract complex visualizations from AbilitySpellbook (may need refactoring tightly-coupled components)
- Whether each batch gets one combined test file or one test file per panel

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DENS-03 | Attributes panel: micro (attribute count), compact (bar chart summary), full (detailed attribute grid) | Full-density content from `AttributesSection` in AbilitySpellbook (lines 648-735). Uses CORE_ATTRIBUTES, DERIVED_ATTRIBUTES, ATTR_WEB_NODES/EDGES, GROWTH_BUILDS data. Shared components: FeatureCard, RadarChart, SectionLabel. |
| DENS-04 | Tags panel: micro (tag count badge), compact (tag list), full (tag hierarchy tree) | Full-density content from `TagsSection` (lines 940-1006). Uses TAG_TREE data structure. TagTreeNode is a recursive component with local state. |
| DENS-05 | Abilities panel: micro (ability count), compact (ability name list with cooldowns), full (ability cards with full details) | Full-density content from `AbilitiesSection` (lines 1010-1096). Uses ABILITY_RADAR_DATA, COOLDOWN_ABILITIES data. Shared components: FeatureCard, PipelineFlow, RadarChart. CooldownWheel is a private helper. |
| DENS-06 | Effects panel: micro (effect count), compact (effect list with durations), full (effect cards with stacking/calculation details) | Full-density content from `EffectsSection` (lines 1147-1183). Uses EFFECT_TYPES data. Shared components: FeatureCard, PipelineFlow. |
| DENS-07 | Tag Deps panel: micro (dep count), compact (simplified dep list), full (network graph) | Full-density content from `TagDepsSection` (lines 1187-1296). Uses TAG_DEP_NODES, TAG_DEP_EDGES, TAG_DEP_CATEGORIES data. SVG network graph with node positions computed via useMemo. |
| DENS-08 | Effect Timeline panel: micro (timeline span badge), compact (condensed timeline bar), full (interactive timeline strip) | Full-density content from `EffectsTimelineSection` (lines 1300-1372). Uses EFFECT_TIMELINE_EVENTS data. Shared component: TimelineStrip. Swim-lane layout with category lanes. |
| DENS-09 | Damage Calc panel: micro (DPS badge), compact (pipeline summary), full (step-by-step calculation flow) | Full-density content from `DamageCalcSection` (lines 1376-1470). Interactive: uses useState for 5 slider parameters. SliderParam and FormulaStep are private helpers. |
| DENS-10 | Tag Audit panel: micro (pass/fail badge), compact (audit summary counts), full (detailed audit checklist) | Full-density content from `TagAuditSection` (lines 1609-1735). Uses TAG_AUDIT_CATEGORIES, TAG_USAGE_FREQUENCY, TAG_DETAIL_MAP data. Interactive: tag click opens TagQuickViewPopover. |
| DENS-11 | Loadout panel: micro (loadout count), compact (loadout names with slots), full (interactive loadout builder) | Full-density content from `LoadoutSection` (lines 1739-1818). Uses OPTIMAL_LOADOUT, LOADOUT_RADAR, LOADOUT_SCORE, ALTERNATIVE_LOADOUTS data. Shared component: RadarChart. |
| INTG-04 | Panel chrome matches PoF's dark theme | PanelFrame applies `data-dzin-panel`, `data-dzin-density`, `data-dzin-panel-header` attributes. pof-bridge.css maps all `--dzin-*` tokens to PoF CSS variables. No additional work needed -- using PanelFrame and existing CSS tokens automatically satisfies INTG-04. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component framework | Project standard |
| lucide-react | latest | Icons (BarChart3, Tags, Sparkles, Flame, Network, Clock, Calculator, ClipboardCheck, Layers) | Already used by AbilitySpellbook sections |
| framer-motion | latest | Animations in full-density views | Already used by AbilitySpellbook; motion.div, AnimatePresence |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/dzin/core` | local | useDensity, PanelFrame, DensityProvider, createRegistry, PanelDefinition | Every panel component + tests |
| `@/components/modules/core-engine/unique-tabs/_shared` | local | FeatureCard, PipelineFlow, SectionLabel, RadarChart, TimelineStrip, STATUS_COLORS | Full-density views that need shared visualizations |
| `@/components/ui/SurfaceCard` | local | Container with depth levels | Full-density card wrappers |
| `@/lib/chart-colors` | local | MODULE_COLORS, STATUS_SUCCESS, STATUS_IMPROVED, STATUS_WARNING, STATUS_ERROR, OPACITY_* | Color constants for status indicators |

No new dependencies needed. Everything required is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/components/modules/core-engine/dzin-panels/
  CorePanel.tsx          # (existing -- Phase 2)
  AttributesPanel.tsx    # DENS-03
  TagsPanel.tsx          # DENS-04
  AbilitiesPanel.tsx     # DENS-05
  EffectsPanel.tsx       # DENS-06
  TagDepsPanel.tsx       # DENS-07
  EffectTimelinePanel.tsx # DENS-08
  DamageCalcPanel.tsx    # DENS-09
  TagAuditPanel.tsx      # DENS-10
  LoadoutPanel.tsx       # DENS-11

src/lib/dzin/panel-definitions.ts  # Add 9 registrations (existing file)

src/__tests__/dzin/
  core-panel-density.test.tsx      # (existing -- Phase 2)
  panel-registration.test.ts       # (existing -- Phase 2, extend for 9 panels)
  attributes-panel-density.test.tsx
  tags-panel-density.test.tsx
  abilities-panel-density.test.tsx
  effects-panel-density.test.tsx
  tag-deps-panel-density.test.tsx
  effect-timeline-panel-density.test.tsx
  damage-calc-panel-density.test.tsx
  tag-audit-panel-density.test.tsx
  loadout-panel-density.test.tsx
```

### Pattern 1: Panel Component Structure (Proven by CorePanel)
**What:** Each panel follows the exact same structure as CorePanel.
**When to use:** Every panel in this phase.
**Example:**
```typescript
// Source: CorePanel.tsx (Phase 2 reference implementation)
'use client';

import { useDensity, PanelFrame } from '@/lib/dzin/core';
import type { FeatureRow } from '@/types/feature-matrix';

export interface AttributesPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  // ... section-specific props
}

function AttributesMicro({ featureMap, defs }: AttributesPanelProps) {
  // Icon + single summary metric
}

function AttributesCompact({ featureMap, defs }: AttributesPanelProps) {
  // Intermediate detail: key stats, short lists
}

function AttributesFull({ featureMap, defs }: AttributesPanelProps) {
  // Full interactive view extracted from AbilitySpellbook's AttributesSection
}

export function AttributesPanel(props: AttributesPanelProps) {
  const density = useDensity();
  return (
    <PanelFrame title="Attributes" icon={<BarChart3 className="w-4 h-4" />}>
      {density === 'micro' && <AttributesMicro {...props} />}
      {density === 'compact' && <AttributesCompact {...props} />}
      {density === 'full' && <AttributesFull {...props} />}
    </PanelFrame>
  );
}
```

### Pattern 2: Panel Registration (Gold Standard)
**What:** Full PanelDefinition with all metadata fields populated.
**When to use:** Every panel registration in panel-definitions.ts.
**Example:**
```typescript
// Source: panel-definitions.ts (CorePanel registration)
pofRegistry.register({
  type: 'arpg-combat-attributes',
  label: 'Attributes -- AttributeSet',
  icon: 'BarChart3',
  defaultRole: 'secondary',
  sizeClass: 'standard',
  complexity: 'medium',
  domains: ['arpg-combat'],
  description: '...',
  capabilities: ['viewing', 'status-tracking'],
  useCases: ['...'],
  suggestedCompanions: ['arpg-combat-core', '...'],
  inputs: [
    { name: 'featureMap', type: 'object', description: '...', required: true },
    { name: 'defs', type: 'object', description: '...', required: true },
  ],
  outputs: [...],
  densityModes: {
    micro: { minWidth: 80, minHeight: 60, description: '...' },
    compact: { minWidth: 200, minHeight: 160, description: '...' },
    full: { minWidth: 400, minHeight: 300, description: '...' },
  },
  component: AttributesPanel as unknown as ComponentType<Record<string, unknown>>,
});
```

### Pattern 3: Density Test Structure (Proven by core-panel-density.test.tsx)
**What:** Test each density level renders expected content.
**When to use:** Every panel's test file.
**Example:**
```typescript
// Source: core-panel-density.test.tsx
import { DensityProvider } from '@/lib/dzin/core';

describe('AttributesPanel at micro density', () => {
  it('renders attribute count', () => {
    render(
      <DensityProvider density="micro">
        <AttributesPanel featureMap={mockFeatureMap} defs={mockDefs} />
      </DensityProvider>,
    );
    expect(screen.getByText(/\d+/)).toBeTruthy();
  });
});
```

### Anti-Patterns to Avoid
- **Importing useFeatureMatrix inside panels:** Panels receive data via props, never fetch their own data. The parent (future layout in Phase 4) provides props.
- **Using framer-motion in micro/compact:** Micro and compact should be lightweight. Reserve animations for full density only.
- **Hardcoded hex colors:** Use `@/lib/chart-colors` constants or existing color variables from the section data.
- **Importing from AbilitySpellbook:** The section functions are private (not exported). Extract content by copying and adapting, not by importing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Panel chrome/frame | Custom div wrappers | `PanelFrame` from `@/lib/dzin/core` | Handles density-aware header visibility, data attributes for theme |
| Density detection | Manual context reading | `useDensity()` hook | Already wired to DensityProvider context |
| Panel registry | Custom panel map | `pofRegistry.register()` | Handles type safety, domain queries, serialization |
| Status colors | Inline color logic | `STATUS_COLORS` from `_shared.tsx` | Consistent status indicator colors across panels |
| Radar charts | Custom SVG radar | `RadarChart` from `_shared.tsx` | Already handles axes, grid, overlays, labels |
| Timeline visualization | Custom timeline | `TimelineStrip` from `_shared.tsx` | Already handles event positioning, duration bars |
| Pipeline flows | Custom step indicators | `PipelineFlow` from `_shared.tsx` | Already handles animated step arrows |
| Feature status cards | Custom status display | `FeatureCard` from `_shared.tsx` | Already handles expand/collapse, status dots, deps |

## Common Pitfalls

### Pitfall 1: AbilitySpellbook Private Dependencies
**What goes wrong:** Attempting to import section functions (CoreSection, AttributesSection, etc.) from AbilitySpellbook -- they are not exported.
**Why it happens:** Developer sees the content exists and tries to reuse it directly.
**How to avoid:** Copy the rendering logic from each section function into the panel's Full-density component. Extract static data constants (TAG_TREE, EFFECT_TYPES, etc.) into the panel file.
**Warning signs:** Import errors referencing AbilitySpellbook internal functions.

### Pitfall 2: Private SVG Components
**What goes wrong:** GASArchitectureExplorer, AttributeRelationshipWeb, AttributeGrowthChart, CooldownWheel, TagTreeNode, SliderParam, FormulaStep, TagQuickViewPopover are all private functions within AbilitySpellbook.
**Why it happens:** These are helper components needed by full-density views.
**How to avoid:** Copy these helper components into the relevant panel file. They are self-contained and small enough to be co-located.
**Warning signs:** Missing component references when building full-density views.

### Pitfall 3: Static Data Extraction
**What goes wrong:** Missing data constants that full-density views depend on (TAG_TREE, TAG_DEP_NODES, EFFECT_TIMELINE_EVENTS, etc.).
**Why it happens:** Data constants are defined at module scope in AbilitySpellbook, not in _shared.tsx.
**How to avoid:** For each panel, identify ALL data constants referenced by the section function and copy them into the panel file.

### Pitfall 4: framer-motion in Tests
**What goes wrong:** Tests fail because framer-motion components require special handling in jsdom.
**Why it happens:** motion.div and AnimatePresence behave differently in test environment.
**How to avoid:** The existing test setup (jsdom environment) handles this -- CorePanel tests already pass with framer-motion. Follow the same test patterns. For panels with heavy animation, test for text/structure presence rather than visual state.

### Pitfall 5: Panel Registration Import Order
**What goes wrong:** Circular import or missing component when panel-definitions.ts imports all 10 panels.
**Why it happens:** All panels import from `@/lib/dzin/core`, and panel-definitions.ts also imports from there.
**How to avoid:** panel-definitions.ts imports are one-directional (it imports panel components, panels import from dzin/core). No circular dependency exists. The `as unknown as ComponentType<Record<string, unknown>>` cast is required (established pattern from CorePanel).

### Pitfall 6: SectionProps vs Panel Props
**What goes wrong:** AbilitySpellbook's `SectionProps` interface includes `expanded` and `onToggle` for accordion state shared across the entire spellbook view. Panels are self-contained.
**Why it happens:** In AbilitySpellbook, multiple FeatureCards share an expanded state. In a panel, the expanded state is local.
**How to avoid:** Each panel manages its own `expanded` state via `useState` internally (like CoreFull does). Don't pass expanded/onToggle through panel props.

## Code Examples

### Data Constants to Extract Per Panel

**AttributesPanel:**
```typescript
const CORE_ATTRIBUTES = ['Health', 'Mana', 'Strength', 'Dexterity', 'Intelligence'];
const DERIVED_ATTRIBUTES = ['Armor', 'AttackPower', 'CritChance', 'CritDamage'];
const ATTR_WEB_NODES: AttrNode[] = [...]; // 9 nodes
const ATTR_WEB_EDGES: AttrEdge[] = [...]; // 5 edges
const GROWTH_BUILDS: { name: string; color: string; points: GrowthPoint[] }[] = [...]; // 3 builds
```

**TagsPanel:**
```typescript
const TAG_TREE: TagNode[] = [...]; // 4 root nodes with children
// Also needs TagTreeNode recursive component
```

**AbilitiesPanel:**
```typescript
const ABILITY_RADAR_AXES = ['Damage', 'Range', 'AOE', 'Speed', 'Efficiency'];
const ABILITY_RADAR_DATA = [...]; // 3 abilities
const COOLDOWN_ABILITIES = [...]; // 4 abilities
// Also needs CooldownWheel component
```

**EffectsPanel:**
```typescript
const EFFECT_TYPES = [...]; // 4 effect types
```

**TagDepsPanel:**
```typescript
const TAG_DEP_CATEGORIES: Record<string, string> = {...};
const TAG_DEP_NODES: TagDepNode[] = [...]; // 9 nodes
const TAG_DEP_EDGES: TagDepEdge[] = [...]; // 6 edges
```

**EffectTimelinePanel:**
```typescript
const EFFECT_TIMELINE_EVENTS: TimelineEvent[] = [...]; // 8 events
```

**DamageCalcPanel:**
```typescript
// No static data -- uses useState for interactive sliders
// Needs SliderParam and FormulaStep helper components
```

**TagAuditPanel:**
```typescript
const TAG_AUDIT_CATEGORIES: AuditCategory[] = [...]; // 4 categories
const TAG_USAGE_FREQUENCY = [...]; // 10 tags
const TAG_AUDIT_SCORE = 85;
const TAG_DETAIL_MAP: Record<string, TagDetail> = {...}; // 10 entries
// Also needs TagQuickViewPopover component
```

**LoadoutPanel:**
```typescript
const OPTIMAL_LOADOUT: LoadoutEntry[] = [...]; // 4 slots
const LOADOUT_RADAR: RadarDataPoint[] = [...]; // 5 axes
const LOADOUT_SCORE = 78;
const ALTERNATIVE_LOADOUTS = [...]; // 3 alternatives
```

### Section Icons Mapping (from SECTIONS config in AbilitySpellbook)
```typescript
// Section → Icon → Color
'attributes' → BarChart3  → '#10b981'
'tags'       → Tags       → '#f59e0b'
'abilities'  → Sparkles   → '#a855f7'
'effects'    → Flame      → '#ef4444'
'tag-deps'   → Network    → '#f59e0b'
'effects-timeline' → Clock → '#ef4444'
'damage-calc' → Calculator → '#f97316'
'tag-audit'  → ClipboardCheck → '#fbbf24'
'loadout'    → Layers     → '#a855f7'
```

### Panel Type IDs (for registry)
```typescript
'arpg-combat-attributes'
'arpg-combat-tags'
'arpg-combat-abilities'
'arpg-combat-effects'
'arpg-combat-tag-deps'
'arpg-combat-effect-timeline'
'arpg-combat-damage-calc'
'arpg-combat-tag-audit'
'arpg-combat-loadout'
```

### Sections With vs Without featureMap
Sections that use featureMap (need featureMap + defs in props):
- Attributes: `Core AttributeSet`, `Default attribute initialization`
- Tags: `Gameplay Tags hierarchy`
- Abilities: `Base GameplayAbility`
- Effects: `Core Gameplay Effects`, `Damage execution calculation`

Sections WITHOUT featureMap (pure visualization):
- Tag Deps
- Effect Timeline
- Damage Calc
- Tag Audit
- Loadout

For pure-visualization panels, featureMap can be omitted from props. However, the CONTEXT.md says "each panel receives featureMap for status info PLUS section-specific static data." To honor this, include featureMap in all panel props for consistency, even if some panels only use it for the micro summary metric (e.g., "associated feature count").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic AbilitySpellbook with tab switching | Individual Dzin panels with density adaptation | Phase 3 (now) | Each section becomes independently composable |
| Shared accordion state across sections | Per-panel local state | Phase 3 (now) | Simpler props, no cross-panel state coupling |

## Open Questions

1. **How many featureNames does each visualization-only panel claim?**
   - What we know: Tag Deps, Effect Timeline, Damage Calc, Tag Audit, and Loadout have `featureNames: []` in the SECTIONS config
   - What's unclear: For micro-density summary metrics on these panels, what number to display if there are no associated features
   - Recommendation: Use section-specific counts instead (e.g., tag dep count = TAG_DEP_EDGES.length, audit score = TAG_AUDIT_SCORE, etc.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, configured) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/__tests__/dzin/` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DENS-03 | Attributes renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/attributes-panel-density.test.tsx -x` | Wave 0 |
| DENS-04 | Tags renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/tags-panel-density.test.tsx -x` | Wave 0 |
| DENS-05 | Abilities renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/abilities-panel-density.test.tsx -x` | Wave 0 |
| DENS-06 | Effects renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/effects-panel-density.test.tsx -x` | Wave 0 |
| DENS-07 | Tag Deps renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/tag-deps-panel-density.test.tsx -x` | Wave 0 |
| DENS-08 | Effect Timeline renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/effect-timeline-panel-density.test.tsx -x` | Wave 0 |
| DENS-09 | Damage Calc renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/damage-calc-panel-density.test.tsx -x` | Wave 0 |
| DENS-10 | Tag Audit renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/tag-audit-panel-density.test.tsx -x` | Wave 0 |
| DENS-11 | Loadout renders at 3 densities | unit | `npx vitest run src/__tests__/dzin/loadout-panel-density.test.tsx -x` | Wave 0 |
| INTG-04 | All panels registered with correct metadata | unit | `npx vitest run src/__tests__/dzin/panel-registration.test.ts -x` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/dzin/ -x`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/dzin/attributes-panel-density.test.tsx` -- covers DENS-03
- [ ] `src/__tests__/dzin/tags-panel-density.test.tsx` -- covers DENS-04
- [ ] `src/__tests__/dzin/abilities-panel-density.test.tsx` -- covers DENS-05
- [ ] `src/__tests__/dzin/effects-panel-density.test.tsx` -- covers DENS-06
- [ ] `src/__tests__/dzin/tag-deps-panel-density.test.tsx` -- covers DENS-07
- [ ] `src/__tests__/dzin/effect-timeline-panel-density.test.tsx` -- covers DENS-08
- [ ] `src/__tests__/dzin/damage-calc-panel-density.test.tsx` -- covers DENS-09
- [ ] `src/__tests__/dzin/tag-audit-panel-density.test.tsx` -- covers DENS-10
- [ ] `src/__tests__/dzin/loadout-panel-density.test.tsx` -- covers DENS-11
- [ ] Extend `src/__tests__/dzin/panel-registration.test.ts` -- covers all 9 new registrations

## Sources

### Primary (HIGH confidence)
- `src/components/modules/core-engine/dzin-panels/CorePanel.tsx` -- reference panel implementation
- `src/lib/dzin/panel-definitions.ts` -- registry pattern with gold-standard registration
- `src/lib/dzin/core/index.ts` -- public API exports (useDensity, PanelFrame, DensityProvider, createRegistry)
- `src/lib/dzin/core/panel/PanelFrame.tsx` -- panel frame chrome behavior
- `src/lib/dzin/core/theme/pof-bridge.css` -- PoF dark theme token mapping
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook.tsx` -- all 10 section implementations with data
- `src/components/modules/core-engine/unique-tabs/_shared.tsx` -- shared visualization components
- `src/__tests__/dzin/core-panel-density.test.tsx` -- test pattern reference
- `src/__tests__/dzin/panel-registration.test.ts` -- registration test pattern reference

### Secondary (MEDIUM confidence)
- None needed -- all sources are project-internal code

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- pattern proven by CorePanel in Phase 2, exact replication
- Pitfalls: HIGH -- identified from direct code analysis of AbilitySpellbook internals

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- internal patterns only)
