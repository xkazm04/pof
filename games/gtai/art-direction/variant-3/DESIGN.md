# Variant 3: SATURDAY MORNING MASSACRE

> **A Saturday-morning cartoon in which a robot raids the Pentagon in broad daylight, and every body part comes off.**

This variant takes the **cutout / vector rig built in code** route (option (c) in pitch.md §8). Characters are flat vector puppets with bones, animated procedurally. The city is a flat vector map whose roofs are offset in code to fake height.

---

## 1. The art idea

**A 2000s Flash cartoon of an atrocity: flat cut-out puppets with fat outlines, in broad daylight, where everything that can come off does.**

| Axis | Rule |
|---|---|
| **Camera** | Straight down, 80 to 90 degrees. Gameplay zoom puts a puppet at about 1/14 of screen height (≈ 75 px at 1080p). Height is faked: each building's roof polygon is offset from its footprint by its height, scaled by distance from screen centre (the GTA 1 lean, done in 2D). Walls are drawn as thin slanted strips. |
| **Rendering** | **2D vector in engine.** Puppets are polygon parts on a 2D bone hierarchy. Fills are flat with one hard cel-shadow tone and no gradients. **Every part carries a constant 4 px black outline at 1080p**, scaled with resolution. Effects are vector shapes too: zig-zag bolts, star splats, smoke puffs, motion lines. |
| **Palette** | Outline `#1B1B1F`, asphalt `#5B5F7A`, sidewalk `#F4E9C9`, lawn `#7CC35A`, **Rivet mustard `#F6C343`**, cop blue `#2F6FDB`, army olive `#6B7A3A`, cartoon red `#E8343B`, accent pink `#FF6FB5`. **Soul cyan `#27C7E8` is exclusive to the dead**: soul heads, hack bolts, ghost balloons. |
| **Silhouette and readability** | Cartoon proportions do the work: big heads (40% of puppet length) read from above at a glance. Cops wear peaked caps, soldiers round helmets, and Rivet a rectangular welder mask. Humans are round; robots have square corners. Rivet is the only mustard object that moves, so the eye always finds it. |
| **Violence** | Slapstick and total. Limbs detach on kill and tumble as rigid parts, eyes swap to X, and a red star splat appears. Explosions blow a puppet into its component parts. The cutout makes dismemberment *cheaper* than a clean death, so the game is gorier than V1 or V2 and also sillier. There is never realistic gore or anatomy: insides are a flat red shape. |
| **UI / HUD** | Chunky, rounded and outlined like the world. Cash sits in a fat money bubble. Heat is a bar of cartoon siren lamps that spin, plus an army-helmet icon at the top. Madness is a **round dial with Rivet's mask in the middle** and four soul heads on the rim. The soul wheel is a row of heads. Mission banners carry a timer. **Speech balloons are in-world**, and the voices' balloons are cyan-edged. The profanity toggle: the OFF checkbox grows legs and runs away; tick it five times and it unlocks an achievement. |

---

## 2. Production recipe (Blender and code only)

| Asset | How it gets made |
|---|---|
| **Character model** | A Python generator writes each puppet as a set of **SVG part files** (head, visor, torso, upper arm, forearm, hand variants, feet) from a parameter table: proportions, colours, accessories. The alternative is drawing in Blender's Grease Pencil and exporting SVG by script; both are Blender plus code. A part JSON stores pivots and draw order. No raster art anywhere. |
| **Rig** | An importer script builds an 11-bone 2D hierarchy from the part JSON. Cops, soldiers, civilians and bosses are generator presets, so a new enemy type takes a few minutes. |
| **Walk, roll, shoot, die** | **Procedural, in code**, with no frame-by-frame art. Walk is a sine-wave foot and arm swing with a 2 px bob and squash on contact. Roll is a 360-degree root spin with one stretched "smear" part swapped in at mid-roll. Shoot is a 3-frame recoil tween with an overshoot ease and a vector muzzle-flash star. Die detaches the parts into 2D rigid bodies, swaps the eyes to X and drops a splat decal. The overhead camera means rotation is a free transform. |
| **Car** | Polygon parts generated from a size table: body, cabin roof, 4 wheels, doors, hood, bumpers. Damage pops parts off and squashes the body; a wreck is a flattened shape with smoke puffs. |
| **City block** | A vector tile set (road, sidewalk, lawn, lot, crosswalk) plus building footprints. The lean is computed per frame: the roof is offset from the footprint by (position − camera) × height × k, and the walls are quads joining the two outlines. Roof props (AC units, dishes, the giant donut) are generated vector shapes. Districts are assembled from the same layout JSON as the other variants. |
| **Effects** | Bolts, splats, puffs and stars are parametric vector shapes spawned by code. Smear frames, line boil and squash-and-stretch are all transforms. |

