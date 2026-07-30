---
lensId: dialogue
lensVersion: 1
ceiling: A4
appliesTo: catalog text/graph steps of dialogue trees and branching conversations
---

# Game dialogue writing — craft lens

This lens gauges line-level dialogue craft in PoF's conversation artifacts — dialogue trees, branching conversations, and bark sets stored as JSON/text — against the writing-room and systems practice of studios whose dialogue defines the professional bar. AAA here means scenes written as negotiations with subtext rather than information vending, player options that express character, trees whose structure survives interruption and re-entry, and reactive lines conditioned on world state. Every criterion is checkable against the stored tree; none requires voice acting, performance, or live players.

## Benchmark anchors

- **A4 AAA-PARITY** — *Baldur's Gate 3* (Larian): per-companion authorial voice with deep state-conditioned reactivity; *Hades* (Supergiant): thousands of lines that acknowledge exactly what the player just did, every speaker identifiable blind; *Fallout: New Vegas* (Obsidian): options that express who your character is, not which reward you want; *Firewatch* (Campo Santo): interruptible, resumable conversation flow where silence is a real choice.
- **A3 AA** — *The Outer Worlds* (Obsidian, AA scope): professional voice and choice writing with shallower state reactivity; *GreedFall* (Spiders): functional branching diplomacy with visible template cadence; *Path of Exile* (Grinding Gear): strong monologue voice, thin interactivity.
- **A2 INDIE** — *Grim Dawn* (Crate) and *Last Epoch* (EHG): clear, shippable NPC exchanges that mostly deliver quest information; branches exist but read as menu options rather than conversation.
- **A1 HOBBY** — NPC-as-vending-machine: player asks, NPC recites lore; every speaker shares one voice; branches are cosmetic; lines run to paragraphs. Would not survive a table read.

## Criteria

### scene-as-negotiation — Every scene is a negotiation, not an information exchange
Ingold's masterclass (built on the Deckard–Rachael scene) demands that both parties want something, the power balance shifts at least once, and information arrives as a move in the negotiation rather than as answers to interview questions. A conversation artifact must show what each speaker wants, at least one reversal or deflection, and lines that do something (probe, dodge, concede, threaten) beyond conveying facts. A tree where the NPC simply answers every player question fails.
Source: Jon Ingold (inkle), "Sparkling Dialogue: A Masterclass", AdventureX 2018

### options-express-character — Player options express character, not menu function
Obsidian's standard: dialogue options are player expression — differing in attitude, values, and approach — not a functional menu of [More info] / [Accept] / [Sarcasm]. Each choice node should offer stances a different kind of protagonist would take, none flagged as the "correct" one, each answered by a genuinely different NPC response. Checkable: sibling options rewritten as attitudes pass; sibling options that all lead to the identical NPC reply fail.
Source: Josh Sawyer (Obsidian), "Do (Say) The Right Thing: Choice Architecture, Player Expression, and Narrative Design in Fallout: New Vegas", GDC 2012

### tree-structural-integrity — Tree structure survives interruption and re-entry
Firewatch's dialog system was built for conversations that get interrupted, resumed, and skipped: every node needs defined entry conditions, and the tree needs authored behavior for abandonment and return — not an assumption the player hears everything in order. The artifact must have no orphan or dead-end nodes, no infinitely re-askable one-time reveals, and explicit once-only/repeatable flags where state changes. A tree that only works when traversed top-to-bottom in one sitting fails.
Source: Patrick Ewing & William Armstrong (Campo Santo), "Do You Copy? Dialog System and Tools in 'Firewatch'", GDC 2017

### silence-is-an-option — Not responding is an authored choice
Firewatch made silence meaningful: the player may decline to reply, and the other speaker reacts to that silence in character. Conversation artifacts should include at least one point where saying nothing (or walking away) is a selectable path with an authored reaction — not a timeout that picks a line for the player. Checkable: a no-response branch exists and its follow-up acknowledges the refusal.
Source: Patrick Ewing & William Armstrong (Campo Santo), "Do You Copy? Dialog System and Tools in 'Firewatch'", GDC 2017

