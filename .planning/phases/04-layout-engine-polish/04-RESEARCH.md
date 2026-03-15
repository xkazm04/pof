# Phase 4: Layout Engine & Polish - Research

**Researched:** 2026-03-15
**Domain:** Layout template switching, composition presets, framer-motion layout animations, cross-panel entity selection
**Confidence:** HIGH

## Summary

Phase 4 wires up the existing layout template infrastructure (templates.ts already defines all 8 templates including split-2, grid-4, primary-sidebar, studio) with user-facing picker UI, composition presets, animated transitions, and cross-panel entity highlighting. The core layout engine (resolver, assignment, density) is already complete from Phase 2. This phase is primarily UI integration work: building the template picker, preset switcher, wrapping DzinLayout slots with framer-motion `LayoutGroup`/`layout` animations, adding `AnimatePresence` crossfade for density transitions, and creating a React context for cross-panel selection state.

framer-motion 12.34.0 is already installed and heavily used throughout the codebase (AnimatePresence, motion.div, layoutId animations). The project has established patterns for all the animation primitives this phase requires. No new dependencies are needed.

**Primary recommendation:** Extend the existing prototype page with multi-panel directives, add layout template picker + preset dropdown to the control bar, wrap DzinLayout slot wrappers with `motion.div layout` for FLIP animations, and create a DzinSelectionContext for cross-panel entity highlighting.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 4 templates exposed: split-2, grid-4, primary-sidebar, studio
- Picker lives in the existing control bar alongside mode toggle and density/resize controls
- Minimap thumbnails: ~24x24px SVG icons showing grid structure as colored rectangles
- Active template highlighted with accent border + slight glow; hover shows border highlight
- Panels auto-fill slots by role matching via Dzin's resolver (no manual slot assignment)
- 3 presets defined:
  - "Ability Overview" (split-2): Core + Abilities
  - "Combat Debug" (grid-4): Core + Effects + DamageCalc + EffectTimeline
  - "Full Spellbook" (studio): Tags + Core + Attributes + Abilities (filling 4 of 5 studio slots)
- Preset switcher: dropdown button in the control bar ("Preset: Ability Overview")
- Selecting a preset changes BOTH the layout template AND which panels are shown
- Layout picker updates to reflect the preset's template as active
- Presets do NOT lock density -- auto-density via assignSlotDensity() based on slot pixel dimensions
- Layout template switches: framer-motion `layout` prop on panel slot wrappers, coordinated via LayoutGroup
- Density level changes: crossfade content using AnimatePresence mode="wait" (~200ms)
- Preset changes: unified transition -- panels that persist animate to new positions, entering panels fade in, exiting panels fade out, all in one ~300ms LayoutGroup animation
- Dzin-specific timing constants: Layout 300ms, Density crossfade 200ms, Cross-panel highlight 150ms
- Entity types: abilities AND tags
- Communication via React context (DzinSelectionContext)
- Selection state: `{ type: 'ability' | 'tag', id: string } | null`
- Click toggles selection (click again to clear)
- Visual: non-related items dimmed to 0.4 opacity, related items full brightness with accent border
- Relation lookup via static relation map data