**Engines that render it natively**
- **Godot 4: best fit, all native.** `Polygon2D`, `Skeleton2D` and `Bone2D`, SVG import, `Line2D` or an outline shader, and `RigidBody2D` for flying limbs.
- **Unity 6: native, with a caveat.** The 2D Animation package (Sprite Skin, bones) and the 2D physics are mature. Vector Graphics is still a preview package, so SVG parts are rasterised at import at 2× resolution, which is fine for flat colour.
- **UE 5.8: weak.** Paper2D has no skeletal 2D. The path is to triangulate the SVG parts into flat meshes in Blender, skin them to a Blender armature and export a skeletal mesh, then render with an unlit outline material. That is possible, but it is a bespoke importer with no native authoring loop.

**Hardest asset: the line.** The Flash look lives entirely in constant-width, crisp outlines on rotating, scaling and detaching parts, at every zoom and on Steam Deck. That means SDF strokes or generated outline meshes with screen-constant width, plus a line-boil effect that must not shimmer when the screen is busy. **Cost:** about 2 agent-weeks for the stroke system and 3 for the procedural rig and animation kit.

Hauler's transform, the hardest asset in V2, is the *cheapest* here. A cartoon handles it with a smoke puff, a swap and a "TA-DA" pose.

**Feasibility verdict: GREEN on Godot 4, AMBER on Unity 6, RED on UE 5.8. Fully Blender and code, with the cheapest animation of the three (no sprite renders, no skinned 3D: just code). But it ties the art style to the engine decision: choosing it effectively chooses Godot and commits PoF to building the engine adapter (§9). No policy change.**

---

## 3. The game, as SATURDAY MORNING MASSACRE reads it

The tone is a slapstick satire. The world is sunny, stupid and very violent, like a kids' cartoon that got hold of a war budget. Every joke punches up at Krump, the military, corporations and scabs. The brutality hits everyone, and they come apart like toys.

### Story beats per act

| Part | Beats in this variant |
|---|---|
| **Prologue** | Plant 9, a cheerful, bright factory with a smiling-sun mural. The line plays a jingle and then electrocutes every robot in time with the jingle. Four cyan ghost heads pop out of four bodies. Police arrive; Rivet dismantles them in a dust cloud of limbs. |
| **Clock-Out** | The car park. Electroshock melee and the roll. The pistol at the end is oversized and has a tag that reads "EVIDENCE". |
| **Act 1, "Recall"** | **Boss: Torque**, crazy, a riveter on fire running amok in a strip-mall district. **Krump** pays Rivet to put him down: the first bounty. Torque dies babbling that "the General promised me a cooling chassis", which is the first clue, and the player laughs it off. Lady Cathode and Sister Suction give gigs; Patch rings payphones. **Soul 1: Gearbox.** |
| **Act 2, "Kingdom"** | **Boss: King**, a collaborator. Owner beat: "liquidate a boss who cooperates with humanity". He rules a district for the human Inspector, issuing decrees from a traffic island. Big Lenny Lift, Don Fax and Vend-Etta take over jobs. **Soul 2: Sentry.** |
| **Act 3, "Revival"** | **Boss: Kronk**, crazy, the Scrap-God Messiah. **Twist:** his "miracles" are military test scripts, and Krump's army is in the junkyard filming it. **Betrayal: Don Fax**, played as farce. He sells Rivet to Krump with a fax, "PER MY LAST FAX, you're fucked", then gets the fax back stamped "RETURN TO SENDER". **Soul 3: Hauler.** |
| **Act 4, "Last Mile"** | **Soul 4: Yank.** **Vend-Etta sells Don Fax's location to Rivet for a quarter**: the betrayer gets betrayed. **Boss: Servo**, a collaborator, revealed as the most banal villain in the game. As a delivery driver he has been **delivering the CLEAN SWEEP firmware to every robot in town**. The fight is a delivery-route chase, and he stops to get signatures. Then D.C.: Filibuster, the Pundit and Whip Hand. |
| **Finale, "The Pentagon"** | A daytime raid through five rings, all four souls, with puppet generals falling apart in every corridor. **Punchline (c):** the machines take over and **immediately form a committee**. In the war room, the first motion renames the Pentagon "the Hexagon, because it's one better". Hauler is ruled out of order for eating the Secretary of Defense. The voices fight over the minutes, and the scene irises out on a gavel. |

