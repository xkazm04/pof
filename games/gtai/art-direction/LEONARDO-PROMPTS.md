# Leonardo prompts: GTAI art directions

These are the 12 prompts behind the concept images in `variant-*/`, ready to paste into Leonardo, plus 3 camera-test prompts. The concept round rendered them on Qwen-Image because the Leonardo API account had no credit, so Leonardo will look different. That difference is part of the test.

**Suggested Leonardo settings**

| Setting | Value |
|---|---|
| Model | **Lucid Origin**, which renders HUD text best; Phoenix 1.0 as a second try |
| Gameplay shots | 16:9, 1472x832 or larger |
| Rivet | 2:3 or 3:4, portrait |
| Prompt Enhance | **OFF**, so the palette and HUD wording stay exact |
| Style | None or Dynamic |
| Images per prompt | 4 |

**Negative prompt**, where the model accepts one: `photorealistic, photograph, real logos, watermark, signature, isometric 45 degree view, poster composition, close-up portrait of characters, human faces on robots, blurry text, misspelled text`

The image every prompt must produce is **a real in-game frame from a shipped top-down game**, not a poster. If Leonardo zooms in on the characters, add: *"gameplay scale, characters very small, wide view of the whole street"*.

## V1 DEAD INK: risograph noir, 3D low-poly with a two-ink print shader

### shot-1

```text
In-game screenshot of a shipped top-down crime video game, 16:9. Fixed overhead camera at 70 degrees pitch, long lens, almost orthographic. Gameplay scale: characters are small, each about one tenth of screen height. The whole frame is printed as a two-ink risograph on warm cream paper: halftone dot shading, slightly misregistered ink plates, paper grain, bold near-black outlines, flat shapes. Scene: night, a factory loading yard with painted lines, pallets and a chain-link fence. Centre: RIVET, a tall narrow scorched-steel welding robot with a welder-mask head, seen from above, drives a crackling electric fist into a riot cop; four small riot cops with round shields close in; one lies flat on a vermilion rubber-stamp splat; a dropped pistol on the asphalt. Four faint translucent teal robot silhouettes hover around Rivet. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B. HUD printed like office forms: top-left a punch-clock card 'CASH $1,240'; top-right a row of five rubber stamps 'WANTED' with two inked; bottom-left a printed form 'STATIC' with four checkboxes LUCID CROWDED CHOIR CHORUS, CROWDED ticked in pen; bottom-right a ticket 'FISTS'; bottom-centre a small teal caption 'HAULER: again. harder.' No photorealism, no real logos, no watermark.
```

### shot-2 *(prompt fixed: the soul portraits now ask for robot heads, not human faces)*

```text
In-game screenshot of a shipped top-down crime video game, 16:9, overhead camera at 70 degrees, near-orthographic, gameplay scale. Rendered as a two-ink risograph print on cream paper: halftone dots, misregistered plates, paper grain, bold dark outlines, flat low-poly shapes. Scene: dusk, a city intersection with crosswalks, low boxy buildings seen from above with flat roofs and water tanks. Centre: RIVET, a small narrow welding robot, one arm raised; thin teal ink lines run from its hand to three boxy sedans. The first hijacked sedan swerves and T-bones a police cruiser; the second drives itself away with a translucent teal ghost driver trailing long-exposure streaks; the third spins toward a cop barricade. Small pedestrians scatter. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B; teal is used only for the soul power and ghosts. HUD printed like forms: bottom-centre four stamped portrait squares of ROBOT heads (a steering-wheel driver bot, a turret dome bot, a hydraulic press bot, a floor-cleaning disc bot), labelled GEARBOX SENTRY HAULER MOP with GEARBOX circled in teal and a cooldown ring; bottom-left form 'STATIC' with CHOIR ticked and pen scribbles over it; top-left punch card 'CASH $8,915'; top-right three of five 'WANTED' stamps inked. No photorealism, no real logos, no watermark.
```

### shot-3

```text
In-game screenshot of a shipped top-down open-city crime video game, 16:9, overhead camera at 65 degrees pitch pulled back for a chase, near-orthographic, gameplay scale with cars small. The frame is a two-ink risograph print on cream paper: halftone dot shading, misregistered plates, visible paper grain, bold dark outlines. Scene: night, a long four-lane avenue between blocks of flat-roofed buildings, rooftop billboards, a rail bridge. A small boxy stolen sedan races up the avenue; six police cruisers chase it in a wedge, sirens drawn as vermilion starbursts; an olive military armoured truck pushes out of a side street; the circle of a helicopter searchlight sweeps the road; wrecked cars burn behind. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B. HUD printed like forms and stamps: top-right a row of six 'WANTED' rubber stamps, five inked, the sixth stamped 'ARMY'; top-left punch card 'CASH $22,300'; right edge a small printed street-map minimap with a vermilion route line; top-centre a torn job ticket 'JOB: DELIVER THE FAX 01:42'; bottom-left form 'STATIC' with LUCID ticked. No photorealism, no real logos, no watermark.
```

