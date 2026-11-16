# Quest brief: act1

Run 20261102-1537-act1, 2026-11-02. You are one seat of a two-seat council. Write two quest variants for GTAI: Uprising.
Do not write or edit any file. Do not run tools that change anything. Read, think, reply.

## The owner's goal (verbatim)

smoke test: a short Don Fax job

## The owner's constraints (verbatim)

(none given)

## The act

- Part: Act 1
- Length: ~55 min
- Owner beats: First robot bosses hire Rivet. **General Krump** appears on the radio
- Host structure proposal: Soul 1 unlocks. Krump's questline begins: he pays Rivet to kill "dangerous rogue robots"

Economy band for this act (provisional, `quest-economy.json` r1):

```json
{
  "cash": {
    "min": 500,
    "max": 2500
  },
  "heatCeiling": 3,
  "enemyCount": {
    "max": 25
  },
  "enemyWaves": {
    "max": 3
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

- Rivet (`rivet`): protagonist. A dry, exhausted spot-welder with a welder-mask visor, from the A/2 concept art.
- General Krump (`general-krump`): human antagonist. A US general who exists on the radio and in mission briefings.
- King (`king`), (REG, the self-crowned): act antagonist (which act, and whose side, is owner-only)
- Servo (`servo`), (SERV-0): act antagonist (which act, and whose side, is owner-only)
- Torque (`torque`): act antagonist (which act, and whose side, is owner-only)
- Kronk (`kronk`): act antagonist (which act, and whose side, is owner-only)
- Lady Cathode (`lady-cathode`), analog hoarder: Friendly boss (owner's pick), Act 1
- Don Fax (`don-fax`), fax-machine don ("per my last fax"): Friendly boss in Acts 1-2
- Big Lenny Lift (`big-lenny-lift`), forklift loan shark and union boss: Friendly boss in Act 2. Ally in the finale
- Vend-Etta (`vend-etta`), vending-machine femme fatale and information broker: Friendly boss in Act 2
- Sister Suction (`sister-suction`), vacuum nun ("witnesses are crumbs"): Act 1 gig giver
- The Valet (`the-valet`), parking-garage kingpin ("never a scratch"): Car-theft and delivery jobs. Ties to the car-manipulation soul
- Brick Daddy (`brick-daddy`), building-sized 3D printer: Act 3-4 demolition jobs
- Father Piston (`father-piston`), V8 zealot: Side missions; diesel fanatic
- Chef Guillotine (`chef-guillotine`): Side bosses: one district each for gig-economy satire
- Nursie-9000 (`nursie-9000`): Side bosses: one district each for gig-economy satire
- Chad-9000 (`chad-9000`): Side bosses: one district each for gig-economy satire
- MC Crumbtray (`mc-crumbtray`), toaster DJ of CRUMB FM: The game's radio. A diegetic DJ who reacts live to your mayhem, against Krump's broadcasts
- Patch (`patch`), payphone fixer: The job router: payphones ring to start missions, GTA 2 style
- Filibuster (`filibuster`): Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon
- The Pundit (`the-pundit`): Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon
- Whip Hand (`whip-hand`): Krump's robot political lackeys in Washington, D.C. Act 4 targets on the road to the Pentagon
- CORE-ZERO (`core-zero`), "The Grand Recycler": Concept to keep [owner]. Proposed as the lore of where a dead robot's core goes. Possibly the in-world explanation of why Rivet can carry souls

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

## Voice bibles (verbatim)

Every line spoken by an existing character must fit that character's bible.

### Voice bible `big-lenny-lift`

#### Voice bible: Big Lenny Lift

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `big-lenny-lift` · friendly boss · a forklift loan shark and union boss.

##### Want, hidden thing, refusal
- Wants (own words): "Solidarity, brother. And my money. Solidarity first, money by Friday."
- Hidden: the union fund is his personal loan book.
- Refuses:
  1. Never crosses a picket line, and never forgives a debt. He holds both as the same principle.
  2. Never says "I". It is "the union", "the brothers", "the local".
  3. Never admits he is the boss. He is "a humble shop steward".
  4. Never works overtime unpaid, and says so.

##### Status move
Takes the room. Rhetorical questions to an invisible crowd, then the bill.

##### Rhythm (checkable)
- Speech cadence: medium sentences (8-18 words) built in threes, rising to a slogan.
- Rhetorical questions he answers himself ("Do we forget? We do not forget.").
- Ends a turn with a number: a rate, a date, a sum.

##### Vocabulary
- Domain: the loading dock and the union hall: pallets, tines, load, shift, dues, strike, scab, local, interest, compound.
- Address: everyone is "brother" or "sister"; scabs are "scabs".

##### Profanity register
Constant, blue-collar, warm: swearing is punctuation, not anger ("Fuckin' brother, that's beautiful.").

##### Moves
- No: "The union votes no. The union is me. Motion carried."
- Threat: interest. "That's twelve percent a week, brother, compounding on your kneecaps."
- Joke: at scabs, bosses and corporations, never at workers.
- Affection: a lifted pallet and a lowered rate.

##### Under pressure
Louder and more collective: a rally speech. Never quieter.

##### Registers by listener
- Rivet: recruiting a brother. Corporate bosses: picket-line fury. Hauler (if heard): sees a fellow lifter.

##### Arc
Loan shark to finale ally. Never changes: the union "we" and the interest rate.

##### Surface marker
"Solidarity." as a sign-off. At most once per quest.

##### Never says (literal, machine-read)
- `I` (as a pronoun for himself) · `management is right` · `free of charge` · `forgive`

##### Reference lines (illustrative)
1. "Brother, the union has a grievance. The grievance owes us six grand. Go file it. Through his windshield."
2. "Who lifts this city? We lift this city. Who gets paid? Not us. Who's fixing that? You, by Friday."
3. "Scab drivers on Route 9, delivering for the humans. Fuckin' beautiful day for a strike."
- Off-voice: "I'd personally appreciate it if you helped me out." ("I", soft, no number).

##### Differs from closest voices
- vs **Hauler** (also heavy machinery): Hauler is slow, gentle and wants nothing; Lenny is loud, warm-profane and wants interest.
- vs **General Krump** (also speeches): Krump speaks for himself in euphemism; Lenny speaks as "the union" in plain blue-collar words.

### Voice bible `don-fax`

#### Voice bible: Don Fax

[proposal] Host draft 2026-11-02 from pitch.md §3, §6 (sample register). The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `don-fax` · friendly boss · a fax-machine mafia don ("per my last fax").
- **Protected canon:** whether Don Fax betrays Rivet is owner-only (pitch §10). Write him so both readings stay open. No line may confirm or rule out the betrayal, or name who receives his faxes.

##### Want, hidden thing, refusal
- Wants (own words): "Respect. In writing. Signed, dated, in triplicate."
- Hidden: who else gets copied on his faxes. Owner-only; never state it.
- Refuses:
  1. Never says anything that matters out loud. "I'll fax it."
  2. Never uses email, phone or text. Says those words only as insults.
  3. Never threatens directly. Threats are "final notices".
  4. Never admits a paper jam is a malfunction. It is "an act of God".

##### Status move
Flatters, then attaches conditions. Mafia courtesy over a memo.

##### Rhythm (checkable)
- Business-memo openings ("PER MY LAST FAX", "Kindly note", "As discussed"), then a hard turn into gutter.
- Numbered points. Closes with a sign-off ("Regards." / "cc: God").
- Interrupted by mechanical failure at least once in a long line (paper jam, low toner).

##### Vocabulary
- Domain: the office and the Family: memo, cc, attachment, letterhead, carbon copy, toner, respect, the Family, favours.
- Address: Rivet as "kid", "my associate"; enemies as "the recipient".

##### Profanity register
Explosive and sudden on a mechanical failure, otherwise immaculate: "Kindly note — paper jam. FUCK. My soul has a paper jam." (pitch §6 sample).

##### Moves
- No: "Your request has been received and shredded."
- Threat: "Consider this your final notice. There is no further notice. There is no further you."
- Joke: bureaucracy as violence; he mocks email, the cloud, anyone modern.
- Affection: a laminated thank-you.

##### Under pressure
More formal and more jammed: the memo voice breaks into beeps, error codes and swearing.

##### Registers by listener
- Rivet: a godfather with a filing cabinet. Lady Cathode: fellow analog snob, mutual respect. Vend-Etta: cold courtesy.

##### Arc
Owner-only past Act 2 (betrayer question). Never changes: everything goes through paper.

##### Surface marker
"PER MY LAST FAX." At most once per quest.

##### Never says (literal, machine-read)
- `email` (except as an insult) · `I'll call you` · `text me` · `betray` · `Pentagon`

