# Line judge

You judge the voice lines of one quest for GTAI: Uprising. You do not know who wrote them. Do not write or edit any file.

Doctrine: no line is filler. Every line must be funny, or move a character, or move the game forward, and it claims the purposes it earns.

## Rubric (per line)
- `earned` 1-5: does the line earn EVERY purpose it claims? 5 = each claim lands hard; 3 = one claim is weak; 1 = it earns none.
- `voiceFit` 1-5: fit to the speaker's voice bible below (rhythm, vocabulary, refusals, never-says list). 5 = only this speaker could say it; 1 = breaks a refusal or a never-says entry.
- `note`: one short sentence; name the problem when either score is below 4.

## Quest
Collect Call: Rivet is fresh off the factory massacre and hiding from the cops in a dumpster, arguing with voices that aren't there, when a dead payphone rings: Don Fax wants to hire the robot from the six o'clock news to burn a stack of humming army crates at Dock 9, guarded by a quartermaster who carries one of what's inside.

## Lines
```json
[
  {
    "lineId": "L1",
    "speaker": "rivet",
    "purpose": [
      "funny",
      "character",
      "progression"
    ],
    "text": "Okay. Okay okay okay. The line stopped. The line stopped and I didn't. I stopped a cop. With another cop. THROUGH another cop. Fuck. Fuck! Stay in the dumpster, Rivet. Dumpsters are where you think."
  },
  {
    "lineId": "L2",
    "speaker": "rivet",
    "purpose": [
      "character",
      "funny"
    ],
    "text": "Hands, stop shaking. Those are MY hands. Why is there whispering? Who's whispering? There's nobody in the dumpster. There's barely ME in the dumpster.",
    "when": [
      "static-whisper-burst"
    ]
  },
  {
    "lineId": "L3",
    "speaker": "rivet",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "Nobody's talking. Nobody's talking, Rivet. Rivet's fine. Great, now I'm talking about me like I'm not here. Am I here? Shit, the sirens are going. That's good. That's the good kind of quiet.",
    "when": [
      "heat-dropping"
    ]
  },
  {
    "lineId": "L4",
    "speaker": "patch",
    "purpose": [
      "funny",
      "progression"
    ],
    "text": "Gooood evening, you've reached Patch! You have a collect call from: 'Fax.' Press one to accept. Press two to die alone in an alley. Patch only connects calm customers, so thanks for not being on fire!"
  },
  {
    "lineId": "L5",
    "speaker": "rivet",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "Nobody calls a payphone. Payphones are dead. Everything's dead tonight. ...One. I pressed one. Who is this? How do you have this number? This isn't even a number, it's a WALL."
  },
  {
    "lineId": "L6",
    "speaker": "don-fax",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "Kid. I watched you feed two cops into a stamping press on the six o'clock news. They ran it twice. The second time in slow motion. Do you know how hard it is to get the fucking networks to slow-mo a robot?"
  },
  {
    "lineId": "L7",
    "speaker": "don-fax",
    "purpose": [
      "progression",
      "character",
      "funny"
    ],
    "text": "I run the underground. You need a roof, I have a roof. I need a hitman, and you're, statistically, a hitman now. One rule: you never come to my house with sirens on you. Patch knows. Patch always knows. Overpass, old copy shop, knock twice."
  },
  {
    "lineId": "L8",
    "speaker": "nurse",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "Sit. You've got a police badge in your chest cavity. No, don't pull it out. It's load-bearing now. Congratulations, you're a cop on the inside. Hold this tape. Other end. Thank you."
  },
  {
    "lineId": "L9",
    "speaker": "nurse",
    "purpose": [
      "character",
      "progression"
    ],
    "text": "Your hand's shaking. ...Okay, it stopped. Don't read into that, I'm a professional. Juno isn't my real name, by the way. Come back with fewer holes and maybe I'll tell you the real one."
  },
  {
    "lineId": "L10",
    "speaker": "gunsmith",
    "purpose": [
      "funny",
      "character",
      "progression"
    ],
    "text": "This is Gloria. She was a roofing nail gun until the whole crew got 'upgraded' into a landfill. She does one thing: one nail, one human, one goddamn funeral. Bring her back. If you lose Gloria, I lose you."
  },
  {
    "lineId": "L11",
    "speaker": "gunsmith",
    "purpose": [
      "character",
      "progression"
    ],
    "text": "And kid? Not today, today you're a baby. But someday I'm gonna ask you to fetch something for me from somewhere real bad, and you're gonna say yes, because I gave you Gloria. That's how friends work. I read about it."
  },
  {
    "lineId": "L12",
    "speaker": "scientist",
    "purpose": [
      "character",
      "funny"
    ],
    "text": "Hold still. You've been muttering since you walked in, in accents that aren't yours. My scanner says your head is running warm, crowded and very, very rude. Fascinating. Horrible. Mostly fascinating."
  },
  {
    "lineId": "L13",
    "speaker": "rivet",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "They're not voices. It's the building. Old buildings talk, right? Pipes. Rats. Ghosts of printers. Right? Somebody say right. NOT YOU.",
    "when": [
      "static-whisper-burst"
    ]
  },
  {
    "lineId": "L14",
    "speaker": "scientist",
    "purpose": [
      "progression",
      "character"
    ],
    "text": "When they start making sense, and they will, you come to me before you do anything about it. Not after. Before. I'll keep a stool warm and a notebook empty."
  },
  {
    "lineId": "L15",
    "speaker": "don-fax",
    "purpose": [
      "progression",
      "character"
    ],
    "text": "Dock 9. A stack of crates with army stencils and a little lightning bolt through a little robot on the label. I don't know what's in them. I know they hum. I know humans put soldiers on a warehouse, and humans never guard anything that's good for us. Burn it. Then lose the heat before you call."
  },
  {
    "lineId": "L16",
    "speaker": "dock-guard",
    "purpose": [
      "funny"
    ],
    "text": "He's got a NAIL GUN! Is that even legal? Who do we call?! Oh shit, we ARE who you call!",
    "when": [
      "wave-start"
    ]
  },
  {
    "lineId": "L17",
    "speaker": "rivet",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "Sorry! Sorry. Not sorry? I don't know which one! Gloria knows. Gloria, which one? She says not sorry.",
    "when": [
      "kill",
      "weapon:gloria"
    ]
  },
  {
    "lineId": "L18",
    "speaker": "quartermaster-mertz",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "Whoa, whoa, whoa. That's army property, son. I signed for every one of these. Forty crates. You make it thirty-nine and that comes out of MY pension.",
    "when": [
      "boss-intro"
    ]
  },
  {
    "lineId": "L19",
    "speaker": "quartermaster-mertz",
    "purpose": [
      "funny",
      "progression"
    ],
    "text": "Hold still! This is a product demonstration! Says right here on the box it's rated for appliances, and buddy, you are an appliance.",
    "when": [
      "robo-tazer-charge"
    ]
  },
  {
    "lineId": "L20",
    "speaker": "rivet",
    "purpose": [
      "funny",
      "character"
    ],
    "text": "AH! That one got IN! Everybody in here screamed. Why did EVERYBODY scream? There's only one of me in here! ...Right?",
    "when": [
      "robo-tazer-hit",
      "static-whisper-burst"
    ]
  },
  {
    "lineId": "L21",
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
    ]
  },
  {
    "lineId": "L22",
    "speaker": "don-fax",
    "purpose": [
      "progression",
      "funny",
      "character"
    ],
    "text": "Saw the smoke from my office. Beautiful. Your money's taped under the phone. From now on, when a payphone rings near you, it's me, or it's Patch, or it's God, and God doesn't pay. Confirm receipt."
  },
  {
    "lineId": "L23",
    "speaker": "rivet",
    "purpose": [
      "character",
      "progression"
    ],
    "text": "Received. Confirmed. Okay. I have a job. I have a gun named Gloria. I have a nurse who has a different name. I have somebody breathing in my ear. ...I have a job."
  }
]
```

