# GTAI night: scoreboard

Generated 11/3/2026, 6:46:06 PM from C:\Users\kazda\kiro\gtai-day-pof-voice\night.json. Total CLI cost $33.10.

| lane | iterations | cost (API key) | last | report | evidence |
|---|---|---|---|---|---|
| pof-voice | 57 | $33.10 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/pof-wt/voice/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/pof-wt/voice/evidence) |

## pof-voice

cwd `C:\Users\kazda\kiro\pof-wt\voice`

Last journal line: NEXT: Director merge at 18:00 (keep-both on fleet-memory + gameHome.tsx per merge-check-iter54.txt); owner casts Mertz and judges takes on :3001; audio-lane requests (voice_treatments.patch, voice_lengths.py reads exported audio paths); open deviations as in REPORT.md.

```
6442d70a docs(voice): lane pof-voice REPORT - what works with evidence, open items, blockers, next steps
83af177b feat(voice): export ships a copy of the as-game master the owner heard (byte-identical to what was approved)
6fe2ca2e feat(voice): cast previews play at the game's voice level too - casting candidates compare at matched loudness
da359aec chore(fleet-memory): gtai-voice mastering decision + delivery
7c22af10 chore(voice): one doc comment on ExportReport.written
3a47ee5e docs(gta): Voice mode - as-game listening, flagged lines first, export mastering lines to relay
c6f2e218 fix(voice): audio route honours byte ranges (seek + true Ogg length: a 12.0 s take showed 0:10); take meta says delivered LUFS
b77b238d feat(voice): the room plays a take as the game plays it (export master: game level + device treatment), provider original one click away
a13b58f3 feat(voice): per-speaker voice treatment (payphone band-limit) from audio_mix.json voice_treatments, tone filters only
afdfe0ce feat(voice): export masters every take to the game's voice target (audio_mix.json loudness, mono, loudnorm) and reports each line's level
```
