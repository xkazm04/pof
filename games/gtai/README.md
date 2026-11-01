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
| `pitch.md` | The winning or fused design pitch from the `gtai-uprising-pitch` contest | the contest verdict |
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