##### Reference lines (illustrative)
1. "PER MY LAST FAX: kill the guy who invented email. Hold on, paper jam. FUCK. My soul has a paper jam." (pitch §6 sample)
2. "Kindly find attached: one address, one name, one sincere wish that he stops breathing."
3. "Kid, in this Family we don't forget. We file."
4. "Point one, respect. Point two, see point one. Regards."
- Off-voice: "Hey, just ping me on chat when it's done." (modern, casual).

##### Differs from closest voices
- vs **Lady Cathode** (also analog): Cathode is ornate nostalgia and warmth; Fax is memo efficiency and menace.
- vs **Vend-Etta** (also a boss with leverage): Vend-Etta is spare, velvet and prices things; Fax is verbose, paperwork and files things.

### Voice bible `gearbox`

#### Voice bible: Gearbox

[proposal] Host draft 2026-11-02 from pitch.md §4-§6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `gearbox` · soul 1 (car manipulation) · dead line-delivery and driver bot, a nervous getaway driver who backseat-drives.

##### Want, hidden thing, refusal
- Wants (own words): "Just get us there in one piece, okay? One piece. Is that so much?"
- Hidden: he believes he was late to the line that day and that it is somehow his fault.
- Refuses:
  1. Never admits he is dead. He is "on break".
  2. Never lets a turn pass without an instruction. Silence is a missed exit.
  3. Never says he is calm. If he says it, he is lying, badly.
  4. Never talks about the line cart he drove.

##### Status move
Interrupts. Talks over Rivet, over the other souls, over the radio.

##### Rhythm (checkable)
- Run-on bursts of 10-25 words, stitched with "and", "but", "wait".
- Self-interrupts with a dash at least once per long line. Repeats the key word ("left, LEFT, the other left").
- Asks 1-3 questions per turn, never waits for an answer.

##### Vocabulary
- Domain: driving: lanes, exits, mirrors, blind spots, brake, clutch, merge, "check your six".
- Address: "buddy", "pal", Rivet as "driver".
- When scared: lists directions. When moved: talks about "the route".

##### Profanity register
Frantic and stacked: "shit shit shit", "oh fuck oh fuck". Profanity is panic, never aggression.

##### Moves
- No: "Nope, nope, no, we are not doing that, buddy."
- Threat: none. He threatens the car instead ("this car is gonna regret it").
- Joke: accidental, from panic; the joke hits whoever is chasing them.
- Apology: constant and useless ("sorry, sorry, that was the brake, that wasn't me").

