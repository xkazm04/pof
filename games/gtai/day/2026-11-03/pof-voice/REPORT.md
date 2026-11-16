# REPORT — lane pof-voice, 2026-11-03

Branch `gtai-voice` (cut from master `417a2275`), tip `83af177b` before this report. 56 files, +3833 / -6.
Evidence root: `G` = `C:\Users\kazda\kiro\gtai-masters\day-d5\pof-voice\`.
I approved nothing, cast nothing and exported nothing to the real game. Those are the owner's decisions.

## What works

| # | Claim | Evidence |
|---|-------|----------|
| 1 | **Data model in PoF SQLite:** voices (`candidate`/`cast`, provider id, origin designed or stock, design prompt, previews), line queue, takes (direction, model/stability/style/speed, file, duration, LUFS, char cost), verdict history. | `src/lib/voice/voice-db.ts`, `types.ts`; tests `src/__tests__/lib/voice/voiceQueue.test.ts` |
| 2 | **Line queue in chronological play order:** quest order comes from the ledger, then `lines[]` order. Text is re-read from the package on change, and an edited text makes the old takes stale. An unchanged ledger is not rewritten. Each line has a class (story or bark, from its `when` tags) and a scene. | fixture of 2 quests whose act order is the reverse of folder order: `voiceQueue.test.ts`, `voiceLineClass.test.ts`; live `G\09-line-class-scene.txt`, `G\17-sync-skip-live.txt` |
| 3 | **The `tts` kind** in `audio-gen` (ElevenLabs `/v1/text-to-speech/{voice_id}`). With `eleven_v3` the direction is sent as inline audio tags. With `multilingual_v2` it only changes voice_settings, because that model would speak the tags aloud. | `src/lib/audio-gen/providers/elevenlabs-speech.ts`; doc findings in JOURNAL "ElevenLabs docs" |
| 4 | **Voice design from the bible** (`/v1/text-to-voice/design` → previews → create on first use). The UI says no imitation or cloning of real people. | live `G\03-design-mertz.txt` (3 Mertz previews, 281 chars) |
| 5 | **Human gate, enforced on the server:** the verdict and cast routes need `Sec-Fetch-Site: same-origin` plus a short-lived HMAC page token, which is minted only for a browser fetch. `voice.mjs` and agents (Node fetch) are refused. `voice.mjs` has no approve, reject or cast command. In the UI, Approve and Cast unlock only after the take or preview has been played through. | `src/__tests__/api/voice-gate.test.ts`; live refusal `G\02-gate-refusal-live.txt` (verdict 403, gate 403, cast 403); `G\16-approve-after-heard-live.txt`, `G\voice-approve-locked-1440.png`, `voice-approve-unlocked-1440.png` |
| 6 | **Verdict rules:** at most one approved take per line; approving another replaces it and keeps the history. Re-casting a character un-proves takes made with the old voice. Approving a take outside the cast voice returns 409. | `voiceQueue.test.ts`, `voice-gate.test.ts` |
| 7 | **Export writes only proven lines** to `project/assets/audio/voice/<quest>/<line>.ogg`. It sets `audio` to the `res://` String the game's `quest_voice.gd` reads, plus `audioTake {takeId, voiceId, model}`. Each file is mastered to the game's `audio_mix.json` target (mono, -18 LUFS / -2 dBTP, speaker treatment). The game gets a byte-identical copy of the as-game master the owner heard. Stale lines are reported and never deleted. | `voiceQueue.test.ts`, `voiceAsGame.test.ts`; Godot probe against a copy of the game: `G\12-export-godot-probe.txt` (the game's own reader loads the take: AudioStreamOggVorbis, 10.72 s); mastering `G\18-export-mastering-probe.txt` |
| 8 | **The owner hears takes as the game plays them:** game voice level plus device filter is the default, the provider original is one click away, and audio supports byte ranges (seek, correct Ogg length). | `voiceAudioResponse.test.ts`; live `G\19-as-game-live.txt`; `G\voice-take-as-game-1440.png` / `-390.png`, `voice-take-as-delivered-*.png` |
| 9 | **Oracles next to the gate:** a local Whisper read-back gives a word error rate per take (flagged over 15 %), and a silence screen flags any internal pause over 1.5 s. Flagged lines come first. | `voiceReadback.test.ts`; live `G\13-readback-live.txt`, `G\14-generate-readback-live.txt`, `G\voice-readback-take-*.png` |
| 10 | **Voice room UI** in the GTAI game home (`/layout?g=gtai&c=spellbook&v=game&room=voice`). It has three views: Queue (grouped by quest, with state and progress), Line (bible, scene, takes, verdict with note, "generate k takes") and Cast. It re-reads every 5 s while visible (`useSuspendableEffect`), and "Next to judge" jumps to the next line waiting for a verdict. | `src/__tests__/components/layout-lab/voiceRoom.test.tsx`; `G\voice-queue-1440.png`, `voice-queue-390.png`, `voice-line-mertz-1440/390.png`, `voice-line-rivet-1440/390.png`, `voice-cast-1440/390.png`, `voice-next-to-judge-1440.png`, `G\11-poll-next-live.txt`; `G\frames.json` (22 frames, 22/22 files exist, checked 17:30) |
| 11 | **Headless `games/gtai/voice/voice.mjs`:** `status`, `next`, `line`, `takes`, `design`, `stock [--casting]`, `verdicts --since`, `readback`, `export`. | live `G\01-status-before.txt`, `05-takes.txt`, `06-status-after.txt`, `08-stock-from-casting.txt`, `10-verdict-feed-live.txt` |
| 12 | **Real end-to-end run on `:3012`** (lane DB `G\e2e-db\pof.db`, not the owner's DB). Designed Mertz (3 previews), stocked Rivet (Liam, from the audio lane's casting.json), and generated 3 takes each of `mertz-inventory` and `rivet-my-hands` with different directions, plus 1 more take of `guard-who-do-we-call` to test the read-back. Stopped there with 0 verdicts and 0 cast. | `G\03`–`G\06`, `G\07-subscription-after.txt` |
| 13 | **`/gta --voice` mode** (table row plus a "Voice mode" section; Quest mode unchanged) and the docs section. | `.claude/skills/gta/SKILL.md`, `docs/architecture/game-workspaces.md` |
| 14 | **Gates:** `npm run validate` exit 0 on `83af177b` (15105 tests, lint 0 errors). The lane's tests re-run at 17:30: 7 files / 46 tests passed. | `G\validate-iter48-tip.log`; `G\report-tests-1735.txt` |
| 15 | **Merge pre-check** against master and `gtai-control-room`. Conflicts appear only in `.claude/fleet-memory.md` (keep both sides) and `gameHome.tsx` (keep both imports and both hooks). The union typechecks and its tests pass. | `G\merge-check-iter54.txt` |

