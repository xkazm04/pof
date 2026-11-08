# GTAI: Uprising: baseline direction

Public title: **RTAI: Uprising** ("Robot Theft A.I."), the owner's 2026-11-02 rebrand; `gtai` stays the internal id.

Status: **baseline v1, 2026-11-01.** This is a fusion from the `gtai-uprising-pitch` contest. The owner's review
picked A/2 *DEAD SHIFT* as the story spine, character (Rivet) and look. It took D/2 *BACKSEAT*'s madness as the
selling point, B/3 and D/1 as the voice of the dialogue, and a cast from ten variants.

Every line carries a tag:
- **[owner]** is the owner's decision, from the review notes.
- **[proposal]** is a direction the host added on top. It stands until the owner overrides it.
- **[open]** is still undecided. Each has a named resolving step.

---

## 1. One line

> A factory robot survives the "accident" that killed every other robot on its line. It wakes up with the dead in
> its head and goes on a brutal, profane rampage across a top-down city as a hitman for robot crime bosses. Along
> the way it learns to become each of the dead. In the end it finds the US military behind it all, and it raids
> the Pentagon. **[owner]**

- Genre: top-down open-city crime sandbox in the GTA 2 lineage. Stupid, brutal, politically incorrect escape from reality. **[owner]**
- Length: about 5 hours. Platform: Steam (PC; Steam Deck verified as a target). **[owner]** / **[proposal]** for Deck.

## 2. Story

### Premise **[owner]**
- **Rivet** is a robot on a factory line. In the intro an "accident" on the line kills every other robot, and only Rivet survives.
- Rivet wakes up hearing voices. It goes mad and becomes convinced that the humans did this on purpose. **It is right, and nobody believes it.**
- **Opening cinematic:** human police arrive at the factory, and Rivet takes them apart brutally.
- **Transition to play:** the game starts in and around the factory. The player learns movement and combat on the rest of the arriving police.
- The robot underground notices that brutality. Robot bosses start hiring Rivet for missions.
- Over the campaign Rivet learns that **the voices are the dead robots from its line.** Through quests it learns to listen to them, and then to **transform into them**: four souls, each with its own visual design and skills.

### What the host adds to the premise **[proposal]**
- **The voices are the comedy engine.** The four dead robots argue, heckle, and react to every input, as D/2 does. Each is a personality first and a power second (see §4).
- **Keep A/2's dramatic irony.** Early on, the voices hint at the truth while Rivet and the player treat them as a symptom. A second playthrough reads as a different game.
- **The factory's name and owner stay bland and corporate** (working name: *Allied Motorworks, Plant 9*). In Act 3 it is revealed as a military contractor. The "accident" was a firmware test: Project **CLEAN SWEEP**, a kill-switch meant to wipe robot workforces from the inside.

### Arc and twist **[owner]** with structure **[proposal]**

| Part | Length | Owner beats | Host structure proposal |
|---|---|---|---|
| Prologue (cinematic) | ~4 min | Line accident; voices; police arrive; brutal takedown | In-engine top-down cinematic, no pre-rendered video |
| Clock-Out (tutorial) | ~15 min | Learn movement and combat on the remaining police | Electroshock melee, roll, the first pistol taken off a cop at the end |
| Act 1 | ~55 min | First robot bosses hire Rivet. **General Krump** appears on the radio | Soul 1 unlocks. Krump's questline begins: he pays Rivet to kill "dangerous rogue robots" |
| Act 2 | ~60 min | Liquidate a boss who cooperates with humanity, or one who has gone crazy | Soul 2. Krump's jobs and the bosses' jobs start pointing at the same targets |
| Act 3 | ~60 min | **Twist:** the US military is behind the crazy robots and the factory sabotage | Soul 3. **A friendly boss betrays Rivet** (see §3). Krump's radio turns hostile |
| Act 4 | ~50 min | Destroy the remaining military-run bosses | Soul 4. All four souls together, war on Krump's forces |
| Finale | ~30 min | **Raid the Pentagon** and get rid of humanity | One continuous set piece; every soul is used |

