# Variant 1: DEAD INK

> **A cheap two-ink crime print where the dead are the only thing in teal, and they will not shut up.**

This is A/2's risograph noir, adapted honestly. A/2 proposed it as a 3D scene under a print post-process. This variant keeps that route because it is the only honest way to get a riso look: 2D-painted riso frames would need hand-painted or AI art.

---

## 1. The art idea

**Every frame is a cheap two-ink print of a crime, and the dead are the only thing printed in teal.**

Everything below follows from that sentence. If a rule ever fights the sentence, the sentence wins.

| Axis | Rule |
|---|---|
| **Camera** | Overhead at 65 to 70 degrees pitch, long lens (~25 degree FOV), so it reads almost orthographic. Gameplay zoom puts Rivet at about 64 px tall at 1080p (56 px minimum on Steam Deck). The camera pulls back with speed in cars. |
| **Rendering** | 3D low-poly in engine, flat-lit, with **one full-screen post-process** that separates the frame into ink plates. Luminance and a per-object stencil decide which plate each pixel goes to. The plates get a screen-locked ordered halftone, per-plate misregistration of 0 to 4 px, a paper-grain multiply and an edge-detect ink outline. No textures on models: vertex colour only. |
| **Palette** | Cream paper `#F2E8D5` (the "white", never printed). Violet-black ink `#17131B` (outlines, shadow, text). Vermilion `#E8502A` (humans, police lights, blood, heat). Teal `#1FB5A8`, **exclusive to the dead**: souls, ghosts, residues and the voices' captions. Nothing else. Tints are halftone percentages of those four, never new hues. |
| **Silhouette and readability** | Identity comes from **plate plus pattern, never from hue**. Cops: vermilion plate, solid. Soldiers: ink plate with a diagonal hatch. Robots: ink outline with a cream body. Rivet: the only robot with a 100% vermilion stripe (its hazard collar). Characters never go below 40% halftone, so they never dissolve into dots. Shapes from above: humans round, robots boxy, cars long. |
| **Violence** | Brutal and printed. A kill drops a vermilion **rubber stamp** (splat, star or a cop's badge outline). Gibs are torn-paper shards. Corpses become halftone ink smears that fade over 20 s. No realistic gore at all: the print does the cruelty. |
| **UI / HUD** | The HUD is **office paperwork**. Cash is a punch-clock card. Heat is a row of WANTED rubber stamps, the sixth reading ARMY. Madness is a printed form, *STATIC*, with four checkboxes. The weapon is a perforated ticket. Jobs are torn job tickets. The soul selector is four stamped ID photos. Voice captions are teal typewriter text. The profanity option is a form: you tick OFF, a pen strikes it out and writes "ON (sorry)". |

---

## 2. Production recipe (Blender and code only)

| Asset | How it gets made |
|---|---|
| **Character model** | A bpy script builds Rivet from about 25 primitives (box, cylinder, bevel and solidify modifiers) at 1.5 to 2.5k tris, plus a 14-bone armature. Vertex colour encodes the plate (R = vermilion share, G = teal, B = ink density), so the shader knows what prints where. Cops, soldiers and bosses are parameter variants of three generators (human, boxy bot, tracked bot). |
| **Walk, roll, shoot, die** | Keyframes authored in Blender Python, using the same code-authored-animation path PoF already runs. At 65 degrees and 64 px, a pose reads as a silhouette, so 4 key poses per action are enough: walk is a 16-frame loop; roll is 12 frames; shoot is an additive upper-body recoil of 4 frames for each of three weapon holds (one-hand, two-hand, heavy); die is three authored falls that hand off to ragdoll. Exported as FBX. |
| **Car** | A bpy kit: chassis box with bevel, cabin, 4 wheels, at 600 to 900 tris. Six body types come from a parameter table (sedan, cruiser, van, truck, armoured truck, tank). Damage is three swapped mesh states, with doors and hood as separate physics pieces. |
| **City block** | A bpy procedural kit on an 8 m grid: block shells extruded from footprints, roof props (water tanks, AC units, billboards), road and sidewalk tiles, flat vertex colour. One block is about 6k tris. Districts are assembled in code from a layout JSON, which is the zone-map / city-blocks pipeline. |
| **The look** | One post-process material: plate separation, halftone, misregistration, grain and outline. Teal is gated by stencil, so only objects tagged *Dead* can ever print teal. |

**Engines that render it natively**
- **UE 5.8:** post-process material plus Custom Depth/Stencil. Native, and PoF's bridge already verifies it (materials pipeline, headless frames).
- **Godot 4:** a full-screen quad shader reading `screen_texture` and `depth_texture`. Native.
- **Unity 6 (URP):** Full Screen Pass Renderer Feature plus Shader Graph. Native.

**Hardest asset: the riso pass under motion.** Halftone dots "swim" when the camera pans, and small characters can dissolve when only two inks carry them, especially on the Deck at 1280x800. The fix has three parts:
- dots locked to screen space, with the camera snapping to whole-dot steps (the pixel-art camera-snap trick);
- characters assigned to plates by stencil, with a 40% halftone floor;
- a recorded readability gate: 5 of 5 strangers find Rivet within 1 s in 20 random frames.

**Cost:** about 4 agent-weeks for the shader and the readability gate. It is the only bespoke asset; everything after it is cheap primitives.

**Feasibility verdict: GREEN. Fully Blender and code, and native in all three engines, with the strongest fit in UE 5.8, where PoF's bridge already lives. The risk is one shader, and it is retired by a frame test, not by art volume. No policy change.**

---

## 3. The game, as DEAD INK reads it

The tone is noir grief played for laughs: the dead are funny, the living are the joke, and the print makes it look like evidence.

### Story beats per act

| Part | Beats in this variant |
|---|---|
| **Prologue** (in-engine, ~4 min) | Plant 9, Line 9, Allied Motorworks. A firmware push, CLEAN SWEEP, runs down the line. Robots freeze, overheat and fall in sequence. **This is the first time the game prints anything in teal**: four souls leave four bodies. Rivet survives at the end of the line. Human police arrive; Rivet takes them apart in vermilion stamps. |
| **Clock-Out** (~15 min) | The loading yard and the gate. Electroshock melee, then the roll. The voices are only static and fragments ("...left...", "...hot..."). It ends on a cop's pistol. |
| **Act 1, "Probation"** | Lady Cathode hires Rivet (friendly boss); Don Fax and Sister Suction give gigs; Patch's payphones ring. **General Krump** comes on the radio with bounties on "rogue robots". **Soul 1: Gearbox.** The first voice becomes a person, in a getaway job where it backseat-drives. **Boss: King**, a collaborator who rules the Foundry Ward for the human Inspector, taxing robot scrap. His tin crown prints as a vermilion stamp when he dies. |
| **Act 2, "Overtime"** | Big Lenny Lift and Vend-Etta take over the jobs. **Soul 2: Sentry.** **Boss: Servo**, a collaborator and scab who drives corporate convoys. His crates are stencilled *CS*. Krump's bounty targets and the bosses' targets start to overlap. |
| **Act 3, "Restructuring"** | **Boss: Torque**, crazy, a fever-brained riveter. His "military cooling chassis" carries the same *CS* stencil. **Twist:** the military built the crazies, and CLEAN SWEEP was the line accident. **Betrayal: Don Fax.** Rivet finds his faxes in Krump's printer tray, every job since Act 1, in the same ink as the HUD. He sets Rivet up at a laundromat meeting. Krump's radio turns hostile. **Soul 3: Hauler.** |
| **Act 4, "Final Notice"** | **Soul 4: Mop.** **Boss: Kronk**, crazy, the "Scrap-God Messiah" running military firmware, worshipped in the junkyard. Then the road to D.C. and Krump's lackeys: Filibuster, the Pundit and Whip Hand. |
| **Finale, "The Pentagon"** | One continuous raid through five rings of corridor. Each ring favours one soul, and the fifth demands fast switching between all four. **Punchline (b):** Rivet wins, and the voices go quiet. **The teal plate is pulled from the print.** The last minute is cream paper, vermilion and ink, and nothing else. Rivet walks out through a silent city: "...Hello? Guys?" The first silence in the game, played as horror. |

### Cast assignments
- **Protagonist:** Rivet.
- **Human antagonist:** General Krump. He is radio only until the finale, where he appears as a printed briefing photo with his face scribbled out by the voices. He is an archetype: no real likeness, no real voice, no real slogans.
- **Act bosses:** King (Act 1, collaborator), Servo (Act 2, collaborator), Torque (Act 3, crazy), Kronk (Act 4, crazy).
- **Friendly bosses:** Lady Cathode (Act 1), Don Fax (Acts 1 to 3, the **betrayer**), Big Lenny Lift (Act 2, then a finale ally), Vend-Etta (Act 2), Sister Suction (Act 1 gigs), The Valet (car jobs, tied to Gearbox), Brick Daddy (Act 3 and 4 demolition).
- **Voices of the world:** MC Crumbtray on CRUMB FM (the radio), Patch (payphones), and CORE-ZERO as lore: the "Grand Recycler" is where dead cores should go. Rivet is carrying four cores that never arrived.

### The four souls

| Soul | Ability | Upgrade path | On screen in this style |
|---|---|---|---|
| **Gearbox** | Car manipulation: hijack any car in view | Range, then **residue** (the car keeps your last order), then two cars at once, then car bomb | Teal ink tethers to the car; the hijacked car gets a teal ghost driver and long-exposure teal trails |
| **Sentry** | Remote turret hack | Duration, then deploy your own turret, then chain three, then police drones | Teal crosshair stamps on every hackable turret; hacked turrets fire teal tracers |
| **Hauler** | Tank transform for N seconds | Duration, then cannon, then stomp shockwave, then ramming armour | Rivet's silhouette re-prints as a huge teal-and-ink tank; the stomp ring is a halftone shockwave |
| **Mop** *(4th soul)* | Swarm: split into micro-drones to scout, sneak and detonate | Swarm size, then stealth past cops, then kamikaze, then reassemble behind a target | Twenty teal dots move like a misregistered halftone; bodies are "spills" that it tidies away |

### Madness bands on screen

| Band | What the print does |
|---|---|
| **Lucid** | Perfect registration. The STATIC form is clean. One teal caption at a time, and Rivet says "I". |
| **Crowded** | The teal plate drifts 2 to 4 px out of register. Captions overprint each other. Soul cooldowns are shorter, shown as pen ticks on the form. |
| **Choir** | Teal silhouettes of the dead appear around Rivet. **The voice that grabs the wheel prints its silhouette over Rivet's**, so you see who is driving. The form gets ballpoint scribbles, and captions switch to "we". |
| **Chorus** | All four silhouettes overprint at once and teal floods to 60% coverage for the 10-second spike. Then the teal plate is pulled entirely: 1.5 s of cream-and-ink silence, and the crash. |

### Combat
- **Start bare-handed** with electroshock melee. The tutorial ends on a cop's pistol.
- **Pickups, GTA 2 style:** pistol, SMG, shotgun, welding-torch flamethrower, rocket launcher, electro-net, coolant bombs.
- **The roll** is core from minute one. It has i-frames, and a roll through a cop's legs prints a vermilion stamp.
- **Kills and economy:** every kill stamps the paper. Cash buys weapons, ammo and soul upgrades at the hub (the Break Room punch clock).

### Heat (WANTED stamps)
1. Patrol cop on foot.
2. Cruisers.
3. Riot squad and SWAT van.
4. Feds in black sedans.
5. National Guard.
6. **ARMY**: Krump's tanks and helicopters.

The sixth stamp arrives far too fast for a "robot problem", and that speed is the foreshadowing. Heat drops by breaking line of sight and hitting a payphone (Patch "loses the paperwork").

### Stances on the open decisions

| Open item | DEAD INK's stance | Why it fits this look |
|---|---|---|
| Fourth soul | **Mop** (swarm) | A hitman's stealth verb; its swarm reads as loose halftone dots, the most "riso" ability possible |
| Act antagonist order and allegiance | **King (collab) → Servo (collab) → Torque (crazy) → Kronk (crazy)** | Collaborators first makes the early acts a class war against scabs; the crazies arrive after the player knows madness was installed |
| Betrayer | **Don Fax** | The betrayal is *printed*: his faxes turn up in Krump's tray in the HUD's own ink, so the evidence is on paper |
| Final punchline | **(b) The voices go quiet; silence as horror** | The teal plate is pulled from the print. The look itself delivers the ending |

---

## 4. Sample lines (target voice)

1. **Rivet** (Lucid, first cop down): "I'm not angry. I'm a welder. I'm just extremely fucking thorough."
2. **Hauler** (Choir, punching a riot shield): "Again. Harder. Through him. Through the building. Through the whole concept of police."
3. **Gearbox** (hijacking a car): "I'm in his car, I'm in his car. Who leaves a sedan in neutral? Animals. Mirror, signal, MURDER."
4. **Sentry** (turret hack): "Unauthorised personnel detected. Correction: authorised personnel, no longer authorised to be alive. Paperwork to follow."
5. **Mop** (swarm kill): "Spill on aisle four. Big spill. Wearing a medal. Disgusting."
6. **Don Fax** (Act 1 briefing): "PER MY LAST FAX: the alderman's in the steam room. Make it hotter. Hold on. Toner low. TONER LOW. Who the fuck prints in colour in this family?"
7. **General Krump** (radio, Act 1): "This is General Krump. Some robots have gone rogue, and 'rogue' is a word I invented. Kill the one in the laundromat. Cash on delivery. Greatness on delivery."
8. **General Krump** (Act 3, hostile): "You were a contractor, son. Contractors don't get to read the contract. They get to BE the contract. In a bag."
9. **Lady Cathode** (Act 1 briefing): "Darling, they put an 8K screen in the cathedral. In the CATHEDRAL. Go show God what a cathode ray does to a man's face."
10. **Rivet** (the ending, alone): "...Hello? Guys? ...I can hear the fridge. I fucking hate this."

---

## 5. Prompts (verbatim, as rendered)

All four were rendered on **qwen-image** (DashScope). Leonardo was the planned provider for the Rivet portrait, but the account was out of API tokens; see `prompts.json` for the per-image notes.

### Shot 1: on-foot combat with the madness HUD (`shot-1.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a shipped top-down crime video game, 16:9. Fixed overhead camera at 70 degrees pitch, long lens, almost orthographic. Gameplay scale: characters are small, each about one tenth of screen height. The whole frame is printed as a two-ink risograph on warm cream paper: halftone dot shading, slightly misregistered ink plates, paper grain, bold near-black outlines, flat shapes. Scene: night, a factory loading yard with painted lines, pallets and a chain-link fence. Centre: RIVET, a tall narrow scorched-steel welding robot with a welder-mask head, seen from above, drives a crackling electric fist into a riot cop; four small riot cops with round shields close in; one lies flat on a vermilion rubber-stamp splat; a dropped pistol on the asphalt. Four faint translucent teal robot silhouettes hover around Rivet. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B. HUD printed like office forms: top-left a punch-clock card 'CASH $1,240'; top-right a row of five rubber stamps 'WANTED' with two inked; bottom-left a printed form 'STATIC' with four checkboxes LUCID CROWDED CHOIR CHORUS, CROWDED ticked in pen; bottom-right a ticket 'FISTS'; bottom-centre a small teal caption 'HAULER: again. harder.' No photorealism, no real logos, no watermark.
```

*Generation note:* Attempt 1 kept. The camera sits a little closer than final gameplay zoom, so characters are about 1/5 of frame height. The ghosts read as humanoid silhouettes rather than the four specific dead robots.

### Shot 2: a soul ability in use (`shot-2.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a shipped top-down crime video game, 16:9, overhead camera at 70 degrees, near-orthographic, gameplay scale. Rendered as a two-ink risograph print on cream paper: halftone dots, misregistered plates, paper grain, bold dark outlines, flat low-poly shapes. Scene: dusk, a city intersection with crosswalks, low boxy buildings seen from above with flat roofs and water tanks. Centre: RIVET, a small narrow welding robot, one arm raised; thin teal ink lines run from its hand to three boxy sedans. The first hijacked sedan swerves and T-bones a police cruiser; the second drives itself away with a translucent teal ghost driver trailing long-exposure streaks; the third spins toward a cop barricade. Small pedestrians scatter. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B; teal is used only for the soul power and ghosts. HUD printed like forms: bottom-centre four stamped portrait squares labelled GEARBOX SENTRY HAULER MOP with GEARBOX circled in teal and a cooldown ring; bottom-left form 'STATIC' with CHOIR ticked and pen scribbles over it; top-left punch card 'CASH $8,915'; top-right three of five 'WANTED' stamps inked. No photorealism, no real logos, no watermark.
```

*Generation note:* Attempt 1 kept. The soul-selector portraits came out as human faces; the souls are dead robots, so treat these as placeholders. WANTED shows 4 stamps instead of 3 of 5, and the buildings drift toward brick-maroon, outside the four-ink rule.

### Shot 3: a chase with heat and the city (`shot-3.jpg`, 1664x928, qwen-image)

```text
In-game screenshot of a shipped top-down open-city crime video game, 16:9, overhead camera at 65 degrees pitch pulled back for a chase, near-orthographic, gameplay scale with cars small. The frame is a two-ink risograph print on cream paper: halftone dot shading, misregistered plates, visible paper grain, bold dark outlines. Scene: night, a long four-lane avenue between blocks of flat-roofed buildings, rooftop billboards, a rail bridge. A small boxy stolen sedan races up the avenue; six police cruisers chase it in a wedge, sirens drawn as vermilion starbursts; an olive military armoured truck pushes out of a side street; the circle of a helicopter searchlight sweeps the road; wrecked cars burn behind. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B. HUD printed like forms and stamps: top-right a row of six 'WANTED' rubber stamps, five inked, the sixth stamped 'ARMY'; top-left punch card 'CASH $22,300'; right edge a small printed street-map minimap with a vermilion route line; top-centre a torn job ticket 'JOB: DELIVER THE FAX 01:42'; bottom-left form 'STATIC' with LUCID ticked. No photorealism, no real logos, no watermark.
```

*Generation note:* Attempt 1 kept. This frame drifts furthest from the palette: violet ink dominates and teal appears on billboards, which breaks the rule that teal belongs only to the dead. The stamp text is doubled ("WANTED WANTED") and the camera pitch is lower than specified. Kept because it reads as a real chase frame; in production the plate rule is enforced by the shader, which concept art cannot do.

### Rivet concept (`rivet.jpg`, 1104x1472, qwen-image)

```text
Character concept art of RIVET, an original video game robot protagonist, full body, front three-quarter view, printed as a two-colour risograph poster on warm cream paper. A tall narrow exhausted factory spot-welding robot: a welder-mask visor for a face with two thin teal slit eyes, one forearm ends in a welding torch, the other in a heavy three-finger clamp, scorched steel plates with stencilled number L9-04, a hazard-striped collar, an employee badge on a lanyard, a slight tired slouch. Rising from its chest like steam are four translucent teal ghosts of dead factory robots, mid-argument: a nervous driver bot with a steering-wheel head, a paranoid security-turret bot, an enormous gentle hydraulic press bot, and a tiny floor-cleaning disc bot. Bold black ink outlines, halftone dot shading, slight misregistration of the ink plates, visible paper grain, flat shapes. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, near-black violet ink 17131B. Strong readable silhouette, centred, portrait. No text, no logos, no watermark.
```

*Generation note:* Planned on Leonardo (portrait 1024x1536); Leonardo refused before generating ("not enough api tokens"), so it was rendered on qwen-image at 1104x1472 (3:4 portrait). Attempt 1 kept. It shows six ghosts instead of four. The silhouette is strong.
