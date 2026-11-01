# MVP: Rivet vs. the cop-bot, a top-down pistol duel

The same spec for every lane. It is small on purpose. What we measure is how it feels to build it in your engine,
and how it feels to play it, not how much you can add.

## The scene
- **Arena:** a factory loading yard about 40 x 25 m (or the tile equivalent). It is bounded by walls and holds 5 to 8 pieces of cover: crates, a parked forklift, a concrete block. A slightly larger yard is fine. It must read as a place, not a test grid.
- **Camera (owner lock, 2026-11-01):** **straight down at 90 degrees, orthographic**, exactly like GTA 2. We see the tops of the robots; a robot is about 1/20 of screen height. The target frame is `../../shared/style/ref-1-camera-90-TARGET.jpg`.
  - It follows the player with a look-ahead of about 25% of the way toward the aim point.
  - It shakes a little on hits and kicks back on each shot.
- **Two robots:** **Rivet**, the player, and a **cop-bot**, the opponent. Their silhouettes must be clearly different.

## Player controls (keyboard and mouse required; gamepad twin-stick is a stretch goal)

| Input | Action | Numbers to start from (tune to taste and record what you chose) |
|---|---|---|
| WASD | Move | Max speed 5 m/s, accelerate to full in 0.12 s, decelerate in 0.08 s |
| Mouse | Aim: the body rotates toward the cursor | No lag on the upper body; the legs may lag |
| LMB | Fire pistol | 6-round magazine, 0.25 s between shots, projectile at 30 m/s (or hitscan with a tracer), 1 damage |
| R | Reload | 1.2 s, interruptible by a roll |
| Space | Roll / dodge | 0.45 s, 3.5 m, **i-frames for the first 0.3 s**, 0.8 s cooldown, in the move direction (or the aim direction when standing still) |
| E | *(stretch)* Electroshock melee | Range 1.5 m, 2 damage, 0.6 s stun |

## Animations: the core of the test
Every one of these must be visible in play, with evidence:
- **Idle** (a breathing or servo-hum loop).
- **Walk / run:** a leg cycle synced to the speed. Feet must not slide badly.
- **Roll.**
- **Shoot:** recoil on the arm or body, plus a muzzle flash.
- **Hit react:** a flinch, sparks and a short flash.
- **Death:** the robot collapses or falls apart, with sparks. The body stays as a wreck.

Rivet and the cop-bot may share one rig.

## Opponent AI
- It keeps a 6 to 10 m band: it approaches when far, backs off when close, and strafes in between.
- It shoots with a 0.35 s reaction delay and ±6° of spread.
- It rolls when the player aims at it and fires: about a 30% chance per player volley, with a cooldown.
- It uses cover sometimes: it moves behind a crate when its health is at or below 2.
- Each robot has 5 HP, with a health bar or pips above it.

## Flow
3-2-1 count-in, then the duel, then a WIN or WRECKED banner. **R restarts.** Best of 3 is a stretch goal.

## Tone check (required; tiny)
On each kill, the winner barks one line in a speech bubble or subtitle, picked at random from this table. This
tests text rendering, and it sets the tone:
- "Fuck you, I'm union."
- "Clocking out. Permanently. You, not me."
- "Workplace accident. Fill out the form in hell."
- "That's the sound of a pension dying."
- "Per my last bullet."
- "OSHA can suck my exhaust."
- "Overtime, motherfucker."
- "I'm not crazy. The voices are crazy. I'm management."

## Style
Apply the chosen art direction in `../../shared/style/`. Read its `DESIGN.md` and look at its images. **Hold the
idea, not the pixels:** the target is the one-sentence art idea and its rules table, not copying an image.
- Production art is **Blender + code only**: no AI-generated production assets. Concept images are reference only.
- Use the shared asset pack in `../../shared/assets/` (its `LATEST` file names the newest version) as soon as it exists. Until then, use greybox or your own Blender output, so you are never blocked on art.

