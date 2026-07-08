# Prompt-hardening loop — agent protocol (2D icons)

## MODEL: Leonardo Lucid Origin (this is the pipeline's real model — validated)
`gen-image.sh` now generates with **Lucid Origin** at 1024² (NOT gpt-image-2). Know its
character: its DEFAULT output is a clean but **flat "emoji / vector-sticker / cel-shaded"**
look — fighting that flatness is your main job. It renders crisp edges + clean silhouettes
WELL (better than gpt-image-2), so those are rarely the problem. The levers that move Lucid
Origin: (1) explicit anti-vector negatives — `NOT a flat vector emoji, NOT a smooth sticker,
NOT a cel-shaded outline, NOT a photographic render`; (2) push HAND-PAINTED / VOLUMETRIC /
textured impasto brushwork; (3) a true CONTINUOUS value range + rich material; (4) a
DISTINCTIVE subject identity, not a generic stock shape. Frames can add cohesion only if
crisp (beveled, specular) — a muddy frame hurts. Validated climb on a Burning icon:
62 (untuned) → 68 (painterly-tuned) with clear levers still open toward 90.


You are an Opus agent hardening the IMAGE-GENERATION PROMPT for one icon family so its output
clears the strict judge. The key is advanced prompt technique, not luck. Work only in the repo
root cwd. **Do NOT edit shared code** — your deliverable is a JSON artifact (below).

## The loop (max 4 generations — Leonardo costs credits, so be deliberate, not brute-force)

1. **Diagnose the baseline.** Judge the baseline image you were given:
   `npx tsx scripts/judge-one.ts --class 2d-art --image "<baseline>" --subject "<subject>"`
   → one-line JSON `{score, dimensions, verdict, findings, fix}`. Read `fix` — it is your target.
2. **Research — MANDATORY, not optional.** Leonardo **Lucid Origin is a genuinely capable
   model**: a low score is almost always a PROMPT-COMPOSITION problem, not a model ceiling.
   Effective diffusion prompt structure is NOT inventable from first principles — you must
   WebSearch it. Search e.g. "Leonardo Lucid Origin prompt guide", "AAA game icon SDXL/Midjourney
   prompt structure camera angle lighting art style", "diffusion negative prompt best practices
   watermark text", "game UI icon prompt token weighting". Extract concrete, non-obvious technique.
   Do NOT conclude "model-capped" unless you have genuinely applied web-searched composition
   technique across the full prompt budget over several iterations.
3. **Write an improved prompt — compose it deliberately.** Lucid Origin allows ~**1400 characters**;
   use them well. Every word earns its place and LEADING tokens carry more weight, so order
   intentionally: subject → **camera angle / framing** → **art style** → material/lighting →
   **quality tags** → a negative tail. Camera-angle, art-style and quality keywords matter as much
   as the subject — name them explicitly (they are the levers, not filler). Apply the research +
   the judge's `fix`. Proven levers from a validated test (Burning icon 40→62 in one pass): kill
   watermarks/text/borders; BOLD STYLIZED emblem not a photoreal render; one strong silhouette
   legible at 40px; a containment/frame shape; deliberate value hierarchy + rim light; PoE2 /
   Diablo IV / Hades II icon language.
4. **Generate:** `bash scripts/gen-image.sh "<your prompt>" "/c/Users/kazda/AppData/Local/Temp/pof-harden/<area>_iN.png"`
   — **use a 300s timeout** (gen+poll+download is ~3-4 min). Success prints `POF_LEO_DONE=<path>`.
5. **Judge** the new image with judge-one (same command, new path).
6. **Reflect + iterate.** Keep the best-scoring prompt. If `score >= 90` stop (success). Else read
   the new `fix`, revise, regenerate — until 90 or 4 generations used. Score should climb; if a
   change lowers it, revert and try a different lever.

## Deliverable (write this file, then report)

Write `.claude/quality-hardening/<area>.json`:
```json
{
  "area": "<area>", "class": "2d-art", "subject": "<subject>",
  "baselineScore": <n>, "bestScore": <n>,
  "bestPrompt": "<the winning image prompt, verbatim>",
  "technique": "<2-4 sentences: the transferable prompt technique that moved the score>",
  "iterations": [{"n":1,"score":<n>,"note":"<what changed>"}],
  "applicableCatalogs": ["<catalogs this technique should lift>"]
}
```

Then report back: bestScore, the biggest lever that worked, and whether 90 is reachable via
prompt alone or looks model-capped (Leonardo ceiling) — that judgment is valuable.

## Rules
- Bound to **6 generations** (raised — composition takes iteration). Keep going while the score
  climbs; stop at ≥90, or when 2 successive well-researched attempts fail to improve the best.
- A "model-capped" verdict is only credible AFTER you have web-searched technique and spent the
  full 1400-char budget with deliberate camera/style/quality keywords — not after naive attempts.
- One representative per family is enough; the technique transfers to `applicableCatalogs`.
- Never weaken the judge or fabricate a score — the score comes only from judge-one.
