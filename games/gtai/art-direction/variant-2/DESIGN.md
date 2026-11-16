# Variant 2: SODIUM

> **GTA 2's trick at today's resolution: a real block city at night, full of sprites rendered once from straight above, and a radio that narrates your war crimes.**

This variant takes the **pre-rendered sprite** route (option (a) in pitch.md §8): characters and cars are Blender renders baked into sprite sheets, laid over a real 3D block city that the engine lights live.

---

## 1. The art idea

**Shoot every body once from directly overhead in Blender, lay it on a real 3D block city, and let the sodium streetlights do the noir.**

| Axis | Rule |
|---|---|
| **Camera** | Near-vertical, 80 to 88 degrees, with real perspective, so tall buildings lean outward from the screen centre (the GTA 2 signature). Gameplay zoom puts a character at about 1/16 of screen height (≈ 64 px at 1080p). It zooms out with car speed, as GTA 2 did. |
| **Rendering** | **Pre-rendered sprites** (albedo, normal and emissive per frame) drawn as ground-parallel quads in a lit 3D scene. Real-time point lights (street lamps, muzzle flashes, siren bars) light the sprites through their baked normal maps. The city is real geometry: GTA 2-style blocks textured from a Blender-baked tile atlas. Wet-road reflections come from a screen-space planar trick, and the fog is light only. |
| **Palette** | Asphalt `#1E2028`, wet blue-grey `#3A4150`, **sodium orange `#FFA43A`** (the light that reveals: if you stand in it, you are seen), neon magenta `#FF3E9A` (signage, CRUMB FM), police blue `#3A7BFF`, blood `#7A0F14`, HUD yellow `#FFD23F`. **Phosphor green `#7CFFC4` is exclusive to the dead**: souls, ghosts, voice text. |
| **Silhouette and readability** | Everything is seen from straight above, so silhouettes are **head-and-shoulder shapes**. Humans have round heads and narrow shoulders. Robots have square heads and wide shoulder plates. Rivet carries the only welder-mask head and an amber visor glint, readable at 48 px. Cops carry a white cap disc, soldiers an olive helmet disc. Each car class has its own roof shape. A rim-light pass is baked into every sprite, so characters pop off dark asphalt. |
| **Violence** | GTA 2-grade: dark-red pooled blood sprites that spread over 2 s, body sprites that stay, and car wrecks that burn and then char. Gibs are a 6-frame burst sprite. It is cruel at a distance, because the camera never gets close. |
| **UI / HUD** | Late-90s and loud. Cash in chunky yellow bitmap digits (top-left). Heat as six police badges plus an army star (top-right). The weapon is an icon with an ammo count. **VOICES** is a round dial (bottom-left) with the four soul portraits around a needle across LUCID, CROWDED, CHOIR and CHORUS. A **pager box** (bottom-centre) carries every voice line and Patch's job texts. A CRUMB FM station banner appears when the radio cuts in. The profanity toggle is a 90s options menu: select OFF and the menu beeps and selects "ON (LOUDER)". |

---

## 2. Production recipe (Blender and code only)