### Claude's Discretion
- Exact SVG icon design for template thumbnails
- Control bar layout details (spacing, grouping, responsive behavior)
- How to structure the relation map data (inline object vs separate file)
- LayoutGroup configuration and animation easing curves
- Per-panel prop interface updates for selection callbacks and highlight state
- Whether the 5th studio slot in "Full Spellbook" gets a panel or stays empty

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DENS-13 | Density transitions between levels are animated (smooth content morphing, no layout jank) | AnimatePresence mode="wait" crossfade pattern; already used in SidebarL2.tsx |
| LAYT-01 | DzinLayout component wired with panel registry and renders combat panels in CSS Grid | DzinLayout already renders CSS Grid; extend renderPanel to dispatch to all 10 panel components by panelType |
| LAYT-02 | User can switch between at least 4 layout templates (split-2, grid-4, primary-sidebar, studio) | Templates exist in templates.ts; pass preferredTemplate to useLayout options |
| LAYT-03 | Layout template picker UI shows visual minimap-style thumbnails of each template | SVG icons ~24x24px showing grid structure; 4 buttons in control bar |
| LAYT-04 | Switching layout templates animates panel positions smoothly (framer-motion layout/FLIP) | motion.div layout prop on slot wrappers inside LayoutGroup; key by panelType not slotIndex |
| LAYT-05 | At least 3 composition presets defined | Static preset definitions mapping name -> { templateId, panelDirectives[] } |
| LAYT-06 | Composition preset switcher UI allows one-click workspace changes | Dropdown button in control bar; sets both template and directives |
| INTG-03 | Selecting an entity in one panel filters/highlights related data in companion panels | DzinSelectionContext with provider + useDzinSelection hook; panels check relation map |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | 12.34.0 | Layout FLIP animations, AnimatePresence crossfade, LayoutGroup coordination | Already installed and used in 15+ files; no alternatives needed |
| React context | 19.x | DzinSelectionContext for cross-panel entity selection | Simplest mechanism for sibling panel communication at layout scope |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (installed) | Icons for control bar buttons | Already used for all panel icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React context for selection | Zustand store | Overkill for ephemeral UI state scoped to prototype page; context is simpler and co-located |
| CSS transitions for layout | framer-motion layout | CSS can't do FLIP (First, Last, Invert, Play) across grid slot changes; framer-motion handles this natively |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended File Structure
```
src/
  app/prototype/page.tsx              # Major update: multi-panel, template picker, preset dropdown, selection context
  lib/dzin/
    composition-presets.ts            # NEW: preset definitions (name -> templateId + directives)
    selection-context.tsx             # NEW: DzinSelectionContext provider + useDzinSelection hook
    animation-constants.ts            # NEW: DZIN_TIMING constants (layout: 300ms, density: 200ms, highlight: 150ms)
    entity-relations.ts               # NEW: static relation map for cross-panel highlighting
    panel-definitions.ts              # Existing: no changes needed
    core/layout/templates.ts          # Existing: templates already defined, no changes
    core/layout/LayoutProvider.tsx    # Existing: DzinLayout component, may wrap slots with motion.div
```

### Pattern 1: Layout Template Switching via preferredTemplate
**What:** The existing `useLayout` hook accepts `options.preferredTemplate`. Changing this value triggers re-resolution with the new template, which re-assigns panels to slots.
**When to use:** When the user clicks a template thumbnail.
**Example:**
```typescript
// Source: existing useLayout.ts + resolver.ts
const [templateId, setTemplateId] = useState<LayoutTemplateId>('split-2');

// In DzinLayout options:
<DzinLayout
  directives={directives}
  registry={pofRegistry}
  renderPanel={renderPanel}
  options={{ containerRef, preferredTemplate: templateId }}
/>
```

### Pattern 2: Composition Presets as Data
**What:** A preset is a named object containing a templateId and a PanelDirective array. Selecting a preset sets both state values at once.
**When to use:** Preset dropdown selection.
**Example:**
```typescript
interface CompositionPreset {
  id: string;
  label: string;
  templateId: LayoutTemplateId;
  directives: PanelDirective[];
}

const PRESETS: CompositionPreset[] = [
  {
    id: 'ability-overview',
    label: 'Ability Overview',
    templateId: 'split-2',
    directives: [
      { type: 'arpg-combat-core' },
      { type: 'arpg-combat-abilities' },
    ],
  },
  // ...
];
```

