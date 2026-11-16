# Lane: enemy-ai (enemies that move, read and fight well)

**Mission:** enemies worth fighting at range and in melee: they move with intent, telegraph their attacks, use cover, flank, panic and regroup, and are animated so their state reads at 32 px/m.

**You own:** enemy brains and movement (`features/police/**`, the combat AI in `features/combat/` such as `boss_brain.gd` and fighters: put new code in `features/combat/ai/**`), the enemy archetype table `data/tables/enemies.json` (create), enemy animations on the cutout rig (run, aim, shoot, hit, stagger, knocked down, die, get up) for humans and robots, the wave spawner, and `data/tables/arena_stations/enemy-ai.json`.

## Read first
- `docs/day/2026-11-03/collisions/REPORT.md` (bodies, knockdowns), `d5-combat`, `vehicles` (cruisers already drive), the crowd's panic and flee modes, how cops behave in the riot today.
- Registry: `agent-behaviour-authoring`, `encounter-balance-simulation`, `difficulty-design-and-adaptation`, `combat-pacing-and-dramatic-arc`.

## Work order
1. **Archetypes** (data): patrol cop (pistol), riot cop (shield + baton, melee), SWAT (rifle, uses cover, flanks), a robot thug (melee, heavy, sparks not blood), and a robot gunner. Each: body class, health, speed, weapon, aggression, accuracy curve by range, reaction time.
2. **Behaviour:** perception (sight cone, hearing shots), states (patrol, alert, engage, take cover, flank, suppress, retreat, panic, down), a squad layer (no more than N shooting at once, so the player is not shredded from every side; others reposition). Deterministic on the tick, RNG from the registry.
3. **Movement:** steering around bodies and cover, no jitter, readable turns, strafing while shooting, stopping to aim. Robots and bosses stay "blocked" against Rivet's tackle (owner: designed later).
4. **Telegraphs:** a visible tell before every attack (aim line or muzzle glint for guns, a windup pose for melee), timed so a player who watches can dodge. Coordinate the gun tell with `gunplay`.
5. **Animations:** the states above on the cutout rig, readable at 32 px/m, with hit reactions that call `gunplay`'s hit-feel module.
6. **Waves** in the arena pit: a spawner with wave definitions (data) and an ASK to the owner on the first difficulty curve (a clip of wave 1-3 and the damage taken).

**Proof:** clips of each archetype fighting Rivet in the pit (and one in the city block), a squad flanking, telegraphs dodged; numbers (damage taken per wave, time to clear); scenario tests (determinism, a planted fault per behaviour).

**Branch:** `e-enemy`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\eve\enemy-ai\`.