**Provider spend:** 1438 characters logged out of the 15,000 lane budget. The account counter moved less than that (74416 → 74845, see `G\07`). Every call is logged in JOURNAL.

## What does not work / open

- **Nothing is proven yet.** 0 / 23 lines in collect-call. That is correct: proving a line takes the owner's click.
- The owner's `~/.pof/pof.db` starts empty. The e2e takes, the 3 Mertz previews and Rivet are only in the lane DB. The designed Mertz voice does exist on the ElevenLabs account. On `:3001` the owner re-runs `voice.mjs stock --casting` and `design`, or the Director points the room at the lane DB.
- **Export has not run against the real game,** as the brief required. It was proven against a copy of the game and by unit tests only.
- **Gate limit:** a process that forges browser headers can pass. The gate stops the agent path and accidents, not an adversary. This is written in `gate.ts` and the docs.
- **Open registry deviations** (details in JOURNAL):
  - bark variant pools conflict with "one approved take per line" (needs a Director call);
  - no authenticated "who" on a verdict;
  - no per-line duration budget (the game would need to declare one);
  - no riot-peak bed listening (measured; it matters only for dialogue inside a riot).
- Pre-existing UI problems, not fixed here:
  - the shared `ui/TabBar` labels are invisible on the light lab theme (scoped locally in the room);
  - the lab shell header overflows at 390 px;
  - a cold `?v=game` link without `c=` lands on Catalogs.

## Blockers (and for how long)

- **The lane dev server would not start.** Turbopack rejects the junctioned `node_modules` without `POF_TURBOPACK_ROOT=C:/Users/kazda/kiro`. This cost about 10 min at the start and 16:39–16:43. Fixed by always setting the variable.
- No other blocks. Nothing was built after the 17:00 freeze.

## Next steps

1. **Director, at the 18:00 merge:** keep both sides of `.claude/fleet-memory.md` and `gameHome.tsx` (`G\merge-check-iter54.txt`).
2. **Owner, on `:3001`:** open the Voice room, cast Mertz from the previews and judge the takes, then run the `/gta --voice` loop.
3. **Audio lane** has two requests:
   - move `process.py`'s Patch payphone special case into `audio_mix.json` `voice_treatments.patch`;
   - make `voice_lengths.py` read the `audio` path of exported lines.
4. **Later:**
   - bark variant pools (after the Director decides);
   - fix the shared TabBar contrast on the lab theme;
   - a per-line duration budget once the game declares one.