### Pattern 3: LayoutGroup + layout Prop for FLIP Animations
**What:** Wrap DzinLayout's grid container in `<LayoutGroup>`. Each slot wrapper becomes `<motion.div layout layoutId={assignment.panelType}>`. When the template changes, framer-motion automatically animates panels from old positions to new positions.
**When to use:** Always -- this is the core animation mechanism.
**Critical detail:** The `layoutId` must be keyed by `panelType` (not `slotIndex`) so that framer-motion recognizes the same panel moving to a different slot. Combine with `AnimatePresence` so panels entering/exiting the layout fade in/out.
**Example:**
```typescript
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

<LayoutGroup>
  <div {...containerProps} className={className}>
    <AnimatePresence mode="popLayout">
      {layout.assignments.map((assignment) => (
        <motion.div
          key={assignment.panelType}
          layout
          layoutId={assignment.panelType}
          style={getSlotProps(assignment.slotIndex).style}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <DensityProvider density={assignment.density}>
            {renderPanel(assignment)}
          </DensityProvider>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
</LayoutGroup>
```

### Pattern 4: AnimatePresence for Density Crossfade
**What:** Inside each panel component, wrap the density switch with `AnimatePresence mode="wait"` so content fades out then fades in when density changes.
**When to use:** For DENS-13 (animated density transitions).
**Example:**
```typescript
function SomePanel({ featureMap, defs }: Props) {
  const density = useDensity();
  return (
    <PanelFrame title="..." icon={...}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {density === 'micro' && <Micro />}
          {density === 'compact' && <Compact />}
          {density === 'full' && <Full featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
```

### Pattern 5: DzinSelectionContext for Cross-Panel Highlighting
**What:** A React context providing `{ selection, setSelection }` where selection is `{ type: 'ability' | 'tag', id: string } | null`. The provider wraps the layout. Each panel reads selection and dims non-related items.
**When to use:** For INTG-03.
**Example:**
```typescript
// selection-context.tsx
const DzinSelectionContext = createContext<{
  selection: EntitySelection | null;
  setSelection: (sel: EntitySelection | null) => void;
}>({ selection: null, setSelection: () => {} });

export function DzinSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<EntitySelection | null>(null);
  const toggle = useCallback((sel: EntitySelection | null) => {
    setSelection(prev =>
      prev && prev.type === sel?.type && prev.id === sel?.id ? null : sel
    );
  }, []);
  return (
    <DzinSelectionContext.Provider value={{ selection, setSelection: toggle }}>
      {children}
    </DzinSelectionContext.Provider>
  );
}

export function useDzinSelection() {
  return useContext(DzinSelectionContext);
}
```

### Pattern 6: Multi-Panel renderPanel Dispatch
**What:** The prototype page's `renderPanel` callback receives a `SlotAssignment` and dispatches to the correct panel component based on `assignment.panelType`.
**When to use:** Required for LAYT-01 (multi-panel rendering).
**Example:**
```typescript
const renderPanel = useCallback((assignment: SlotAssignment) => {
  const commonProps = { featureMap, defs };
  switch (assignment.panelType) {
    case 'arpg-combat-core': return <CorePanel {...commonProps} />;
    case 'arpg-combat-abilities': return <AbilitiesPanel {...commonProps} />;
    case 'arpg-combat-effects': return <EffectsPanel {...commonProps} />;
    // ... all 10 panels
    default: return null;
  }
}, [featureMap, defs]);
```

### Anti-Patterns to Avoid
- **Keying motion.div by slotIndex:** Causes framer-motion to treat panel moving from slot 0 to slot 2 as slot 0 disappearing and slot 2 appearing (no FLIP). Key by panelType instead.
- **Animating grid-template changes with CSS transition:** CSS cannot interpolate between different grid-template-rows/columns strings. The FLIP approach via `layout` prop sidesteps this entirely.
- **Using mode="wait" on the layout AnimatePresence:** mode="wait" would wait for exiting panels to fully leave before entering panels appear. Use mode="popLayout" (or no mode) so layout animations happen simultaneously.
- **Putting LayoutGroup inside DzinLayout:** LayoutGroup should wrap the grid container from outside, not be nested inside individual slots.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FLIP layout animations | Manual getBoundingClientRect + transform calculations | framer-motion `layout` prop + `LayoutGroup` | Handles interruptions, z-index during animation, border-radius interpolation |
| Enter/exit transitions | Manual mount/unmount with setTimeout | `AnimatePresence` | Handles exit animations before unmount, interruptible |
| Grid slot positioning | Manual absolute positioning + transforms | CSS Grid + framer-motion layout | CSS Grid handles the layout; framer-motion handles the transition between layouts |
| Cross-panel communication | Event bus or Zustand store | React context | Selection state is ephemeral, scoped to prototype page, and only 2 values deep |

