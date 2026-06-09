/**
 * Plain-language dictionary for the statistical jargon used by the Prompt
 * Evolution engine (A/B testing, clustering, optimization).
 *
 * The Prompt Evolution view is the most jargon-dense screen in the product —
 * it surfaces terms like "epsilon-greedy", "Jaccard", "z-test", "centroid" and
 * "95% confidence" that day-to-day non-technical users cannot interpret. This
 * dictionary powers the inline `StatTerm` tooltips (and the plain-language
 * Simple Mode) so every term has a one-sentence, jargon-free explanation.
 *
 * Keep entries terse — a single sentence for `plain`, an optional one-line
 * `whyItMatters` hook. Mirrors the shape of `blueprint-jargon.ts`.
 */

export interface StatTermEntry {
  /** Canonical display term (e.g. "z-test", "Jaccard similarity"). */
  term: string;
  /** One-line, jargon-free description of what the term means. */
  plain: string;
  /** Optional one-line "why it matters" hook. */
  whyItMatters?: string;
}

// Keyed by a lowercased canonical key so lookups are case-insensitive.
const STAT_TERMS: Record<string, StatTermEntry> = {
  'epsilon-greedy': {
    term: 'epsilon-greedy',
    plain: 'A strategy that mostly uses the wording that is winning so far, but occasionally tries the other one to stay fair.',
    whyItMatters: 'It avoids locking in an early leader before there is enough evidence.',
  },
  jaccard: {
    term: 'Jaccard similarity',
    plain: 'A 0–100% score for how much two prompts share the same words.',
    whyItMatters: 'It is how we group similar prompts together without any AI model.',
  },
  'jaccard similarity': {
    term: 'Jaccard similarity',
    plain: 'A 0–100% score for how much two prompts share the same words.',
    whyItMatters: 'It is how we group similar prompts together without any AI model.',
  },
  'z-test': {
    term: 'z-test',
    plain: 'A standard math check for whether two success rates are really different or just look different by chance.',
    whyItMatters: 'It stops us from declaring a winner on a lucky streak.',
  },
  'z-score': {
    term: 'z-score',
    plain: 'How many "steps" apart the two success rates are — bigger means a more clear-cut difference.',
  },
  centroid: {
    term: 'centroid',
    plain: 'The single most typical prompt that best represents a whole group of similar prompts.',
  },
  confidence: {
    term: 'confidence',
    plain: 'How sure we are that the winner truly is better, and not just luck — higher is more certain.',
    whyItMatters: '95% means there is only a 1-in-20 chance the result is a fluke.',
  },
  'success rate': {
    term: 'success rate',
    plain: 'The share of attempts that finished the task successfully (e.g. 8 of 10 = 80%).',
  },
  trial: {
    term: 'trial',
    plain: 'One run of a prompt — counted as a success or a failure.',
  },
  'agglomerative clustering': {
    term: 'agglomerative clustering',
    plain: 'A grouping method that starts with every prompt alone, then repeatedly merges the two most similar groups.',
  },
  proportion: {
    term: 'proportion',
    plain: 'A fraction of the whole, like "6 out of 8" written as 75%.',
  },
};

/**
 * Return the plain-language entry for a statistics term, or undefined if we
 * have no translation. Case-insensitive — extra surrounding punctuation is not
 * stripped (callers pass clean term keys).
 */
export function lookupStatTerm(term: string): StatTermEntry | undefined {
  return STAT_TERMS[term.toLowerCase()];
}
