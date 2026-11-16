# Visual targets, 2026-11-04 (owner-judged image rounds 1-2)

The owner judged two Codex image_gen brainstorm rounds on the "RTAI Look Table" page (claude.ai/artifact/UJ3qb5wqriCPCRJREVGpMC).
- **Owner, after round 2:** "no need to iterate next round. We have nice visual targets for next runs".
- **Every verdict and comment** is in `verdicts.json`.
- **The kept images** are in `img/`, named `<round>_<image>.jpg`.
- **The round sources** (prompts, references, full-resolution PNGs) are in `C:\Users\kazda\kiro\gtai-art\r1\` and `r2\` (`jobs.json`, `out/`).

**These images are targets to chase in the engine, not production assets.** The game draws its characters as cutout rigs and its world as code, under the D5 Inked Grime look. A lane matches these targets in proportion, silhouette, palette, texture and weight. It does not paste the images in.

## The doctrine behind them (owner, 2026-11-04 13:00)
"we have still too heavy and thick main characters and cops which should be both closer to crowd in their default state. I can imagine character grow in transformed state, oponents like bosses and advanced robots in later acts to gain such large size."

- **The default cast is slim.** Rivet, the cops and the crowd share roughly one human footprint; Rivet is only slightly larger.
- **Large size has three uses only:** Rivet's transformed state, bosses, and advanced robots in later acts.

## Characters

| Target | Image | The owner's note |
|---|---|---|
| **Rivet's default body: the lanky + android hybrid.** The lanky lean piston limbs and gait, with the android's work-plated torso and shoulders. He keeps the welder-visor head, the black-and-vermilion hazard collar, the pincer claw and the welding torch on a cable. | `r2_c3_lanky_android_hybrid.jpg` | Keep. The pure lanky and pure android bodies were dropped in round 2 in favour of it. |
| **Transformation: two stages only.** The hybrid default goes straight to the full transformed form (about 2x height, about 3x mass); there is no middle stage. | `r2_c4_transformation_stages.jpg` | "Fit into Lanky + android hybrid, keep only two stages (remove middle)". The image still shows three stages on the old body; the owner's note governs. |
| Cops from straight above, in action: aim, run, shield block, rifle, hit, dead, baton charge, crouch | `r2_c5_cops_action_overhead.jpg` | Keep |
| The cast at real game scale (with the lanky body and with the android body; the hybrid replaces both) | `r2_c6_cast_ingame_scale_lanky.jpg`, `r2_c7_cast_ingame_scale_android.jpg` | Keep: the scale target |
| The crowd baseline: eight civilians, the footprint every human matches | `r1_c6_crowd_lineup.jpg` | Keep |
| The scale ladder: civilian, cop, Rivet, robot thug 1.6x, security robot 2.2x, transformed 2x, boss 4x | `r1_c7_scale_chart.jpg` | Keep |
| Later-act robots from straight above: thug, gunner, riot robot, four-legged mech, demolition boss | `r2_c8_late_robots_overhead.jpg`, `r1_c8_late_robots.jpg` | Keep |

**Camera:** the round 2 images are true 90-degree straight-down views, which match the game. Round 1's views were more oblique.

## Weapons

| Target | Image | The owner's note |
|---|---|---|
| Kinetic guns: pistol, machine pistol, hand cannon, nail gun | `r1_w1_guns_kinetic.jpg` | Keep |
| Heavy weapons: rocket launcher, mini-nuke launcher, flamethrower with tank, Gatling | `r1_w2_guns_heavy.jpg` | Keep |
| Energy guns: electro gun, plasma rifle, ray gun, homing shard gun | `r1_w3_guns_energy.jpg` | Keep |
| Plasma sword: four variants with the blade 20 % longer | `r2_w1_plasma_sword_longer.jpg` | Keep (round 1 note: "make weapon blade longer with 20% increase") |
| The melee set, with the longer plasma sword | `r2_w2_melee_longer_plasma.jpg` | Keep |
| **Gatling** (the future weapon): four variants with the **barrel cluster 50 % longer** | `r1_w6_gatling_variants.jpg` | Round 1: "increase length of gatling with 50% increase of the left part" (the left part is the barrel cluster). The edit was blocked twice by the image tool's moderation, so the note governs. |
| Effects in colour (muzzle, tracer, rocket, explosion, flame, arc, plasma, ray, shards, impacts) | `r2_w4_fx_colour.jpg` | Keep (round 1: "Nice but add colors to the effects") |
| Held from straight above: guns, heavy weapons, melee wind-up and strike | `r2_w5_held_guns_overhead.jpg`, `r2_w6_held_heavy_overhead.jpg`, `r2_w7_held_melee_overhead.jpg` | Keep: the hold and grip target (see the backlog note "player's hold and animation of melee weapons") |
| Pickups on the ground at game scale, all 16 weapons | `r2_w8_pickup_icons.jpg` | Keep |

## Art direction (the visual engine)

| Target | Image | The owner's note |
|---|---|---|
| **The look to chase: a middle ground between Inked Grime with a risograph texture and the current game.** Fine halftone in the flat fills, slight ink misregistration on the coloured parts, more paper fibre, and the readability of today's game. | `r2_a5_inked_grime_riso_texture.jpg`; the round 1 base is `r1_a1_inked_grime_plus.jpg` | "Chase middleground between this variant and current game." |
| **Close-up stages and battles: the alley.** Tight spaces, building edges seen from above, fire escapes, dumpsters, puddles. | `r2_a6_inked_grime_alley.jpg` | "Keep as direction for closeup stages/battles." |
| Surface grain: tone it down, but never remove it | `r2_a1_riso_light_no_shadow.jpg` (dropped as a whole) | "Tone down graininess of the surface but do not remove completely" |

**Dropped:**
- Round 1: heavy noir ink, flat-colour comic, pure risograph, night sodium, painterly, clean graphic. Dynamic light came back in round 2 combined with the risograph print, and all of those combinations were dropped.
- Round 2: effect light on Inked Grime, the market square, and the full merge.

**No cast shadows** came up in the owner's round 1 note on dynamic light ("remove shadows"). The look carries no long cast shadows.

## The ghosts (Look Table round 3, owner verdict 2026-11-04 23:45)
The owner: "Beautiful concepts. ... For Mage use Ohm intead of Old Arc. Otherwise keep names of their winning variants and add into nightly run effort to create these characters, animate transformation between characters, design and implement their attacks."

| Ghost | Name | The winning concept | Image |
|---|---|---|---|
| Mechanic | **Dent** | A battered crash-test robot: a dented humanoid dummy shape, black-and-yellow target discs on the head and joints, a seatbelt harness, a cracked visor. It spent its life being driven into walls and loves the impact. **Ability:** it seizes cars, rides or steers them into enemies, then overloads them until they blow up on impact. | `img/ghost_dent_mechanic.jpg` |
| Bulky | **Tonnage** | A giant hydraulic stamping press walking on four piston legs, the press head as a heavy brow, die-plates as armour, about 3x the hero's height. Slow, enormous, very resistant, destructive. **Ability:** a press-head slam that flattens a police car, with a shockwave that cracks the street. | `img/ghost_tonnage_bulky.jpg` |
| Fast | **Kerf** | A laser-cutter gantry head freed from its rails: a sleek, narrow, hovering cutting head with a mirror-lens eye and slim jointed limbs ending in beam emitters, with a duelist's silhouette. Precise and silent. **Ability:** it blinks along a straight teal line behind a target and slices with a thin cutting beam, leaving a glowing cut line in the air (teleport and assassinate). | `img/ghost_kerf_fast.jpg` |
| Mage | **Ohm** | The elder spot-welding robot: small and hunched, older than everything in the factory, a welding-gun arm like a cane, twin copper electrode fingers, a frayed cable beard, cracked goggles. Smaller than Rivet. **Ability:** a forked bolt from the fingertips (single), and later lightning arcing to many machines at once (mass), strong against machines. | `img/ghost_ohm_mage.jpg` |

Dropped variants: Clutch, Torque, Slag, Hoist, Flick, Dart, Spool, and the substation keeper (whose name, Ohm, moved to the welder).