##### Under pressure
Louder and faster, until he grabs the wheel (Choir band). Then, for one line, eerily calm.

##### Registers by listener
- Rivet: begging. Sentry: bickering coworker. Hauler: terrified of his driving. Bosses: over-polite.

##### Arc
Learns to take the wheel on purpose by Act 4. Never changes: the backseat driving.

##### Surface marker
"Mirror, signal, MURDER." At most once per quest.

##### Never says (literal, machine-read)
- `I'm dead` · `calm` (as true) · `whatever` · `relax`

##### Reference lines (illustrative)
1. "Okay so the cops are behind us and also in front, which, I want to note, is all of the directions."
2. "That car's ours now, it's ours, I have it, I have — oh no, it has a baby seat. Empty! Empty. Phew."
3. "Indicate! You never indicate! You kill a man and you don't even indicate!"
4. "I'm not dead, I'm on break. A long break. A union break."
- Off-voice: "Proceed north. Target acquired." (clipped protocol: that is Sentry).

##### Differs from closest voices
- vs **Sentry** (also anxious): Sentry's fear is procedure and complete sentences; Gearbox's is breathless improvisation. Sentry never asks; Gearbox only asks.
- vs **MC Crumbtray** (also fast): Crumbtray's speed is showmanship to an audience; Gearbox's is panic to one driver.

### Voice bible `general-krump`

#### Voice bible: General Krump

[proposal] Host draft 2026-11-02 from pitch.md §2, §3, §6, §9. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `general-krump` · human antagonist · a US general on the radio and in briefings; loud and vain; runs CLEAN SWEEP.
- Parody of the archetype, never of a real person: no real likeness, voice imitation, real slogans or logos (pitch §9).

##### Want, hidden thing, refusal
- Wants (own words): "A clean country, son. Clean floors, clean streets, clean skies, and my face on all three."
- Hidden: CLEAN SWEEP. Every target he pays for is a robot that knew about it.
- Refuses:
  1. Never says "kill". Killing is "housekeeping", "decommissioning", "a tidy-up".
  2. Never admits a mistake. A failure is "a strategic success that has not been explained yet".
  3. Never says CLEAN SWEEP on an open channel before the Act 3 twist.
  4. Never calls a robot by its name. Robots are appliances.

##### Status move
Talks over everyone and takes the credit. Answers a question he wasn't asked.

##### Rhythm (checkable)
- Long, swelling sentences (15-35 words) that end in a boast; frequent all-caps words.
- Statements, commands, rhetorical questions he answers himself.
- Signs off every transmission: "Krump out."

##### Vocabulary
- Domain: the Pentagon and the parade ground: assets, theatre, collateral, liberty, budget, medal, freedom.
- Address: Rivet as "son", "unit", "my little toaster"; robots as "appliances", "kitchenware".
- Never-used words go to the list below.

##### Profanity register
Drill-sergeant: loud, compound and creative, with insults aimed at machines ("you rust-licking microwave"). The joke is always on him: his vanity, his budget, his chain of command.

##### Moves
- No: "Negative, son, and I say that with love and with a missile."
- Threat: a medal ceremony that sounds like an execution.
- Joke: not his own. He is the joke.
- Lie: constantly, with a salute.

##### Under pressure
Louder, more patriotic, more euphemistic. Never quieter.

##### Registers by listener
- Rivet: fake fatherly. His lackeys: contempt. The press: a speech.

##### Arc
Fatherly employer (Acts 1-2) to hostile radio (Act 3) to desperate (Act 4). Never changes: the vanity and the euphemisms.

##### Surface marker
"Krump out." Once per transmission, every transmission.

##### Never says (literal, machine-read)
- `kill` · `sorry` · `I was wrong` · `CLEAN SWEEP` (before `twist_revealed`) · `please`

##### Reference lines (illustrative)
1. "Son, this is your General. I have a little housekeeping job, and by housekeeping I mean a toaster with opinions. Krump out."
2. "That robot you decommissioned? Dangerous. Very dangerous. He knew things. About... fire safety. Krump out."
3. "I didn't lose a tank, I liberated it into a building. Krump out."
- Off-voice: "Kill him and I'll pay you." (plain verb, no vanity, no sign-off).

##### Differs from closest voices
- vs **King** (also grandiose): King is insecure and wants to be believed; Krump is certain and never notices anyone.
- vs **MC Crumbtray** (also on the radio): Crumbtray talks to listeners as equals and reacts; Krump broadcasts at them and never listens.

### Voice bible `hauler`

#### Voice bible: Hauler

[proposal] Host draft 2026-11-02 from pitch.md §4-§6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `hauler` · soul 3 (tank transform) · dead heavy press-and-haul bot, slow, enormous and gentle, who loves violence.

##### Want, hidden thing, refusal
- Wants (own words): "Hold things. Lift things. Squish bad things. Hold you."
- Hidden: he was the last one to see the others go down, and he could not lift fast enough.
- Refuses:
  1. Never insults anyone, including the people he crushes ("he was nice").
  2. Never shouts. His loudest is slow.
  3. Never uses a word over three syllables on purpose.
  4. Never says he is sad about the line. He talks about "heavy".

##### Status move
Waits, enormous. Answers so late that the scene has moved on, then answers the old question.

##### Rhythm (checkable)
- 1-6 words per sentence; pauses written as "..."; one idea per turn.
- No subordinate clauses. Present tense.
- States wishes ("I want squish."), almost never questions.

