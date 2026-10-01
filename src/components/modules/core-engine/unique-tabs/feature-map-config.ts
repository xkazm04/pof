import type { SubModuleId } from '@/types/modules';

/**
 * The Feature Map section registry — the ONE declared set of section ids per module.
 *
 * Every entry says how the sub-module honours it:
 *  - `gated: true`       — a `<VisibleSection sectionId="…">` in the sub_* root reads this id;
 *                          it is the only kind the Feature Map renders as a toggle.
 *  - `in: '<gated id>'`  — a sub-panel rendered inside that gated panel; it follows its parent.
 *  - `locked: 'no-gate'` — shown on the map for orientation, but nothing in the module hides it.
 *
 * `src/__tests__/components/core-engine/feature-section-coverage.test.ts` pins the gated ids
 * equal to the `sectionId="…"` literals under each sub_* dir, and `VisibleSection` takes a
 * `SectionId`, so a gate and its registry entry cannot drift apart silently.
 */
export interface SectionDef<I extends string = string> {
  id: I;
  label: string;
  tab: string;
  summary?: string;
  gated?: true;
  in?: string;
  locked?: 'no-gate';
}

export interface TabGroup {
  tabId: string;
  tabLabel: string;
  sections: SectionDef<SectionId>[];
}

/* ── Declaration helpers ───────────────────────────────────────────────────── */

/** A section a `<VisibleSection>` gate reads. */
function g<const I extends string>(tab: string, id: I, label: string, summary?: string): SectionDef<I> {
  return { id, label, tab, gated: true, ...(summary && { summary }) };
}

/** A sub-panel rendered inside the gated panel `parent`. */
function sub<const I extends string>(tab: string, id: I, label: string, parent: string, summary?: string): SectionDef<I> {
  return { id, label, tab, in: parent, ...(summary && { summary }) };
}

/** A section no gate reads — always shown. */
function free<const I extends string>(tab: string, id: I, label: string, summary?: string): SectionDef<I> {
  return { id, label, tab, locked: 'no-gate', ...(summary && { summary }) };
}

