/**
 * Plain-language glossary for the Evaluator module's tabs.
 *
 * The evaluator leans on insider metaphors (Nexus, Constellation, Oracle,
 * Archeologist, Wrapped, …) that mean nothing to a non-technical user. This is
 * the single source of truth that pairs every cryptic chip with:
 *   - `label`       — the short name shown on the chip (kept as-is, for character)
 *   - `plain`       — a plain-language alias ("Module map", "Asset vs code consistency")
 *   - `description` — one non-technical sentence on what the tab actually does
 *
 * The chip label, its muted subtitle line, and its accessible tooltip all read
 * from here so the three never drift. Section blurbs power the first-run coachmark.
 */

/** Union of every Evaluator tab id. Single-sourced here so {@link EVALUATOR_TAB_INFO}
 *  is enforced complete by `Record<EvaluatorTabId, …>`. */
export type EvaluatorTabId =
  | 'overview'
  | 'nexus'
  | 'constellation'
  | 'features'
  | 'conflicts'
  | 'quality'
  | 'dependencies'
  | 'analytics'
  | 'spend'
  | 'scanner'
  | 'deep-eval'
  | 'gdd'
  | 'compliance'
  | 'asset-scout'
  | 'patterns'
  | 'economy'
  | 'perf'
  | 'combat'
  | 'i18n'
  | 'crashes'
  | 'health'
  | 'build-health'
  | 'pp-studio'
  | 'evolution'
  | 'digest'
  | 'wrapped'
  | 'roadmap'
  | 'workflows'
  | 'archeologist'
  | 'oracle';

export interface EvaluatorTabInfo {
  /** Short chip label as shown in the tab bar (kept for character). */
  label: string;
  /** Plain-language alias for the (sometimes cryptic) chip name. */
  plain: string;
  /** One non-technical sentence describing what the tab does. */
  description: string;
}