**Key insight:** framer-motion's `layout` prop does all the heavy lifting for FLIP animations. The entire layout animation system is built by adding `layout` and `layoutId` props to existing slot wrapper divs. No custom animation math needed.

## Common Pitfalls

### Pitfall 1: LayoutId Collisions
**What goes wrong:** Two panels with the same layoutId cause framer-motion to animate the wrong elements.
**Why it happens:** If layoutId uses slotIndex instead of panelType, or if the same panel type appears twice.
**How to avoid:** Use `assignment.panelType` as layoutId. Each panel type is unique per composition.
**Warning signs:** Panels visually "teleporting" or flickering during template switch.

### Pitfall 2: Grid Container Height Collapse
**What goes wrong:** The CSS Grid container collapses to 0 height when switching templates because the new template has different row definitions.
**Why it happens:** DzinLayout uses `height: 100%` which requires the parent to have explicit height.
**How to avoid:** Give the layout container an explicit min-height (e.g., `min-h-[600px]`) or use `flex-1` in a flex column layout.
**Warning signs:** Layout disappears momentarily during template switch.

### Pitfall 3: AnimatePresence mode with Layout Animations
**What goes wrong:** Using `mode="wait"` on the layout-level AnimatePresence causes sequential animations (exit then enter) instead of simultaneous FLIP.
**Why it happens:** mode="wait" is correct for density crossfade (sequential) but wrong for layout changes (simultaneous).
**How to avoid:** Use `mode="popLayout"` for the layout-level AnimatePresence (allows layout animations to run during exit). Use `mode="wait"` only inside panels for density crossfade.
**Warning signs:** Layout switch feels slow (300ms exit + 300ms enter = 600ms total instead of 300ms simultaneous).

### Pitfall 4: ResizeObserver Thrashing During Animation
**What goes wrong:** As panels animate to new positions, ResizeObserver fires repeatedly, causing density recalculation during the animation.
**Why it happens:** The 100ms debounce in useLayout may not be enough during a 300ms layout animation.
**How to avoid:** Either increase debounce to 350ms during transitions, or ignore resize events while a layout transition is in progress (use a ref flag).
**Warning signs:** Panels briefly flash different density levels during layout animation.

### Pitfall 5: Stale Selection After Preset Change
**What goes wrong:** After switching presets, the selection context still references an entity from a panel that's no longer visible.
**Why it happens:** Preset change removes panels but doesn't clear selection.
**How to avoid:** Clear selection state when preset/directives change (useEffect watching directives).
**Warning signs:** Dimmed opacity on all items with no way to clear it.

## Code Examples

### Template Thumbnail SVG Component
```typescript
// Minimap-style thumbnail for a layout template
function TemplateThumbnail({ templateId, active }: { templateId: LayoutTemplateId; active: boolean }) {
  // Each template maps to a simple SVG showing slot proportions
  const thumbnails: Record<string, ReactNode> = {
    'split-2': (
      <svg width="24" height="24" viewBox="0 0 24 24">
        <rect x="1" y="1" width="13" height="22" rx="1" fill="currentColor" opacity={0.6} />
        <rect x="16" y="1" width="7" height="22" rx="1" fill="currentColor" opacity={0.4} />
      </svg>
    ),
    'grid-4': (
      <svg width="24" height="24" viewBox="0 0 24 24">
        <rect x="1" y="1" width="10" height="10" rx="1" fill="currentColor" opacity={0.6} />
        <rect x="13" y="1" width="10" height="10" rx="1" fill="currentColor" opacity={0.4} />
        <rect x="1" y="13" width="10" height="10" rx="1" fill="currentColor" opacity={0.4} />
        <rect x="13" y="13" width="10" height="10" rx="1" fill="currentColor" opacity={0.3} />
      </svg>
    ),
    // ... primary-sidebar, studio
  };

  return (
    <button
      className={`p-1 rounded border transition-all ${
        active
          ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.3)]'
          : 'border-border text-text-muted hover:border-border/80 hover:text-text'
      }`}
    >
      {thumbnails[templateId]}
    </button>
  );
}
```