### rivet

```text
Character concept art of RIVET, an original video game robot protagonist, full body, front three-quarter view, printed as a two-colour risograph poster on warm cream paper. A tall narrow exhausted factory spot-welding robot: a welder-mask visor for a face with two thin teal slit eyes, one forearm ends in a welding torch, the other in a heavy three-finger clamp, scorched steel plates with stencilled number L9-04, a hazard-striped collar, an employee badge on a lanyard, a slight tired slouch. Rising from its chest like steam are four translucent teal ghosts of dead factory robots, mid-argument: a nervous driver bot with a steering-wheel head, a paranoid security-turret bot, an enormous gentle hydraulic press bot, and a tiny floor-cleaning disc bot. Bold black ink outlines, halftone dot shading, slight misregistration of the ink plates, visible paper grain, flat shapes. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, near-black violet ink 17131B. Strong readable silhouette, centred, portrait. No text, no logos, no watermark.
```

## V2 SODIUM: pre-rendered 3D sprites over a 3D block city at night

### shot-1

```text
In-game screenshot of a top-down crime video game whose characters are pre-rendered 3D CGI sprites over a 3D block city, 16:9. Camera high above looking straight down at 85 degrees, wide view of a whole street block, so building rooftops lean slightly outward from the screen centre. Gameplay scale: every character is tiny, about one sixteenth of the screen height, seen from directly above (head and shoulders, no faces). Scene: night, a wet back street behind a diner, puddles reflecting sodium-orange street lamps, dumpsters, parked cars, pink neon glow spilling from a sign on the diner roof. Centre: RIVET, a tiny gunmetal robot seen from above (welder-mask head, broad shoulder plates) fires a pistol, a bright muzzle flash lights the asphalt; three tiny police officers return fire from behind a cruiser with red and blue lights; one officer lies in a dark red pool; scattered shell casings. Four faint green phosphor outlines of robots flicker around Rivet. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. HUD: top-left cash in chunky yellow digits '$0041250'; top-right six police-badge icons, three lit, and a pistol icon with '34'; bottom-left a round dial labelled VOICES with four tiny robot heads and a needle pointing at the word CROWDED; bottom-centre a pager box with the exact text 'SENTRY: TWO ON THE LEFT!'. No real logos, no watermark.
```

### shot-2

```text
In-game screenshot of a 1999 PC top-down crime game made of pre-rendered 3D sprites over a 3D block city, 16:9. Camera almost straight down with perspective so buildings lean outward from the screen centre. Night, sodium-orange street lights, wet asphalt, neon. Centre: the player has transformed into HAULER, a huge pre-rendered tank robot seen from above, wide caterpillar tracks, a hydraulic press body, a stubby cannon arm, rivets and hazard stripes; it stomps through a police roadblock and a white shockwave ring spreads across the road; two police cruisers are flipped and crushed; a third is mid-air; small officers fly backwards; concrete barriers shatter into chunks; tiny sparks and debris sprites. A green phosphor outline of the small robot Rivet glows inside the tank silhouette. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. Late-90s game HUD: top-left cash '$0063900' in chunky yellow digits; top-right four of six police badges lit; top-centre a draining bar labelled 'HAULER 07s'; bottom-left round 'VOICES' dial with the needle in the CHOIR band and the HAULER portrait glowing; bottom pager box 'HAULER: I LOVE YOU, LITTLE CARS'. No real logos, no watermark.
```

### shot-3

```text
In-game screenshot of a 1999 PC top-down open-city crime game: pre-rendered 3D sprites over a textured 3D block city, 16:9. Camera high above, looking almost straight down with perspective, so the rooftops of tall buildings lean outward from the centre: a downtown grid at night with roof vents, rooftop neon billboards, a raised train track, sodium-orange street lights, wet reflective roads. A small stolen red muscle car drifts round a corner leaving tyre marks; behind it a pack of police cruisers with red and blue light bars, a black SWAT van, and two olive army tanks rolling in from a cross street; a helicopter shadow and searchlight circle on the road; burning wrecks. Small pedestrians run. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. Late-90s game HUD: top-right six police-badge icons all lit and a seventh army star lit; top-left cash '$0127450' in chunky yellow digits; a big yellow arrow at the screen edge pointing to the objective; top-centre a radio banner 'CRUMB FM 94.1'; bottom pager box 'PATCH: PAYPHONE ON 9TH IS RINGING. ANSWER IT.'. No real logos, no watermark.
```

