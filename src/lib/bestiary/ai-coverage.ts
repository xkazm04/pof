/**
 * AI behavior coverage (ECW Phase 10-B, idea acca239f lite). Checks an
 * archetype's `btSummary` (Record<string,string>) against the core behaviors a
 * combat enemy needs — aggro, attack, patrol, retreat — and reports which are
 * covered. Pure. Powers the BestiaryAiFacet's coverage view.
 */

export interface AiCoverageFinding {
  behavior: 'aggro' | 'attack' | 'patrol' | 'retreat';
  label: string;
  covered: boolean;
  /** The matched btSummary detail, if covered. */
  detail?: string;
}

const CORE_BEHAVIORS: Array<{ behavior: AiCoverageFinding['behavior']; label: string; keywords: string[] }> = [
  { behavior: 'aggro', label: 'Aggro / detection', keywords: ['aggro', 'aggress', 'detect', 'perceive', 'sight', 'chase'] },
  { behavior: 'attack', label: 'Attack', keywords: ['attack', 'melee', 'ranged', 'strike', 'combo'] },
  { behavior: 'patrol', label: 'Patrol / idle', keywords: ['patrol', 'idle', 'wander', 'waypoint', 'guard'] },
  { behavior: 'retreat', label: 'Retreat / flee', keywords: ['retreat', 'flee', 'reposition', 'kite', 'escape'] },
];

export function lintAiCoverage(btSummary: Record<string, string>): AiCoverageFinding[] {
  const entries = Object.entries(btSummary);
  return CORE_BEHAVIORS.map(({ behavior, label, keywords }) => {
    const match = entries.find(([k, v]) => {
      const text = `${k} ${v}`.toLowerCase();
      return v.trim().length > 0 && keywords.some((kw) => text.includes(kw));
    });
    return match
      ? { behavior, label, covered: true, detail: match[1] }
      : { behavior, label, covered: false };
  });
}
