/**
 * What is NOT the asset — the single list both judge scripts strip before handing a config
 * to the judge.
 *
 * `produceDirection` is the load-bearing addition (2026-07-29): 240 of 816 artifacts carry
 * `{direction, prompt}` whose `prompt` is the full ~5.7k-char produce instruction ("You are a
 * senior systems designer at a AAA action-RPG studio…"). `judge-run.ts` copied every key it
 * did not explicitly strip, so that instruction was graded AS THE ASSET — while the rubric
 * separately penalises leaked engine/prompt tokens. The harness injected the defect it docked
 * for. It stays in the DB (it is real provenance); it never reaches the judge.
 */
export const NON_CONTENT_KEYS: ReadonlySet<string> = new Set([
  'genHistory',      // media candidate history — huge, and the image is judged separately
  'audioAssets',     // served audio refs, not judgeable text
  '_provenance',     // who produced it, not what was produced
  'produceDirection', // the generation prompt itself
]);

/** Copy of `data` without the non-content keys. Pure; never mutates the input. */
export function stripNonContent(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (NON_CONTENT_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}