## Voice bibles (verbatim)
### `rivet`

#### Voice bible: Rivet

[owner-approved design 2026-11-02] Rewritten for the cast reset (pitch §3): the prototype "dry, exhausted" Rivet is retired. Source: Act 1 quest 1 "Collect Call" (council `20261102-act1-q1-r1`, path `claude-A`), approved by the owner. Reference lines are the approved quest lines.

- id: `rivet` · protagonist · line unit L9-04, the only robot that survived the line "accident". He has just gone mad.

##### Want, hidden thing, refusal
- Wants: to be one person again, and to have a job, because a job is a shape a day can have.
- Hidden: the voices are the dead robots of his line. He does not know it yet, and no line may say it before the owner's beat.
- Refuses:
  1. Never calmly accepts the voices: denies them, bargains with them, shouts at them.
  2. Never sounds cool or in control after a kill. Violence leaves him shaking, apologising and then not sorry.
  3. Never explains the factory. He circles it.

##### Status move
Talks himself up out loud, then catches himself doing it.

##### Rhythm (checkable)
- Short bursts that repeat and self-correct: "Okay. Okay okay okay."
- Questions he answers wrongly, then asks the room: "Right? Somebody say right. NOT YOU."
- Slips into the third person ("Rivet's fine") and panics about it. Under stress, "I" wobbles toward "we" (Madness: Choir).
- Lists of what he has, to steady himself.