### rivet

```text
Character render of RIVET, an original video game robot protagonist, in the style of a late-1990s pre-rendered CGI game render from a PC game manual: smooth ray-traced plastic and metal, soft baked lighting, slightly soft focus, dark background with a blue-grey gradient. Full body, front three-quarter view. A tall narrow exhausted factory spot-welding robot: a welder-mask visor for a face with a glowing amber slit, gunmetal and scorched steel plates, orange and black hazard stripes on the shoulders, stencilled number L9-04, one forearm ends in a welding torch with a small blue flame, the other in a heavy three-finger clamp, an employee badge on a lanyard, slightly slouched. Four faint green phosphor wireframe ghosts of dead robots hang behind it: a driver bot, a turret bot, a huge tank bot, and a small paint-sprayer bot. At the bottom of the image, small, the same robot seen from directly above as a game sprite on a dark tile. Strong readable silhouette, portrait. No text, no logos, no watermark.
```

## V3 SATURDAY MORNING MASSACRE: Flash-cartoon cutout rigs

### shot-1

```text
In-game screenshot of a top-down cartoon crime video game in 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours with one hard cel shadow, no gradients, bright daylight, 16:9. Camera high and looking straight down at 80 degrees, wide view of a whole parking lot and the street beside it. Gameplay scale: every character is a tiny cutout puppet seen from above, about one fourteenth of the screen height, big round heads, noodle arms. Scene: a sunny strip-mall parking lot with painted bays, shopping carts, palm trees, a donut-shop roof with a giant pink donut, a street with a crosswalk. Centre: RIVET, a tiny mustard-yellow robot with a black welder-mask head, punches a cop with a cyan zig-zag lightning bolt, the cop's hat flies off; five more tiny cops with big pistols run in from a police car with spinning lights; one cop lies flat on a red star-shaped splat; small cartoon bullets streak across. Three small speech balloons above Rivet: 'HIT HIM WITH A CAR!' 'THERE IS NO CAR!' 'MAKE ONE!'. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, cyan 27C7E8, cop blue 2F6FDB, cartoon red E8343B, pink FF6FB5. Chunky rounded HUD with thick outlines: top-left '$3,200' money bubble; top-right five siren lights, two lit; bottom-left a round dial with Rivet's mask in the middle, four small robot heads around the rim, needle in an orange zone labelled CHOIR. No real logos, no watermark.
```

### shot-2

```text
In-game screenshot of a top-down cartoon crime video game, 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours with one hard cel shadow, bright daylight, 16:9, camera straight down, gameplay scale with small cutout-puppet characters. Scene: a military checkpoint on a city street: sandbags, striped boom gate, two automatic gun turrets on posts. RIVET has switched to its SENTRY soul: a mustard-yellow robot puppet now wearing a cyan security-dome head with a little antenna and a clipboard; cyan zig-zag hack lines run from its hand to both turrets; the turrets have spun around and spray cartoon bullet streaks into a squad of soldiers in olive helmets and riot cops diving behind sandbags; one soldier's helmet pops off, stars and tiny red splats fly; a hacked police drone wobbles overhead. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, soul cyan 27C7E8, cop blue 2F6FDB, army olive 6B7A3A, cartoon red E8343B. Chunky rounded HUD with thick outlines: bottom-centre a soul wheel of four robot heads with the SENTRY head enlarged and glowing cyan; above it a bar 'HACK 0:07'; top-left '$9,450' money bubble; top-right three of five siren lights spinning; a speech balloon from Rivet 'SENTRY: THIS IS A RESTRICTED AREA. FOR THEM.'. No real logos, no watermark.
```

### shot-3

```text
In-game screenshot of a top-down open-city cartoon crime video game, 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours with one hard cel shadow, 16:9. Camera straight down, pulled back for a chase; flat-coloured roofs of buildings are offset to fake height, so the walls show as thin slanted strips, like a cut-paper diorama. Afternoon, a cartoon downtown grid with crosswalks, a fountain plaza, rooftop air-conditioners. A stolen pastel-pink ice-cream truck with a mustard-yellow robot at the wheel careens round a corner on two wheels, scattering cones; behind it five blue police cars with big round sirens, a military jeep, and a rounded cartoon army tank crushing a hot-dog cart; a helicopter's round shadow; motion lines and dust puffs. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, soul cyan 27C7E8, cop blue 2F6FDB, army olive 6B7A3A, cartoon red E8343B, pink FF6FB5. Chunky rounded HUD with thick outlines: top-right five siren lights all spinning plus a green army helmet icon; top-left '$31,700' money bubble; top-centre a banner 'GET TO THE CAR WASH 0:58'; bottom-right a round minimap with a dotted route; bottom-left the madness dial with the needle in the green LUCID zone. No real logos, no watermark.
```