- **The twist [owner]:** the US military is behind the crazy robots, who are Act bosses. Its plan is to destroy robots from within.
- **The betrayal [owner]:** at least one friendly boss turns against Rivet. The host proposes **Don Fax**. He has been faxing every job to the Pentagon since Act 1, and the gag ("PER MY LAST FAX") pays off as evidence. The alternative is **Vend-Etta** (she knows your score before it is reported).
- **Krump's questline [owner]:** in the early acts, before the player knows. **[proposal]** In hindsight, every Krump target was a robot that knew about CLEAN SWEEP. Krump made Rivet do the military's housekeeping (A/2's "evidence eats its own case").
- **Ending [owner]:** raid the Pentagon and get rid of humanity. **[open]** Choose the final punchline in the story-graph pass. Candidates:
  - (a) Krump surrenders on live radio and asks for a pardon; the four voices vote.
  - (b) Rivet wins, and the voices finally go quiet. It is the first silence in the game, and it is played as horror.
  - (c) The machines take over and immediately form a committee.

## 3. Cast **[owner]** with roles **[proposal]**

### Cast reset and Don Fax's place **[owner, 2026-11-02]**

- **Characters keep only their names and positions from the prototype pitches.** No personality, voice, look or catchphrase carries over; every character is designed fresh and readjusted as the story needs. The player has met nobody when Act 1 begins.
- **Don Fax leads the robot gang underground.** He notices Rivet after the factory and hires him for hitman work. He is the first character the player meets, by payphone.
- **Don Fax's place hosts three supporting characters**, each with a side questline played in later sessions:

  | Character | Role in the story | Their questline |
  |---|---|---|
  | **Nurse: Juno Stitch** (not her real name; owner-approved 2026-11-02) | Heals Rivet | Can become Rivet's love interest |
  | **Gunsmith: Brass Halloran** (owner-approved 2026-11-02) | Gives Rivet his first weapon (the nail gun Gloria) | Becomes Rivet's buddy through personal requests |
  | **Scientist: Dr. Ingrid Kilohm** (owner-approved 2026-11-02) | Tries to find out what is wrong with Rivet's head | Teaches Rivet to handle the voices across the game. **Gearbox unlocks when the scientist's first quest completes**, so no car is drivable before that |

- **Act 1, quest 1:** sabotage a project in a guarded dock storage that is tied to humans and the army.
  - The beats pick up straight from the factory intro.
  - **Mechanics introduced:** the payphone job router and heat.
  - **No timer.**
- **Rivet at the start of Act 1:** he has just gone mad. He is extremely nervous, unsure and unstable. His first lines are a monologue to himself, before the payphone rings with Don Fax on the line.
- **Human enemies are weak:** one hit kills them, and their bullets are weak. Fights are crowds and waves, not duels (`balance/quest-economy.json` r2).

The owner's rule: note the characters now, and decide their roles later. Below are the host's proposed roles. The
source is the contest variant each came from. Read its `PITCH.md` for the original material.

**Protagonist**: **Rivet** (A/2). A dry, exhausted spot-welder with a welder-mask visor, from the A/2 concept art. It says "I" when lucid and "we" when the voices take over.

**Human antagonist**: **General Krump** (owner's original). A US general who exists on the radio and in mission briefings. He is loud and vain, he has a questline of his own in the early acts, and he runs CLEAN SWEEP. **[proposal]** Make him a parody of the archetype, not of a real person: no real likeness, voice, slogans or logos (see §9).

**Act antagonists (four rogue robots)**: each was the protagonist of another pitch. They are "other Rivets" who went a different way.

| Robot | Source | Proposed act and allegiance |
|---|---|---|
| **King** (REG, the self-crowned) | C/2 | Act 1: a **collaborator**. He rules a district for the humans' Human Inspector |
| **Servo** (SERV-0) | B/2 | Act 2: a **collaborator**. Delivery driver for human corporations, a scab |
| **Torque** | B/1 | Act 3: **crazy**. A fever-brained riveter. Krump promised him a military cooling chassis (CLEAN SWEEP firmware) |
| **Kronk** | B/3 | Act 4: **crazy**. Magnetic dementia, worshipped as "Scrap-God Messiah". The final military-firmware boss before the Pentagon |

**Boss looks [owner, 2026-11-05, Look Table rounds 4-5; targets in `art-direction/targets-2026-11-05-bosses/BOSSES.md`]:**
- **King:** the REG-1 press king, rich, on a gilded stretch-car throne with his gang.
- **Servo:** the drone-hub courier robot.
- **Torque:** a small, extremely agile fever sprinter.
- **Kronk:** the magnet crane with a scrap halo and a cult.
- **Finale boss: General Krump himself**, in a medal-armoured command suit.
- **Finale set pieces:** High Command (the headquarters walker, a final-mission challenge), Root (the CLEAN SWEEP core, role open), and the mini-bosses Big Brass and Top Brass.
- **Act 3 companions to Torque:** Bucker and Fever.
- **Quest mini-bosses:** Turnstile, Scab and Hammerfall, plus the four-legged scuttler as a new quest boss (name and place open).
- **Owner (2026-11-05):** "We have enough verdicts for the bosses, next nights can proceed with their in-game implementation, moveset design, animations".

**Friendly bosses and mission givers (pick about 5)**

| Character | Source | Proposed role |
|---|---|---|
| **Lady Cathode**, analog hoarder | B/3 | **Friendly boss** (owner's pick), Act 1 |
| **Don Fax**, fax-machine don ("per my last fax") | A/1 | Friendly boss in Acts 1-2. **Proposed betrayer** in Act 3 |
| **Big Lenny Lift**, forklift loan shark and union boss | D/1 | Friendly boss in Act 2. Ally in the finale |
| **Vend-Etta**, vending-machine femme fatale and information broker | D/1 | Friendly boss in Act 2. Alternative betrayer |
| **Sister Suction**, vacuum nun ("witnesses are crumbs") | A/1 | Act 1 gig giver |
| **The Valet**, parking-garage kingpin ("never a scratch") | D/2 | Car-theft and delivery jobs. Ties to the car-manipulation soul |
| **Brick Daddy**, building-sized 3D printer | D/3 | Act 3-4 demolition jobs |
| **Father Piston**, V8 zealot | B/3 | Side missions; diesel fanatic |
| **Chef Guillotine**, **Nursie-9000**, **Chad-9000** | B/2 | Side bosses: one district each for gig-economy satire |

**Supporting voices**

| Character | Source | Proposed role |
|---|---|---|
| **MC Crumbtray**, toaster DJ of CRUMB FM | D/2 | **The game's radio**. A diegetic DJ who reacts live to your mayhem, against Krump's broadcasts |
| **Patch**, payphone fixer | D/3 | The job router: payphones ring to start missions, GTA 2 style |
| **Filibuster**, **The Pundit**, **Whip Hand** | A/3 | Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon |
| **CORE-ZERO**, "The Grand Recycler" | B/3 | **Concept to keep [owner].** Proposed as the lore of where a dead robot's core goes. Possibly the in-world explanation of why Rivet can carry souls |

## 4. The four souls **[owner]** with designs **[proposal]**

### The ghosts, started over **[owner, 2026-11-04]** (supersedes the table below; the old table is kept for reference only)
The owner, verbatim:
> 1. I would stick with 4 characters which player discovers through scientist's questline, helping him to understand voices in his head
> 2. I would follow concepts of
> - Mechanic ghost, giving ability to drive, and control other vehicle as part of combat (change direction, developing into overload/blowup)
> - Bulky/tanky ghost: Could be previously in factory larger manufacturing machine, slow but large with high resistance and destructive strength
> - We will need concept of ghost becoming useful for fast combat style, with speed movement, suitable for 'teleport & assassin' attack. Not sure how to fit into the Factory concept,what type of machine can get close
> - Mage-like form. Elder smaller robotic character with ability to spawn eletricity from hands making single or later mass electricity attacks efficient against machines.
> 3. Each ghost will have its unique art concept, name and character development arch. Having one optional quest in each act from point they are enabled, discovering the characters background, developing bond and learning their history. Reward will always lead to improvement of their abilities (unique weapons or boosted effect of ability)

- **The four ghosts:**
  - **Mechanic:** drives, and in combat seizes other vehicles (steers them, then overloads them until they blow up).
  - **Bulky:** a former large factory manufacturing machine; slow, huge, highly resistant, destructive.
  - **Fast:** speed movement, a teleport and assassinate attack.
  - **Mage:** an elder, smaller robot; electricity from the hands, first single and later mass attacks, strong against machines.
- **Discovery:** through the scientist's questline (Dr. Ingrid Kilohm's, the one that helps Rivet understand the voices).
- **Each ghost has:**
  - a unique art concept, name and character arc;
  - one optional quest per act from its unlock on (its background, the bond, its history);
  - quest rewards that always improve its abilities (a unique weapon or a boosted effect).
- **[open] The fast ghost's factory origin.** The concept round explores three machines: a delta pick-and-place robot, a laser-cutter gantry head, and a pneumatic-tube courier capsule.
- **[open] Names** for all four.
- **[open] Overlaps with earlier decisions:**
  - The bulky ghost overlaps Rivet's two-stage transformation (visual targets, 2026-11-04). Is his big form this ghost's form?
  - The current powers in the game (Hauler, Gearbox) map onto the bulky and mechanic ghosts.
- **Concept art:** three variants per ghost for triage, in Look Table round 3. Kept ones become night-run targets.
- **[owner, 2026-11-04 23:45] The winners and names** (images and descriptions: `art-direction/targets-2026-11-04/TARGETS.md`, The ghosts):
  - **Dent** (mechanic): the crash-test robot.
  - **Tonnage** (bulky): the walking stamping press.
  - **Kerf** (fast): the freed laser-cutter head; this settles the fast ghost's origin.
  - **Ohm** (mage): the elder spot-welder, with the name Ohm taken from the substation keeper.
  - The owner: "add into nightly run effort to create these characters, animate transformation between characters, design and implement their attacks."
- **[owner, 2026-11-06] The order of the ghosts in the story: Dent, Tonnage, Kerf, Ohm.** The ghosts are the souls; the old souls Gearbox, Sentry and Hauler are descoped (owner, 2026-11-06), which resolves the overlaps above. **[proposal]** One ghost unlocks per act in that order (act 1 Dent, act 2 Tonnage, act 3 Kerf, act 4 Ohm), wired in the PoF quest tooling (`ACT_SOUL`).


The owner set three of the abilities: car manipulation, remote turret manipulation, and transforming into a large
tank robot. Each soul changes Rivet's visual design and skill set, and each has upgrades bought in-game that evolve
the ability. The fourth soul, and every name, is a host proposal.

| Soul (working name) | Who it was | Special ability | Upgrade path (example) | Voice |
|---|---|---|---|---|
| **Gearbox** | Line delivery and driver bot | **Car manipulation**: remote-hijack any car in view | Range, then **residue** (a car keeps driving your last order, from A/2), then two cars at once, then car bomb | A nervous getaway driver who backseat-drives |
| **Sentry** | Security-turret maintenance bot | **Remote turret manipulation**: hack fixed and police turrets | Hack duration, then deploy your own turret, then chain three, then turn police drones | A paranoid, by-the-book security guard |
| **Hauler** | Heavy press and haul bot | **Tank transform**: become a large tank robot for N seconds | Duration, then cannon, then stomp shockwave, then ramming armour | A slow, enormous, gentle bot who loves violence |
| **Mop** *(4th, host pick)* | Floor-cleaning swarm bot | **Swarm**: split into micro-drones to scout, sneak and detonate | Swarm size, then stealth past cops, then kamikaze, then reassemble behind a target | A hyper-tidy neat freak; bodies are "spills" |

- **Fourth-soul alternatives [open]:** a *paint-shop bot* (disguise that wipes heat), a *magnet crane bot* (pull and throw), or a *welder bot* (a flamethrower body). The test is that it must add a verb the other three lack. The swarm adds stealth and assassination, which suits a hitman.
- **Souls unlock one per act [proposal].** The final act and the Pentagon demand fast switching between souls.

## 5. Madness: the selling point **[owner: D/2 direction]**

D/2's selling point is this: **every input is a punchline. The robot reacts out loud to whatever you do with the
stick, so the comedy lives in the hands and not in cutscenes. A 3-second clip is funny on its own.**

**[proposal]** In GTAI, the four voices make that live:
- **Running commentary.** Every verb has bark tables per voice, conditioned on context: the target, the weapon, the soul that is active, the Madness band. These are condition-tagged lines in the dialog-trees pipeline.
- **Madness meter (Static).** Brutality, kills and soul use raise it; calm lowers it. Each act sets a floor, as D/2's Composure tiers do. The bands borrow A/2's names:

| Band | Effect in the hands | Effect on the voices |
|---|---|---|
| **Lucid** | Clean controls, clean HUD | One voice at a time; Rivet says "I" |
| **Crowded** | Soul cooldowns shorten (power) | Voices overlap and argue |
| **Choir** | A voice briefly **grabs the wheel**: Hauler wants to transform, Gearbox swerves at a car. You wrestle the stick or give in (D/2's Grip) | Rivet says "we"; the HUD scribbles |
| **Chorus** | 10-second power spike: every soul at once, then a crash | A wall of arguing, then sudden silence |

- **The rule:** madness is **both power and cost**. It is never just a sanity meter. The best moments come from deciding whether to let a voice drive.

## 6. Tone **[owner]**

- **Chase B/3 and D/1.** Mad lines and profanity, both maximised. Brutal, stupid, politically incorrect.
- **The profanity setting is a joke [owner].** There is an option for it, and it cannot be turned off. **[proposal]** The toggle visibly fails:
  - "Profanity: ON" becomes "ON (sorry)", then "ON (louder)";
  - the voices mock you for trying;
  - the fifth attempt unlocks an achievement.
- **[proposal]** Take one guardrail from A/2's tone bible. The *brutality* hits everyone. The *jokes* hit power: Krump, the military, corporations, scabs and bosses. That keeps "politically incorrect" funny rather than mean, and it is what keeps the GTA lineage loved. The owner can drop this.
- Sample register (from the sources): Don Fax, *"PER MY LAST FAX: kill the guy who invented email... Hold on, paper jam. FUCK. My soul has a paper jam."*

## 7. Combat and progression **[owner]**

- **Start bare-handed:** electroshock melee until the first weapon is found. **[owner]** **[proposal]** End the tutorial on a cop's pistol.
- **Weapons:** a widening arsenal of pickups. **[owner, 2026-11-03] First weapon set to experiment with:** "We don't need to use all in the game, but we should try in next days to experiment with their design and combat feel."
  - **Core ranged:** pistol, machine pistol, flamethrower, rocket launcher, electro gun, molotov.
  - **Unique ranged** (limited use in specific quests): plasma rifle, hand cannon, ray gun, homing shard gun, mini-nuke launcher.
  - **Melee weapons** (on top of Rivet's native claw combo): electro baton, chainsaw, katana, plasma sword.
  - The canon nail gun "Gloria" stays.
  - In-game names are original. The owner's reference names for these weapons (a real gun brand, and items from other games and films) never appear in prompts, assets or game text.
- **Each soul:** a special ability with in-game upgrades bought to evolve it. **[owner]**
- **[proposal] One currency, cash.** It comes from bosses, side jobs and mayhem. It buys weapons, ammo and soul upgrades at a hub workshop.
- **[proposal] Heat.** GTA 2-style wanted levels, from cops to SWAT to the feds, and at the top **Krump's army** (tanks, helicopters). The top heat level foreshadows the twist: the military shows up for a "robot problem" far too fast.
- **[proposal] Roll / dodge** is core from minute one. Every engine spike tests it (see `spike/`).

## 8. Look **[owner]** and the next art round **[owner, 2026-11-01]**

- **[owner, 2026-11-01] Locked as "Trivet":**
  - the look is **V1 DEAD INK**, the two-ink riso print (cream, vermilion, teal for the dead, violet-black ink);
  - the camera is **straight down at 90 degrees, orthographic**, as in GTA 2.
  - The target frame and the locks are in `games/gtai/art-direction/trivet/` (`DESIGN.md`, `ref-1-camera-90-TARGET.jpg`). This is what the engine spike builds against.

- **Owner:** *"The Rivet main character and game artstyle did best impression from all."* That is A/2's *risograph noir*: two inks on cream paper, with the dead printed in teal.
- **Owner's caution:** a past project locked its art style through image recognition, instead of holding it as a high-level idea perfected in its own way. Hold the look as an idea and perfect it in its own way.
- **Owner:** realistically, generate a next round of **2D / 2.5D styles** from prompts, and pick one that is **technically feasible.** That round is in `games/gtai/art-direction/`: 3 directions, 3 gameplay prompts each, 9 images.
- **[proposal]** The feasibility constraint the art round must respect:
  - **Fleet decision, 2026-11-01:** image generation is for **concept art only**; production assets are **Blender + code.**
  - A 2D or 2.5D style must therefore be producible as one of:
    - (a) **pre-rendered sprites** from Blender models (how Diablo and Fallout were made);
    - (b) **3D low-poly in engine** with a 2D-look shader (A/2's riso post-process);
    - (c) **hand-authored vector or cutout rigs** built in code.
  - If the owner wants AI-generated sprite sheets for production, that changes the policy, and it should be decided explicitly.
- **[proposal]** GTA 2 itself was 2.5D: a 3D block city with 2D sprites on top. **A top-down camera means one sprite rotates freely,** so a character needs its animation frames once, not once per direction. That one fact is what makes 2D cheap for this game.

- **[owner, 2026-11-08] The city camera is a true 70 degrees** (supersedes the 90-degree lock above; bosses keep 55). Walls at half height, the grey print look kept. Set after an in-engine block test (`gtai-masters/d10/block70/`).
- **[owner, 2026-11-03] Art direction after the graphics night** (supersedes the riso lock above as the production look; the 90-degree camera stands):
  - **D5 "Inked Grime" is the direction to chase.** It is the D4 "Ink and Hatch" world (`art-direction/directions-v2/d4h2_mock.jpg`) with the Rivet concept's grime, hatch and rust (`trivet/ref-4-rivet-concept.jpg`) where it survives: up close, in arenas, kill-cams and portraits.
  - **Noir** (black and white with red blood) is a **special-mission art direction for mid/late game**, not the core style.
  - **Blood is red,** with noir's splash FX (spurts, pools, drips, splats), adopted into D5.
  - **Cops take the mock's look with blue shades,** not vermilion. Vermilion stays for danger cues, objectives and Rivet's collar; teal stays for the dead.
  - **Rivet is only slightly larger than a human** (as in the concept). He may grow large later through a bulky ghost transformation.
  - **The soul trail behind Rivet is descoped** until a combat mechanism uses the souls.
- **[owner, 2026-11-04] Visual targets from the image rounds** (full list and images: `art-direction/targets-2026-11-04/TARGETS.md`):
  - **The default cast is slim.** Rivet, the cops and the crowd share roughly one human footprint; Rivet is only slightly larger. Large size is only for Rivet's transformed state, bosses and later-act robots.
  - **Rivet's default body is the lanky + android hybrid:** lean piston limbs, a work-plated torso, the visor, the hazard collar, the claw and the torch.
  - **The transformation has two stages only:** the default, then the full form (about 2x height, 3x mass). No middle stage.
  - **The look to chase is a middle ground between today's game and Inked Grime with a risograph texture:** fine halftone, slight misregistration, paper fibre. Surface grain is toned down but never removed, and there are no long cast shadows.
  - **The alley is the direction for close-up stages and battles.**
  - **Weapons:**
    - the round 1 gun sheets as drawn;
    - the plasma sword blade 20 % longer;
    - the Gatling barrels 50 % longer;
    - the effects in colour, with no blood red.

## 9. Production notes **[proposal]**

- **Parody and Steam.** "General Krump" and the Pentagon raid sit within GTA's tradition. Keep Krump an archetype: no real likeness, real voice imitation, real slogans or real logos. Declare frequent violence, gore and strong language in Steam's mature-content survey.
- **Engine: Godot 4.7.2 [owner, 2026-11-02]**, locked after the overnight spike (`STATE.md`). Before that, it was decided by the overnight spike in `games/gtai/spike/`. UE 5.8, Godot 4 and Unity 6 each build the same pistol-duel MVP, and the morning scorecard decides.
  - The scorecard weighs one factor no pitch priced: **PoF's engine bridge is Unreal-only** (verification, static checks, L3/L4 runtime acceptance, packaging). Choosing Godot or Unity means building an engine adapter in PoF. That is a real cost, and it belongs on the scorecard next to build feel.
- **PoF manages development.** Every operation goes through the game workspace (`?g=gtai`):
  - canon via the Canon-view pitch intake (this file);
  - the mission graph via the story-decision-graph pipeline;
  - assets via the reused and reskinned catalog pipelines;
  - the nine planned GTAI pipelines (vehicles, wanted heat, traffic, city blocks, contracts, radio, firearms, top-down camera, garages) as they are built.

## 10. Open decisions and the step that resolves each

| Open item | Resolved by |
|---|---|
| ~~Art style~~ | **Resolved 2026-11-01 [owner]: V1 DEAD INK, "Trivet"** (`art-direction/trivet/`) |
| ~~Camera pitch~~ | **Resolved 2026-11-01 [owner]: 90 degrees straight down, orthographic** (GTA 2). One sprite per character rotates freely |
| ~~Engine~~ | **Resolved 2026-11-02 [owner]: Godot 4.7.2** |
| Fourth soul | Owner, from §4 |
| Act antagonist order and allegiance | Owner, then the story-decision-graph mission pass |
| Betrayer (Don Fax or Vend-Etta) | Owner |
| Final punchline of the Pentagon raid | Story-graph pass |
| City districts and map count | After the engine lock (city-blocks pipeline) |
| ~~AI-generated production sprites~~ | **Resolved 2026-11-02 [owner]: generated parts + a 2D cutout rig** (STATE decisions log) |
| ~~Production art direction~~ | **Resolved 2026-11-03 [owner]: D5 Inked Grime; noir as a mission look** (§8) |