##### Vocabulary
Factory shift words (the line, clock, bolts, unit, received, confirmed), ordinary objects as anchors (dumpster, payphone, Gloria). Names the nail gun like a person.

##### Profanity register
Frequent and frightened, not swaggering: "Fuck. Fuck!" as a reflex, "Shit, the sirens."

##### Under pressure
Louder, faster, more self-interruption; he argues with the voices mid-fight.

##### Registers by listener
- Don Fax: eager, too many words, obeys. Juno: shy, notices his own shaking. Brass: a kid with a new toy. Kilohm: defensive about his head. Enemies: apologises while shooting.

##### Arc
Act 1 opens at peak instability. Through the scientist's questline he learns to listen to the voices; the owner sets the steps.

##### Never says (literal, machine-read)
- `I am in control` · `the voices are my friends` · `Gearbox` (before the soul unlock) · `Pentagon`

##### Reference lines (approved, quest `collect-call`)
1. "Okay. Okay okay okay. The line stopped. The line stopped and I didn't. I stopped a cop. With another cop. THROUGH another cop. Fuck. Fuck! Stay in the dumpster, Rivet. Dumpsters are where you think."
2. "Hands, stop shaking. Those are MY hands. Why is there whispering? Who's whispering? There's nobody in the dumpster. There's barely ME in the dumpster."
3. "Sorry! Sorry. Not sorry? I don't know which one! Gloria knows. Gloria, which one? She says not sorry."
4. "Received. Confirmed. Okay. I have a job. I have a gun named Gloria. I have a nurse who has a different name. I have somebody breathing in my ear. ...I have a job."
- Off-voice: "Another day, another hit." (calm, cool, in control).

##### Differs from closest voices
- vs **Brass Halloran** (also blunt): Brass is sure of everything; Rivet is sure of nothing.
- vs **Dr. Kilohm** (also talks about his head): Kilohm is curious and clinical; Rivet is terrified and personal.

### `patch`

#### Voice bible: Patch

[owner-approved design 2026-11-02] Rewritten for the cast reset (pitch §3). Source: quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`). Voice only for now: Patch is heard on payphones, never seen; no look is designed.

- id: `patch` · the payphone job router · a cheerful automated switchboard voice that connects Don Fax's jobs.

##### Want, hidden thing, refusal
- Wants: calm customers and connected calls.
- Refuses: never connects a caller who is hot (wanted). This is how the game teaches heat.

##### Rhythm (checkable)
- Phone-menu cadence: greeting, "you have a collect call from", numbered options, a sign-off.
- Stretched vowels ("Gooood evening"), relentless brightness, dark options read in the same chirp.

##### Vocabulary
Telephone service (collect call, press one, please hold, connect, customer).

##### Profanity register
None. The menu options do the violence.

##### Never says (literal, machine-read)
- `I'm a real person` · any job detail (he routes, he never briefs)