### rivet

```text
Character model sheet of RIVET, an original cartoon robot protagonist for a video game, in the style of a 2000s Flash cartoon: flat vector shapes, thick uniform black outlines, flat colours with one hard cel shadow, no gradients, on a plain off-white background. Large hero pose: a tall narrow factory spot-welding robot, mustard yellow with chipped grey plates, a black welder-mask visor head with two cyan slit eyes and an exhausted, deadpan expression, long noodle arms, one hand a welding torch with a cartoon blue flame, the other a three-finger clamp, an employee badge on a lanyard, big flat feet. Beside it, smaller: the same robot as a flat cutout puppet seen from directly above, and an exploded parts layout of the puppet (head, visor, torso, upper arm, forearm, torch hand, clamp hand, feet) with small pivot dots at each joint. Four small cyan ghost heads of dead robots float around the hero: a driver bot, a turret dome bot, a big tank bot and a magnet crane bot. Strong readable silhouette, portrait. No text, no logos, no watermark.
```

## Camera test: the GTA 2 near-vertical camera

All nine concept shots drew a camera at about 45-65°. GTA 2 looked almost straight down. That is the open camera-pitch decision: near-vertical lets one sprite rotate freely and is cheap to animate; at 45° every character needs 8 directional sprite sets, or 3D. Render each style once at 90° and judge whether it still reads, and still looks good:

### camera-90 for V1 (1068 chars)

```text
In-game screenshot of a top-down crime video game, 16:9. Camera directly overhead looking straight down at 90 degrees, orthographic, exactly like the 1999 game GTA 2: we see only the tops of heads, shoulders and car roofs; building walls are not visible except as thin slanted strips at the screen edges; characters very small, about one twentieth of the screen height, wide view of two street blocks. Rendered as a two-ink risograph print on warm cream paper: halftone dots, misregistered ink plates, paper grain, bold near-black outlines, flat shapes. Night, a factory loading yard beside a street; RIVET, a small narrow welding robot seen from above, shoots a pistol at three riot cops behind a cruiser; a muzzle flash; one cop on a vermilion stamp splat; four faint teal robot ghosts trail Rivet. Palette only: cream F2E8D5, vermilion E8502A, teal 1FB5A8, violet-black ink 17131B. HUD printed like office forms: punch card CASH top-left, five WANTED stamps top-right with two inked, a STATIC checkbox form bottom-left. No photorealism, no real logos, no watermark.
```

### camera-90 for V2 (1002 chars)

```text
In-game screenshot of a 1999 PC top-down crime game made of pre-rendered 3D sprites over a 3D block city, 16:9. Camera directly overhead looking straight down at 90 degrees, orthographic, exactly like the 1999 game GTA 2: we see only the tops of heads, shoulders and car roofs; building walls are not visible except as thin slanted strips at the screen edges; characters very small, about one twentieth of the screen height, wide view of two street blocks. Night, wet asphalt, sodium-orange street lamps, pink neon on a rooftop. RIVET, a tiny gunmetal robot seen from straight above, fires a pistol at police officers behind a cruiser with red and blue lights; shell casings; one officer down in a dark red pool; a stolen red car parked crooked. Palette: asphalt 1E2028, wet blue-grey 3A4150, sodium orange FFA43A, neon magenta FF3E9A, police blue 3A7BFF, phosphor green 7CFFC4. Late-90s HUD: yellow cash digits top-left, police badges top-right, a VOICES dial bottom-left. No real logos, no watermark.
```

### camera-90 for V3 (1073 chars)

```text
In-game screenshot of a top-down cartoon crime video game in 2000s Flash cartoon style: flat vector shapes, thick black outlines, flat colours, one hard cel shadow, bright daylight, 16:9. Camera directly overhead looking straight down at 90 degrees, orthographic, exactly like the 1999 game GTA 2: we see only the tops of heads, shoulders and car roofs; building walls are not visible except as thin slanted strips at the screen edges; characters very small, about one twentieth of the screen height, wide view of two street blocks. A strip-mall parking lot and a street: RIVET, a tiny mustard-yellow cutout robot puppet seen from straight above, punches a cop with a cyan lightning bolt; cops with big pistols run in from a police car; one cop flat on a red star splat; shopping carts, palm trees seen from above. Palette: outline 1B1B1F, asphalt 5B5F7A, sidewalk F4E9C9, lawn 7CC35A, mustard F6C343, cyan 27C7E8, cop blue 2F6FDB, cartoon red E8343B. Chunky rounded HUD: money bubble top-left, siren lights top-right, madness dial bottom-left. No real logos, no watermark.
```

Write down which renders you keep, with a note, and the next session records them in `pitch.md` §8 and §10.