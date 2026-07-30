---
lensId: audio
lensVersion: 1
ceiling: A4
appliesTo: audio deliverables (SFX/music/ambient); cutscene audio is voiceover-lens
---

# Game Audio — craft lens

Gauges generated SFX, music, and ambient beds against shipped AAA audio practice: loudness
discipline, adaptive/layered structure, mix headroom, and repetition management. Every
criterion is checkable against a stored audio file plus its spec/metadata (measured LUFS,
declared layer structure, file budgets) — never against a live in-game mixing session.

## Benchmark anchors

- **A4 AAA-PARITY** — *DOOM* (2016, id Software): Mick Gordon's combat-state-driven adaptive
  score is the modern reference for music that reshapes itself around gameplay. *God of War*
  (2018, Sony Santa Monica): layered, game-state-aware SFX construction and a cinematic mix
  built to a first-party loudness spec. *Overwatch* (2016, Blizzard): a mix engineered so
  sound alone carries gameplay information ("play by sound"). *Diablo III: Reaper of Souls*
  (2014, Blizzard): the dark-fantasy ARPG scoring benchmark — live orchestra and choir bound
  to a coherent thematic identity.
- **A3 AA** — *Path of Exile* (Grinding Gear), *Warhammer: Vermintide 2* (Fatshark),
  *Hellblade: Senua's Sacrifice* (Ninja Theory): professional loudness discipline and solid
  beds, but without the named AAA differentiators — state-driven stem systems, importance-based
  mixing, deep per-action variation pools.
- **A2 INDIE** — *Darkest Dungeon* (Red Hook), *Dead Cells* (Motion Twin): characterful and
  shippable, but with static music loops, small variant counts, and mix decisions made by ear
  rather than to a measured spec.
- **A1 HOBBY** — single-take renders with clipped peaks, ambient loops with audible seams, no
  measured loudness, no declared structure; would not survive a professional audio review.

## Criteria

### loudness-discipline — Measured loudness against a declared target
AAA first-party practice fixes an integrated loudness target and measures every deliverable
against it: Sony's platform-wide recommendation is −24 LKFS (±2 LU) with true peak ≤ −1 dBTP.
The stored file's metadata must carry a measured integrated LUFS and a declared target (PoF
music declares −16 LUFS at the stem/spec level — the measurement must exist and match the
declaration within tolerance, and any deviation from platform norms must be justified in the
spec, not silent).
Source: Sony ASWG-R001, "Average Loudness and Peak Levels of Audio Content on Sony Computer
Entertainment Platforms" — Sony Worldwide Studios Audio Standards Working Group (Garry
Taylor et al.), 2013 revision.

### adaptive-music-layering — Music delivered as intensity-state stems, not one loop
AAA combat music ships as layers/stems with declared intensity states and transition rules,
so the score can escalate and recede with gameplay. A music deliverable must declare its
layer structure in config (stem list, which state each stem serves, loop/transition points);
a single undifferentiated loop cannot claim adaptive structure.
Source: "'DOOM': Behind the Music" — Mick Gordon (id Software/Bethesda), GDC 2017.

### sfx-transient-readability — SFX carry gameplay information through distinct transients
Blizzard's "play by sound" mandate demanded that every weapon and ability be identifiable by
ear alone in a 12-player fight. A generated SFX must have a distinct attack transient and a
spectral identity that separates it from sibling sounds in the same catalog; the spec should
name what gameplay fact the sound communicates (hit confirm, rarity drop, danger).
Source: "Overwatch — The Elusive Goal: Play by Sound" — Scott Lawlor & Tomas Neumann
(Blizzard Entertainment), GDC 2016.

### sfx-layered-construction — Multi-layer source construction tied to game state
God of War's axe SFX blends modular layers whose relative mix changes with the weapon's
upgrade status — AAA SFX are composites (transient + body + tail + sweetener), not single
takes. The spec/metadata should declare layer composition or, for a single-file deliverable,
show a composite structure audible in the waveform (distinct attack/body/tail stages) rather
than one flat synthesized event.
Source: "The Sound Design for 'God of War'" — Mike Niederquell (Sony Santa Monica), GDC 2019.

