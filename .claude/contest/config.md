---
vault: ["C:/Users/kazda/Documents/Obsidian/pof"]
vault_subdir: Contest
arena: .contest/arena
participants: ""
judges: ""
variants: 3
timeout_min: 60
---

# contest overlay - pof

PoF is a Next.js 16 / React 19 / TypeScript / Tailwind 4 app that drives UE5 game development. A
contest here is almost always about a **dense authoring or analysis surface** a designer works in
for hours, not a marketing page.

## Engines

All three CLI families are installed and on PATH on this machine:

- `claude` -> `/c/users/kazda/.local/bin/claude`
- `codex` -> `/c/nvm4w/nodejs/codex`
- `grok` -> `/c/Users/kazda/.grok/bin/grok`

So a clean cross-family panel IS available (Codex + Grok judging Claude-built variants satisfies
"no judge shares a family with every participant, and two judges never share one family with each
other"). The owner may still choose `--review owner` and skip the panel; when they do, say in the
report that no code-reading judge saw the field, because the defects a screenshot hides then go
uncaught unless the staged data carries seeded ones.

## Data

PoF's real material lives in SQLite at `~/.pof/pof.db` (WAL) and in `src/lib/catalog/reference/*`.
Stage by hand per contest and say how. Rules that have already cost something:

- **Read-only SQLite for staging**: `sqlite3 "file:$HOME/.pof/pof.db?mode=ro"`. The DB is shared
  across checkouts and other sessions write to it.
- **A `file://` page cannot `fetch()`.** Always emit data twice: `<name>.json` (pretty, for reading)
  and `<name>.js` (minified, assigning a `window.<GLOBAL>`) so a static page loads it with a plain
  `<script>` tag.
- **Minify the `.js` copy.** A 2 MB page once produced a false `broken` verdict when a headless
  browser and two judge seats loaded it at once.
- **Stage a synthetic fixture at the real target scale whenever the real data is smaller than the
  claim.** PoF's authored content is routinely 10-100x smaller than the scale a surface must
  survive, so a prototype judged only on real data is never judged on scale.
- **Seed deliberate defects into a synthetic fixture and keep the answer key out of the
  workspace instructions** (ship it, but tell participants not to read it). Whether a person using
  the design would *find* a defect is the thing worth measuring.
- **Honesty rules belong in `data/SCHEMA.md`**, one line per claim: which figures are transcribed
  rather than read from source, which are provisional, which coverage is partial, and what
  "unmeasured" must look like versus zero.

## Taste

Judge these harder here than a generic rubric would:

- **Density with legibility.** PoF surfaces carry a lot at once. A design that is clear only because
  it shows little has not solved the problem. Equally, a wall of text is a failure however dense.
- **Honest states.** Unmeasured must not render as zero; stale must not render as fresh; deferred
  must not render as passed. This is the repo's deepest convention - the whole acceptance ladder
  exists to keep "we have not checked" distinct from "it is fine".
- **Colourblind-safe status.** Status is never hue-only; it carries a glyph or a pattern too
  (WCAG 1.4.1). The repo already ships `StatusToken`/`StatusTag` and `ChartLegend` with non-colour
  shape cues.
- **Performance measured, not asserted.** A claim about frames or load time must come with the
  number and how it was taken. "Should be fast" scores as unmeasured.
- **Keyboard operability is not a bonus.** Real zoom/fit buttons, a deliberate focus order, and a
  screen-reader model of the *content*, not the geometry.
- **Reduced motion.** The repo has `useReducedMotion()`/`motionSafe()`; a design whose meaning
  depends on animation has excluded people.
- **Dark surfaces are the house style** (`SchematicPanel` is the signature dark blueprint surface),
  but a light design that is genuinely better wins.

## Skill improvement log

- 2026-10-04 (storymap): first contest in this repo. The brief deliberately named **axes a design may
  differ on** instead of example designs, after the skill's own lesson that listing example bets made
  eight of nine variants build exactly those.