const SECTIONS = {
  'arpg-character': [
    g('Overview', 'class-hierarchy', 'Class Hierarchy', 'ACharacter → AARPGCharacterBase tree'),
    g('Overview', 'properties', 'Properties'),
    g('Overview', 'scaling', 'Scaling', 'Level-based stat curves & multipliers'),
    sub('Overview', 'hitbox', 'Hitbox', 'scaling'),
    sub('Overview', 'camera', 'Camera', 'class-hierarchy'),
    g('Input', 'bindings', 'Bindings', 'Action mappings & input contexts'),
    sub('Input', 'keyboard', 'Keyboard', 'bindings'),
    g('Movement', 'states', 'States', '5 states across 3 groups'),
    sub('Movement', 'dodge-trajectories', 'Dodge Trajectories', 'states'),
    free('Playground', 'curve-editor', 'Curve Editor'),
    free('AI Feel', 'optimizer', 'Optimizer'),
    free('Simulator', 'comparison', 'Comparison'),
    free('Simulator', 'balance', 'Balance'),
  ],
  'arpg-animation': [
    g('State Graph', 'states', 'States', '8 state nodes with blend logic'),
    sub('State Graph', 'transitions', 'Transitions', 'states', 'Conditional edges & blend times'),
    sub('State Graph', 'heatmap', 'Heatmap', 'states'),
    g('Combos', 'chain', 'Chain', 'Multi-hit combo graph'),
    sub('Combos', 'montages', 'Montages', 'chain'),
    sub('Combos', 'scrubber', 'Scrubber', 'chain'),
    g('Retargeting', 'skeleton', 'Skeleton'),
    sub('Retargeting', 'trajectories', 'Trajectories', 'skeleton'),
    g('Budget', 'assets', 'Assets'),
    sub('Budget', 'playrate', 'Playrate', 'assets'),
  ],
  'arpg-gas': [
    g('Core', 'architecture', 'Architecture', 'ASC → GA → GE → Attribute pipeline'),
    g('Abilities', 'radar', 'Radar', '14 abilities with cooldown overlays'),
    sub('Abilities', 'cooldowns', 'Cooldowns', 'radar'),
    g('Combos', 'timeline', 'Timeline'),
    g('Effects', 'effects-timeline', 'Timeline', 'Stacking, duration & modifier chains'),
    sub('Effects', 'tags', 'Tags', 'effects-timeline'),
    g('Tags', 'hierarchy', 'Hierarchy', 'Gameplay tag tree & ownership'),
    sub('Tags', 'audit', 'Audit', 'hierarchy'),
    sub('Tags', 'dependencies', 'Dependencies', 'hierarchy'),
  ],
  'arpg-combat': [
    g('Flow', 'lanes', 'Lanes', 'Melee / ranged / AoE action lanes'),
    sub('Flow', 'sequences', 'Sequences', 'lanes'),
    g('Hits', 'traces', 'Traces', 'Sphere & capsule trace configs'),
    sub('Hits', 'stats', 'Stats', 'traces'),
    g('Polish', 'feedback-tuner', 'Feedback Tuner'),
    g('Metrics', 'dps', 'DPS', 'Per-ability DPS breakdown'),
    sub('Metrics', 'effectiveness', 'Effectiveness', 'dps'),
    sub('Metrics', 'sankey', 'Sankey', 'dps'),
    sub('Metrics', 'kpis', 'KPIs', 'dps'),
    g('Attributes', 'attribute-defaults', 'Attribute Defaults', 'DT_AttributeDefaults per archetype'),
    g('Encounter', 'encounter-choreography', 'Choreographer', 'Waves, tension arc & findings; baseline diff per tuning pass'),
  ],
  'arpg-enemy-ai': [
    g('Archetypes', 'cards', 'Cards', '6 enemy archetypes with variants'),
    sub('Archetypes', 'modifiers', 'Modifiers', 'cards'),
    sub('Archetypes', 'radar', 'Radar', 'cards'),
    g('AI Logic', 'behavior-tree', 'Behavior Tree', 'BT nodes with blackboard keys'),
    sub('AI Logic', 'decision-log', 'Decision Log', 'behavior-tree'),
    sub('AI Logic', 'aggro', 'Aggro', 'behavior-tree', 'Threat table & decay rules'),
    g('Encounters', 'formations', 'Formations'),
    sub('Encounters', 'waves', 'Waves', 'formations'),
    sub('Encounters', 'difficulty', 'Difficulty', 'formations'),
  ],
  'arpg-inventory': [
    g('Catalog', 'grid', 'Grid', 'Slot-based inventory layout'),
    sub('Catalog', 'sets', 'Sets', 'grid'),
    sub('Catalog', 'loadout', 'Loadout', 'grid', 'Equipment slots & swap rules'),
    g('Economy', 'sources', 'Sources'),
    sub('Economy', 'scaling', 'Scaling', 'sources'),
    g('Mechanics', 'inv-stats', 'Stats'),
    sub('Mechanics', 'power', 'Power', 'inv-stats'),
    g('Simulation', 'economy-sim', 'Economy Sim', 'Monte Carlo loot economy'),
    g('Simulation', 'loot-filter', 'Loot Filter', 'Show / hide / highlight drop rules'),
  ],
  'arpg-loot': [
    g('Core', 'pipeline', 'Pipeline', 'Roll → rarity → affix → drop flow'),
    sub('Core', 'weights', 'Weights', 'pipeline'),
    sub('Core', 'world-items', 'World Items', 'pipeline'),
    g('Probability', 'treemap', 'Treemap', 'Drop chance hierarchy visualization'),
    sub('Probability', 'histogram', 'Histogram', 'treemap'),
    g('Affix', 'simulator', 'Simulator'),
    sub('Affix', 'co-occurrence', 'Co-occurrence', 'simulator', 'Affix pair frequency matrix'),
    g('Pity', 'timer', 'Timer', 'Bad-luck protection countdown'),
    sub('Pity', 'drought', 'Drought', 'timer'),
    g('Economy', 'beacon', 'Beacon'),
    sub('Economy', 'impact', 'Impact', 'beacon'),
  ],
  'arpg-ui': [
    g('Flow', 'nodes', 'Nodes', 'Screen flow graph nodes'),
    sub('Flow', 'edges', 'Edges', 'nodes'),
    g('Systems', 'breakpoints', 'Breakpoints'),
    sub('Systems', 'bindings', 'Bindings', 'breakpoints'),
    g('UI', 'animations', 'Animations', 'Widget enter/exit transitions'),
    sub('UI', 'z-layers', 'Z-Layers', 'animations'),
    g('A11y', 'categories', 'Categories', 'WCAG compliance categories'),
  ],
  'arpg-progression': [
    g('Curve', 'chart', 'Chart', 'XP / level / power curves'),
    sub('Curve', 'parameters', 'Parameters', 'chart'),
    g('Builds', 'presets', 'Presets'),
    sub('Builds', 'radar', 'Radar', 'presets', 'Build archetype comparison'),
    g('Rewards', 'milestones', 'Milestones', 'Level-gated unlock timeline'),
    sub('Rewards', 'unlocks', 'Unlocks', 'milestones'),
    g('Analysis', 'danger-zones', 'Danger Zones'),
    sub('Analysis', 'dr', 'DR', 'danger-zones'),
  ],
  'arpg-world': [
    g('Map', 'topology', 'Topology', 'Zone connectivity & level ranges'),
    g('Map', 'playtime', 'Playtime'),
    g('Density', 'heatmap', 'Heatmap', 'Entity density per zone tile'),
    sub('POI', 'discovery', 'Discovery', 'fast-travel'),
    g('Travel', 'fast-travel', 'Fast Travel'),
    sub('Travel', 'streaming', 'Streaming', 'fast-travel', 'Level streaming & LOD budgets'),
  ],
  'arpg-save': [
    g('Schema', 'groups', 'Groups', 'Data groups & serialization order'),
    sub('Schema', 'fields', 'Fields', 'groups'),
    g('Slots', 'preview', 'Preview'),
    sub('Slots', 'integrity', 'Integrity', 'preview', 'Checksum & corruption detection'),
    g('Versions', 'history', 'History'),
    sub('Versions', 'migration', 'Migration', 'history', 'Schema upgrade path & compat'),
    g('Size', 'breakdown', 'Breakdown'),
    sub('Size', 'compression', 'Compression', 'breakdown'),
  ],
  'arpg-polish': [
    g('System', 'health', 'Health', 'FPS, memory & GC pressure'),
    // The Debug dashboard is one panel behind the 'health' gate; every other card lives in it.
    sub('System', 'performance', 'Performance', 'health'),
    sub('Network', 'ping', 'Ping', 'health'),
    sub('Network', 'bandwidth', 'Bandwidth', 'health', 'Packet size & replication budget'),
    sub('Console', 'logs', 'Logs', 'health'),
    sub('Crashes', 'predictor', 'Predictor', 'health', 'Crash hotspot heuristics'),
    sub('Crashes', 'regression', 'Regression', 'health'),
  ],
} as const satisfies Partial<Record<SubModuleId, readonly SectionDef[]>>;

