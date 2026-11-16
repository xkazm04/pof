# Quest brief: act1

Run 20261102-act1-q1, 2026-11-02. You are one seat of a two-seat council. Write one quest design for GTAI: Uprising.
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
- 12 to 22 lines per design. At least 3 beats. Every `lineIds` entry names a line in `lines`. Every line `speaker` is a `characters` id.
- Line ids are kebab and unique. Every line has `"audio": null`.
- Use existing cast ids as written above. Include `rivet` when Rivet speaks.
- At most 4 new characters per design. Every new character (`"status": "new"`) needs a `designNote`: a one-line look for top-down cutout art.
- `difficulty.timeLimitS` is `null` for no timer. `fingerprint.newMechanic` is `null` when the quest adds no mechanic.
- Omit a key that does not apply (`target`, `location`, `when`). Do not send it as null.
