# Lane: gunplay (smooth combat at range, and the hit feel everyone shares)

**Owner decision:** twin-stick with visible bullets. The mouse aims freely while Rivet strafes; bullets travel, have tracers and can be dodged; a light aim assist on the pad only. Enemy shots must be readable and dodgeable. "Smooth combat on long and melee range would be the core piece of game we need to master."

**You own:** weapons and projectiles (`features/combat/` weapon and projectile code; split new code into `features/combat/weapons/**`), the weapon table `data/tables/weapons.json` (create or extend), the shared hit-feel module (`features/combat/hit_feel/**`: hit-stop, camera shake, knockback, hit flash, damage response) that melee and powers also call, aiming (the reticle, the aim line, pad aim assist), and `data/tables/arena_stations/gunplay.json`.

## Read first
- What exists: the combat feature, the CitySim projectile feed, `d5-combat`'s blood and kill beat (`docs/day/2026-11-03/d5-combat/REPORT.md`; its REQUEST 3: hit-stop 6 -> 8 ticks under a beat mode), the audio event table (shots, hits).
- Canon weapons (pitch §7): start bare-handed, a cop's pistol ends the tutorial, then pickups. Proposed arsenal: pistol, SMG, shotgun, the nail gun "Gloria", assault rifle, a welding-torch flamethrower, rocket launcher, electro-net, coolant bombs.
- Registry: `realtime-combat-semantics`, `combat-pacing-and-dramatic-arc`, `encounter-balance-simulation`.

## Work order
1. **The shooting model:** projectiles in the sim (deterministic, 60 Hz, parity kept if they live in the native sim), speed per weapon, tracers readable at 32 px/m, spread and recoil (bloom that recovers), fire modes, reload, ammo. Bullets collide with bodies (radii from `bodies.json`), cover and buildings.
2. **The weapon table: the owner's first weapon set (20:00, binding).** "We don't need to use all in the game, but we should try in next days to experiment with their design and combat feel." Use these working names in data and code. **Never use the franchise or brand names the owner used as references** in prompts, assets, code or game text.
   - **Core ranged, tonight, in this order:**
     - **pistol**;
     - **machine pistol** (a compact full-auto SMG);
     - **flamethrower** (a short-range cone; burning targets panic and keep taking damage; fire on the ground lingers briefly);
     - **rocket launcher** (a slow visible rocket, splash damage, knockdown, wrecks cars through the vehicles lane's damage states);
     - **electro gun** (an arcing bolt that chains between metal targets and stuns humans);
     - **molotov** (thrown in an arc; leaves a fire patch).
   - **Unique ranged, for single quests, prototyped later** (the night run and the next days; do not start them before the core six feel good):
     - plasma rifle;
     - hand cannon (a heavy single-shot pistol with big knockback);
     - ray gun;
     - homing shard gun (slow crystal needles that home in and burst after a delay);
     - mini-nuke launcher (a lobbed nuclear shell, a huge blast and a screen-filling flash under the reduced-motion budget).
   - The canon nail gun "Gloria" (the gunsmith's gift) keeps its row.
   - Every number goes in the table and in the tuning panel. ASK the owner with a range clip of the core six side by side, plus their time-to-kill at 5, 10, 20 and 35 m.
   - Melee weapons (electro baton, chainsaw, katana, plasma sword) belong to `rivet-motion`. Your hit-feel module serves them too.
3. **Aim:** a reticle and an aim line that make range readable; Rivet's arms point where he aims (coordinate with `rivet-motion` via REQUEST); pad aim assist (a light magnetism cone, off for the mouse).
4. **Hit feel (shared):** hit-stop by damage class, camera shake with a budget and the reduced-motion flag, knockback and stagger, a hit flash on the victim, the enemy's hit reaction hook (`enemy-ai` plays the animation). Write the module's API in its README so melee and powers use the same one.
5. **Readable enemy fire:** enemy bullets slower than the player's and visible, a muzzle flash and a short tell before a shot, so a player can dodge with a strafe or a roll. Coordinate the tell with `enemy-ai`.
6. **Range station** `arena_stations/gunplay.json`: the range lanes, targets, and every weapon value.

**Proof:** range clips per weapon at 32 and 48 px/m; time-to-kill and hit-rate numbers at each range from the arena telemetry; a dodge clip (strafing through an enemy volley); scenario tests (projectile determinism, replay identical, a planted fault).

**Branch:** `e-gunplay`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\eve\gunplay\`.
