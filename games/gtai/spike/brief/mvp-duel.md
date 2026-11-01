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
