# Lane: rivet-motion (Rivet looks like the concept and moves like a fighter)

**The owner, verbatim:** "Main character does not look like art concept, it is too large and large arms. It has no directional movement, no movement animation, no melee attack if without weapon."

**You own:** Rivet's rig, plan and clips (`features/characters/rivet_plan.gd`, `rig_*.gd` where it concerns Rivet, his parts), the player's locomotion feel (`features/player/**`, shared with nobody tonight), his melee (the claw combo, the charged electroshock, the tackle's animation), sprint and roll, and `data/tables/arena_stations/rivet-motion.json`.
`gunplay` owns guns and the shared hit-feel module (hit-stop, shake, knockback rules); call it for your melee hits, or stub the call and record a REQUEST.

## Read first
- The concept: `C:\Users\kazda\kiro\pof\games\gtai\art-direction\trivet\ref-4-rivet-concept.jpg` (T2) and the target frame `...\directions-v2\d4h2_mock.jpg` (T1).
- `docs/day/2026-11-03/d5-cast/REPORT.md` (the rescale to size_k 1.2 with a hunched guard), `collisions/REPORT.md` (body radius 0.42 m; the 5 m/s tackle line), `slice-play/REPORT.md` (TopDownMover, the input table).
- Registry: `realtime-combat-semantics`, `motion-quality-gating`, `learning-curve-and-teaching-design`.

## Work order
1. **Look like the concept.** Measure Rivet against T2 and against a cop and a ped at 32 and 48 px/m (the d5-cast lane's `rig_footprint.gd`). Today his arms dominate the silhouette. Bring the arm length, hand size and guard width to the concept's proportions; he stays "only slightly larger than a human". Before/after lineup frames beside T2. ASK the owner with 2-3 proportions as frames.
2. **Directional movement (twin-stick):** the legs and hips follow the movement direction, the torso and arms follow the aim, with a turn rate and a limit on the twist between them; strafing, backpedalling and turning read clearly at 32 px/m. Facing must be readable at a glance.
3. **Locomotion animation** on the cutout rig: idle (breathing, servo twitch), walk, run, strafe left/right, backpedal, sprint (a held key above the 5 m/s tackle line, owner call C19), a dodge roll (canon tutorial verb) with recovery frames, start and stop transitions, footfall timing matched to ground speed (no skating). Rig only; no new art unless an ASK says so.
4. **Bare-handed melee:** a 3-hit claw combo on click (windup, active, recovery per hit, a combo window, a finisher with knockback), a charged electroshock (hold to charge, release: stun, chains to metal targets), and the tackle (sprint into a human knocks down; the collisions lane built the sim side). Timing data in a table (frames per phase), so the panel can tune it. Hits land on humans (blood from d5-combat) and robots (sparks).
4b. **Melee weapons: the owner's first set (20:00).** These come on top of the native claw combo. "We don't need to use all in the game, but we should try in next days to experiment with their design and combat feel."
   - The four weapons:
     - **electro baton** (a fast stun stick, chains to metal);
     - **katana** (fast slashes, a long reach and a lunge finisher);
     - **chainsaw** (hold to grind: continuous damage, slow movement, hit-stop on contact);
     - **plasma sword** (an energy blade that deflects bullets on a timed block). Use only this generic name; never a franchise name.
   - Build a melee-weapon framework: weapon rows in `data/tables/weapons.json` (shared with `gunplay`; add your rows in a separate block to avoid conflicts, or in `data/tables/melee_weapons.json`), plus a combo per weapon as timing data.
   - Order: the framework and the electro baton plus the katana tonight. The chainsaw and the plasma sword come in the night run.
   - ASK the owner with a clip of each against the melee dummy line.
5. **Feel numbers:** input-to-motion latency, turn rate, stop distance, combo cadence, measured in the arena course (or your dev scene until the arena lands) and written down.
6. **Arena station** `arena_stations/rivet-motion.json`: the course spawns, a melee dummy line, and every tunable value.

**Proof:** real-time clips (walk, strafe, sprint, roll, combo, shock, tackle) at 32 and 48 px/m; the lineup beside T2; scenario tests (combo timing, roll invulnerability window if you add one, sprint threshold) with planted faults.

**Branch:** `e-motion`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\eve\rivet-motion\`.
