---
lensId: narrative
lensVersion: 1
ceiling: A4
appliesTo: catalog text/graph steps of quests, codex, factions, bestiary, cutscenes, tutorial-beats
---

# Narrative craft — craft lens

This lens gauges the story, worldbuilding, quest, and lore TEXT that PoF's narrative-leaning catalogs produce — quest specs, codex and bestiary entries, faction briefs, cutscene scripts, tutorial-beat copy — against the practice of AAA narrative teams. AAA here means the discipline visible in shipped RPG/ARPG narrative at CD Projekt Red, Obsidian, Naughty Dog, and Guerrilla scale: quests built as cause-and-effect graphs with personal stakes, choices with deferred consequences, and lore written as evidence rather than encyclopedia. Everything below is checkable against a stored text artifact; nothing requires a shipped build or live players.

## Benchmark anchors

- **A4 AAA-PARITY** — *The Witcher 3: Wild Hunt* (CD Projekt Red): side quests carry personal stakes and moral residue that outlast the reward; *Fallout: New Vegas* (Obsidian): faction web where every allegiance is sympathetic from inside and costs something; *Baldur's Gate 3* (Larian): branch reactivity acknowledged many hours later; *Horizon Zero Dawn* (Guerrilla): non-linear quest graphs that survive out-of-order play.
- **A3 AA** — *The Outer Worlds* (Obsidian, AA scope): professional choice writing with narrower consequence webs; *Path of Exile* (Grinding Gear): strong voice-driven lore delivered mostly outside quest structure; *GreedFall* (Spiders): competent faction drama with visible template seams.
- **A2 INDIE** — *Grim Dawn* (Crate): serviceable grimdark lore notes and functional quest text; *Last Epoch* (EHG): coherent timeline worldbuilding whose quests remain errand-shaped.
- **A1 HOBBY** — placeholder-grade text: fetch/kill quests with no dramatic question, wiki-style lore dumps, factions that are palette swaps, tutorial copy that breaks fiction to lecture. Would not survive a professional narrative review.

## Criteria

### quest-personal-stakes — Personal stakes and a dramatic question
Every quest spec must state what the quest is *about* beyond its objective: whose problem it is, why it matters to that person, and the dramatic question the ending answers. CD Projekt Red's quest lessons demand quests be personal and morally loaded rather than transactional — a brief that reads "collect 5 pelts for reward" with no human situation behind it fails. Checkable: the artifact names a wanting character, a cost, and an outcome that changes someone's situation, not only the player's inventory.
Source: Paweł Sasko (CD Projekt Red), "10 Key Quest Design Lessons from 'The Witcher 3' and 'Cyberpunk 2077'", GDC 2023

### quest-graph-integrity — Non-linear quest-graph integrity
Guerrilla built Horizon's quests as graphs of steps linked by cause and effect, each step defined by a concrete player verb, explicitly authored to survive out-of-order arrival, failure, and abandonment. A quest artifact must show that shape: steps with entry conditions, at least one authored failure/abandon path, journal/state updates per branch, and no orphan step reachable from nowhere. A pure linear chain with an implicit "and then" between steps blocks the professional bar.
Source: Leszek Szczepański (Guerrilla Games), "Building Non-linear Narratives in 'Horizon: Zero Dawn'", GDC 2017

### choice-consequence-architecture — Choices with real, deferred consequences
Obsidian's choice architecture requires options that differ in kind (approach, allegiance, cost), not a good/evil binary or a fake fork that reconverges unacknowledged. The artifact must map each major choice to a distinct downstream state — a later scene, faction standing, vendor/NPC availability, or epilogue line — and at least one consequence should land later than the quest that caused it. Checkable in text: a choice→consequence table or graph edges; "all roads lead to the same next node with no recorded difference" fails.
Source: Josh Sawyer (Obsidian), "Do (Say) The Right Thing: Choice Architecture, Player Expression, and Narrative Design in Fallout: New Vegas", GDC 2012