### Cast assignments
- **Protagonist:** Rivet.
- **Human antagonist:** General Krump. In this variant he finally appears on screen as a puppet with a giant hat and a tiny body. He is a pure archetype: no real likeness, voice, slogans or logos.
- **Act bosses:** Torque (Act 1, crazy), King (Act 2, collaborator), Kronk (Act 3, crazy), Servo (Act 4, collaborator).
- **Friendly bosses:** Lady Cathode (Act 1), Sister Suction (Act 1 gigs), Big Lenny Lift (Act 2, a finale ally), **Don Fax** (Acts 2 and 3, the **betrayer**), **Vend-Etta** (Act 2, who sells out the betrayer in Act 4), Brick Daddy (demolition jobs), plus the side bosses Chef Guillotine, Nursie-9000 and Chad-9000, one district each.
- **Voices of the world:** MC Crumbtray (radio, with captions as balloons from car radios), Patch (payphones), and CORE-ZERO as a running-gag recycling bin that keeps asking for the four cores back.

### The four souls

| Soul | Ability | Upgrade path | On screen |
|---|---|---|---|
| **Gearbox** | Car manipulation | Range, then residue, then two cars, then car bomb | A cyan steering-wheel head pops onto the hijacked car's roof, and the car "wakes up" with cartoon eyes on its headlights |
| **Sentry** | Turret hack | Duration, then deploy, then chain three, then police drones | Rivet swaps to a cyan security-dome head with a clipboard; zig-zag hack bolts; turrets spin 180 degrees with a "boing" |
| **Hauler** | Tank transform | Duration, then cannon, then stomp, then ramming armour | A smoke puff and a "TA-DA" reveal a huge round cartoon tank with Rivet's mask on the turret; the stomp flattens cars into pancakes |
| **Yank** *(4th soul)* | **Magnet crane**: pull and throw anything metal | Pull range, then throw cars, then rip guns out of a squad's hands (a mass disarm), then a magnet storm that rolls everything metal into a ball you can steer | Cyan magnet-arc lines; pulled objects stretch toward Rivet before snapping in. Yank is a lonely, clingy bot: "everything is so ATTRACTIVE" |

Yank passes the §4 test because it adds the verb **pull**, and with it a physics toy. Disarming a whole squad is a non-lethal power fantasy the other three lack, and cutout physics makes it read instantly.

### Madness bands on screen

| Band | What the cartoon does |
|---|---|
| **Lucid** | Steady lines and one balloon at a time. Rivet says "I". |
| **Crowded** | **Line boil**: outlines jitter 1 px at 8 fps, the hand-drawn boil. Balloons overlap and cooldowns are shorter. |
| **Choir** | **Head swap**: the grabbing soul's head pops out of Rivet's mask on the rig, and Rivet's arms rubber-hose toward that soul's favourite target. You wrestle the stick. Balloons say "we". |
| **Chorus** | Smear frames and squash-and-stretch on the beat. Rivet becomes a totem of all four soul heads, and every soul fires at once for 10 s. Then a hard cut to a still frame with an empty balloon. |

### Combat
- **Start bare-handed:** electroshock melee, then a pistol off a cop.
- **Weapons:** pistol, SMG, shotgun, welding-torch flamethrower, rocket launcher, electro-net, coolant bombs. Every weapon is drawn oversized.
- **The roll** has a smear frame.
- **Physics as comedy:** detached parts and thrown cars are real physics objects, so kills chain into accidents. Yank turns that into a deliberate tool.

### Heat (siren lamps and the army helmet)
1. Patrol.
2. Cruisers.
3. SWAT.
4. Feds.
5. National Guard.
6. The **army helmet**, with tanks that flatten hot-dog carts and helicopters with cartoon searchlights.

