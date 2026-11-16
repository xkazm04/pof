/**
 * One rule for stat comparability across the bestiary roster.
 *
 * The roster merges archetypes authored on different stat scales: combat-derived
 * enemies carry HP/Damage/Speed/Range as % of the roster max, hand-authored ones
 * raw HP/ATK/DEF/SPD/INT. An archetype's scale is named by its stat VOCABULARY;
 * a label that appears under more than one vocabulary is not comparable across
 * them (a pooled average or a cross-enemy diff would mix units). ArchetypeCard's
 * average tick and ComparisonPanel's diff badges both read this one definition.
 */

interface HasStatLabels {
  stats: readonly { label: string }[];
}

/** The archetype's stat vocabulary, e.g. `ATK|DEF|HP|INT|SPD`. */
export function statVocabulary(a: HasStatLabels): string {
  return a.stats.map(s => s.label).sort().join('|');
}

/** True when both archetypes are authored on the same stat scale. */
export function sameStatScale(a: HasStatLabels, b: HasStatLabels): boolean {
  return statVocabulary(a) === statVocabulary(b);
}

/** Stat labels carried by more than one vocabulary across the roster. */
export function mixedScaleStatLabels(roster: readonly HasStatLabels[]): ReadonlySet<string> {
  const vocabsByStat = new Map<string, Set<string>>();
  for (const arch of roster) {
    const vocab = statVocabulary(arch);
    for (const stat of arch.stats) {
      if (!vocabsByStat.has(stat.label)) vocabsByStat.set(stat.label, new Set());
      vocabsByStat.get(stat.label)!.add(vocab);
    }
  }
  return new Set(
    [...vocabsByStat.entries()].filter(([, vocabs]) => vocabs.size > 1).map(([label]) => label),
  );
}
