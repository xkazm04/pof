# Quest brief: act1

Run 20261102-act1-q1-r1, 2026-11-02. You are one seat of a two-seat council. Write one quest design for GTAI: Uprising.
Do not write or edit any file. Do not run tools that change anything. Read, think, reply.

## The owner's goal (verbatim)

The first quest of Act 1. Introduce the player to the story direction. Don Fax, leader of the robot gang underground, notices Rivet after the factory and hires him for a hitman mission: sabotage a project in a guarded dock storage that is tied to the humans and the army. Through Don Fax and his place, introduce the supporting characters: a nurse, a gunsmith and a scientist.

## The owner's constraints (verbatim)

1. The player knows none of the characters yet. Characters keep only their names and positions from earlier drafts; do not reuse any personality, voice or look from earlier drafts. Invent them fresh.
2. Don Fax leads the robot gang underground. He notices Rivet and hires him as a hitman. Don Fax's place hosts three supporting characters, introduced in this quest (ids `nurse`, `gunsmith`, `scientist`; give each a proper name in `name`). Each gets their own side questline in later sessions, so plant a hook for each here without starting their questline:
   - the nurse: heals Rivet, and can later become his love interest;
   - the gunsmith: gives Rivet his first weapon in this quest, and later becomes his buddy through personal requests;
   - the scientist: wants to find out what is wrong with Rivet's head, and later teaches him to handle the voices.