| Asset | How it gets made |
|---|---|
| **Character model** | A bpy script builds the model at higher detail than V1 (8 to 20k tris), because nothing renders in real time. Procedural materials only: no painted textures. Cops, soldiers and civilians share three body generators, and liveries are material parameters swapped in code. |
| **Rendering to sprites** | A bpy render script places an **orthographic camera straight down** and renders every animation frame in Cycles at 4× the target size, then downsamples to a 128 px cell. Each frame emits albedo, a world-space normal pass and an emissive mask (visor, muzzle, siren). A Python packer writes atlases plus a JSON frame table. |
| **Walk, roll, shoot, die** | Authored as keyframes in Blender Python (PoF's code-authored animation path), then rendered. The camera is overhead, so **one direction serves all 360 degrees**: the sprite rotates in engine. Walk is 8 frames. Roll is 8. Punch is 4. Shoot is 3 frames for each of three weapon holds. Die is 3 variants of 8 frames plus a corpse frame. That is about 45 frames per form; Rivet plus four soul forms comes to about 250 frames. |
| **Car** | One top-down body render, 4 damage states, door-open frames, and a normal map: about 12 frames per car type. Wheels are separate small sprites rotated in engine, so steering shows. Burning and charred states are tint and emissive changes, not new renders. |
| **City block** | GTA 2's method. Blocks are real cubes on a 2D grid with a height value, built in engine from a layout JSON. Their faces are textured from a 64 px tile atlas that Blender bakes: roof variants, wall bands, lit and unlit window strips with emissive. Road markings are decals. |
| **Memory check** | 250 frames × 128² × (albedo + normal) ≈ 32 MB raw, about 8 MB with BC7. Trivial. |

**Engines that render it natively**
- **Godot 4: best fit.** `Sprite3D` or `AnimatedSprite3D` with normal maps on ground-parallel quads, `GridMap` for the block city, OmniLight3D for street lamps. All native.
- **Unity 6: native.** Quads with a lit sprite shader in 3D URP, or the 2D Renderer with secondary normal textures. Well-trodden.
- **UE 5.8: works, but against the grain.** Paper2D flipbooks exist but are in maintenance mode. The practical path is a flipbook material on a quad mesh with a normal-mapped lit material (native `Flipbook` node) plus instanced static meshes for blocks. PoF's bridge works on it, but PoF has no sprite pipeline today.

**Hardest asset: Hauler's transform, plus frame growth.** The transform needs:
- a 24-frame Rivet-to-tank transition;
- a tank body with an **independently rotating turret layer** and scrolling tracks (three sprite layers, not one);
- a stomp shockwave.

Every new weapon hold also multiplies across five forms. The other trap is baked-versus-live lighting: sprites cannot receive true shadow from the 3D blocks, so the design uses normal-mapped lighting and blob shadows, and bans long cast shadows.

**Cost:** about 3 agent-weeks for the sprite pipeline (bpy renderer, atlas packer, engine importer, and a frame-diff check in PoF). After that, about half a day of machine time per character.

**Feasibility verdict: GREEN on Godot 4 and Unity 6, AMBER on UE 5.8. Fully Blender and code: every pixel comes from a Blender render. It is the cheapest per new asset and the most faithful to the GTA 2 lineage. On UE it costs a new sprite pipeline, and in the engine spike it favours Godot, which means paying for PoF's engine adapter. No policy change.**

---

## 3. The game, as SODIUM reads it

The tone is a radio-driven crime spree. The city is one long night. CRUMB FM narrates you live, and Krump keeps cutting into the broadcast. The comedy lives in the pager box and on the airwaves, and the souls heckle like a car full of drunk uncles.

### Story beats per act

| Part | Beats in this variant |
|---|---|
| **Prologue** | Plant 9 at shift change, lit by sodium floodlights. The line stops; four robots die in a cascade of sparks, and four **phosphor-green** outlines rise from them. Police arrive with sirens painting the floor blue and red; Rivet takes them apart. |
| **Clock-Out** | The employee car park. Electroshock melee and the roll. It ends with the cop's pistol and the first payphone ringing. |
| **Act 1, "Deliveries"** | Patch routes jobs from payphones, GTA 2 style. Lady Cathode and Don Fax hire Rivet, and The Valet gives car jobs. **Soul 1: Gearbox.** **Krump** cuts into CRUMB FM with bounties. **Boss: Servo**, a collaborator: a delivery scab who runs human corporate convoys through robot districts. The act ends in a convoy chase that teaches driving. |
| **Act 2, "Royalty"** | Big Lenny Lift and **Vend-Etta** take over. **Soul 2: Sentry.** **Boss: King**, a collaborator who rules a district for the human Inspector. Owner beat: "liquidate a boss who cooperates with humanity". The kill is a district war, block by block. |
| **Act 3, "Revival"** | **Boss: Kronk**, crazy: the Scrap-God cult in the junkyard. His sermons are full of CLEAN SWEEP code words, which MC Crumbtray plays on air. **Twist:** the military runs the crazies. **Betrayal: Vend-Etta.** She has been reading Rivet's score for Krump all game; the HUD gag of her quoting your cash before the payout lands pays off. She hands CRUMB FM's frequency to Krump. **Soul 3: Hauler.** |
| **Act 4, "Fever"** | **Soul 4: Primer.** **Boss: Torque**, crazy and fever-brained. Krump personally delivers the "cooling chassis" on live radio. The act is one long burning chase across the city, Torque's heat against the clock. Then D.C.: Filibuster, the Pundit and Whip Hand. |
| **Finale, "The Pentagon"** | The raid under helicopter searchlights and five rings, all four souls. **Punchline (a):** Krump surrenders **live on CRUMB FM** and asks for a pardon from the voices in Rivet's head. The four voices vote, and the VOICES dial becomes a ballot. The vote splits 2-2, Hauler eats the ballot, and Crumbtray calls it "the most democratic thing that's ever happened in this building". The tie-break goes to the soul the player upgraded most, so the ending shot differs per player. |

### Cast assignments
- **Protagonist:** Rivet.
- **Human antagonist:** General Krump, as a radio voice that keeps hijacking CRUMB FM. He is an archetype: no real likeness, voice, slogans or logos.
- **Act bosses:** Servo (Act 1, collaborator), King (Act 2, collaborator), Kronk (Act 3, crazy), Torque (Act 4, crazy).
- **Friendly bosses:** Lady Cathode (Act 1), Don Fax (Acts 1 and 2; he stays loyal and faxes the proof to CRUMB FM in Act 3), The Valet (car jobs), Big Lenny Lift (Act 2 and a finale ally), **Vend-Etta** (Act 2, the **betrayer**), Father Piston (side missions; diesel chases).
- **Voices of the world:** MC Crumbtray is **the spine of this variant**: every act opens and closes on air. Patch rings the payphones. CORE-ZERO is the lore of where the dead cores should have gone.

### The four souls

| Soul | Ability | Upgrade path | On screen |
|---|---|---|---|
| **Gearbox** | Car manipulation | Range, then residue, then two cars, then car bomb | A green phosphor ghost appears on the hijacked car's roof; its brake lights flash green |
| **Sentry** | Turret hack | Duration, then deploy, then chain three, then police drones | Green scan sweep; hacked turrets flip their muzzle flash to green |
| **Hauler** | Tank transform | Duration, then cannon, then stomp, then ramming armour | The giant tank sprite with a rotating turret layer; the stomp is a white shockwave ring |
| **Primer** *(4th soul)* | **Spray disguise**: repaint yourself or a car to shed heat | Drop one heat level, then repaint a car into police livery (cops ignore it), then a wet-paint slick that makes cops slip, then a once-per-mission full-block repaint that wipes heat | A paint mist sprite; the car's livery swaps mid-chase. Primer is a flamboyant body-shop artist: "that colour does nothing for your crimes" |

Primer passes the §4 test because it adds the verb **disappear**, which the other three lack. In a chase-heavy GTA 2 game, losing the cops is the verb players use most.

### Madness bands on screen

| Band | What the screen does |
|---|---|
| **Lucid** | Clean sprites and a clean HUD. One pager line at a time. |
| **Crowded** | **Sprite afterimages**: the four soul sprites ghost behind Rivet at 25% in phosphor green. Pager messages stack. Cooldowns are shorter. |
| **Choir** | **Palette cycling**, the 90s trick: street lamps flicker from sodium to phosphor green. The grabbing soul's sprite swaps in over Rivet for 6 frames, and the stick fights you. The VOICES needle shakes. |
| **Chorus** | **Sprite flicker**: all four soul forms alternate every frame, as old hardware multiplexed sprites, and every soul power is live for 10 s. The pager floods. Then a hard cut: the HUD goes black and the radio goes silent for one beat. |

### Combat
- **Start bare-handed:** electroshock melee, then a pistol off a cop.
- **Weapons, GTA 2 pickups:** pistol, SMG, shotgun, welding-torch flamethrower, rocket launcher, electro-net, coolant bombs.
- **The roll** is core.
- **Lighting is a combat rule:** standing in sodium light makes you visible to cops at double range, and shooting out street lamps is a stealth tool.

### Heat (six badges and an army star)
1. Patrol.
2. Cruisers.
3. SWAT vans.
4. Feds.
5. National Guard.
6. Army, with tanks and helicopters. The army star lights far too early for a "robot problem".

Heat drops through Primer's repaints or a Patch payphone ("I lost your file. It's in the river. With the guy who had it.").

### Stances on the open decisions

| Open item | SODIUM's stance | Why |
|---|---|---|
| Fourth soul | **Primer** (paint-shop bot: disguise that wipes heat) | Adds "disappear", the chase verb; the repaint shows off sprite livery swaps for free |
| Act antagonist order and allegiance | **Servo (collab) → King (collab) → Kronk (crazy) → Torque (crazy)** | Servo's convoys teach driving first. Kronk's cult is the best twist stage. Torque's fever turns the last act into one long chase |
| Betrayer | **Vend-Etta** | Her "knows your score before it's reported" gag pays off through the HUD, and she hands Krump the radio, so the betrayal is heard |
| Final punchline | **(a) Krump surrenders on live radio and asks for a pardon; the voices vote** | The radio is this variant's spine, and the VOICES dial becomes the ballot |

---

## 4. Sample lines (target voice)

1. **MC Crumbtray** (CRUMB FM): "Ninety-four point one, CRUMB FM! Traffic: a welding robot just turned the Ninth Street bridge into modern art. Modern art is when nobody survives. Here's a slow jam."
2. **Primer** (repainting a car mid-chase): "Hold still. Hold STILL. Congratulations, you're a police car now. You're the problem. Own it."
3. **Gearbox** (Choir, swerving): "Your left. Your OTHER left. That was a nun. You hit a nun. She's fine, she's got God. Go go go!"
4. **Vend-Etta** (briefing, before the payout lands): "You're at forty-one thousand two-fifty, sugar. Don't ask how I know. I know the price of everything. Especially you."
5. **General Krump** (hijacking CRUMB FM): "This is your General. The robot uprising is a hoax invented by robots. If you see one, report it to me, then stand very still while I shoot it."
6. **Servo** (Act 1 boss fight): "I'm not a scab, I'm a SOLUTIONS PARTNER! Sign for the package. Sign for it. Sign for it with your fucking chassis!"
7. **Patch** (payphone): "Phone's ringing on Ninth. Answer it or I tell the General where you parked. Kidding, I already told him. Answer it anyway."
8. **Hauler** (tank form): "I love you, little cars. I love you so much I'm gonna stand on you."
9. **Cop** (heat 4, radio): "Dispatch, suspect has changed colour. Repeat, the robot is now fucking mauve. Requesting backup and a colour wheel."
10. **General Krump** (the finale, live): "I'd like to request a pardon. From the four robots in your head. Yes. I'm aware of how that sounds. I'm aware of how ALL of this sounds."

---

## 5. Prompts (verbatim, as rendered)

All four were rendered on **qwen-image** (DashScope). Shot 1 is the second attempt; its rejected first prompt and the reason are in `prompts.json`. Leonardo was planned for the Rivet portrait but the account was out of API tokens.

### Shot 1: on-foot combat with the madness HUD (`shot-1.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a top-down crime video game whose characters are pre-rendered 3D CGI sprites over a 3D block city, 16:9. Camera high above looking straight down at 85 degrees, wide view of a whole street block, so building rooftops lean slightly outward from the screen centre. Gameplay scale: every character is tiny, about one sixteenth of the screen height, seen from directly above (head and shoulders, no faces). Scene: night, a wet back street behind a diner, puddles reflecting sodium-orange street lamps, dumpsters, parked cars, pink neon glow spilling from a sign on the diner roof. Centre: RIVET, a tiny gunmetal robot seen from above (welder-mask head, broad shoulder plates) fires a pistol, a bright muzzle flash lights the asphalt; three tiny police officers return fire from behind a cruiser with red and blue lights; one officer lies in a dark red pool; scattered shell casings. Four faint green phosphor outlines of robots flicker around Rivet. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. HUD: top-left cash in chunky yellow digits '$0041250'; top-right six police-badge icons, three lit, and a pistol icon with '34'; bottom-left a round dial labelled VOICES with four tiny robot heads and a needle pointing at the word CROWDED; bottom-centre a pager box with the exact text 'SENTRY: TWO ON THE LEFT!'. No real logos, no watermark.
```

*Generation note:* Attempt 1 rejected: Rivet filled about 1/4 of frame height (poster scale, not gameplay scale), the camera sat at about 60 degrees, and the pager read "SENTERY". Attempt 2 (camera tightened to 85 degrees, characters at 1/16 of screen height) kept: the scale is fixed, but the "SENTERY" typo survived (in-game text is engine-rendered, so this is concept-only).

### Shot 2: a soul ability in use (`shot-2.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a 1999 PC top-down crime game made of pre-rendered 3D sprites over a 3D block city, 16:9. Camera almost straight down with perspective so buildings lean outward from the screen centre. Night, sodium-orange street lights, wet asphalt, neon. Centre: the player has transformed into HAULER, a huge pre-rendered tank robot seen from above, wide caterpillar tracks, a hydraulic press body, a stubby cannon arm, rivets and hazard stripes; it stomps through a police roadblock and a white shockwave ring spreads across the road; two police cruisers are flipped and crushed; a third is mid-air; small officers fly backwards; concrete barriers shatter into chunks; tiny sparks and debris sprites. A green phosphor outline of the small robot Rivet glows inside the tank silhouette. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. Late-90s game HUD: top-left cash '$0063900' in chunky yellow digits; top-right four of six police badges lit; top-centre a draining bar labelled 'HAULER 07s'; bottom-left round 'VOICES' dial with the needle in the CHOIR band and the HAULER portrait glowing; bottom pager box 'HAULER: I LOVE YOU, LITTLE CARS'. No real logos, no watermark.
```

*Generation note:* Attempt 1 kept. Heat shows 5 blue badges rather than 4 of 6 gold.

### Shot 3: a chase with heat and the city (`shot-3.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a 1999 PC top-down open-city crime game: pre-rendered 3D sprites over a textured 3D block city, 16:9. Camera high above, looking almost straight down with perspective, so the rooftops of tall buildings lean outward from the centre: a downtown grid at night with roof vents, rooftop neon billboards, a raised train track, sodium-orange street lights, wet reflective roads. A small stolen red muscle car drifts round a corner leaving tyre marks; behind it a pack of police cruisers with red and blue light bars, a black SWAT van, and two olive army tanks rolling in from a cross street; a helicopter shadow and searchlight circle on the road; burning wrecks. Small pedestrians run. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. Late-90s game HUD: top-right six police-badge icons all lit and a seventh army star lit; top-left cash '$0127450' in chunky yellow digits; a big yellow arrow at the screen edge pointing to the objective; top-centre a radio banner 'CRUMB FM 94.1'; bottom pager box 'PATCH: PAYPHONE ON 9TH IS RINGING. ANSWER IT.'. No real logos, no watermark.
```

*Generation note:* Attempt 1 kept. The pager reads "PAYHONE" (model typo). The camera sits at about 55 degrees rather than near-vertical, so buildings lean less than GTA 2 and the spec intend.

### Rivet concept (`rivet.jpg`, 1104x1472, qwen-image)

```text
Character render of RIVET, an original video game robot protagonist, in the style of a late-1990s pre-rendered CGI game render from a PC game manual: smooth ray-traced plastic and metal, soft baked lighting, slightly soft focus, dark background with a blue-grey gradient. Full body, front three-quarter view. A tall narrow exhausted factory spot-welding robot: a welder-mask visor for a face with a glowing amber slit, gunmetal and scorched steel plates, orange and black hazard stripes on the shoulders, stencilled number L9-04, one forearm ends in a welding torch with a small blue flame, the other in a heavy three-finger clamp, an employee badge on a lanyard, slightly slouched. Four faint green phosphor wireframe ghosts of dead robots hang behind it: a driver bot, a turret bot, a huge tank bot, and a small paint-sprayer bot. At the bottom of the image, small, the same robot seen from directly above as a game sprite on a dark tile. Strong readable silhouette, portrait. No text, no logos, no watermark.
```

*Generation note:* Planned on Leonardo (portrait 1024x1536); Leonardo refused before generating ("not enough api tokens"), so it was rendered on qwen-image at 1104x1472 (3:4 portrait). Attempt 1 kept. The "top-down sprite" inset shows a back view, not a true overhead view.
