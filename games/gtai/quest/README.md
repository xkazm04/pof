# GTAI quest loop

One quest goes from the owner's goal to a playable package (spark `gta-quest-loop`). `/gta --quest` drives it;
the protocol is in `.claude/skills/gta/SKILL.md` under **Quest mode**. Doctrine: **no quest is filler.**
Every voice line must be funny or move a character or the game forward.

## The loop

1. **brief**: write the council brief for one act and the owner's goal.
2. **run**: two seats (Claude Opus 5.5 and Grok 4.7, high effort) each answer with `[A, B]`. A is the act's
   expected tone; B swerves (different giver, verb and payoff). That makes 4 paths.
3. **assess**: PoF's guards (`@/lib/games/gtai-quest`: story, economy, lines, uniqueness) pre-score each path.
4. **render**: the 4 paths and their verdicts become `fuse.html`, which is published as a claude.ai Artifact.
   The owner ticks what to keep and saves the fusion to the artifact's db (`fusion/current`).
5. The Director composes `games/gtai/quests/<id>/quest.json` (`gtai.quest/1`) from the fusion, runs **check**,
   executes the quest (art, animation, lines, mechanics), runs **judge** on the lines, and plays it in Godot.

## Commands

Run from the repo root.

```bash
node games/gtai/quest/council.mjs brief  --act act1 --goal "<owner goal>" [--constraints "<text>"] [--run <runId>]
node games/gtai/quest/council.mjs run    games/gtai/quests/_council/<runId> [--seats claude,grok] [--ceiling-min 30]
node games/gtai/quest/council.mjs assess games/gtai/quests/_council/<runId>
node games/gtai/quest/council.mjs render games/gtai/quests/_council/<runId>
node games/gtai/quest/council.mjs judge  games/gtai/quests/<id> --author claude|grok
node games/gtai/quest/council.mjs check  games/gtai/quests/<id>        # exit 1 = blocked
```

- `brief`: the default runId is `<YYYYMMDD-HHMM>-<act>`. The brief carries the goal and constraints verbatim,
  the act's arc row and economy band, the cast (with protected canon stripped), the tone and madness sections
  of `pitch.md`, every voice bible verbatim, the ledger of existing quests, the forced-contrast rule and the
  delivery spec. It copies `proposal.schema.json` beside itself so the seats can read it.
- `run`: probes each seat (150 s ceiling, low effort) and skips a seat that fails, with the reason in
  `seats.json`. Live seats run in parallel with the run folder as their working directory; each gets a short
  prompt that points at `BRIEF.md`. The reply is validated against the schema and the brief's rules (8-14
  lines, at least 3 beats, line and speaker references, one new character at most, B differs from A). One
  repair round sends the errors back (`REPAIR.<seat>.md`); still invalid, the reply is kept as
  `proposals.<seat>.invalid.json` with its reasons. Cost and wall time per attempt go into `seats.json`; a
  seat whose CLI reports no cost is recorded as unmeasured, never as zero.
- `assess`: `npx tsx games/gtai/quest/assess-cli.ts <runDir>` writes `verdicts.json` (`{ [pathId]: QuestVerdict }`).
- `check`: `assess-cli.ts --package <questDir>` prints the package verdict, with the judge report when present.
- `judge`: the other family judges each line blind (lines are aliased `L1..Ln`; no seat, no provenance) with
  every speaker's voice bible verbatim: `earned` 1-5, `voiceFit` 1-5 and a note. It writes
  `<questDir>/verdicts/lines.judge.json` (`gtai.lineJudge/1`).

Seats come from the ai-registry's contest machinery (`skills/contest/scripts/lib/participants.mjs` and
`seat.mjs`), imported from `$AI_REGISTRY_DIR`, else `registry.local` in `.ai/manifest.yaml`. Override a seat's
binary with `CONTEST_CLAUDE_BIN` / `CONTEST_GROK_BIN` (an `a|b` value is an argv list), which is also how the
tooling is tested offline with a fake seat.

## Files

| Path | What |
|---|---|
| `games/gtai/quest/council.mjs` | The CLI above |
| `games/gtai/quest/assess-cli.ts` | Guards over a run or a package (`npx tsx`) |
| `games/gtai/quest/render.mjs` | Proposals + verdicts to `fuse.html` |
| `games/gtai/quest/proposal.schema.json` | JSON Schema of `gtai.questProposal/1`, mirroring `src/lib/games/gtai-quest/types.ts` |
| `games/gtai/quest/brief.template.md` | The council brief template |
| `games/gtai/voices/<id>.md` | One voice bible per speaker; the seats, the line generator and the judge read them verbatim |
| `games/gtai/balance/quest-economy.json` | The provisional per-act economy bands |
| `games/gtai/quests/_council/<runId>/` | One council run, committed as the record: `BRIEF.md`, `run.json`, `seats.json`, `proposals.<seat>.json` (or `.invalid.json`), `REPAIR.<seat>.md`, `verdicts.json`, `fuse.html`, `_logs/<seat>/` |
| `games/gtai/quests/<id>/quest.json` | A quest package (`gtai.quest/1`); `verdicts/lines.judge.json` beside it |

Folders under `quests/` that start with `_` are never ledger quests.

## The fuse page

`fuse.html` is self-contained (no external scripts) and works at phone width. Each path card shows the seat
and variant, the story, the characters (existing or new, with design notes), beats, lines with purpose chips,
mechanics with their home, reward and difficulty next to the act band, and the 4 guard chips (pass, block,
unmeasured, each with a glyph). Every element has a checkbox whose key is a `FusionSource.elements` key
(`spine`, `giver`, `beat:<id>`, `line:<id>`, `mechanic:<id>`, `character:<id>`), and each path has a "take
this path's spine" radio. "Save fusion" writes one db doc, `fusion/current`:
`{ runId, sources: FusionSource[], notes, savedAt }`. When the db capability is unavailable, the page says so,
and the JSON is always shown with a copy button. A seat that did not deliver renders as an honest card.

## Voice bibles

Each bible follows the registry technique `voice-bible-per-speaker` (want, hidden thing and refusals, status
move, a checkable rhythm row, vocabulary, profanity register, moves, pressure, registers by listener, arc,
surface marker, a machine-readable "never says" row, illustrative reference lines with an off-voice line, and
how the voice differs from its two closest). All are `[proposal]` drafts: the owner signs off the refusal rows
and replaces the illustrative reference lines with chosen anchors. There is no bible for the fourth soul
(protected canon), and the bibles of Don Fax, Vend-Etta and King keep their protected questions open.
