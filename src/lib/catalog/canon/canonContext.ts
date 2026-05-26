import type { ProjectRule, RuleCategory } from './types';

/** Rules in scope for a catalog (global + that catalogId), optionally filtered by category. */
export function selectRules(rules: ProjectRule[], catalogId?: string, categories?: RuleCategory[]): ProjectRule[] {
  return rules.filter(
    (r) => (r.scope === 'global' || (!!catalogId && r.scope === catalogId)) && (!categories || categories.includes(r.category)),
  );
}

/** Render the in-scope canon into a prompt context block. Empty string when none apply. */
export function canonContextFor(rules: ProjectRule[], catalogId?: string, categories?: RuleCategory[]): string {
  const sel = selectRules(rules, catalogId, categories);
  if (!sel.length) return '';
  const byCat: Record<string, ProjectRule[]> = {};
  for (const r of sel) (byCat[r.category] ??= []).push(r);
  const blocks = Object.entries(byCat).map(
    ([cat, rs]) => `## ${cat.toUpperCase()} CANON\n${rs.map((r) => `- ${r.title}: ${r.body}${r.refs?.length ? ` (refs: ${r.refs.join(', ')})` : ''}`).join('\n')}`,
  );
  return `# PROJECT CANON (follow these)\n${blocks.join('\n\n')}`;
}