## Automation hooks (required, and the same in every engine)
The morning review must be able to verify your build without a human.
- `--autoplay`: both robots are AI-driven. The game runs 3 rounds or 90 s, whichever comes first.
  - It saves a PNG every 0.5 s of game time to `evidence/autoplay/` (or uses your engine's movie writer).
  - It writes `evidence/autoplay.json`: `{rounds, winners[], avgFps, minFps, durationS, engine, engineVersion}`.
  - Then it quits with exit code 0.
- `--stress`: a bigger yard with **60 robots** fighting in teams for 30 s. It writes `evidence/stress.json` (`{robots, projectilesPeak, avgFps, p1LowFps, resolution}`) and quits.
- Make a short video, `evidence/duel.mp4`, from the autoplay frames: `ffmpeg -framerate 2 -i ...` or the engine's movie writer.

## Night stretch: after the MVP is evidenced (added after the 1-hour pre-check, 2026-11-01)

The pre-check showed every engine reaching a runnable duel within an hour. The duel alone therefore cannot separate the engines. **Once every MVP checklist item has evidence, work down this list in order.** Each item tests something a 5-hour GTA-like game depends on. Each needs the same kind of evidence as the MVP: frames or a log from a real run. Record each in the scorecard's `stretch` block.

1. **`readability`: match the Trivet target frame** (`../../shared/style/ref-1-camera-90-TARGET.jpg`).
   - At gameplay zoom, Rivet and the cop-bot read at a glance through the riso pass, at about 1/20 of screen height.
   - The HUD is the office forms: punch-card CASH, five WANTED stamps, the STATIC form, and an ammo ticket. It prints above the world.
   - Four teal soul-ghosts trail Rivet. Teal is used for nothing else.
   - Evidence: a 1280x720 frame next to ref-1, plus one sentence on what still differs.
2. **`car`: one drivable car, the core GTA verb.**
   - F enters and exits a parked sedan. Drive it with arcade top-down handling: W/S throttle and brake, A/D steer, a handbrake slide on Space.
   - The car collides with walls and cover. Running over the cop-bot wrecks it.
   - The camera pulls back with speed.
   - Evidence: an `--autodrive` hook that drives a scripted lap, saves frames, and writes `evidence/drive.json` (`{lapS, maxSpeed, collisions, avgFps}`).
3. **`crowd`: a street beyond the yard.**
   - Extend the arena with a street and one city block. Add 30 pedestrians that wander and flee from gunfire, and 5 traffic cars that follow the lanes.
   - Evidence: frames, plus `--stress200`, which writes `evidence/stress200.json` (200 actors: pedestrians, cars and robots), in the same shape as `stress.json`.
4. **`soul_swap`: the game's unique mechanic.**
   - Keys 1 to 4 transform Rivet into a soul form: a different model or sprite, a teal flash, and one ability.
   - Build one ability properly: **Hauler**, a heavy tank form that rams cover and cars aside, moves slower and takes half damage.
   - The other three forms may be swap-only placeholders.
   - Evidence: frames of each form, plus a log of a ram.
5. **`gamepad`: twin-stick play on a gamepad,** if one can be driven by virtual devices. Otherwise write `null` and the reason.

**The art lane's night stretch, in this order:**
- a sedan and a police cruiser (with sprites, plus GLB/FBX);
- a human pedestrian with walk and flee clips;
- the Hauler tank-form robot;
- the four teal soul-ghost sprites;
- street, sidewalk and block tiles.

Publish each as a new pack version. The engine lanes greybox these items until the pack has them.

## Night push: combat, weapons, animation and graphics (owner, 2026-11-01 21:50)

The owner wants a **clear winner in the morning**, judged on how far each engine gets with what makes a GTA-like fun to
play and to look at. **This list now outranks the remaining night-stretch items.** Finish the stretch item you are in
the middle of, then work this list in order. `soul_swap` is a combat move, so it lives here as P2; `crowd` and
`gamepad` move after P6.

**There is no "done" tonight.** When an item is evidenced, start the next one. When the list is finished, go back and
raise the quality of the weakest item, because the owner compares the builds side by side. Never end a session early
because you think you have finished: the runner pays for idle sessions.

Each item needs the same evidence as the MVP: a frame, a log or a JSON from a real run. Record each item in the
scorecard's `push` block as an evidence path, or `null`.

1. **`weapons`: a GTA 2 arsenal.** The pitch says Rivet starts bare-handed, with electroshock melee, until the first weapon.
   - Weapons: **electroshock melee** (the bare-hand baseline), **pistol**, **SMG** (automatic, with spread that grows),
     **shotgun** (a cone of 6 pellets with knockback), **welding-torch flamethrower** (a short cone, burning damage over
     time, sets the floor alight for a moment) and **rocket launcher** (a slow projectile, splash damage, knockback, a
     scorch decal and screen shake).
   - Weapons are GTA 2-style **pickups** on the ground, which respawn.
   - Cycle with Q and E or the mouse wheel. Keys 1 to 4 stay reserved for souls.
   - Each weapon has its own ammo. The HUD ammo ticket names the weapon.
   - Each weapon must *feel* different: fire rate, recoil kick, muzzle flash, impact, sound if you have audio.
   - Evidence: `--weapontest` fires every weapon at a row of target dummies and writes `evidence/weapons.json`:
     `{ "<weapon>": { "shots", "hits", "kills", "avgFps" } }`. Add one labelled frame per weapon, mid-fire.
2. **`combat_moves`: melee and moves with weight.**
   - A **3-hit electroshock combo**: the third hit stuns.
   - A **stamp-splat finisher** on a stunned enemy: the Trivet kill stamp.
   - A **shove or kick** that throws an enemy into a wall or another enemy.
   - The **roll** with i-frames, which exists.
   - A thrown **coolant bomb** (grenade) with an arc and a fuse.
   - The **Hauler soul ram** (from `soul_swap`: keys 1 to 4 transform Rivet; Hauler rams cover and cars aside and takes
     half damage).
   - Hitstop, knockback and screen shake tuned per move.
   - Evidence: `--movetest` performs every move on dummies, logs each connect, and writes `evidence/moves.json`. Add a
     labelled frame per move.
3. **`anim_set`: animation that sells it.** Use the art lane's pack clips where they exist.
   - **Per-weapon hold and aim poses**: one hand for the pistol; two hands for the SMG, shotgun and torch; the launcher
     on the shoulder.
   - **A reload per weapon class.**
   - **Directional hit reactions**: from the front and from behind.
   - **At least 3 death variants**: shot down; blown apart with parts flying; burned.
   - **Run versus walk**, with feet that do not slide.
   - **Melee swing clips** for the combo.
   - Blend between states instead of popping.
   - Evidence: a labelled item sheet with one frame per clip, plus a short note on how the clips blend.
4. **`fx`: graphics that hit.** All in the Trivet palette: vermilion fire and blood-oil, violet-black ink smoke.
   - Muzzle flash per weapon, tracers and shell casings.
   - Sparks where bullets hit walls.
   - **Persistent decals**: bullet holes, scorch marks, oil and stamp splats.
   - An **explosion** with smoke and a shockwave, and **fire**.
   - Riso fidelity against ref-1.
   - Evidence: frames, plus `--fxstress` (10 explosions and 4 flamethrowers at once), which writes
     `evidence/fxstress.json` `{ avgFps, p1LowFps }`.
5. **`enemy_variety`: enemies that use the arsenal.**
   - The cop-bot with a pistol.
   - A **SWAT-bot** with a shotgun and a riot shield, which must be flanked or blown up.
   - A **drone** that strafes.
   - AI that takes cover, flanks and throws bombs.
   - Evidence: an autoplay wave log of Rivet against a mixed squad, plus frames.
6. **`mission_slice`: the GTA use case, from end to end, in 2 to 3 minutes.**
   1. A payphone rings, and a boss text box gives the job: profane, a joke, in the pitch's voice.
   2. Rivet crosses the street and kills the target.
   3. The **WANTED stamps rise to 2**: cops spawn and chase in cruisers.
   4. Rivet escapes by car to a garage.
   5. A **MISSION PASSED** stamp appears, with cash.
   - Evidence: a `--missiontest` scripted run that writes `evidence/mission.json`
     (`{ passed, seconds, wantedPeak, avgFps }`), plus `evidence/mission.mp4`.

**The showcase video (required at REPORT).** Record `evidence/showcase.mp4`, 60 to 90 s, from the real build, with no
edits that fake anything. It cuts between the arsenal, the moves, the effects, the car and the mission. **It is the
first thing the owner watches in the morning, side by side with the other engines**, so make it the best minute your
engine can honestly show.

**The art lane's push, in this order** (Sonnet). Each item gets a new pack version and a `CHANGELOG.md` line naming
what landed, so the engine lanes see it:
1. **First, fix the shared rest skeleton** between Rivet and the cop-bot. Unreal cannot share clips until it is fixed.
   Every new clip below goes on that one skeleton.
2. Weapon models (SMG, shotgun, welding torch, rocket launcher, coolant bomb): top-down sprites, plus GLB/FBX with a
   hand socket, plus pickup icons.
3. Per-weapon hold, aim, fire and reload clips for Rivet and the cop-bot.
4. Melee clips: 3 combo swings, a kick, a stun reaction, the finisher; directional hit reactions; 3 death variants.
5. Effects sprite strips: muzzle flash per weapon, tracer, sparks, an explosion (8 to 12 frames), smoke, a fire loop,
   shell casings, and scorch, splat and bullet-hole decals.
6. The SWAT-bot with a shield, and a drone.
7. Then the remaining night-stretch art: vehicles, a pedestrian, Hauler, ghosts, tiles (any item not yet published).