### Entity Relation Map Structure
```typescript
// Static relation map: keyed by "type:id", values are arrays of related "type:id" strings
const ENTITY_RELATIONS: Record<string, string[]> = {
  'ability:MeleeAttack': ['tag:Ability.Melee', 'tag:Damage.Physical'],
  'ability:Fireball': ['tag:Ability.Ranged', 'tag:Damage.Fire', 'tag:Element.Fire'],
  'ability:Dodge': ['tag:Ability.Movement', 'tag:State.Invulnerable'],
  'tag:Ability.Melee': ['ability:MeleeAttack'],
  'tag:Damage.Fire': ['ability:Fireball'],
  // bidirectional -- each entity lists its related entities
};

// Helper to check if an item is related to the current selection
function isRelatedToSelection(
  itemType: 'ability' | 'tag',
  itemId: string,
  selection: EntitySelection | null,
  relations: Record<string, string[]>,
): boolean {
  if (!selection) return true; // no selection = everything visible
  const key = `${selection.type}:${selection.id}`;
  const related = relations[key] ?? [];
  return related.includes(`${itemType}:${itemId}`) || (selection.type === itemType && selection.id === itemId);
}
```

### Highlight Wrapper for Panel Items
```typescript
// Wrap clickable items in panels with selection-aware opacity
function SelectableItem({
  type, id, children,
}: { type: 'ability' | 'tag'; id: string; children: ReactNode }) {
  const { selection, setSelection } = useDzinSelection();
  const relations = useEntityRelations();
  const isRelated = isRelatedToSelection(type, id, selection, relations);
  const isSelected = selection?.type === type && selection?.id === id;

  return (
    <motion.div
      onClick={() => setSelection({ type, id })}
      animate={{ opacity: selection && !isRelated ? 0.4 : 1 }}
      transition={{ duration: 0.15 }}
      className={`cursor-pointer ${isSelected ? 'ring-1 ring-blue-500/50' : ''}`}
    >
      {children}
    </motion.div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-grid-layout for panel layouts | CSS Grid + framer-motion layout | framer-motion v6+ (2022) | No drag-drop library needed; pure CSS Grid with FLIP transitions |
| Manual FLIP via react-flip-toolkit | framer-motion `layout` prop | framer-motion v5 (2021) | Single prop handles all FLIP math |
| AnimatePresence mode="sync" | mode="popLayout" | framer-motion v7+ (2023) | Allows layout animations during exit transitions |

**framer-motion 12.x notes (HIGH confidence -- installed version):**
- `LayoutGroup` is stable and exported from `framer-motion`
- `mode="popLayout"` on AnimatePresence enables layout animations to continue during exit
- `layout` prop accepts boolean or `"position"` or `"size"` for selective animation
- `layoutId` enables shared layout animations across different DOM locations

## Open Questions

1. **Which panels need SelectableItem wrappers?**
   - What we know: Abilities and tags are the entity types. AbilitiesPanel has ability names, TagsPanel has tag entries.
   - What's unclear: How deep into panel content the selection wrapper goes (every list item? only full density? all densities?)
   - Recommendation: Apply to compact and full density levels only. Micro is too small for meaningful interaction.

2. **Should the 5th studio slot in "Full Spellbook" be empty or filled?**
   - What we know: Studio template has 5 slots. "Full Spellbook" preset specifies 4 panels (Tags, Core, Attributes, Abilities).
   - What's unclear: Whether an empty slot looks bad or fine.
   - Recommendation: Leave it empty. The resolver will skip unfilled slots gracefully. An empty slot is better than forcing an unrelated panel.

3. **ResizeObserver interaction with layout animations**
   - What we know: useLayout debounces ResizeObserver at 100ms. Layout animations last 300ms.
   - What's unclear: Whether density thrashing will occur during animation.
   - Recommendation: Start without extra guarding. If density flickering is observed during animation, add a `isTransitioning` ref that suppresses density recalculation during layout transitions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/__tests__/dzin/` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DENS-13 | Density transitions are animated (AnimatePresence wraps density switch) | unit | `npx vitest run src/__tests__/dzin/density-animation.test.tsx -x` | No -- Wave 0 |