### contextual-bark-variation — Barks keyed to context with real variation depth
Valve's dynamic-dialog system matches lines against world-state criteria, prefers the most specific applicable line, and holds enough variants that repetition doesn't expose the seams. Bark sets in an artifact must carry state conditions (health, zone, rarity tier of the drop, combat state), an ordering from specific to generic fallback, and multiple variants per slot — a single unconditioned line per trigger fails. Checkable entirely from the stored criteria/variant table.
Source: Elan Ruskin (Valve), "AI-driven Dynamic Dialog through Fuzzy Pattern Matching. Empower Your Writers!", GDC 2012

### voice-distinctiveness — Every speaker passes the blind-attribution test
Supergiant's Hades cast stays identifiable across tens of thousands of lines because each character has a fixed idiolect — vocabulary, rhythm, obsession, register — that never drifts. In the artifact, any line stripped of its speaker tag should be attributable to its speaker among the scene's cast, and one character's lines across separate conversations must keep the same voice. Interchangeable speakers, or a merchant who suddenly talks like the narrator, fail.
Source: Greg Kasavin & Darren Korb (Supergiant Games), "Breathing Life into Greek Myth: The Dialogue of 'Hades'", GDC 2021

### reactive-continuity — Lines acknowledge what the player actually did
Hades' dialogue is selected against the player's recent history — how you died, what you equipped, whom you met — so characters demonstrably know what just happened. Dialogue artifacts must condition lines on recorded game state (quest outcomes, prior choices in this same tree, equipped Unique, cleared zone) and never contradict it: an NPC greeting the player as a stranger after a shared quest fails. Checkable: condition fields reference real sibling-artifact state, and no line's content contradicts the state that gates it.
Source: Greg Kasavin & Darren Korb (Supergiant Games), "Breathing Life into Greek Myth: The Dialogue of 'Hades'", GDC 2021

### line-economy-for-staging — Lines written short enough to stage
CD Projekt Red's dialogue pipeline generates cinematic staging from the dialogue data itself — lines are written as playable beats with timing, not prose paragraphs, because every line must carry a performable intent. Lines in the artifact should be speakable in one breath (roughly under 30 words), one intent per line, with long exposition broken across an exchange the other speaker can push against. A node whose text is a multi-paragraph lecture fails.
Source: Piotr Tomsiński (CD Projekt Red), "Behind the Scenes of Cinematic Dialogues in The Witcher 3: Wild Hunt", GDC 2016

## Scoring guidance

- **A1 is forced** by any of: vending-machine structure (player interrogates, NPC recites — no NPC want anywhere in the tree); a cast that fails blind attribution wholesale; branches whose options all receive the same reply; paragraph-length lines as the norm.
- **A2** = clean, in-character, shippable exchanges — but functional menu options, single-variant barks, and trees that assume one uninterrupted top-to-bottom read are the systematic gaps.
- **A3 is blocked** by: no reversal or deflection in any scene (pure Q&A politeness); any orphan/dead-end node or re-askable one-time reveal; barks without state conditions; more than occasional lines over ~30 words.
- **A4 requires** all eight criteria at once: negotiation-shaped scenes, stance-based options, interruption-safe trees with authored silence, specificity-ordered bark variants, blind-attributable voices held across conversations, state-conditioned continuity consistent with sibling artifacts, and staging-ready line economy.

**DISQUALIFIERS** (cap at A1 regardless of other strengths): (1) a line contradicting the state that gates it, or PoF canon (single-player ARPG, rarity tiers Normal/Magic/Rare/Unique — no party-of-players or invented tiers); (2) speaker-swap test passes for the whole cast (voices interchangeable); (3) placeholder text, TODOs, or unexpanded template variables in any line; (4) every choice node reconverging to one reply with no differentiated response; (5) structural breakage — orphan nodes, unreachable branches, or a one-time reveal with no once-only guard.

## Ceiling statement

This lens is uncapped at A4: dialogue is the purest text medium in the pipeline, and the LLM-market bet is precisely that frontier models — given fixed character idiolects, state conditions, and structural linting — can write lines indistinguishable from the named anchors' writing rooms.
