import type { SubModuleId } from '@/types/modules';

export interface SectionDef {
  id: string;
  label: string;
  tab: string;
  summary?: string;
}

export interface TabGroup {
  tabId: string;
  tabLabel: string;
  sections: SectionDef[];
}

/* ── Flat section registry per module ──────────────────────────────────────── */

function s(tab: string, id: string, label: string, summary?: string): SectionDef {
  return { id, label, tab, ...(summary && { summary }) };
}

const SECTIONS: Partial<Record<SubModuleId, SectionDef[]>> = {
  'arpg-character': [
    s('Overview', 'class-hierarchy', 'Class Hierarchy', 'ACharacter \u2192 AARPGCharacterBase tree'),
    s('Overview', 'properties', 'Properties'),
    s('Overview', 'scaling', 'Scaling', 'Level-based stat curves & multipliers'),
    s('Overview', 'hitbox', 'Hitbox'),
    s('Overview', 'camera', 'Camera'),
    s('Input', 'bindings', 'Bindings', 'Action mappings & input contexts'),
    s('Input', 'keyboard', 'Keyboard'),
    s('Movement', 'states', 'States', '5 states across 3 groups'),
    s('Movement', 'dodge-trajectories', 'Dodge Trajectories'),
    s('Playground', 'curve-editor', 'Curve Editor'),
    s('AI Feel', 'optimizer', 'Optimizer'),
    s('Simulator', 'comparison', 'Comparison'),
    s('Simulator', 'balance', 'Balance'),
  ],
  'arpg-animation': [
    s('State Graph', 'states', 'States', '8 state nodes with blend logic'),
    s('State Graph', 'transitions', 'Transitions', 'Conditional edges & blend times'),
    s('State Graph', 'heatmap', 'Heatmap'),
    s('Combos', 'chain', 'Chain', 'Multi-hit combo graph'),
    s('Combos', 'montages', 'Montages'),
    s('Combos', 'scrubber', 'Scrubber'),
    s('Retargeting', 'skeleton', 'Skeleton'),
    s('Retargeting', 'trajectories', 'Trajectories'),
    s('Budget', 'assets', 'Assets'),
    s('Budget', 'playrate', 'Playrate'),
  ],
  'arpg-gas': [
    s('Core', 'architecture', 'Architecture', 'ASC \u2192 GA \u2192 GE \u2192 Attribute pipeline'),
    s('Abilities', 'radar', 'Radar', '14 abilities with cooldown overlays'),
    s('Abilities', 'cooldowns', 'Cooldowns'),
    s('Combos', 'timeline', 'Timeline'),
    s('Effects', 'effects-timeline', 'Timeline', 'Stacking, duration & modifier chains'),
    s('Effects', 'tags', 'Tags'),
    s('Tags', 'hierarchy', 'Hierarchy', 'Gameplay tag tree & ownership'),
    s('Tags', 'audit', 'Audit'),
    s('Tags', 'dependencies', 'Dependencies'),
  ],
  'arpg-combat': [
    s('Flow', 'lanes', 'Lanes', 'Melee / ranged / AoE action lanes'),
    s('Flow', 'sequences', 'Sequences'),
    s('Hits', 'traces', 'Traces', 'Sphere & capsule trace configs'),
    s('Hits', 'stats', 'Stats'),
    s('Polish', 'feedback-tuner', 'Feedback Tuner'),
    s('Metrics', 'dps', 'DPS', 'Per-ability DPS breakdown'),
    s('Metrics', 'effectiveness', 'Effectiveness'),
    s('Metrics', 'sankey', 'Sankey'),
    s('Metrics', 'kpis', 'KPIs'),
  ],
  'arpg-enemy-ai': [
    s('Archetypes', 'cards', 'Cards', '6 enemy archetypes with variants'),
    s('Archetypes', 'modifiers', 'Modifiers'),
    s('Archetypes', 'radar', 'Radar'),
    s('AI Logic', 'behavior-tree', 'Behavior Tree', 'BT nodes with blackboard keys'),
    s('AI Logic', 'decision-log', 'Decision Log'),
    s('AI Logic', 'aggro', 'Aggro', 'Threat table & decay rules'),
    s('Encounters', 'formations', 'Formations'),
    s('Encounters', 'waves', 'Waves'),
    s('Encounters', 'difficulty', 'Difficulty'),
  ],
  'arpg-inventory': [
    s('Catalog', 'grid', 'Grid', 'Slot-based inventory layout'),
    s('Catalog', 'sets', 'Sets'),
    s('Catalog', 'loadout', 'Loadout', 'Equipment slots & swap rules'),
    s('Economy', 'sources', 'Sources'),
    s('Economy', 'scaling', 'Scaling'),
    s('Mechanics', 'inv-stats', 'Stats'),
    s('Mechanics', 'power', 'Power'),
  ],
  'arpg-loot': [
    s('Core', 'pipeline', 'Pipeline', 'Roll \u2192 rarity \u2192 affix \u2192 drop flow'),
    s('Core', 'weights', 'Weights'),
    s('Core', 'world-items', 'World Items'),
    s('Probability', 'treemap', 'Treemap', 'Drop chance hierarchy visualization'),
    s('Probability', 'histogram', 'Histogram'),
    s('Affix', 'simulator', 'Simulator'),
    s('Affix', 'co-occurrence', 'Co-occurrence', 'Affix pair frequency matrix'),
    s('Pity', 'timer', 'Timer', 'Bad-luck protection countdown'),
    s('Pity', 'drought', 'Drought'),
    s('Economy', 'beacon', 'Beacon'),
    s('Economy', 'impact', 'Impact'),
  ],
  'arpg-ui': [
    s('Flow', 'nodes', 'Nodes', 'Screen flow graph nodes'),
    s('Flow', 'edges', 'Edges'),
    s('Systems', 'breakpoints', 'Breakpoints'),
    s('Systems', 'bindings', 'Bindings'),
    s('UI', 'animations', 'Animations', 'Widget enter/exit transitions'),
    s('UI', 'z-layers', 'Z-Layers'),
    s('A11y', 'categories', 'Categories', 'WCAG compliance categories'),
  ],
  'arpg-progression': [
    s('Curve', 'chart', 'Chart', 'XP / level / power curves'),
    s('Curve', 'parameters', 'Parameters'),
    s('Builds', 'presets', 'Presets'),
    s('Builds', 'radar', 'Radar', 'Build archetype comparison'),
    s('Rewards', 'milestones', 'Milestones', 'Level-gated unlock timeline'),
    s('Rewards', 'unlocks', 'Unlocks'),
    s('Analysis', 'danger-zones', 'Danger Zones'),
    s('Analysis', 'dr', 'DR'),
  ],
  'arpg-world': [
    s('Map', 'topology', 'Topology', 'Zone connectivity & level ranges'),
    s('Map', 'playtime', 'Playtime'),
    s('Density', 'heatmap', 'Heatmap', 'Entity density per zone tile'),
    s('POI', 'discovery', 'Discovery'),
    s('Travel', 'fast-travel', 'Fast Travel'),
    s('Travel', 'streaming', 'Streaming', 'Level streaming & LOD budgets'),
  ],
  'arpg-save': [
    s('Schema', 'groups', 'Groups', 'Data groups & serialization order'),
    s('Schema', 'fields', 'Fields'),
    s('Slots', 'preview', 'Preview'),
    s('Slots', 'integrity', 'Integrity', 'Checksum & corruption detection'),
    s('Versions', 'history', 'History'),
    s('Versions', 'migration', 'Migration', 'Schema upgrade path & compat'),
    s('Size', 'breakdown', 'Breakdown'),
    s('Size', 'compression', 'Compression'),
  ],
  'arpg-polish': [
    s('System', 'health', 'Health', 'FPS, memory & GC pressure'),
    s('System', 'performance', 'Performance'),
    s('Network', 'ping', 'Ping'),
    s('Network', 'bandwidth', 'Bandwidth', 'Packet size & replication budget'),
    s('Console', 'logs', 'Logs'),
    s('Crashes', 'predictor', 'Predictor', 'Crash hotspot heuristics'),
    s('Crashes', 'regression', 'Regression'),
  ],
};

/* ── Derive grouped tabs from the flat list ────────────────────────────────── */

export function getTabGroups(moduleId: SubModuleId): TabGroup[] {
  const flat = SECTIONS[moduleId];
  if (!flat) return [];

  const order: string[] = [];
  const map = new Map<string, SectionDef[]>();

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

/** Return all section IDs for a module (useful for bulk operations). */
export function getAllSectionIds(moduleId: SubModuleId): string[] {
  return (SECTIONS[moduleId] ?? []).map((s) => s.id);
}