export const EVALUATOR_TAB_INFO: Record<EvaluatorTabId, EvaluatorTabInfo> = {
  // ── Analysis ──
  overview: {
    label: 'Overview',
    plain: 'Project summary',
    description: 'A one-glance summary of your project’s health and what to do next.',
  },
  nexus: {
    label: 'Nexus',
    plain: 'Module map',
    description: 'How your game’s modules connect and depend on one another.',
  },
  constellation: {
    label: 'Constellation',
    plain: 'Feature tech-tree',
    description: 'One module’s features as a tech-tree, showing what’s done and what’s blocked.',
  },
  features: {
    label: 'Features',
    plain: 'Feature status grid',
    description: 'Every feature across all modules and how complete each one is.',
  },
  conflicts: {
    label: 'Conflicts',
    plain: 'Overlapping work',
    description: 'Spots where two modules build the same thing and may clash.',
  },
  dependencies: {
    label: 'Dependencies',
    plain: 'Dependency graph',
    description: 'Which modules rely on which others, drawn as a graph.',
  },
  analytics: {
    label: 'Analytics',
    plain: 'Usage analytics',
    description: 'Stats on your work sessions and how the tool is being used.',
  },
  spend: {
    label: 'Spend',
    plain: 'Cost & token spend',
    description: 'How much each CLI run costs in dollars and tokens, with daily/monthly budget limits.',
  },

  // ── Quality ──
  quality: {
    label: 'Quality',
    plain: 'Quality scoreboard',
    description: 'Aggregated code-quality scores for every module.',
  },
  scanner: {
    label: 'Scanner',
    plain: 'Batch code scan',
    description: 'Sweep the project to collect issues, remembered errors, and health checks.',
  },
  compliance: {
    label: 'Compliance',
    plain: 'Design-doc compliance',
    description: 'How closely the build matches your game design document.',
  },
  health: {
    label: 'Health',
    plain: 'Holistic health',
    description: 'Quality, crashes, and performance combined into one health score.',
  },
  'build-health': {
    label: 'Build Health',
    plain: 'Build status',
    description: 'Whether the project compiles and packages cleanly.',
  },
  archeologist: {
    label: 'Archeologist',
    plain: 'Tech-debt digger',
    description: 'Digs through your code for anti-patterns, risky churn, and refactoring debt.',
  },
  oracle: {
    label: 'Oracle',
    plain: 'Asset vs code consistency',
    description: 'Checks that your assets and the code referencing them stay in sync — no orphaned or missing references.',
  },

  // ── Simulation ──
  economy: {
    label: 'Economy',
    plain: 'Economy simulator',
    description: 'Model and balance your in-game economy — drops, prices, and rewards.',
  },
  combat: {
    label: 'Combat',
    plain: 'Combat simulator',
    description: 'Simulate fights to balance damage, health, and difficulty.',
  },
  perf: {
    label: 'Perf',
    plain: 'Performance profiler',
    description: 'Find performance bottlenecks and frame-rate risks.',
  },

  // ── Pipeline ──
  gdd: {
    label: 'GDD',
    plain: 'Game design doc',
    description: 'Your living game design document.',
  },
  'asset-scout': {
    label: 'Asset Scout',
    plain: 'Asset finder',
    description: 'Finds and recommends ready-made assets for what you’re building.',
  },
  patterns: {
    label: 'Patterns',
    plain: 'Pattern library',
    description: 'Reusable code and design patterns mined from your project.',
  },
  i18n: {
    label: 'i18n',
    plain: 'Localization',
    description: 'Translate and localize your game’s text for other languages.',
  },
  crashes: {
    label: 'Crashes',
    plain: 'Crash analyzer',
    description: 'Explains crash reports in plain English and suggests fixes.',
  },
  'pp-studio': {
    label: 'PP Studio',
    plain: 'Post-process studio',
    description: 'Tune the camera’s post-processing look — color, bloom, exposure.',
  },
  workflows: {
    label: 'Workflows',
    plain: 'Workflow orchestrator',
    description: 'Chain multi-step build tasks into automated workflows.',
  },
  roadmap: {
    label: 'Roadmap',
    plain: 'Calendar roadmap',
    description: 'Your planned work laid out on a calendar.',
  },

  // ── Intelligence ──
  evolution: {
    label: 'Evolution',
    plain: 'Prompt evolution',
    description: 'Tracks how your AI prompts improve over time.',
  },
  digest: {
    label: 'Digest',
    plain: 'Weekly digest',
    description: 'A weekly recap of what changed and what’s worth noting.',
  },
  wrapped: {
    label: 'Wrapped',
    plain: 'Project wrapped',
    description: 'A year-in-review-style recap of your project’s journey.',
  },
  'deep-eval': {
    label: 'Deep Eval',
    plain: 'In-depth code review',
    description: 'A thorough multi-pass quality review with findings and suggested fixes.',
  },
};

/** Convenience: plain label only (falls back to the chip label if unknown). */
export function plainTabLabel(id: EvaluatorTabId): string {
  return EVALUATOR_TAB_INFO[id]?.plain ?? EVALUATOR_TAB_INFO[id]?.label ?? id;
}

export interface EvaluatorSectionInfo {
  id: string;
  /** Section heading as printed in the tab-bar dividers. */
  label: string;
  /** One plain-language sentence on what the whole section is for. */
  blurb: string;
}

/** The five tab-bar sections, in display order, each with a plain-language blurb.
 *  Powers the dismissible first-run coachmark. */
export const EVALUATOR_SECTIONS: EvaluatorSectionInfo[] = [
  {
    id: 'analysis',
    label: 'Analysis',
    blurb: 'See the big picture — how modules connect, what’s done, and what to do next.',
  },
  {
    id: 'quality',
    label: 'Quality',
    blurb: 'Score code quality, scan for issues, and track build & project health.',
  },
  {
    id: 'simulation',
    label: 'Simulation',
    blurb: 'Model your economy, combat, and performance before shipping.',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    blurb: 'Author content — design docs, assets, localization, look, and workflows.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    blurb: 'Long-term insights — prompt evolution and weekly / seasonal recaps.',
  },
];