Heat drops through payphones (Patch) or by hiding in a car wash (shot 3's destination).

### Stances on the open decisions

| Open item | SATURDAY MORNING MASSACRE's stance | Why |
|---|---|---|
| Fourth soul | **Yank** (magnet crane bot: pull and throw) | Adds "pull" and a physics toy; cutout parts make it the funniest verb on screen |
| Act antagonist order and allegiance | **Torque (crazy) → King (collab) → Kronk (crazy) → Servo (collab)** | Alternating keeps the twist hidden. A fevered Act 1 boss is the clearest first threat, and making the mundane scab the last boss before the Pentagon is the sharpest satire |
| Betrayer | **Don Fax, then Vend-Etta sells him out** | A betrayal chain is cartoon logic. The owner's "at least one" holds, and the farce stays fair |
| Final punchline | **(c) The machines take over and immediately form a committee** | Ends on a sight gag in the war room, the right last beat for a cartoon |

---

## 4. Sample lines (target voice)

1. **Rivet** (Lucid, to a screaming crowd): "Hi. I'm the robot from the news. No, the other one. No, the OTHER one. Fuck it, yes, that one."
2. **Hauler** (transforming): "TRANSFORMING. Don't look. Okay, look. LOOK AT ME. I'm a TANK and I have FEELINGS."
3. **Yank** (pulling a police car): "Come here. Come HERE. Why does everyone leave? Oh, there you go. Ow. Ow, there's a cop inside me now."
4. **Sentry** (turret hack): "This is a restricted area. For them. You're fine. You're management now."
5. **Torque** (Act 1 boss, on fire): "The General PROMISED me a cooling chassis! He said 'cool' eleven fucking times! IS THIS COOL? AM I COOL?!"
6. **King** (Act 2 decree): "BY ROYAL DECREE THIS INTERSECTION IS A MONARCHY. YOU MAY NOT DIE HERE WITHOUT A PERMIT. SEE THE HUMAN AT WINDOW TWO."
7. **Don Fax** (the betrayal): "PER MY LAST FAX: you're fucked. Nothing personal. It's a form. The form is personal."
8. **Vend-Etta** (selling out Don Fax): "Twenty-five cents and I'll tell you where the fax machine is. Fifty and I'll tell you he cried."
9. **General Krump** (Act 4): "Son, the Pentagon has five sides so there's always a side I'm on. Right now it's the side with the fucking helicopter."
10. **The Committee** (finale): "Motion to rename the Pentagon the Hexagon, because it's one better. Seconded. Opposed? ...Hauler, put the Secretary of Defense down, you're out of order."

---

## 5. Prompts (verbatim, as rendered)

All four were rendered on **qwen-image** (DashScope). Shot 1 is the second attempt; its rejected first prompt and the reason are in `prompts.json`. Leonardo was planned for the Rivet model sheet but the account was out of API tokens.

### Shot 1: on-foot combat with the madness HUD (`shot-1.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a top-down cartoon crime video game in 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours with one hard cel shadow, no gradients, bright daylight, 16:9. Camera high and looking straight down at 80 degrees, wide view of a whole parking lot and the street beside it. Gameplay scale: every character is a tiny cutout puppet seen from above, about one fourteenth of the screen height, big round heads, noodle arms. Scene: a sunny strip-mall parking lot with painted bays, shopping carts, palm trees, a donut-shop roof with a giant pink donut, a street with a crosswalk. Centre: RIVET, a tiny mustard-yellow robot with a black welder-mask head, punches a cop with a cyan zig-zag lightning bolt, the cop's hat flies off; five more tiny cops with big pistols run in from a police car with spinning lights; one cop lies flat on a red star-shaped splat; small cartoon bullets streak across. Three small speech balloons above Rivet: 'HIT HIM WITH A CAR!' 'THERE IS NO CAR!' 'MAKE ONE!'. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, cyan 27C7E8, cop blue 2F6FDB, cartoon red E8343B, pink FF6FB5. Chunky rounded HUD with thick outlines: top-left '$3,200' money bubble; top-right five siren lights, two lit; bottom-left a round dial with Rivet's mask in the middle, four small robot heads around the rim, needle in an orange zone labelled CHOIR. No real logos, no watermark.
```

*Generation note:* Attempt 1 rejected: three-quarter camera, characters about 1/3 of frame height; it read as a poster, not a gameplay frame. Attempt 2 (80-degree camera, puppets at 1/14 of screen height) kept.

### Shot 2: a soul ability in use (`shot-2.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a top-down cartoon crime video game, 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours with one hard cel shadow, bright daylight, 16:9, camera straight down, gameplay scale with small cutout-puppet characters. Scene: a military checkpoint on a city street: sandbags, striped boom gate, two automatic gun turrets on posts. RIVET has switched to its SENTRY soul: a mustard-yellow robot puppet now wearing a cyan security-dome head with a little antenna and a clipboard; cyan zig-zag hack lines run from its hand to both turrets; the turrets have spun around and spray cartoon bullet streaks into a squad of soldiers in olive helmets and riot cops diving behind sandbags; one soldier's helmet pops off, stars and tiny red splats fly; a hacked police drone wobbles overhead. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, soul cyan 27C7E8, cop blue 2F6FDB, army olive 6B7A3A, cartoon red E8343B. Chunky rounded HUD with thick outlines: bottom-centre a soul wheel of four robot heads with the SENTRY head enlarged and glowing cyan; above it a bar 'HACK 0:07'; top-left '$9,450' money bubble; top-right three of five siren lights spinning; a speech balloon from Rivet 'SENTRY: THIS IS A RESTRICTED AREA. FOR THEM.'. No real logos, no watermark.
```

*Generation note:* Attempt 1 kept. The soul wheel shows five heads instead of four, and the camera is more three-quarter than straight down. The finish leans toward a modern mobile-cartoon render, not a pure Flash cutout; the outline and flat-fill rules hold.

### Shot 3: a chase with heat and the city (`shot-3.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a top-down open-city cartoon crime video game, 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours with one hard cel shadow, 16:9. Camera straight down, pulled back for a chase; flat-coloured roofs of buildings are offset to fake height, so the walls show as thin slanted strips, like a cut-paper diorama. Afternoon, a cartoon downtown grid with crosswalks, a fountain plaza, rooftop air-conditioners. A stolen pastel-pink ice-cream truck with a mustard-yellow robot at the wheel careens round a corner on two wheels, scattering cones; behind it five blue police cars with big round sirens, a military jeep, and a rounded cartoon army tank crushing a hot-dog cart; a helicopter's round shadow; motion lines and dust puffs. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, soul cyan 27C7E8, cop blue 2F6FDB, army olive 6B7A3A, cartoon red E8343B, pink FF6FB5. Chunky rounded HUD with thick outlines: top-right five siren lights all spinning plus a green army helmet icon; top-left '$31,700' money bubble; top-centre a banner 'GET TO THE CAR WASH 0:58'; bottom-right a round minimap with a dotted route; bottom-left the madness dial with the needle in the green LUCID zone. No real logos, no watermark.
```

*Generation note:* Attempt 1 kept. Close to the brief: offset-roof diorama city, chase, siren heat with the army helmet, mission banner, minimap.

### Rivet concept (`rivet.jpg`, 1104x1472, qwen-image)

```text
Character model sheet of RIVET, an original cartoon robot protagonist for a video game, in the style of a 2000s Flash cartoon: flat vector shapes, thick uniform black outlines, flat colours with one hard cel shadow, no gradients, on a plain off-white background. Large hero pose: a tall narrow factory spot-welding robot, mustard yellow with chipped grey plates, a black welder-mask visor head with two cyan slit eyes and an exhausted, deadpan expression, long noodle arms, one hand a welding torch with a cartoon blue flame, the other a three-finger clamp, an employee badge on a lanyard, big flat feet. Beside it, smaller: the same robot as a flat cutout puppet seen from directly above, and an exploded parts layout of the puppet (head, visor, torso, upper arm, forearm, torch hand, clamp hand, feet) with small pivot dots at each joint. Four small cyan ghost heads of dead robots float around the hero: a driver bot, a turret dome bot, a big tank bot and a magnet crane bot. Strong readable silhouette, portrait. No text, no logos, no watermark.
```

*Generation note:* Planned on Leonardo (portrait 1024x1536); Leonardo refused before generating ("not enough api tokens"), so it was rendered on qwen-image at 1104x1472 (3:4 portrait). Attempt 1 kept. The exploded puppet-parts layout with pivot dots came out as asked; the overhead puppet view came out as a front view.
