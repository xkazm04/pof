# Lane: rivet-arsenal (Rivet holds, carries and uses every weapon, in the live game)

**The owner, 00:05:** "Equiped design on player". Evening: "no movement animation, no melee attack if without weapon", "We don't have ... final animation".

**You own:**
- Rivet's rig, poses and clips, including holding weapons;
- his locomotion and melee in the **live game**;
- weapon switching, plus the pickup and drop on his side;
- `data/tables/arena_stations/rivet-arsenal.json`.

Paths: `features/characters/rivet_plan.gd`, the `rig_*.gd` files where they concern Rivet, and `features/player/**`.

## Read first
- `docs/eve/2026-11-03/rivet-motion/REPORT.md`. Its status line: "all four are built and tested in this lane's dev scenes. **None of it is wired into the live game yet.**"
- `docs/eve/2026-11-03/arena/REPORT.md`, `docs/eve/2026-11-03/gunplay/REPORT.md`, and the slice's `TopDownMover` and input table (`docs/day/2026-11-03/slice-play/REPORT.md`).

## Work order
1. **Wire the evening's motion into the live game first:**
   - PlayerMotion: twin-stick hips and torso, stride 1.3, sprint, roll;
   - the MeleeCombo: the claw combo, the charged shock and the tackle.

   The paths are the arena (`--arena`), the city proving block (`--arena=city`) and quest 1. Measure input-to-pixel latency in the live game; it is UNMEASURED today. Clip: Rivet walking, strafing, sprinting, rolling and doing the claw combo on a cop, in the arena, at 32 px/m.
2. **Equipped design: holding each weapon.** Do one grip class at a time, each finished before the next:
   - one-handed (pistol, hand cannon, machine pistol, electro baton);
   - two-handed long (plasma rifle, ray gun, homing shard gun, electro gun, katana, plasma sword);
   - shoulder (rocket launcher, mini-nuke launcher);
   - backpack-and-hose (flamethrower);
   - thrown (molotov: wind-up and release);
   - heavy two-handed (chainsaw).

   Per class:
   - the grip pose of the claw and arm;
   - the idle and walk carry;
   - the aim pose: the arm points where the mouse aims, and the weapon's muzzle point sits on the aim line;
   - the holster or stow when switching.

   Use the parts and the grip and muzzle points from `weapon-art`. Until a weapon's art exists, use a clean placeholder silhouette of the right size and replace it when the art lands (merge or cherry-pick from `n-weapon-art`).
3. **Weapon animations on Rivet:**
   - the recoil per weapon class (a light kick, an SMG shake, a rocket shoulder kick, the flamer sway);
   - a reload per class (magazine out, magazine in, a cock or charge);
   - the switch (stow, then draw);
   - the throw for the molotov;
   - melee swings per melee weapon: the katana slashes and the lunge, the baton strikes, the chainsaw grind loop, the plasma sword slashes and the timed deflect.

   Timing data lives in a table, so the panel can tune it.
4. **Switching and pickups:**
   - a weapon wheel or number keys (decide; record it);
   - walking over a pickup picks it up;
   - drop.

   Coordinate the HUD ammo ticket with gunplay.
5. **Feel numbers measured in the live game:**
   - latency;
   - turn rate;
   - stop distance;
   - the combo cadence;
   - draw time per weapon class.

**Proof:**
- Clips at 32 px/m and close-ups at 64 px/m: Rivet carrying, aiming, firing (with gunplay's shots once merged), reloading and switching, one clip per grip class, plus the melee weapons swinging at a cop in the arena.
- Scenario tests for the combo timing, the draw time and the switch, each with a planted fault.

**Branch:** `n-rivet-arsenal`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\n4\rivet-arsenal\`.
