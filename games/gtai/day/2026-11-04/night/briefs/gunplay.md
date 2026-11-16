# Lane: gunplay (shooting design: every shot looks, sounds and lands like its weapon, in the real fight)

**The owner, 00:05:** "Shooting design". Earlier: "Smooth combat on long and melee range would be the core piece of game we need to master." Owner answer gunplay-3 = A: the enemy's locked burst stays tight on the told line.

**You own:**
- weapons and projectiles (`features/combat/weapons/**`) and the weapon table `data/tables/weapons.json`;
- the shared hit-feel module (`features/combat/hit_feel/**`);
- aiming, enemy fire and its tells;
- the real fight code's weapon behaviour (`CombatArena` and the projectile feed);
- `data/tables/arena_stations/gunplay.json`.

## Read first
- `docs/eve/2026-11-03/gunplay/REPORT.md`. Its largest gap: "**The quest/city fight (`CombatArena`) still models direct hits only.** So in the real fight the flamethrower does not burn, the rocket does not splash and the electro gun does not chain."
- `docs/eve/2026-11-03/visual-fixes/` and `C:\Users\kazda\kiro\gtai-masters\eve\visual-fixes\riot-bisect.md`. The riot slowdown comes from d5-combat's `CityBlood` / `BloodFx` redraw, and the fix is yours (REQUEST 2).

## Work order
1. **Port the full behaviours into the real fight:**
   - burn: panic plus damage over time, fire patches;
   - splash with knockdown;
   - the electro chain and the stun;
   - the molotov's arc and fire patch.

   They go into `CombatArena` and the city, so the arena, the city block and the quest all share one model. Determinism and replay stay identical: a scenario with a planted fault.
2. **Shooting design per weapon, in the order pistol, machine pistol, rocket launcher, flamethrower, electro gun, molotov, then the unique five:**
   - fire modes and cadence;
   - the muzzle flash (art from `weapon-art`);
   - the tracer or projectile visual (the rocket with its smoke trail and wobble, flame puffs that grow and fade, electro arcs that jump, the molotov's arc and shadow);
   - shell casings and their scatter;
   - the impact (decals on walls and ground, sparks on metal, dust on concrete);
   - screen feel through hit-feel: hit-stop by class, shake inside its budget, knockback;
   - reload timing;
   - sound hooks.

   Each weapon must feel distinct in a 5 s clip with the sound off. Finish the pistol and the machine pistol in the arena range and in the city block before moving on.
3. **The unique weapons** (`enabled: false` today: plasma rifle, hand cannon, ray gun, homing shard gun, mini-nuke launcher):
   - make them work with their own projectile designs;
   - their kills on humans are the `brutality` lane's signature kills (one shot);
   - agree the kill-event payload (weapon id, hit direction, hit point, damage type) with `brutality` and `human-reactions` in your JOURNAL REQUESTs, early in the night.
4. **Readable enemy fire on the real characters:**
   - the cop's raised-gun pose and the aim line as the tell;
   - the muzzle flash;
   - a slowed, visible round;
   - Rivet's own hit reaction (a flinch, sparks off his plating).
5. **The riot blood cost (REQUEST 2 from visual-fixes):**
   - print `CombatBlood.spent_us/frames` and `BloodFx.draw_us` in the bench JSON;
   - cut the redraw: `settled_redraw_ticks` 6 -> 30, redraw only changed pools, bake settled pools into the ground print;
   - target the morning's numbers of record (riot p99 about 2.4 ms idle; measure under the bench lock and say CONTENDED if it was).
6. Keep the range station and the time-to-kill table current.

**Proof:**
- one clip per finished weapon in the arena range and in the city block at 32 px/m, plus a 64 px/m close-up of the muzzle and the impact;
- a side-by-side clip of the finished weapons;
- determinism scenarios;
- the riot bench before and after.

**Branch:** `n-gunplay`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\n4\gunplay\`.