| LAYT-01 | DzinLayout renders multi-panel grid | unit | `npx vitest run src/__tests__/dzin/multi-panel-layout.test.tsx -x` | No -- Wave 0 |
| LAYT-02 | Template switching changes grid layout | unit | `npx vitest run src/__tests__/dzin/template-switching.test.tsx -x` | No -- Wave 0 |
| LAYT-03 | Template picker renders thumbnails | unit | `npx vitest run src/__tests__/dzin/template-picker.test.tsx -x` | No -- Wave 0 |
| LAYT-04 | Layout animation uses motion.div with layout prop | unit | `npx vitest run src/__tests__/dzin/layout-animation.test.tsx -x` | No -- Wave 0 |
| LAYT-05 | 3 composition presets defined with correct templates and directives | unit | `npx vitest run src/__tests__/dzin/composition-presets.test.ts -x` | No -- Wave 0 |
| LAYT-06 | Preset switcher changes layout + directives | unit | `npx vitest run src/__tests__/dzin/preset-switcher.test.tsx -x` | No -- Wave 0 |
| INTG-03 | Cross-panel selection highlights related items | unit | `npx vitest run src/__tests__/dzin/cross-panel-selection.test.tsx -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/dzin/ -x`
- **Per wave merge:** `npm run validate`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/dzin/composition-presets.test.ts` -- covers LAYT-05 (pure data, no React)
- [ ] `src/__tests__/dzin/cross-panel-selection.test.tsx` -- covers INTG-03 (context + relation map)
- [ ] `src/__tests__/dzin/multi-panel-layout.test.tsx` -- covers LAYT-01, LAYT-02 (renderPanel dispatch)
- [ ] Test files for LAYT-03, LAYT-04, LAYT-06, DENS-13 can be combined with the above or created per-task

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- `src/lib/dzin/core/layout/templates.ts` (all 8 templates defined with CSS Grid)
- **Codebase inspection** -- `src/lib/dzin/core/layout/resolver.ts` (resolveLayout pipeline with preferredTemplate support)
- **Codebase inspection** -- `src/lib/dzin/core/layout/LayoutProvider.tsx` (DzinLayout component)
- **Codebase inspection** -- `src/lib/dzin/core/layout/useLayout.ts` (ResizeObserver + layout resolution hook)
- **Codebase inspection** -- `src/lib/dzin/panel-definitions.ts` (all 10 panels registered with types)
- **Codebase inspection** -- `src/app/prototype/page.tsx` (current single-panel prototype page)
- **Codebase inspection** -- framer-motion 12.34.0 installed, AnimatePresence/motion/layoutId already used in 15+ files
- **Codebase inspection** -- `src/components/layout/SidebarL2.tsx` uses `AnimatePresence mode="wait"` (existing pattern)

### Secondary (MEDIUM confidence)
- framer-motion `layout`, `LayoutGroup`, `mode="popLayout"` -- based on framer-motion documentation and established patterns in codebase

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- framer-motion already installed and used extensively; no new dependencies
- Architecture: HIGH -- extends existing DzinLayout/useLayout/templates infrastructure; all integration points identified in code
- Pitfalls: HIGH -- based on direct codebase analysis of ResizeObserver timing, AnimatePresence modes, and layoutId patterns
- Animation patterns: MEDIUM -- LayoutGroup + mode="popLayout" combination not yet used in this codebase but well-documented in framer-motion

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable domain, no fast-moving dependencies)