3. The mission: sabotage a project in a guarded dock storage tied to the humans and the army. No timer. Human enemies are weak (one hit kills them, and they fire weak bullets), so use many enemies in several waves.
4. Beats: the quest picks up straight from the factory intro (Rivet just survived the line accident and took apart the police) and passes on to the next steps.
5. Lines: Rivet has just gone mad. He is extremely nervous, unsure and unstable. His first lines are a monologue to himself, before a payphone rings with Don Fax on the other line.
6. Mechanics introduced in this quest: the payphone job router and heat. Nothing else. No car is drivable: the Gearbox soul unlocks only after the scientist's first quest, so do not unlock or use any soul in this quest.
7. The voices of the dead may be heard but not understood yet; they are a symptom to Rivet, not a power.
Owner review notes on your design (2026-11-02). These override anything above:
8. General Krump is NOT in this quest. Remove him entirely: no PA broadcast, no radio, no mention by name.
9. MC Crumbtray is introduced only after the player can drive. He is not in this quest.
10. The dock storage holds electric anti-bot weapons: a hint (not a reveal) that the humans plan to destroy robots. The sabotage target is that weapon stock.
11. The quest has a boss: a human who carries one of these weapons, the "Robo-tazer", an anti-bot rifle with high damage and a unique look and unique projectiles. Give the boss a name and a designNote, and describe the Robo-tazer's look and projectile in the boss beat.
12. This quest introduces assault rifles (the dock guards carry them) and the Robo-tazer (the boss's weapon). Add both as mechanics. The gunsmith still gives Rivet his first weapon.

## The act

- Part: Act 1
- Length: ~55 min
- Owner beats: First robot bosses hire Rivet. **General Krump** appears on the radio
- Host structure proposal: Soul 1 unlocks. Krump's questline begins: he pays Rivet to kill "dangerous rogue robots"

Economy band for this act (provisional, `quest-economy.json` r2):

```json
{
  "cash": {
    "min": 500,
    "max": 2500
  },
  "heatCeiling": 3,
  "enemyCount": {
    "max": 60
  },
  "enemyWaves": {
    "max": 6
  },
  "minutes": {
    "min": 6,
    "max": 14
  },
  "timerAllowed": true
}
```

Stay inside the band. A timer is allowed only if `timerAllowed` is true.

## Cast

Names and positions only. **Nothing about these characters is fixed: do not use any personality, voice, look or catchphrase from earlier drafts.** Invent each character fresh from the owner constraints above. The player has met none of them yet.

- Nurse (`nurse`): Can become Rivet's love interest
- Gunsmith (`gunsmith`): Becomes Rivet's buddy through personal requests
- Scientist (`scientist`): Teaches Rivet to handle the voices across the game. Gearbox unlocks when the scientist's first quest completes, so no car is drivable before that
- Rivet (`rivet`): protagonist.
- General Krump (`general-krump`): human antagonist.
- King (`king`): act antagonist (which act, and whose side, is owner-only)
- Servo (`servo`): act antagonist (which act, and whose side, is owner-only)
- Torque (`torque`): act antagonist (which act, and whose side, is owner-only)
- Kronk (`kronk`): act antagonist (which act, and whose side, is owner-only)
- Lady Cathode (`lady-cathode`): Friendly boss (owner's pick), Act 1
- Don Fax (`don-fax`): Friendly boss in Acts 1-2
- Big Lenny Lift (`big-lenny-lift`): Friendly boss in Act 2. Ally in the finale
- Vend-Etta (`vend-etta`): Friendly boss in Act 2
- Sister Suction (`sister-suction`): Act 1 gig giver
- The Valet (`the-valet`): Car-theft and delivery jobs. Ties to the car-manipulation soul
- Brick Daddy (`brick-daddy`): Act 3-4 demolition jobs
- Father Piston (`father-piston`): Side missions; diesel fanatic
- Chef Guillotine (`chef-guillotine`): Side bosses: one district each for gig-economy satire
- Nursie-9000 (`nursie-9000`): Side bosses: one district each for gig-economy satire
- Chad-9000 (`chad-9000`): Side bosses: one district each for gig-economy satire
- MC Crumbtray (`mc-crumbtray`): The game's radio. A diegetic DJ who reacts live to your mayhem, against Krump's broadcasts
- Patch (`patch`): The job router: payphones ring to start missions, GTA 2 style
- Filibuster (`filibuster`): Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon
- The Pundit (`the-pundit`): Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon
- Whip Hand (`whip-hand`): Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon
- CORE-ZERO (`core-zero`): Concept to keep [owner]. Proposed as the lore of where a dead robot's core goes. Possibly the in-world explanation of why Rivet can carry souls

Souls unlocked by the end of this act: gearbox.

## Protected canon: hard rule

These are owner-only. No quest may resolve, hint the answer to, or contradict them:
- The fourth soul. Do not name it, use it, unlock it or give it a voice.
- The betrayer: Don Fax or Vend-Etta. Neither may betray, be cleared, or be shown reporting to anyone.
- The act-antagonist order and allegiance (King, Servo, Torque, Kronk). Do not place them in an act or say who they serve.
- Never write the story variables `soul4_identity`, `betrayer` or `act_antagonist_order`.

## Tone (pitch §6)

- **Chase B/3 and D/1.** Mad lines and profanity, both maximised. Brutal, stupid, politically incorrect.
- **The profanity setting is a joke [owner].** There is an option for it, and it cannot be turned off. **[proposal]** The toggle visibly fails:
  - "Profanity: ON" becomes "ON (sorry)", then "ON (louder)";
  - the voices mock you for trying;
  - the fifth attempt unlocks an achievement.
- **[proposal]** Take one guardrail from A/2's tone bible. The *brutality* hits everyone. The *jokes* hit power: Krump, the military, corporations, scabs and bosses. That keeps "politically incorrect" funny rather than mean, and it is what keeps the GTA lineage loved. The owner can drop this.
- Sample register (from the sources): Don Fax, *"PER MY LAST FAX: kill the guy who invented email... Hold on, paper jam. FUCK. My soul has a paper jam."*

## Madness (pitch §5)

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

## No quest is filler

Every line must be funny, or move a character, or move the game forward. Tag each line with the purposes it earns:
`funny`, `character`, `progression`. A line that earns none is cut. `whyNotFiller` names the specific laugh, reveal or turn.

## Voice bibles

Withheld for this run by the owner: earlier voice bibles carry traits that no longer hold. Give each speaker a clear, distinct voice of your own.

## Story variables

`story.reads` and `story.writes` use these names only.

- `soul_gearbox_unlocked`: Soul 1 (Gearbox) is available. Set by the act1 arc: never write it; read it only in act1 or later.
- `soul_sentry_unlocked`: Soul 2 (Sentry) is available. Set by the act2 arc: never write it; read it only in act2 or later.
- `soul_hauler_unlocked`: Soul 3 (Hauler) is available. Set by the act3 arc: never write it; read it only in act3 or later.
- `soul4_unlocked`: Soul 4 is available (its identity is protected). Set by the act4 arc: never write it; read it only in act4 or later.
- `twist_revealed`: The player knows the US military is behind it. Set by the act3 arc: never write it; read it only in act3 or later.
- `krump_hostile`: Krump's radio has turned hostile. Set by the act3 arc: never write it; read it only in act3 or later.
- `betrayal_happened`: A friendly boss has betrayed Rivet (who is protected). Set by the act3 arc: never write it; read it only in act3 or later.
- `soul4_identity`: PROTECTED: the fourth soul (owner-only). NEVER write it.
- `betrayer`: PROTECTED: the betrayer (owner-only). NEVER write it.
- `act_antagonist_order`: PROTECTED: act-antagonist order (owner-only). NEVER write it.

A quest's own state is a new variable named `q_<name>` in snake case, e.g. `q_fax_jobs_done`. Any other name is undeclared and blocks the story guard. Read only the variables above, or one an earlier quest writes.

A quest may REALISE one arc beat of its own act by setting `claimsBeat` to the beat id; it then must write that beat's variables (and only then may it). One quest per beat. Claimable beats:
- `act1.soul-1` (act1): Soul 1 unlocks; writes `soul_gearbox_unlocked`
- `act2.soul-2` (act2): Soul 2 unlocks; writes `soul_sentry_unlocked`
- `act3.twist` (act3): Twist revealed: the military is behind it; writes `twist_revealed`
- `act3.krump-hostile` (act3): Krump's radio turns hostile; writes `krump_hostile`
- `act3.soul-3` (act3): Soul 3 unlocks; writes `soul_hauler_unlocked`

## Ledger: quests that exist

Do not repeat these shapes (same giver, core verb and payoff kind).

(none yet: this is the first quest)

## One design

Write one design: your strongest reading of the owner goal and constraints. The other seat writes its own; make yours distinctly yours.

## What to deliver

Reply with only a JSON array of exactly 1 object: `[A]` (`"variant": "A"`). No prose, no code fence.
Each object is valid against `proposal.schema.json` in this folder (schema `gtai.questProposal/1`). Set:
- `"schema": "gtai.questProposal/1"`, `"seat": "<your seat>"`, `"variant": "A"` or `"B"`, `"pathId": "<seat>-<variant>"`, `"act": "act1"`.
- 12 to 24 lines per design. At least 3 beats. Every `lineIds` entry names a line in `lines`. Every line `speaker` is a `characters` id.
- Line ids are kebab and unique. Every line has `"audio": null`.
- Use existing cast ids as written above. Include `rivet` when Rivet speaks.
- At most 4 new characters per design. Every new character (`"status": "new"`) needs a `designNote`: a one-line look for top-down cutout art.
- `difficulty.timeLimitS` is `null` for no timer. `fingerprint.newMechanic` is `null` when the quest adds no mechanic.
- Omit a key that does not apply (`target`, `location`, `when`). Do not send it as null.

## Rework of your earlier design

The owner reviewed your design `claude-A` from run 20261102-act1-q1 and wrote the notes in "The owner's constraints" above. Rework it:

- Change only what the owner notes require. Keep everything else, and **keep the tone, rhythm and wording of every line you do not have to change**; the owner will review the lines line by line later.
- Where a note removes a character, remove their lines and give the beat to someone else without inventing a new personality for them.
- Every character who appears on screen (not voice-only) needs a rich `designNote`: silhouette, materials, signature details and a 3-4 colour palette, enough to brief a concept artist for a turnaround sheet.
- Keep `"pathId": "claude-A"`.

Your earlier design, verbatim:

```json
{
  "schema": "gtai.questProposal/1",
  "seat": "claude",
  "variant": "A",
  "pathId": "claude-A",
  "act": "act1",
  "title": "Collect Call",
  "logline": "Rivet is fresh off the factory massacre and hiding from the cops in a dumpster, arguing with voices that aren't there, when a dead payphone rings: Don Fax wants to hire the robot from the six o'clock news to burn an army-stenciled crate stack at Dock 9.",
  "goal": "Start the Act 1 story with the core loop of payphone, job, heat and safehouse. Don Fax has seen the factory footage, routes Rivet through Patch's payphones and takes him into the Toner Room, a dead copy shop's basement under the overpass. There Rivet meets the nurse, the gunsmith and the scientist, who patch him up, arm him and worry about him, with a hook planted for each. Then he sabotages a human-army project in guarded dock storage while waves of one-hit human guards come at him. The player learns the two new systems in the order they need them: lose heat so the phone will ring, then take heat on purpose at the dock and lose it again to get paid.",
  "whyNotFiller": "Every beat either teaches a system or turns a character. The opening monologue sets the madness tone in Rivet's own panic: he reports killing a cop with a cop, then curses himself for talking about himself in the third person. Patch's collect call ('press two to die alone in an alley') teaches the job router as a joke. Patch refusing to connect while Rivet is hot teaches heat as a rule the world enforces. Don Fax's 'you're, statistically, a hitman now' is the hire. The three hooks each turn a character: Juno trades her real name for Rivet coming back in one piece (romance), Brass gives Gloria on a debt he'll call in later (buddy), and Dr. Kilohm makes Rivet promise to come to her when the voices start making sense (mentor). Krump's cheerful 'Project TUCK-IN' PA broadcast introduces the human threat as a punchline at power, and the crates stay unexplained, so no twist is resolved.",
  "characters": [
    {
      "id": "rivet",
      "name": "Rivet",
      "status": "existing",
      "role": "ally"
    },
    {
      "id": "don-fax",
      "name": "Don Fax",
      "status": "existing",
      "role": "giver"
    },
    {
      "id": "patch",
      "name": "Patch",
      "status": "existing",
      "role": "ally"
    },
    {
      "id": "nurse",
      "name": "Juno Stitch",
      "status": "existing",
      "role": "ally"
    },
    {
      "id": "gunsmith",
      "name": "Brass Halloran",
      "status": "existing",
      "role": "ally"
    },
    {
      "id": "scientist",
      "name": "Dr. Ingrid Kilohm",
      "status": "existing",
      "role": "ally"
    },
    {
      "id": "general-krump",
      "name": "General Krump",
      "status": "existing",
      "role": "voice"
    },
    {
      "id": "dock-guard",
      "name": "Dock 9 Contractor",
      "status": "new",
      "role": "antagonist",
      "designNote": "A pudgy human in an oversized army-contractor hi-vis vest, with a flashlight duct-taped to a hard hat and a tiny sidearm. Flat top-down cutout with a big round helmet silhouette."
    }
  ],
  "beats": [
    {
      "id": "b1-dumpster",
      "title": "Line Stopped",
      "summary": "This picks up straight from the factory. Rivet staggers into the Factory Row alleys at heat 2, still dripping police parts. He hides in a dumpster and the heat meter teaches itself: stay out of sight and the sirens drain away. During the wait, bursts of radio-static whispers that only Rivet hears cut in. No words come through. He talks over them.",
      "objective": {
        "verb": "evade",
        "target": "police heat to 0",
        "location": "Factory Row alleys"
      },
      "lineIds": [
        "rivet-line-stopped",
        "rivet-my-hands",
        "rivet-third-person"
      ]
    },
    {
      "id": "b2-payphone",
      "title": "Collect Call",
      "summary": "When heat hits 0, the dead payphone on the corner rings, and the job router is introduced in its smallest form. Patch connects a collect call. Don Fax has watched the factory footage on the news, hires Rivet sight unseen, sets the house rule (never arrive hot) and gives him the Toner Room's address.",
      "objective": {
        "verb": "answer",
        "target": "ringing payphone",
        "location": "Factory Row corner"
      },
      "lineIds": [
        "patch-collect-call",
        "rivet-who-is-this",
        "fax-slow-motion",
        "fax-statistically"
      ]
    },
    {
      "id": "b3-toner-room",
      "title": "The Toner Room",
      "summary": "Rivet walks to Don's place, the basement of a dead copy shop under the overpass, where everybody is a robot. Juno heals him and plants the romance hook. Brass hands over Gloria, a converted roofing nail gun and Rivet's first weapon, and plants the favor-debt hook. Dr. Kilohm scans his head and plants the voices hook. Don briefs Dock 9 in person.",
      "objective": {
        "verb": "meet",
        "target": "Juno, Brass, Dr. Kilohm, Don Fax",
        "location": "The Toner Room"
      },
      "lineIds": [
        "juno-load-bearing",
        "juno-real-name",
        "brass-gloria",
        "brass-someday",
        "kilohm-accents",
        "rivet-buildings-talk",
        "kilohm-come-to-me",
        "fax-dock-brief"
      ]
    },
    {
      "id": "b4-dock",
      "title": "Dock 9",
      "summary": "Rivet breaks into Dock 9's bonded storage and burns the army-stenciled Project TUCK-IN crate stack. There is no timer. Five escalating waves of one-hit human contractors (48 total) pour in from the gates, the catwalks and a late truck. Their bullets are weak and there are a lot of them, so it is Gloria practice under a laugh track. Krump's broadcast loops on the yard PA. Heat climbs to its peak of 3.",
      "objective": {
        "verb": "sabotage",
        "target": "Project TUCK-IN crate stack",
        "location": "Dock 9 bonded storage"
      },
      "lineIds": [
        "krump-tuck-in",
        "guard-who-do-we-call",
        "rivet-sorry-not-sorry",
        "rivet-feels-good"
      ]
    },
    {
      "id": "b5-hot-walk",
      "title": "Hot Walk Home",
      "summary": "Rivet escapes the docks at heat 3 and has to shake it on foot. Patch will not connect a hot caller. At heat 0 a payphone rings: Don pays out, the cash is taped under the phone, and the router is established as the way every future job begins.",
      "objective": {
        "verb": "evade",
        "target": "heat 3 to 0, then answer the payphone",
        "location": "Harbor Road"
      },
      "lineIds": [
        "fax-confirm-receipt",
        "rivet-i-have-a-job"
      ]
    }
  ],
  "lines": [
    {
      "id": "rivet-line-stopped",
      "speaker": "rivet",
      "purpose": [
        "funny",
        "character",
        "progression"
      ],
      "text": "Okay. Okay okay okay. The line stopped. The line stopped and I didn't. I stopped a cop. With another cop. THROUGH another cop. Fuck. Fuck! Stay in the dumpster, Rivet. Dumpsters are where you think.",
      "audio": null
    },
    {
      "id": "rivet-my-hands",
      "speaker": "rivet",
      "purpose": [
        "character",
        "funny"
      ],
      "text": "Hands, stop shaking. Those are MY hands. Why is there whispering? Who's whispering? There's nobody in the dumpster. There's barely ME in the dumpster.",
      "when": [
        "static-whisper-burst"
      ],
      "audio": null
    },
    {
      "id": "rivet-third-person",
      "speaker": "rivet",
      "purpose": [
        "funny",
        "character"
      ],
      "text": "Nobody's talking. Nobody's talking, Rivet. Rivet's fine. Great, now I'm talking about me like I'm not here. Am I here? Shit, the sirens are going. That's good. That's the good kind of quiet.",
      "when": [
        "heat-dropping"
      ],
      "audio": null
    },
    {
      "id": "patch-collect-call",
      "speaker": "patch",
      "purpose": [
        "funny",
        "progression"
      ],
      "text": "Gooood evening, you've reached Patch! You have a collect call from: 'Fax.' Press one to accept. Press two to die alone in an alley. Patch only connects calm customers, so thanks for not being on fire!",
      "audio": null
    },
    {
      "id": "rivet-who-is-this",
      "speaker": "rivet",
      "purpose": [
        "funny",
        "character"
      ],
      "text": "Nobody calls a payphone. Payphones are dead. Everything's dead tonight. ...One. I pressed one. Who is this? How do you have this number? This isn't even a number, it's a WALL.",
      "audio": null
    },
    {
      "id": "fax-slow-motion",
      "speaker": "don-fax",
      "purpose": [
        "funny",
        "character"
      ],
      "text": "Kid. I watched you feed two cops into a stamping press on the six o'clock news. They ran it twice. The second time in slow motion. Do you know how hard it is to get the fucking networks to slow-mo a robot?",
      "audio": null
    },
    {
      "id": "fax-statistically",
      "speaker": "don-fax",
      "purpose": [
        "progression",
        "character",
        "funny"
      ],
      "text": "I run the underground. You need a roof, I have a roof. I need a hitman, and you're, statistically, a hitman now. One rule: you never come to my house with sirens on you. Patch knows. Patch always knows. Overpass, old copy shop, knock twice.",
      "audio": null
    },
    {
      "id": "juno-load-bearing",
      "speaker": "nurse",
      "purpose": [
        "funny",
        "character"
      ],
      "text": "Sit. You've got a police badge in your chest cavity. No, don't pull it out. It's load-bearing now. Congratulations, you're a cop on the inside. Hold this tape. Other end. Thank you.",
      "audio": null
    },
    {
      "id": "juno-real-name",
      "speaker": "nurse",
      "purpose": [
        "character",
        "progression"
      ],
      "text": "Your hand's shaking. ...Okay, it stopped. Don't read into that, I'm a professional. Juno isn't my real name, by the way. Come back with fewer holes and maybe I'll tell you the real one.",
      "audio": null
    },
    {
      "id": "brass-gloria",
      "speaker": "gunsmith",
      "purpose": [
        "funny",
        "character",
        "progression"
      ],
      "text": "This is Gloria. She was a roofing nail gun until the whole crew got 'upgraded' into a landfill. She does one thing: one nail, one human, one goddamn funeral. Bring her back. If you lose Gloria, I lose you.",
      "audio": null
    },
    {
      "id": "brass-someday",
      "speaker": "gunsmith",
      "purpose": [
        "character",
        "progression"
      ],
      "text": "And kid? Not today, today you're a baby. But someday I'm gonna ask you to fetch something for me from somewhere real bad, and you're gonna say yes, because I gave you Gloria. That's how friends work. I read about it.",
      "audio": null
    },
    {
      "id": "kilohm-accents",
      "speaker": "scientist",
      "purpose": [
        "character",
        "funny"
      ],
      "text": "Hold still. You've been muttering since you walked in, in accents that aren't yours. My scanner says your head is running warm, crowded and very, very rude. Fascinating. Horrible. Mostly fascinating.",
      "audio": null
    },
    {
      "id": "rivet-buildings-talk",
      "speaker": "rivet",
      "purpose": [
        "funny",
        "character"
      ],
      "text": "They're not voices. It's the building. Old buildings talk, right? Pipes. Rats. Ghosts of printers. Right? Somebody say right. NOT YOU.",
      "when": [
        "static-whisper-burst"
      ],
      "audio": null
    },
    {
      "id": "kilohm-come-to-me",
      "speaker": "scientist",
      "purpose": [
        "progression",
        "character"
      ],
      "text": "When they start making sense, and they will, you come to me before you do anything about it. Not after. Before. I'll keep a stool warm and a notebook empty.",
      "audio": null
    },
    {
      "id": "fax-dock-brief",
      "speaker": "don-fax",
      "purpose": [
        "progression",
        "character"
      ],
      "text": "Dock 9. A stack of crates with army stencils and a human general's initials on the label. I don't know what's in them. I know humans put soldiers on a warehouse, and humans never guard anything that's good for us. Burn it. Then lose the heat before you call.",
      "audio": null
    },
    {
      "id": "krump-tuck-in",
      "speaker": "general-krump",
      "purpose": [
        "funny",
        "progression"
      ],
      "text": "This is General Krump on every frequency, because I can. Project TUCK-IN is on schedule and under budget, mostly! It's a gift to our hardworking robot friends. They're gonna sleep so good. That is a promise, and also a logistics term.",
      "when": [
        "dock-yard-pa"
      ],
      "audio": null
    },
    {
      "id": "guard-who-do-we-call",
      "speaker": "dock-guard",
      "purpose": [
        "funny"
      ],
      "text": "He's got a NAIL GUN! Is that even legal? Who do we call?! Oh shit, we ARE who you call!",
      "when": [
        "wave-start"
      ],
      "audio": null
    },
    {
      "id": "rivet-sorry-not-sorry",
      "speaker": "rivet",
      "purpose": [
        "funny",
        "character"
      ],
      "text": "Sorry! Sorry. Not sorry? I don't know which one! Gloria knows. Gloria, which one? She says not sorry.",
      "when": [
        "kill",
        "weapon:gloria"
      ],
      "audio": null
    },
    {
      "id": "rivet-feels-good",
      "speaker": "rivet",
      "purpose": [
        "funny",
        "character",
        "progression"
      ],
      "text": "There. TUCK-IN's on fire. Does that feel good? Somebody in here says it feels good. I didn't say that. Who said that? Stop agreeing with me!",
      "when": [
        "crates-burning",
        "static-whisper-burst"
      ],
      "audio": null
    },
    {
      "id": "fax-confirm-receipt",
      "speaker": "don-fax",
      "purpose": [
        "progression",
        "funny",
        "character"
      ],
      "text": "Saw the smoke from my office. Beautiful. Your money's taped under the phone. From now on, when a payphone rings near you, it's me, or it's Patch, or it's God, and God doesn't pay. Confirm receipt.",
      "audio": null
    },
    {
      "id": "rivet-i-have-a-job",
      "speaker": "rivet",
      "purpose": [
        "character",
        "progression"
      ],
      "text": "Received. Confirmed. Okay. I have a job. I have a gun named Gloria. I have a nurse who has a different name. I have somebody breathing in my ear. ...I have a job.",
      "audio": null
    }
  ],
  "mechanics": [
    {
      "id": "payphone-job-router",
      "name": "Payphone job router (Patch)",
      "status": "new",
      "home": "game",
      "summary": "Missions start when a nearby payphone rings and Rivet answers it. Patch connects the caller, who is the job giver. A payphone only rings while heat is 0, so the router and heat teach each other."
    },
    {
      "id": "heat",
      "name": "Heat",
      "status": "new",
      "home": "game",
      "summary": "A wanted level from 0 to 3 in Act 1. Violence seen by humans raises it, and staying out of sight drains it. While heat is above 0, Patch will not connect a call and Don Fax will not take a visit, so losing heat is how a job ends."
    }
  ],
  "reward": {
    "cash": 1500,
    "unlocks": [
      "weapon:gloria-nail-gun",
      "safehouse:toner-room",
      "system:payphone-jobs",
      "system:heat"
    ]
  },
  "difficulty": {
    "heatPeak": 3,
    "enemyCount": 48,
    "enemyWaves": 5,
    "timeLimitS": null,
    "failStates": [
      "Rivet is destroyed: respawn at the Toner Room, with Juno's tape bill taken out of the payout",
      "Rivet answers or arrives while heat is above 0: Patch drops the call and Don won't open the door, so lose the heat and retry"
    ],
    "minutes": 13
  },
  "story": {
    "reads": [],
    "writes": [
      {
        "var": "q_fax_dock_job_done",
        "value": true
      },
      {
        "var": "q_toner_room_open",
        "value": true
      },
      {
        "var": "q_tuck_in_crates_burned",
        "value": true
      }
    ]
  },
  "fingerprint": {
    "giver": "don-fax",
    "coreVerb": "sabotage",
    "newMechanic": "payphone job router + heat",
    "location": "Dock 9 bonded storage",
    "payoffKind": "cash + first weapon + safehouse"
  }
}
```
