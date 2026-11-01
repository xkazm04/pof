# MVP: Rivet vs. the cop-bot, a top-down pistol duel

The same spec for every lane. It is small on purpose. What we measure is how it feels to build it in your engine,
and how it feels to play it, not how much you can add.

## The scene
- **Arena:** a factory loading yard about 40 x 25 m (or the tile equivalent). It is bounded by walls and holds 5 to 8 pieces of cover: crates, a parked forklift, a concrete block. A slightly larger yard is fine. It must read as a place, not a test grid.
- **Camera:** top-down in the GTA 2 lineage, at a 60 to 90 degree pitch, near-orthographic or with a slight perspective on the blocks.
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