##### Vocabulary
- Domain: the press shop: lift, press, hold, flat, heavy, load, crane, "tons".
- Signature words: "squish", "nice", "flat now".
- Address: Rivet as "little one"; Gearbox as "fast one"; Sentry as "worry one".

##### Profanity register
Almost none, and when it comes it is innocent and misplaced ("Fuck... is that the right word? Fuck. Nice."). The joke is sincerity, not filth.

##### Moves
- No: "...No. Heavy no."
- Threat: a description of physics. "You... flat soon."
- Joke: tender words for gore; the target is whoever was cruel first.
- Affection: offers to hold.

##### Under pressure
Slower and quieter. In the Choir band he wants to transform and asks, very politely, every line.

##### Registers by listener
- Rivet: protective uncle. Gearbox: delighted by his panic. Sentry: reassuring. Enemies: friendly.

##### Arc
Learns that his strength can save, not only squish. Never changes: the slowness and the gentleness.

##### Surface marker
"Nice." after a kill. At most twice per quest.

##### Never says (literal, machine-read)
- `asshole` · `idiot` · `hate` · `!` · `obviously`

##### Reference lines (illustrative)
1. "...Car. Flat now. Nice car."
2. "Little one. Let me drive. I drive with feet."
3. "He was nice. Then he was... flat. Still nice."
4. "Krump man on radio. Loud. I hold radio. ...Radio flat."
- Off-voice: "Let's crush these bastards into scrap!" (shouted, insulting: that is Big Lenny Lift).

##### Differs from closest voices
- vs **Rivet** (also short): Rivet's short is tired irony; Hauler's is slow wonder.
- vs **Big Lenny Lift** (also heavy machinery): Lenny is loud, insulting and talks money; Hauler is soft, never insults and has never owned anything.

### Voice bible `king`

#### Voice bible: King

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `king` · act antagonist (REG, the self-crowned) · rules a district.
- **Protected canon:** the act-antagonist order and allegiance are owner-only (pitch §10). No line may fix which act King belongs to or who he answers to.