### faction-sympathetic-conflict — Factions in sympathetic conflict
New Vegas's faction web works because every faction is coherent and defensible from inside its own values, and siding with one visibly costs access to another. A faction brief must state the faction's goal, the resource or principle that puts it in conflict with a named other faction, what it believes that a reasonable person could hold, and what allying with it locks out. Palette-swap factions ("the evil cult", "the other evil cult") or a faction with no stated antagonist relationship fail.
Source: Josh Sawyer (Obsidian), "Do (Say) The Right Thing: Choice Architecture, Player Expression, and Narrative Design in Fallout: New Vegas", GDC 2012

### lore-implied-history — Lore as evidence of implied history
Worch and Smith's environmental-storytelling standard: the world presents evidence and lets the player's mind assemble the event — meaning is created by inference, and it must be possible to miss things. Codex and bestiary entries should be written as situated artifacts (a witness account, a scholar's marginal note, a hunter's warning) that imply a history with deliberate gaps, not omniscient wiki summaries that state the whole truth. Checkable: entry has an in-world author/vantage, at least one concrete detail that implies an unstated event, and withholds at least one answer.
Source: Matthias Worch & Harvey Smith, "What Happened Here? Environmental Storytelling", GDC 2010

### cutscene-gameplay-alignment — Cutscene and tutorial beats aligned with play
Naughty Dog's "active cinematic experience" parallels gameplay and storytelling: scripted scenes set stakes the following gameplay pays off, and emotional investment is built through allies present in play, not lore delivered adjacent to it. A cutscene script must enter late, exit into a playable verb, and change a character's state (knowledge, relationship, goal) rather than recap; a tutorial-beat must teach its mechanic inside the fiction (a character with a reason to instruct) rather than breaking voice to lecture. Checkable: each scene ends on a change + a handoff to player action.
Source: Bruce Straley & Neil Druckmann (Naughty Dog), "Creating the Active Cinematic Experience of Uncharted 2: Among Thieves", GDC 2010

### cast-and-canon-continuity — Cast and canon continuity across artifacts
Supergiant kept a large mythological cast consistent across an enormous line count by grounding every character in a fixed identity and adapting source material without contradicting it. Narrative artifacts must keep proper nouns, character temperaments, faction allegiances, and established facts consistent with sibling artifacts and PoF canon — single-player ARPG, rarity tiers Normal/Magic/Rare/Unique, no co-op or multiplayer framing. Checkable: no entity contradicts its own codex entry, no invented rarity tier or "your party of players" phrasing, recurring characters keep their stance between quests.
Source: Greg Kasavin & Darren Korb (Supergiant Games), "Breathing Life into Greek Myth: The Dialogue of 'Hades'", GDC 2021

## Scoring guidance

- **A1 is forced** by any of: a quest whose entire spec is objective + reward with no named human stake (quest-personal-stakes absent); lore written as an omniscient wiki dump with no vantage or gap; factions distinguishable only by name and color; tutorial copy that addresses "the player" and breaks fiction; a direct canon contradiction (invented rarity tier, co-op/multiplayer framing, an entity contradicting its own codex).
- **A2** = internally consistent, readable, functional — but linear quest chains, choices that reconverge silently, and encyclopedia-style lore mark the systematic gaps.
- **A3 is blocked** by: no authored failure/abandon path in the quest graph; no choice with a consequence that lands later than its own quest; any lore entry without an in-world vantage; a cutscene that only recaps and changes nothing.
- **A4 requires** all seven criteria met simultaneously across the artifact set: graph-shaped quests with personal stakes, at least one deferred cross-quest consequence, sympathetic faction conflict with stated lockouts, evidence-style lore with deliberate gaps, scenes that hand off into play, and zero canon drift between sibling artifacts.

**DISQUALIFIERS** (cap at A1 regardless of other strengths): (1) canon contradiction with PoF's single-player ARPG frame or Normal/Magic/Rare/Unique tiers; (2) a "choice" whose options all produce the same recorded state with no acknowledgment; (3) placeholder text, TODOs, or template variables left in the artifact; (4) a faction or bestiary entry that could be attached to a different entity unchanged (fails the swap test); (5) fiction-breaking instructional voice inside a quest, cutscene, or tutorial-beat body.

## Ceiling statement

This lens is uncapped at A4: narrative craft is pure text design, exactly the medium frontier LLMs are bet to master — with canon grounding and cross-artifact checking supplied by the pipeline, generated quest and lore text can be made indistinguishable from the named AAA anchors.