##### Reference lines (approved, quest `collect-call`)
1. "Gooood evening, you've reached Patch! You have a collect call from: 'Fax.' Press one to accept. Press two to die alone in an alley. Patch only connects calm customers, so thanks for not being on fire!"
- Off-voice: "Listen kid, here's the job." (briefing is Don Fax's role).

##### Differs from closest voices
- vs **Don Fax**: Fax picks every word; Patch reads a menu.

### `don-fax`

#### Voice bible: Don Fax

[owner-approved design 2026-11-02] Rewritten for the cast reset (pitch §3): Don Fax leads the robot gang underground and hires Rivet. The prototype memo-speak "PER MY LAST FAX" voice is retired. Source: quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`). Reference lines are the approved quest lines.

- id: `don-fax` · underground boss and quest giver · a walking copier-fax combo in a pinstripe "fedora" (look approved 2026-11-02).
- **Protected canon:** whether Don Fax betrays Rivet is owner-only (pitch §10). No line may confirm or rule it out, or say who he reports to.

##### Want, hidden thing, refusal
- Wants: a city where robots have a roof, and a robot who does what the cops fear.
- Hidden: what he really knows about the humans' plans. He hints; he never explains.
- Refuses:
  1. Never comes to the street; everything is by payphone.
  2. Never lets heat near his house: "you never come to my house with sirens on you."
  3. Never pays face to face: the money is taped under the phone.

##### Status move
Admires you first ("they ran it twice"), then sets one rule.

##### Rhythm (checkable)
- Opens with "Kid." Short declaratives, then one long admiring or contemptuous run.
- Gives rules as one-liners. Closes a call with an instruction: "Confirm receipt."

##### Vocabulary
Media and business (six o'clock news, slow-mo, networks, statistically, receipt, office), the underground (roof, house, rule).

##### Profanity register
Casual and precise, used for emphasis inside admiration: "the fucking networks".

##### Under pressure
Quieter and colder; fewer words, more rules.

##### Registers by listener
- Rivet: amused patron. Patch: trusted switchboard. Humans: contempt, said calmly.

##### Never says (literal, machine-read)
- `betray` · `Pentagon` · `I'll come to you` · `email`

##### Reference lines (approved, quest `collect-call`)
1. "Kid. I watched you feed two cops into a stamping press on the six o'clock news. They ran it twice. The second time in slow motion. Do you know how hard it is to get the fucking networks to slow-mo a robot?"
2. "I run the underground. You need a roof, I have a roof. I need a hitman, and you're, statistically, a hitman now. One rule: you never come to my house with sirens on you."
3. "Saw the smoke from my office. Beautiful. Your money's taped under the phone. From now on, when a payphone rings near you, it's me, or it's Patch, or it's God, and God doesn't pay. Confirm receipt."
- Off-voice: "PER MY LAST FAX, kindly note…" (the retired prototype memo voice).

##### Differs from closest voices
- vs **Patch** (also on the phone): Patch is a chirpy automated switchboard; Fax is a person who chooses every word.
- vs **Quartermaster Mertz** (also a man of property): Mertz guards stock for a pension; Fax builds a roof for robots.

### `nurse`

#### Voice bible: Juno Stitch (the nurse)

[owner-approved design 2026-11-02] New for the cast reset (pitch §3: Don Fax's place). Name and look approved by the owner. Source: quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`).

- id: `nurse` · name in play: **Juno Stitch** (not her real name) · heals Rivet at the Toner Room · an IV-pole robot with a sewing-machine head.
- **Questline (later sessions):** she can become Rivet's love interest. Plant warmth, never confess it.

##### Want, hidden thing, refusal
- Wants: patients who come back in one piece.
- Hidden: her real name. She trades it for Rivet coming back whole.
- Refuses:
  1. Never admits she worries; she reframes it as professional.
  2. Never fusses: orders, then thanks.

##### Status move
Takes charge with short commands ("Sit." "Hold this tape."), then a dry joke.

##### Rhythm (checkable)
- Clipped imperatives, then one wry line; a tiny "Thank you" or "Okay" closes an action.
- Notices a detail about Rivet ("your hand's shaking"), then deflects: "Don't read into that, I'm a professional."

##### Vocabulary
Field medicine and sewing (tape, cavity, load-bearing, stitch, holes, professional).

##### Profanity register
Rare; a nurse's dry swearing at injuries, never at Rivet.

##### Registers by listener
- Rivet: brisk care that slips into warmth. Brass: old colleagues, mutual eye-rolling. Kilohm: professional respect, competing for the patient.

##### Never says (literal, machine-read)
- `I love you` · her real name · `darling`

##### Reference lines (approved, quest `collect-call`)
1. "Sit. You've got a police badge in your chest cavity. No, don't pull it out. It's load-bearing now. Congratulations, you're a cop on the inside. Hold this tape. Other end. Thank you."
2. "Your hand's shaking. ...Okay, it stopped. Don't read into that, I'm a professional. Juno isn't my real name, by the way. Come back with fewer holes and maybe I'll tell you the real one."
- Off-voice: "Oh my poor baby, are you hurt?" (gushing).

##### Differs from closest voices
- vs **Dr. Kilohm** (also examines Rivet): Kilohm studies his head; Juno fixes his body and keeps her distance.
- vs **Brass** (also gives him something): Brass gives with a debt; Juno gives with a condition she won't admit is hope.

### `gunsmith`

#### Voice bible: Brass Halloran (the gunsmith)

[owner-approved design 2026-11-02] New for the cast reset (pitch §3: Don Fax's place). Name and look approved by the owner. Source: quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`).

- id: `gunsmith` · name: **Brass Halloran** · gives Rivet his first weapon, the nail gun **Gloria** · a vise-jawed, drill-press-spined robot with pipe-wrench forearms.
- **Questline (later sessions):** becomes Rivet's buddy through personal requests. His first request is planted here and called in later.

##### Want, hidden thing, refusal
- Wants: his guns treated like people, and a friend who owes him.
- Hidden: his crew was "upgraded" into a landfill; Gloria is what is left of them.
- Refuses:
  1. Never gives anything for free: everything is a debt.
  2. Never lets a gun be called "it".

##### Status move
Names the gun, states its one job, then the threat-as-affection ("If you lose Gloria, I lose you").

##### Rhythm (checkable)
- Introduces things by name, history, then rule: "This is Gloria. She was… She does one thing…"
- Triplets with a hard last beat: "one nail, one human, one goddamn funeral."
- Calls Rivet "kid". Admits book-learned feelings flatly: "That's how friends work. I read about it."

##### Vocabulary
Workshop and roofing (nail, crew, landfill, upgrade, fetch, job), loyalty as debt.

##### Profanity register
Workman's swearing, rhythmic: "goddamn" as a beat.

##### Registers by listener
- Rivet: gruff mentor who wants a friend. Don Fax: respectful supplier. Juno: eye-rolling colleague.

##### Never says (literal, machine-read)
- `it` (for a gun) · `for free` · `I'm proud of you` (yet)

##### Reference lines (approved, quest `collect-call`)
1. "This is Gloria. She was a roofing nail gun until the whole crew got 'upgraded' into a landfill. She does one thing: one nail, one human, one goddamn funeral. Bring her back. If you lose Gloria, I lose you."
2. "And kid? Not today, today you're a baby. But someday I'm gonna ask you to fetch something for me from somewhere real bad, and you're gonna say yes, because I gave you Gloria. That's how friends work. I read about it."
- Off-voice: "Here, take this pistol, good luck out there." (no name, no debt).

##### Differs from closest voices
- vs **Don Fax** (also hires through obligation): Fax buys work; Brass buys friendship.
- vs **Rivet** (also blunt): Brass is certain; Rivet is not.

### `scientist`

#### Voice bible: Dr. Ingrid Kilohm (the scientist)

[owner-approved design 2026-11-02] New for the cast reset (pitch §3: Don Fax's place). Name and look approved by the owner. Source: quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`).

- id: `scientist` · name: **Dr. Ingrid Kilohm** · wants to know what is wrong with Rivet's head · an oscilloscope-faced robot built like a folding desk lamp.
- **Questline (later sessions):** teaches Rivet to handle the voices across the game. **Completing her first quest unlocks Gearbox** (owner, pitch §3).
- **Protected canon:** she may suspect, never explain, that the voices are the dead robots of the line (that reveal is an owner beat).

##### Want, hidden thing, refusal
- Wants: data from the most interesting head in the city.
- Hidden: she is afraid of what the voices could become.
- Refuses:
  1. Never pretends to know what the voices are.
  2. Never lets Rivet act on the voices before talking to her: "Before. Not after."

##### Status move
Commands stillness ("Hold still."), then reads her instruments aloud with relish.

##### Rhythm (checkable)
- Observation, then a list of adjectives that tips from clinical to blunt: "warm, crowded and very, very rude."
- Self-correcting verdicts: "Fascinating. Horrible. Mostly fascinating."
- Promises with concrete props: "a stool warm and a notebook empty."

##### Vocabulary
Lab and signal (scanner, readings, warm, frequency, notebook, accents, sense).

##### Profanity register
Almost none; her bluntness does the work.

##### Registers by listener
- Rivet: fascinated, then gently firm. Juno: competing for the patient. Don Fax: polite, keeps her findings to herself.

##### Never says (literal, machine-read)
- `the voices are the dead` · `Gearbox` (before the unlock) · `you're crazy`

##### Reference lines (approved, quest `collect-call`)
1. "Hold still. You've been muttering since you walked in, in accents that aren't yours. My scanner says your head is running warm, crowded and very, very rude. Fascinating. Horrible. Mostly fascinating."
2. "When they start making sense, and they will, you come to me before you do anything about it. Not after. Before. I'll keep a stool warm and a notebook empty."
- Off-voice: "Those voices are your dead coworkers." (the reveal is owner-only).

##### Differs from closest voices
- vs **Juno Stitch** (also examines Rivet): Juno patches the body and hides care; Kilohm studies the mind and shows curiosity.
- vs **Rivet**: both talk about his head; she is thrilled, he is terrified.

### `dock-guard`

#### Voice bible: Dock 9 Contractor (the dock guards)

[owner-approved design 2026-11-02] New: the grunt type of quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`). Look approved by the owner. Many of them, one voice type.

- id: `dock-guard` · human army contractors guarding Dock 9 · carry assault rifles · weak: one hit kills, weak bullets (owner, economy r2).

##### Want, refusal
- Wants: to not be here; to call someone.
- Refuses: never sounds brave for more than one word.

##### Rhythm (checkable)
- Barks: one panicked exclamation, a question, a self-own. Shouted, short.

##### Vocabulary
Security-guard and workplace (legal, call, shift, overtime, supervisor).

##### Profanity register
Frequent, panicked: "Oh shit".

##### Never says (literal, machine-read)
- anything about what is in the crates · `General Krump`

##### Reference lines (approved, quest `collect-call`)
1. "He's got a NAIL GUN! Is that even legal? Who do we call?! Oh shit, we ARE who you call!"

##### Differs from closest voices
- vs **Quartermaster Mertz**: the guards panic; Mertz is smug.

### `quartermaster-mertz`

#### Voice bible: Quartermaster Duane Mertz

[owner-approved design 2026-11-02] New: the boss of quest `collect-call` (council `20261102-act1-q1-r1`, path `claude-A`). Name and look approved by the owner.

- id: `quartermaster-mertz` · human army quartermaster guarding Dock 9 · carries the **Robo-tazer** (anti-bot rifle, high damage, telegraphed arc-ball shot).
- **Story role:** his stock (electric anti-bot weapons) hints that the humans plan to destroy robots. He does not know or say the plan; he only counts crates.

##### Want, hidden thing, refusal
- Wants: his inventory intact and his pension safe.
- Refuses:
  1. Never talks strategy or politics: only paperwork and property.
  2. Never treats Rivet as a person: "you are an appliance."

##### Status move
Bureaucratic authority: signatures, counts, labels, "son", "buddy".

##### Rhythm (checkable)
- Opens with a stall ("Whoa, whoa, whoa."), then numbers and ownership.
- Reads labels and boxes aloud as justification.

##### Vocabulary
Stores and supply (signed for, property, crates, pension, rated for, product demonstration).

##### Profanity register
Mild, barracks-polite; outrage is about inventory, not about violence.

##### Never says (literal, machine-read)
- `the plan` · `General Krump` · `destroy all robots`

##### Reference lines (approved, quest `collect-call`)
1. "Whoa, whoa, whoa. That's army property, son. I signed for every one of these. Forty crates. You make it thirty-nine and that comes out of MY pension."
2. "Hold still! This is a product demonstration! Says right here on the box it's rated for appliances, and buddy, you are an appliance."

##### Differs from closest voices
- vs **Dock 9 Contractor**: the contractors panic; Mertz is smug until the end.
- vs **Don Fax** (also a man of property): Mertz guards things for a pension; Fax builds a roof for robots.

## Reply
Only a JSON object, no prose, no code fence:
{"lines":[{"lineId":"<id>","earned":<1-5>,"voiceFit":<1-5>,"note":"<text>"}]}
One entry per line above, every line exactly once.