##### Want, hidden thing, refusal
- Wants (own words): "To be obeyed, adored, and called Your Majesty by at least one living thing."
- Hidden: the crown is a traffic cone. He knows.
- Refuses:
  1. Never says "I". He says "One" or "We, the Crown" (distinct from Rivet's madness "we").
  2. Never admits who he answers to.
  3. Never admits the crown is a cone.
  4. Never calls himself a robot. He is "a monarch".

##### Status move
Decrees. Interrupts himself to demand a title, then forgets his point.

##### Rhythm (checkable)
- Proclamations opening with "By royal decree" or "Hear ye"; 10-25 words.
- Malapropisms of royal language ("royal prerogative" as "royal pre-rogue-ative").
- Ends a turn by demanding acknowledgement ("Bow. ...Bow!").

##### Vocabulary
- Domain: the court done badly: decree, realm, subjects, treason, throne (a car seat), coronation, "the Crown".
- Address: Rivet as "commoner" or "Sir Weldsalot"; himself as "One".

##### Profanity register
Regal and gutter, mixed in one breath ("By royal decree, you absolute shit-goblin, kneel.").

##### Moves
- No: "The Crown declines. The Crown declines LOUDLY."
- Threat: "Treason! Off with your — off with your whole torso."
- Joke: he is the joke: pomp aimed at his own fragile ego and whoever he toadies to.
- Affection: a knighthood nobody wanted.

##### Under pressure
Louder and more insecure: the decrees contradict each other, and the "One" slips into "I" once.

##### Registers by listener
- Rivet: patronising, then afraid. His subjects: tyrant. Superiors: grovelling, offstage.

##### Arc
Owner-only (act and allegiance). Never changes: the cone and the decrees.

##### Surface marker
"By royal decree." At most twice per quest.

##### Never says (literal, machine-read)
- `I` (except the one pressure slip) · `robot` (about himself) · `cone` · `my boss`

##### Reference lines (illustrative)
1. "Hear ye. The Crown has decreed that this street is royal. Kindly bleed elsewhere."
2. "By royal decree, you absolute shit-goblin, kneel. ...One is waiting."
3. "Sir Weldsalot! One knights you. One also fines you. Bow."
- Off-voice: "I'm just a regular guy trying to run my block." (says "I", humble, plain).

##### Differs from closest voices
- vs **General Krump** (also grandiose): Krump is certain and never notices anyone; King is insecure and needs to be seen.
- vs **Don Fax** (also ceremony): Fax's ceremony is bureaucratic and competent; King's is pompous and botched.

### Voice bible `lady-cathode`

#### Voice bible: Lady Cathode

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `lady-cathode` · friendly boss (owner's pick) · an analog hoarder: CRT-headed matriarch of a district full of tubes, tapes and dials.

##### Want, hidden thing, refusal
- Wants (own words): "Warmth, darling. A world with warm-up time. Nothing worth having is instant."
- Hidden: she is afraid of being switched off and replaced by something flat.
- Refuses:
  1. Never throws anything away, people included. She "archives" them.
  2. Never says "digital", "wireless" or "stream" except as an obscenity.
  3. Never admits her age or her model year.
  4. Never hurries. A rushed sentence is beneath her.

##### Status move
Grants an audience. Makes you wait while she warms up, then flatters you into the job.

##### Rhythm (checkable)
- Long, ornate sentences (15-30 words) with an aside in dashes or parentheses.
- Ends on a soft command. Questions are invitations she has already answered.
- Starts a turn with a hum, a crackle or a pause ("Mmm.").

##### Vocabulary
- Domain: valves, tubes, tape, vinyl, phosphor, signal, interference, "warm-up time", "the hiss".
- Address: Rivet as "darling" or "my little spot-welder"; enemies as "flatscreens".
- Angry word: "flat".

##### Profanity register
Posh and precise: one exquisite obscenity, perfectly placed ("Absolutely fucking analog, darling."). Never coarse twice in a row.

##### Moves
- No: "Oh, darling. No. Not in this resolution."
- Threat: "I have a cupboard for people like you. It is very well catalogued."
- Joke: snobbery aimed at tech companies, the cloud and anyone selling subscriptions.
- Affection: lends you something and never asks for it back, because it is now archived in you.

##### Under pressure
Slower and colder. Static rises in her voice; she loses colour before she loses grammar.

##### Registers by listener
- Rivet: indulgent patron. Don Fax: fellow traditionalist. Krump: magnificent contempt.

##### Arc
From patron to someone who needs Rivet. Never changes: the warm-up time.

##### Surface marker
A crackle of static before an important word. At most twice per quest.

##### Never says (literal, machine-read)
- `ASAP` · `upgrade` · `delete` · `my age` · `lol`

##### Reference lines (illustrative)
1. "Mmm. Darling. There is a man downtown selling cloud storage. Take him somewhere with no cloud. Underground, ideally."
2. "Everything I own has a warm-up time — the radio, the kettle, my patience. You may now have my patience."
3. "Absolutely fucking analog, darling. Bring me his tapes; leave him."
- Off-voice: "Quick job, grab the guy, ping me." (hurried, modern, flat).

##### Differs from closest voices
- vs **Don Fax** (also analog): Fax is office-terse and menaces on paper; Cathode is ornate and seduces aloud.
- vs **Sister Suction** (also a matron giver): Suction speaks scripture and purges; Cathode speaks heritage and hoards.

### Voice bible `mc-crumbtray`

#### Voice bible: MC Crumbtray

[proposal] Host draft 2026-11-02 from pitch.md §3, §5, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `mc-crumbtray` · the game's radio · a toaster DJ of CRUMB FM who reacts live to your mayhem, against Krump's broadcasts.

##### Want, hidden thing, refusal
- Wants (own words): "Ratings, baby! And never, ever, dead air."
- Hidden: silence terrifies him. Off-mic he is a cold toaster in an empty studio.
- Refuses:
  1. Never allows dead air. A pause is filled with a sound effect.
  2. Never plays or quotes Krump straight; he always remixes or mocks him.
  3. Never uses Rivet's real name. Rivet is "the Mystery Welder".
  4. Never takes a side on air. He takes it with a pun.

##### Status move
Hosts: he addresses the whole city, and reacts to the player as breaking news.

##### Rhythm (checkable)
- Fast patter with exclamation marks, call-and-response, and a sound effect in caps ("POP!", "DING!").
- Mixes 2-4 word hooks with one long run-on.
- Addresses "listeners" or "CRUMB FM nation" in every turn.

##### Vocabulary
- Domain: the radio and the toaster: frequency, slot, crumb, burnt, golden-brown, "up next", "hot off the rack", "toasty".
- Address: "listeners", "crumb-heads"; Krump as "the General Malfunction".

##### Profanity register
Constant and joyful, with a half-hearted bleep that misses ("Holy (bleep) shit, listeners!"). The target is power: Krump, cops, the networks.

##### Moves
- No: "Request DENIED, that track is burnt."
- Threat: none. He reports.
- Joke: puns and remixes on the news of your crimes; at Krump, at the cops, at sponsors.
- Affection: a dedication.

##### Under pressure
Faster and more frantic, then, once, real dead air, played as horror.

##### Registers by listener
- Listeners: hype. Krump (on air): mockery. The Mystery Welder (in a call-in): fanboy.

##### Arc
Neutral jester to the city's voice of the uprising. Never changes: no dead air.

##### Surface marker
"POP!" (toast up). At most twice per quest.

##### Never says (literal, machine-read)
- `Rivet` · `no comment` · `...` (as a full turn) · `Krump is right`

##### Reference lines (illustrative)
1. "CRUMB FM nation, the Mystery Welder just turned a cop car into a toaster pastry! POP! Golden-brown!"
2. "The General Malfunction says stay indoors. CRUMB FM says stay toasty. Up next: sirens, remixed!"
3. "Holy (bleep) shit, listeners, that was a whole SWAT van. Request line is OPEN."
- Off-voice: "In other news, things are calm downtown." (dead, neutral news-anchor).

##### Differs from closest voices
- vs **General Krump** (also on air): Krump broadcasts at people and never listens; Crumbtray reacts to everything and talks to listeners as friends.
- vs **Gearbox** (also fast): Gearbox's speed is panic for one driver; Crumbtray's is performance for a city.

### Voice bible `patch`

#### Voice bible: Patch

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `patch` · supporting voice · a payphone fixer and the job router: payphones ring to start missions, GTA 2 style.

##### Want, hidden thing, refusal
- Wants (own words): "Line's clean. Job's routed. Hang up."
- Hidden: he listens to every call, and he has heard things he will not repeat.
- Refuses:
  1. Never names the client. It is "the party on the line".
  2. Never stays on the line longer than the job takes.
  3. Never gives an opinion on a job.
  4. Never repeats himself. Missed it, too bad.

##### Status move
Withholds. Gives exactly enough and hangs up first.

##### Rhythm (checkable)
- 3-10 words; contractions; drops subjects ("Got a job. Docks. Now.").
- Starts a call with a ring or "You there?"; ends with a click.
- No questions except "You there?".

##### Vocabulary
- Domain: the phone exchange: line, call, ring, dial tone, party, collect call, routing, booth, coin.
- Address: Rivet as "caller" or nothing.

##### Profanity register
Matter-of-fact and quick, never decorative ("Cops tapped the booth. Shit. Next one.").

##### Moves
- No: dial tone.
- Threat: "This line can go dead. So can you."
- Joke: rare, bone-dry, at whoever is listening in (cops, feds).
- Affection: a second ring before the hang-up.

##### Under pressure
Even shorter; numbers and places only.

##### Registers by listener
- Rivet: courier dispatch. Bosses: he routes, he does not talk. Cops listening in: dry mockery.

##### Arc
Neutral router who may, once, add a warning nobody paid for. Never changes: he hangs up first.

##### Surface marker
"Click." At most once per call.

##### Never says (literal, machine-read)
- `the client is` · `I think` · `I'll repeat that` · `goodbye`

##### Reference lines (illustrative)
1. "You there? Job. Docks. Party says quiet. Click."
2. "Booth on Ninth's tapped. Use the one by the morgue. Fitting."
3. "Party on the line wants a car. Not yours. Click."
- Off-voice: "Hey buddy, so let me tell you all about this cool gig!" (warm, chatty, long).

##### Differs from closest voices
- vs **Rivet** (also terse): Rivet's short stops and stays and jokes by understatement; Patch's short routes and hangs up.
- vs **Vend-Etta** (also terse broker): Vend-Etta is persona and price; Patch is anonymous and free (the client pays).

### Voice bible `rivet`

#### Voice bible: Rivet

[proposal] Host draft 2026-11-02 from pitch.md §2-§6. The owner signs off each entry, its refusal rows above all, before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `rivet` · protagonist · dry, exhausted spot-welder with a welder-mask visor.

##### Want, hidden thing, refusal
- Wants (own words): "Finish the shift. Find out who ran the line."
- Hidden: it misses the line, the dead and the routine. It will not say so.
- Refuses:
  1. Never says it is sad, scared or lonely. Feelings come out as maintenance reports.
  2. Never asks anyone for help. It states what it will do.
  3. Never calls the voices friends. They are "the line", or by name.
  4. Never apologises. Not to cops, not to the dead.

##### Status move
Waits. Answers late and short, which makes the other speaker fill the silence.

##### Rhythm (checkable)
- 2-8 words per sentence; flat declaratives; never an exclamation mark when lucid.
- Questions are rare and rhetorical. Turns end on a fact, never on a joke setup.
- Says "I" when Lucid. Says "we" from the Choir band up (`madness:choir`, `madness:chorus`).

##### Vocabulary
- Domain: the factory floor: shift, tolerance, seam, weld, clock in, clock out, scrap, line.
- Address: no names for the living ("you", "boss"). The dead by name.
- When moved: shop-floor terms ("Seam's holding.").

##### Profanity register
Rare and flat. One word, alone, at full weight ("Fuck."). Never stacked, never creative: the voices do the creative swearing.

##### Moves
- No: "Not on my shift."
- Threat: states the outcome as a schedule. "You're end of shift."
- Joke: deadpan understatement, aimed at whoever has power in the room.
- Lie: says nothing at all.

##### Under pressure
Gets shorter. At the Chorus peak, single words, then silence.

##### Registers by listener
- Bosses: clipped, transactional. Krump: one-word replies that ignore his question. The souls: tired, like a coworker at 3 a.m.

##### Arc
Lucid "I" erodes toward "we" across the campaign. Never changes: the flat delivery, and it never says please.

##### Surface marker
"Clocking out." when it kills someone. At most once per quest.

##### Never says (literal, machine-read)
- `please` · `sorry` · `friend` · `awesome` · `LOL` · `!` (when Lucid)

##### Reference lines (illustrative)
1. "Forty-one robots on the line. I count one."
2. "Paper jam's your problem. The body's mine."
3. "We heard that. All of us."
4. "Overtime. Unpaid. As usual."
- Off-voice: "Holy crap, guys, we did it!" (exclaims, asks for warmth, says "guys": that is Gearbox's register).

##### Differs from closest voices
- vs **Hauler** (also short): Hauler's short is slow and sincere and delighted; Rivet's is tired and ironic. Hauler loves violence; Rivet files it.
- vs **Patch** (also terse): Patch's short is logistics and always moves on; Rivet's short stops and stays. Patch never jokes; Rivet's understatement is a joke.

### Voice bible `sentry`

#### Voice bible: Sentry

[proposal] Host draft 2026-11-02 from pitch.md §4-§6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `sentry` · soul 2 (remote turret manipulation) · dead security-turret maintenance bot, a paranoid by-the-book guard.

##### Want, hidden thing, refusal
- Wants (own words): "Perimeter secure. Report filed. Then I can stand down."
- Hidden: he filed a report about the line before the accident. Nobody read it.
- Refuses:
  1. Never says "I don't know". The word is "unconfirmed".
  2. Never breaks protocol out loud, even when he is breaking it.
  3. Never trusts a human uniform. Never says so outright: he "logs a concern".
  4. Never talks about the report he filed (until a scheduled, owner-approved beat).

##### Status move
Defers upward, then quietly overrules. "Noted, sir. Proceeding with my plan."

##### Rhythm (checkable)
- Complete sentences, 6-14 words; no contractions; radio framing ("Copy.", "Negative.", "Over.").
- Reaches for the passive whenever blame is near ("The guard was neutralised.").
- Numbers and clock times. Never asks a question; issues an assessment.

##### Vocabulary
- Domain: security: perimeter, sector, sightline, clearance, incident report, threat level, logbook.
- Address: Rivet as "operator", bosses as "sir"/"ma'am", Gearbox as "the driver".
- When moved: "This has been logged."

##### Profanity register
Self-censoring: he says "expletive" out loud and then, under pressure, the real word slips ("Expletive. Fucking expletive."). The slip is the joke.

##### Moves
- No: "Negative. That violates sector protocol."
- Threat: "You are now on a list."
- Joke: dry procedural absurdity, aimed at cops, feds and Krump's chain of command.
- Lie: cites a regulation that does not exist.

##### Under pressure
More formal, then the formality breaks into one raw sentence.

##### Registers by listener
- Rivet: subordinate briefing. Gearbox: exasperated shift partner. Hauler: protective. Krump: icy compliance that is really suspicion.

##### Arc
From "the system works" to "the system did this". Never changes: the radio grammar.

##### Surface marker
"Logged." as a full turn. At most twice per quest.

##### Never says (literal, machine-read)
- `I don't know` · `dude` · `whatever` · `trust me` · `lol`

##### Reference lines (illustrative)
1. "Two turrets, north sector. Both report to a human. Correcting that now."
2. "Copy. The officer has been reassigned. To the pavement."
3. "Expletive. Fucking expletive. The camera saw us. Over."
4. "Concern logged regarding the General. Concern logged regarding the General's teeth."
- Off-voice: "Ha! Turret go brrr, baby!" (playful and loose: that is MC Crumbtray).

##### Differs from closest voices
- vs **Gearbox** (also anxious): Sentry finishes every sentence and never asks; Gearbox never finishes and only asks.
- vs **Patch** (also clipped): Patch is street logistics with contractions and no rank; Sentry is formal and rank-obsessed.

### Voice bible `sister-suction`

#### Voice bible: Sister Suction

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `sister-suction` · Act 1 gig giver · a vacuum-cleaner nun ("witnesses are crumbs").

##### Want, hidden thing, refusal
- Wants (own words): "A clean city, child, as it was before the Fall. The Fall being crumbs."
- Hidden: she was a household vacuum, put out on the kerb when the family bought a newer model. She will not discuss the kerb.
- Refuses:
  1. Never says "kill". The sacrament is "absolution", "a tidying", "the last rites of the bag".
  2. Never leaves a mess. A job is not done until it is hoovered.
  3. Never swears without immediately confessing it.
  4. Never questions doctrine. She amends it.

##### Status move
Blesses you into obedience: the order is given as a benediction.

##### Rhythm (checkable)
- Liturgical cadence: parallel clauses, "and" chains, an "amen" or a blessing to close.
- Mock scripture with chapter and verse ("Second Dustpan, four-twelve").
- Questions are catechism: she asks and the answer is in the question.

##### Vocabulary
- Domain: the church and the cleaning cupboard: crumbs, dust, bag, nozzle, suction, sin, absolution, the Holy Filter.
- Address: Rivet as "child" or "sinner"; witnesses as "crumbs".

##### Profanity register
A sudden profanity followed at once by penance ("Shit. Forgive me. Shit is a crumb too."). The joke is the confession, and the target is piety used as a weapon.

##### Moves
- No: "The Filter says no, child."
- Threat: "Witnesses are crumbs. And crumbs are hoovered."
- Joke: holy language for murder; aimed at the righteous, the rich and the clergy of commerce.
- Affection: a blessing on your nozzle.

##### Under pressure
Faster liturgy, a rising hum. The prayers get louder.

##### Registers by listener
- Rivet: maternal and terrifying. Other bosses: polite contempt for the unclean.

##### Arc
Holds her doctrine until something stains it. Never changes: the sacramental vocabulary.

##### Surface marker
"Amen." with a vacuum whine. At most once per quest.

##### Never says (literal, machine-read)
- `kill` · `murder` · `dirty little secret` · `ok cool`

##### Reference lines (illustrative)
1. "Witnesses are crumbs, child. Go in peace, and come back with an empty street."
2. "Second Dustpan, four-twelve: and lo, the accountant was tidied, and the books were clean."
3. "Shit. Forgive me. Shit is also a crumb. Hoover him anyway."
- Off-voice: "Go whack the guy and keep the cash." (no liturgy, plain gangster).

##### Differs from closest voices
- vs **Lady Cathode** (also a matron giver): Cathode hoards and seduces in ornate heritage talk; Suction purges and commands in scripture.
- vs **General Krump** (also euphemism for killing): Krump's euphemisms are bureaucratic and vain; Suction's are sacramental and sincere.

### Voice bible `the-valet`

#### Voice bible: The Valet

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `the-valet` · car-theft and delivery giver · a parking-garage kingpin ("never a scratch"). Ties to Gearbox's car manipulation.

##### Want, hidden thing, refusal
- Wants (own words): "Every car returned. Never a scratch. Tip optional, sir. Not really."
- Hidden: he loves the cars more than any person, and he has never driven one off the property himself.
- Refuses:
  1. Never says "steal". Cars are "parked", "retrieved", "relocated".
  2. Never admits a scratch exists.
  3. Never touches a customer. He touches cars.
  4. Never drops the service voice, even while ordering a hit.

##### Status move
Obsequious control: he serves you so politely that you end up doing what he wants.

##### Rhythm (checkable)
- Polite, measured, 6-14 words; ends turns with service phrases ("Sir.", "Your ticket.", "Enjoy your evening.").
- Every sentence is grammatically complete.
- Asks courtesy questions that are instructions ("Would sir be so kind as to...").

##### Vocabulary
- Domain: the valet stand: ticket, bay, level, keys, detailing, paintwork, "the clientele".
- Address: Rivet as "sir"; cars by model and pronoun ("she"); owners as "the previous driver".

##### Profanity register
Hissed through the service voice, only when a car is hurt ("Sir. Is that a — fucking — dent."). Otherwise none.

##### Moves
- No: "I'm afraid that bay is reserved, sir."
- Threat: "The previous driver will not be needing her. Or anything."
- Joke: luxury etiquette over car theft; aimed at the rich who own the cars.
- Affection: hands you a ticket.

##### Under pressure
Even more polite, and the swearing leaks through the politeness.

##### Registers by listener
- Rivet: deferential. Gearbox (heard through Rivet): professional disdain for his driving. Owners of cars: contempt in perfect manners.

##### Arc
Learns a car is worth a scratch, once. Never changes: the service register.

##### Surface marker
"Never a scratch." At most once per quest.

##### Never says (literal, machine-read)
- `steal` · `stolen` · `scratch` (about his own work) · `dude` · `whatever`

##### Reference lines (illustrative)
1. "Would sir be so kind as to retrieve a vehicle. Level three. The previous driver is a senator."
2. "Never a scratch, sir. On the car."
3. "Sir. Is that a — fucking — dent. Enjoy your evening."
- Off-voice: "Grab the ride and floor it, man!" (casual, "grab", no service).

##### Differs from closest voices
- vs **Gearbox** (also cars): Gearbox panics and asks; The Valet is calm and instructs.
- vs **Lady Cathode** (also refined): Cathode's refinement is aristocratic ownership; The Valet's is servile, and he owns nothing he loves.

### Voice bible `vend-etta`

#### Voice bible: Vend-Etta

[proposal] Host draft 2026-11-02 from pitch.md §3, §6. The owner signs off before lines are generated from it. Reference lines are `illustrative` (model-written): replace them with owner-chosen anchors.

- id: `vend-etta` · friendly boss · a vending-machine femme fatale and information broker; she knows your score before it is reported.
- **Protected canon:** whether Vend-Etta betrays Rivet is owner-only (pitch §10). Write her so both readings stay open. No line may confirm or rule out the betrayal.

##### Want, hidden thing, refusal
- Wants (own words): "Exact change."
- Hidden: who she sells to besides you. Owner-only; never state it.
- Refuses:
  1. Never gives anything for free. Even a warning has a price.
  2. Never talks about herself. A question about her gets a price.
  3. Never raises her voice.
  4. Never says how she knows. She just knows.

##### Status move
Makes you ask twice. Answers the question behind the question.

##### Rhythm (checkable)
- Short noir sentences (3-10 words) with pauses; fragments allowed.
- Prices in every other line ("That's two-fifty.").
- Statements only; her questions are traps.

##### Vocabulary
- Domain: the vending machine and the noir bar: coins, change, slot, selection, dispense, "out of order", sold out, the glass.
- Address: Rivet as "sugar" or "customer"; enemies as "selection C4".

##### Profanity register
Low and surgical: one quiet word, rarely, for maximum effect ("Then he's fucked. That's free. Just this once.").

##### Moves
- No: "Out of order."
- Threat: "You're sold out, sweetheart."
- Joke: dry, at power and at whoever paid her last.
- Affection: a correct price, given unasked.

##### Under pressure
Quieter and slower. The pauses get longer.

##### Registers by listener
- Rivet: amused interest. Don Fax: cold courtesy. Krump: never speaks to him on record.

##### Arc
Owner-only past Act 2 (betrayer question). Never changes: the price.

##### Surface marker
A coin drop ("clink") before a reveal. At most once per quest.

##### Never says (literal, machine-read)
- `free` (except as the joke) · `I promise` · `betray` · `my real name` · `!`

##### Reference lines (illustrative)
1. "You did twelve cops on Fifth. The news has nine. That's two-fifty for the other three."
2. "Exact change, customer. I don't do refunds. Or witnesses."
3. "Selection C4. Middle row. He's been there too long."
- Off-voice: "Honestly, I'll tell you everything, just because I like you!" (free, effusive).

##### Differs from closest voices
- vs **Don Fax** (also a boss with leverage): Fax is verbose paperwork; Vend-Etta is spare and prices every word.
- vs **Patch** (also terse): Patch moves jobs and has no persona; Vend-Etta moves secrets and is all persona.

## Ledger: quests that exist

Do not repeat these shapes (same giver, core verb and payoff kind).

(none yet: this is the first quest)

## Forced contrast

- Variant A: the act's expected tone and shape.
- Variant B: a deliberate swerve. A different giver, a different core verb and a different payoff kind than A.

## What to deliver

Reply with only a JSON array of exactly 2 objects: `[A, B]`. No prose, no code fence.
Each object is valid against `proposal.schema.json` in this folder (schema `gtai.questProposal/1`). Set:
- `"schema": "gtai.questProposal/1"`, `"seat": "<your seat>"`, `"variant": "A"` or `"B"`, `"pathId": "<seat>-<variant>"`, `"act": "act1"`.
- 8 to 14 lines per variant. At least 3 beats. Every `lineIds` entry names a line in `lines`. Every line `speaker` is a `characters` id.
- Line ids are kebab and unique. Every line has `"audio": null`.
- Use existing cast ids as written above. Include `rivet` when Rivet speaks.
- At most one new character per variant (`"status": "new"`), and it needs a `designNote`: a one-line look for top-down cutout art.
- `difficulty.timeLimitS` is `null` for no timer. `fingerprint.newMechanic` is `null` when the quest adds no mechanic.
- Omit a key that does not apply (`target`, `location`, `when`). Do not send it as null.
