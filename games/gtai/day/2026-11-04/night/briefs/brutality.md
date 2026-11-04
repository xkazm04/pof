# Lane: brutality (advanced weapons kill a human in one shot, each with its own signature kill)

**The owner, 00:05:** "more advanced weapons will one shot them with unique animation/brutality."

**You own:**
- the signature kills: the one-shot kill animations and effects of the advanced weapons on humans;
- the kill-cam beat around them (a frame of hit-stop, an ink flash, optional slow motion; the kill beat switch from d5-combat);
- `features/combat/kills/**`;
- `data/tables/signature_kills.json`;
- `data/tables/arena_stations/brutality.json`.

The tone: violent, over-the-top comic-book action in the D5 ink print (red blood, ink splats, cream highlights), stylised and readable at 32 px/m, never photoreal gore. Use original names only.

## The kills, in this order (each finished before the next)
1. **Rocket launcher:**
   - the body is blown apart: 4-6 inked gib parts (torso, limbs, hat) fly along the blast with spin and bounce;
   - a red spray and ink splat;
   - a scorch mark.
2. **Hand cannon:** the victim is blown off their feet, flies back 3-4 m along the shot, slides with a long smear, and the hat spins off.
3. **Flamethrower** (a long burst): the victim runs ablaze in panic, then collapses into a charred, smoking silhouette that crumbles to ash flakes.
4. **Electro gun** (the charged shot): a stiff convulsion, an X-ray skeleton flash, smoke from the collar, and the victim drops stiff.
5. **Katana:** a clean slash that cuts the body in two along the swing. Both halves slide apart and the blood fans along the cut.
6. **Plasma rifle:** a hole burned through the torso, glowing edges, the victim drops; the bolt continues.
7. **Chainsaw:** the grind (the victim held and shaking, a continuous spray), then a split.
8. **Plasma sword:** like the katana, with cauterised glowing edges and no blood.
9. **Ray gun:** the victim dissolves in rings into a pile of glowing dust and their empty clothes.
10. **Homing shard gun:** shards stick in, then burst after a delay into a pop of red mist.
11. **Mini-nuke launcher:** everyone in the radius is vaporised to shadows on the ground, under the screen-flash budget and the reduced-motion flag.

## Work order
1. **The framework:**
   - the kill event (weapon id, damage type, hit point, direction, victim rig) from `gunplay`;
   - the death hook from `human-reactions` (replace the standard death);
   - a data row per signature kill (parts, impulses, effects, the kill-beat timing);
   - pooled gib parts;
   - a corpse and leftovers that persist like corpse stains (a budget for how many);
   - determinism: physics on the 60 Hz tick with the RNG registry.

   Until those lanes deliver, stub the event and the hook in your own folder and agree the payload in JOURNAL REQUESTs. Merge or cherry-pick their work as it lands.
2. **The rig cut:** the cop and pedestrian rigs need gib or split parts. Do it procedurally from the existing parts where you can: a rig torso split along a line, limbs detached. REQUEST new art (charred overlay, skeleton flash, gib bits, ash) from `weapon-art` early.
3. Build the kills in the order above. Each one is shown on the real cop in the arena and in the city block.
4. **Reduced motion and ratings:** a `--gore=full|reduced` flag (reduced: no dismemberment, the victim falls), honoured everywhere, and the reduced-motion flag for flashes and shakes.

**Proof:**
- a 10-20 s real-time clip per signature kill at 32 px/m plus a 64 px/m slow close-up;
- a reel of all finished kills;
- determinism scenarios (same seed, same gibs) with a planted fault;
- the frame cost of the worst kill (CONTENDED or under the bench lock).

**Branch:** `n-brutality`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\n4\brutality\`.

## Director's checkpoint, 04:00
Nine kills exist; stop adding until the existing ones read. Priorities: (1) re-shoot each kill clip with one isolated victim (no pack, no dummy row) at 48 px/m follow + the 64 px/m slow close-up; (2) the katana and plasma-sword split must show **two clearly separated halves** sliding apart (today the cut is hidden among bodies); (3) the electro kill needs a **visible skeleton flash** (cream bones on ink, 3-4 frames) - today only the arcs read; (4) the rocket-kill first-frame spike; (5) then homing-shard burst and mini-nuke shadows, if time remains before 07:30.
