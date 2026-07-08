# Prompt-hardening loop — agent protocol (TEXT / config)

You harden a TEXT-config step's output. Unlike 2D (bounded by a 1500-char image prompt +
model fidelity), text has **no external ceiling** — quality comes from a more thoughtful,
logically richer produce prompt and deeper authored content. Aim for a genuine ≥90.

## The loop (up to 5 iterations — text is cheap, iterate freely)

1. **Fetch + diagnose the baseline.** Dump the stored config, then judge it. IMPORTANT: use a
   SESSION-UNIQUE `--out` filename (parallel agents clobber shared names) — prefix with your area,
   e.g. `<area>-base.json`, and ALWAYS pass `--entity` (order-safe):
   `npx tsx scripts/get-config.ts --catalog <c> --step "<step>" --entity <e> --out <area>-base.json`
   `npx tsx scripts/judge-one.ts --class text-config --text <area>-base.json --subject "<c> :: <step>"`
   → `{score, dimensions, verdict, findings, fix}`. The rubric scores coherence, specificity,
   voice, completeness, plausibility against AAA systems-design writing (PoE2/D4/Last Epoch).
   Common failure (seen at score 3): a shallow one-field prose blurb where a real Concept Brief
   needs structured fields — mechanical identity, stat/damage hooks, rarity positioning, visual
   spec, player fantasy, references. DEPTH + STRUCTURE is the lever.
2. **Understand the real domain.** Dump all siblings for context:
   `npx tsx scripts/get-config.ts --catalog <c> --out siblings.json` — author content consistent
   with them and cross-referencing real values; the #1 failure is generic filler and invented
   references that contradict siblings. WebSearch the actual game-design topic if it helps (ARPG
   affix budgets, quest stage graphs, vendor pricing) — domain grounding is the whole lever.
3. **Author a markedly richer config.** Not longer for its own sake — deeper: concrete named
   values, real formulas/relationships, edge cases, designer intent, tight consistency with
   siblings, a distinctive confident voice. Every field load-bearing; zero boilerplate.
4. **Judge it** (judge-one --text on your authored JSON). Read the `fix`.
5. **Reflect + iterate** until ≥90 or 5 passes. Keep the best.

## Deliverable

Write `.claude/quality-hardening/text-<area>.json`:
```json
{
  "area": "text-<area>", "class": "text-config", "subject": "<catalog :: step>",
  "baselineScore": <n>, "bestScore": <n>,
  "bestContent": <the winning config object>,
  "promptTechnique": "<the transferable produce-prompt technique that yields this depth>",
  "iterations": [{"n":1,"score":<n>,"note":"<what deepened>"}],
  "applicableCatalogs": ["<steps/catalogs this technique lifts>"]
}
```
Then report bestScore, the biggest lever, and (unlike 2D) whether 90 was reached — for text it
should be, since there is no model-fidelity wall, only prompt depth.

## Rules
- The score comes ONLY from judge-one — never fabricate or self-assess.
- Cross-check siblings; contradicting them is an automatic coherence failure.
- Depth beats length. A tight, specific, consistent config outscores a padded one.