### ambient-bed-looping-and-budget — Seamless beds that leave spectral room, inside budget
AAA ambient beds loop seamlessly (no click or level jump at the seam), run long enough to
avoid perceptible cycling, and are mixed to leave the midrange free so dialogue and SFX stay
audible above them. Checkable: loop-point continuity in the stored file, declared loop length
in spec, and compliance with the zone file budget (PoF: ≤ 8 MiB per ambient zone).
Source: "Aural Immersion: Audio Technology in The Last of Us" — Naughty Dog (Sony), GDC 2014.

### mix-priority-and-headroom — Declared ducking/priority intent, no full-scale masters
Professional mixes reserve headroom and encode priority: what ducks under what, and by how
much, is a design decision recorded in config — not an accident of whichever file is loudest.
A deliverable must not master to full scale (true peak ≤ −1 dBTP) and its spec should state
its mix class (bed / spot SFX / stinger) and ducking relationship to dialogue.
Source: "Overwatch — The Elusive Goal: Play by Sound" — Scott Lawlor & Tomas Neumann
(Blizzard Entertainment), GDC 2016.

### score-identity-dark-fantasy — Thematic identity coherent with the canon
Diablo III's score works because its themes, instrumentation, and darkness are one deliberate
identity sustained across the whole game, produced with declared orchestration intent. A PoF
music deliverable must state its instrumentation palette and thematic role in spec, and the
audio must match both the declaration and the single-player dark-fantasy ARPG canon — no
genre-stray cues (chiptune, pop kit) without an authored justification.
Source: "Soundtracking Hell — The Music of Diablo III: Reaper of Souls" — Russell Brower,
Derek Duke, Joseph Lawrence (Blizzard Entertainment) & Neal Acree, GDC 2015.

### variation-and-repetition-management — Variant pools for high-frequency sounds
ARPG combat sounds repeat thousands of times per session; AAA teams ship multiple variations
per repeated action (round-robins, pitch/timing spread) as part of content production so the
sound survives repetition without fatigue. The spec must declare the variant count for any
sound classed as high-frequency (hits, footsteps, pickups), and the stored variants must be
audibly distinct, not one file duplicated.
Source: "The Sound Design for 'God of War'" — Mike Niederquell (Sony Santa Monica), GDC 2019.

## Scoring guidance

- **A1 HOBBY** — files exist and play, but no measured loudness, no declared structure,
  audible seams/clipping, or genre-stray identity. Would not survive professional review.
- **A2 INDIE** — clean, seam-free, budget-compliant files with declared targets mostly met;
  but static loops, thin variant pools, and no layer/state structure. Shippable indie.
- **A3 AA** — measured loudness within tolerance, seamless beds, declared mix class and
  variant pools; misses at least one named AAA differentiator (state-driven stems, layered
  game-state SFX construction, information-bearing transient design).
- **A4 AAA-PARITY** — all criteria met including declared adaptive layer structure and
  variation pools; indistinguishable in kind from the anchor titles' documented practice.

**Disqualifiers** (cap at A1 regardless of other merits):
1. True peak above −1 dBTP or audible clipping in the stored file.
2. No measured integrated LUFS anywhere in metadata/spec (loudness never gauged).
3. An ambient zone exceeding its declared file budget (PoF: 8 MiB/zone).
4. A loop deliverable with an audible discontinuity at the loop seam.
5. "Variants" that are byte-identical or near-identical copies of one render.

## Ceiling statement

Uncapped — A4 is reachable. The lens bets that generated audio (ElevenLabs SFX plus authored
specs) can meet the same measurable bar as the anchors: structure, loudness, and variation
are declared and verifiable, so parity is a matter of craft, not of who rendered the file.
