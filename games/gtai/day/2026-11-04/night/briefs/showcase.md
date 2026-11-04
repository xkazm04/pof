# Lane: showcase (the night's work merged, played together and filmed: the morning's judgeable build)

**Why this lane exists:** the owner judges by visual impression. Five lanes build pieces of one combat experience on separate branches. Your job is to make sure there is **one build, every few hours, where all of it plays together**, and film it.

**You own:**
- the integration branch `n-showcase` and its worktree;
- the showcase scenario: a scripted fight in the arena and in the city block, using all the finished weapons, the reactions and the signature kills;
- the morning reel.

You don't own the other lanes' features. A conflict or defect you find goes to the owning lane as a `REQUEST <n> -> <lane>` in your JOURNAL; read their JOURNALs to see the replies. Fix things yourself only when they are integration glue (a merge resolution, a wiring line, a scene that loads both).

## Work order
1. **Every iteration**, merge the current tips of `n-weapon-art`, `n-rivet-arsenal`, `n-gunplay`, `n-human-reactions` and `n-brutality` into `n-showcase`, in that order:
   - `git merge` from the shared repo; the branches are visible to you;
   - never edit their worktrees;
   - each lane's root `JOURNAL.md` and `REPORT.md` stay theirs: on a conflict keep yours, i.e. the showcase's;
   - the look goldens keep ours and are re-blessed once per merge round, if needed, with a decisions line.

   Then run all four gates under your private APPDATA.
2. **The showcase scenario,** `project/dev/showcase/combat_reel.gd` or the nearest existing place. It's a scripted, deterministic run that drives the real Rivet through:
   - walk and strafe;
   - the claw combo on a cop;
   - the pistol on two cops (their reactions and deaths);
   - the machine pistol on a group;
   - each finished advanced weapon's signature kill;
   - a riot cop with a shield;
   - the robot thug.

   It runs in the arena and in the city block. It grows as the lanes finish things.
3. **Film it** at 32 px/m, plus a 64 px/m close-up pass, 30-90 s, `--fixed-fps`. Each reel goes to `C:\Users\kazda\kiro\gtai-masters\n4\showcase\reel-<HHMM>.mp4`, with a `frames.json` entry naming which lane commits it contains. Look at every reel yourself (extract frames) and write in JOURNAL what looks wrong; send those findings as REQUESTs to the owning lanes. This is the night's quality loop.
4. **The bench** (under the bench lock) on each merged build, in the arena fight and the riot. Write it in JOURNAL with CONTENDED where true.
5. **The final round, 07:45-08:30:** the last merge, the gates, the final reel and an exported exe (`build/export/windows/RTAI.exe` in your worktree, with the release DLL; copy `project/native/bin` from `C:\Users\kazda\kiro\gtai-wt\int-day` if missing) that boots into the arena with every finished weapon available. In REPORT, give the owner the exact command to play the arena and the city block.

**Proof:**
- the reels, in time order, so the night's progress is visible;
- the gates per merge round;
- the bench;
- the exe.

**Branch:** `n-showcase`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\n4\showcase\`.

## Director's checkpoint, 04:00
The final reel (07:45-08:30) is the owner's whole morning impression. Build it as **a directed sequence, not a wave fight**: chapters of 4-8 s, each one weapon or one kill, with a title card or caption (weapon name) burned in the corner, a 48 px/m follow camera, and each signature-kill victim isolated (spawn them singly in the chapter, not in a pit wave). Order: claw combo -> pistol (two cops, reactions, deaths) -> machine pistol on a group -> rocket -> flamethrower -> electro -> molotov -> katana -> chainsaw -> plasma sword deflect -> hand cannon -> plasma rifle -> ray gun -> homing shards -> riot cop with shield -> mini-nuke finale; then 15 s of free fight in the city block at 32 px/m. Target 2-3 min. Start this scenario now (`combat_reel.gd` director mode, deterministic) so 05:00 and 06:30 cuts exist before the final; send each owning lane a REQUEST for whatever reads badly in it.
