# Lane: weapon-art (every weapon designed, drawn and cut for the rig)

**The owner, 00:05:** "Design, Equiped design on player, ..." Evening (21:25): "We don't have weapon design."

**You own:** the weapons' art and design language. That means the design sheets, the held parts for the cutout rig, the pickup sprites, the HUD icons, the muzzle and projectile art (muzzle flash frames, rocket, flame puffs, electro arcs, the molotov bottle, shells, casings), and the art registry rows. Paths: `project/features/combat/weapons/art/**` (or the nearest existing art folder), the AI provenance lines, and `data/tables/arena_stations/weapon-art.json`. The image route is yours. Other lanes send REQUESTs for art to you; read their JOURNALs each session.

## Read first
- How characters are drawn and cut today: `docs/day/2026-11-03/d5-cast/REPORT.md` and the cutout rig (`features/characters/rig_*.gd`, `rivet_plan.gd`, parts atlases). Read the Trivet art direction in `C:\Users\kazda\kiro\pof\games\gtai\art-direction\trivet\` (the concept T2 `ref-4-rivet-concept.jpg` and the target frame `directions-v2\d4h2_mock.jpg`) and the image recipe in `C:\Users\kazda\kiro\pof\games\gtai\research\chatgpt-pro-image-route.md` §8.
- What gunplay built: `docs/eve/2026-11-03/gunplay/REPORT.md`. It covers `weapons.json` with `held_scale`, and what the pistol fight draws today.
- The owner's weapon set and its intent: pitch §7 in `C:\Users\kazda\kiro\pof\games\gtai\pitch.md`.

## Work order
1. **A design language for the arsenal.** One sheet sets the rules:
   - weapons are drawn from above in the D5 ink style, readable at 32 px/m (a pistol is about 8-10 px long there);
   - the silhouette identifies the weapon, not detail; a unique shape per weapon;
   - the materials are worn metal, tape and scavenged parts (Rivet is a scrap robot in a gritty city), in the palette tokens;
   - no brand marks.

   Write it to `docs/art/weapons.md` with a reference sheet.
2. **Weapons, in this order.** Each one is finished before the next:
   - pistol;
   - machine pistol;
   - rocket launcher;
   - flamethrower (the tank and hose too);
   - electro gun;
   - molotov;
   - katana;
   - electro baton;
   - hand cannon;
   - plasma rifle;
   - chainsaw;
   - plasma sword;
   - ray gun;
   - homing shard gun;
   - mini-nuke launcher.

   Per weapon:
   - a design sheet: top-down held view, side view, pickup, HUD icon;
   - the cut parts for the rig (the grip point and the muzzle point as data, so `rivet-arsenal` can attach the weapon and `gunplay` can spawn shots from the muzzle);
   - the muzzle-flash frames (2-3) and the projectile art.
3. **Projectile and effect art** that the `gunplay` and `brutality` lanes ask for: tracers, the rocket with its smoke puffs, flame puffs, electro arcs, the plasma bolt, ray-gun rings, shards, the nuke flash, shell casings, burning and charred overlays for human rigs, and the gib parts (inked, red, comic-book) for the brutality kills. Work through their REQUESTs, or start these right after the pistol and the rocket launcher.
4. **An in-game lineup:** a clip or frame of every finished weapon held by Rivet, and on the floor as a pickup, at 32 and 64 px/m, beside a cop for scale. If `rivet-arsenal` hasn't wired the holding yet, show the weapon parts in your own dev scene.

**Proof:**
- the design sheets, beside the concept T2 for style;
- the in-game lineup at 32 and 64 px/m;
- a provenance line per AI asset;
- the art lint and gates green.

**Branch:** `n-weapon-art`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\n4\weapon-art\`.