/** Every declared section id, across all modules. `VisibleSection` accepts only these. */
export type SectionId = (typeof SECTIONS)[keyof typeof SECTIONS][number]['id'];

/** Widened, module-indexable view of the registry. */
const REGISTRY: Partial<Record<SubModuleId, readonly SectionDef<SectionId>[]>> = SECTIONS;

/** The declared sections of one module, in map order (empty when none). */
export function getSections(moduleId: SubModuleId): readonly SectionDef<SectionId>[] {
  return REGISTRY[moduleId] ?? [];
}

/* ── Derive grouped tabs from the flat list ────────────────────────────────── */

export function getTabGroups(moduleId: SubModuleId): TabGroup[] {
  const flat = getSections(moduleId);
  const order: string[] = [];
  const map = new Map<string, SectionDef<SectionId>[]>();

  for (const sec of flat) {
    if (!map.has(sec.tab)) {
      order.push(sec.tab);
      map.set(sec.tab, []);
    }
    map.get(sec.tab)!.push(sec);
  }

  return order.map((tab) => ({
    tabId: tab.toLowerCase().replace(/\s+/g, '-'),
    tabLabel: tab,
    sections: map.get(tab)!,
  }));
}

/** Return all section IDs for a module, gated or not. */
export function getAllSectionIds(moduleId: SubModuleId): SectionId[] {
  return getSections(moduleId).map((s) => s.id);
}
