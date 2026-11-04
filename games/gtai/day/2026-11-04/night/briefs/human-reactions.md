# Lane: human-reactions (human opponents react to every hit and die by its kind)

**The owner, 00:05:** "Animation on human oponents". Evening (21:25): "We don't have ... oponent reaction on hit."

**You own:**
- the human enemies' and pedestrians' animation and reaction layer:
  - the cop, riot cop and SWAT rigs in combat;
  - pedestrians under fire;
  - hit reactions, stagger, knockdown and get-up;
  - the standard deaths by damage type, corpses and wounded crawl;
- the enemy AI's link to them (`features/combat/ai/**`, the evening's enemy-ai code);
- `data/tables/arena_stations/human-reactions.json`.

The one-shot signature kills of the advanced weapons belong to the `brutality` lane. You provide the base reaction system and the death pipeline they plug into.

## Read first
- `docs/eve/2026-11-03/enemy-ai/REPORT.md`. Its gaps: "Rivet in that pit is still a scripted dummy that fires nails, not the real pistol or claw. The robot thug borrows King's skeleton. ... the pit is not hooked into the arena scene yet."
- `docs/day/2026-11-03/d5-cast/REPORT.md` (the cop rigs), `docs/day/2026-11-03/d5-combat/REPORT.md` (blood: spurts along the round, pools, corpse stains), `docs/day/2026-11-03/collisions/REPORT.md` (the tackle knockdown: slide about 2 m, lie 1.4 s, get up and flee).
- `features/combat/hit_feel/README.md` (the `HitFeel.reaction` hook).

## Work order
1. **Hook the enemy brains into the live game.** Bring the pit into the arena (`--arena`) and the city block (`--arena=city`), with the real Rivet and the real pistol or claw, not the dummy. Cherry-pick or merge from `n-rivet-arsenal` and `n-gunplay` as their work lands.
2. **Hit reactions on the cutout rigs**, driven by the hit direction and the damage class:
   - a flinch: the head and torso snap away from the hit, an arm comes up;
   - a stagger: stepping back along the hit and dropping the weapon arm;
   - a knockdown: falling along the hit, a slide, lying, getting up;
   - a riot shield block: recoil behind the shield;
   - a melee hit: spin or fold;
   - an electro stun: convulsing in place, the hat jolting;
   - burning: panic-running and flailing (the gunplay burn state);
   - a hit while in cover;
   - a wounded state: limping at low hp, if humans ever have more than 1 hit.
3. **Standard deaths by damage type:**
   - bullet: falling back or crumpling according to the direction;
   - melee: folding over;
   - explosion: thrown and tumbling;
   - burn: collapsing charred;
   - electro: stiff fall.

   Plus the corpse lying in a pose that matches its death (blood pools from d5-combat under it). The death pipeline must expose a hook where `brutality` replaces the standard death with a signature kill.
4. **Crowd reactions to gunfire:** pedestrians duck, cover their heads, flee away from the shooter, and trip over bodies. They read in a riot.
5. **The robot thug:** give it its own skeleton (no longer King's), and sparks or oil reactions per hit. Keep this light tonight; humans come first.

**Proof:**
- a clip per reaction family on the real cop rigs in the arena at 32 px/m, plus 64 px/m close-ups;
- a "shoot each cop type from four directions" clip;
- a riot clip with crowd reactions;
- scenarios for determinism and for the reaction timings, with planted faults.

**Branch:** `n-human-reactions`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\n4\human-reactions\`.
