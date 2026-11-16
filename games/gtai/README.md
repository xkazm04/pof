# GTAI: Uprising: design truth

This folder holds the **versioned design truth** for game `gtai` (see
[`docs/architecture/game-workspaces.md`](../../docs/architecture/game-workspaces.md)). GTAI: Uprising is a
top-down open-city crime sandbox in the GTA 2 mould. A rogue factory robot takes hitman contracts from
underground robot bosses, steals and drives vehicles, causes mayhem and answers to police wanted heat.
The target is about 5 hours of play, shipped on Steam.

The SQLite DB (`~/.pof/pof.db`) is a working copy. The files here are the record. When the DB is lost,
it is re-seeded from these files idempotently.

| File | What it holds | Written by |
|------|---------------|------------|
| `pitch.md` | Baseline direction: the owner's fusion of the `gtai-uprising-pitch` contest (A/2 spine, D/2 madness, B/3 and D/1 voice) | the contest verdict + owner notes |
| `STATE.md` | The campaign's living state: phase, next steps, decisions, PoF gaps found by the game, session log | every `/gta` session |
| `art-direction/` | Three 2D/2.5D art directions with design stances, 9 gameplay concepts and 3 Rivet concepts (`index.html` compares them); `LEONARDO-PROMPTS.md` holds the prompts plus camera-pitch tests | concept round, 2026-11-01 |
| `spike/` | Overnight engine spike: UE 5.8 vs Godot 4 vs Unity 6 on one pistol-duel MVP (`PLAN.md`, `spike.mjs`) | engine decision |
| `canon.json` | Accepted canon rules, profile `gtai` | the pitch intake, on operator accept |
| `entities.json` | Accepted starter entities (ids prefixed `gtai-`, authored provenance) | the pitch intake, on operator accept |
| campaign storygraph (later) | The mission and decision graph (`pof.storygraph/1`) | the story-decision-graph work stream |

Nothing is written here without an operator decision. The intake proposes rules and entities, and only
an accept writes them.

The game's code definition (pipeline manifest, engine binding, canon profile) lives in
`src/lib/games/gtai.ts` and `src/lib/catalog/canon/profiles.ts`. The engine is undecided until the contest
verdict. Until then every UE-bound acceptance for a gtai entity is `deferred` with
"no engine project bound for game gtai". When the engine project exists, this folder moves to that
project's repo or is mirrored there.

To continue the campaign in a new session, run **`/gta`** (`.claude/skills/gta/SKILL.md`). It reads `STATE.md`, agrees the day's or night's plan with the owner, and writes the state back.
