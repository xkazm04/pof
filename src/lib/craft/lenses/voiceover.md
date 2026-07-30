---
lensId: voiceover
lensVersion: 1
ceiling: A4
appliesTo: voice-over deliverables (cutscene/TTS dialogue lines); non-speech audio is audio-lens
---

# Voice-Over — craft lens

Gauges TTS-generated voice-over against shipped AAA dialogue practice: casting fit,
direction, performance quality, and the technical delivery standards professional VO must
clear. Every criterion is checkable against a stored line (or line set) plus its
spec/metadata — casting notes, direction context, measured noise floor and loudness — never
against a live recording session.

## Benchmark anchors

- **A4 AAA-PARITY** — *The Last of Us Part II* (Naughty Dog): an industrialized dialogue
  pipeline holding thousands of lines to one technical and performance standard. *God of War*
  (2018, Sony Santa Monica): casting and direction where the lead performance defines the
  character. *Baldur's Gate 3* (Larian): full-cast performance at enormous line volume
  without consistency collapse. Blizzard's casting practice (Andrea Toyias): character specs
  drive casting, not availability.
- **A3 AA** — *Hades* (Supergiant), *Divinity: Original Sin 2* (Larian): professional casts,
  clean delivery, and consistent characters, but without full-ensemble performance direction
  or an automated per-line QC pipeline at AAA scale.
- **A2 INDIE** — *Darkest Dungeon* (Red Hook), *Children of Morta* (Dead Mews): narrow VO
  scope done well (a single narrator, sparse barks); shippable, but with systematic gaps —
  limited take variation, uneven loudness across sessions, thin direction notes.
- **A1 HOBBY** — flat reads with no character intent, audible noise floor or artifacts,
  loudness varying line to line, no direction context recorded; would not survive a
  professional dialogue review.

## Criteria

### casting-character-fit — The voice matches a written character spec
AAA casting starts from a fleshed-out character spec — age, physicality, temperament, role
archetype — and auditions are judged against it. A VO deliverable must have a stored
character spec, and the chosen (TTS) voice must plausibly match it: a grizzled dark-fantasy
warlord cannot ship with a bright youthful timbre. Gauge the stored audio against the spec's
stated identity.
Source: "Anatomy of Great Voice-Over: A Casting & Recording Primer" — Andrea Toyias
(Blizzard Entertainment) & Dee Bradley Baker, GDC 2016.

### direction-and-scene-context — Lines are performed in context, not cold-read
Professional sessions give the actor scene context — what just happened, the emotional state,
who is being addressed — and the read reflects it. The line's spec must record that context
(scene, addressee, emotional beat), and the delivery in the stored file must match it: a line
tagged "grief, whispered over a body" cannot ship as a neutral announcer read.
Source: "Anatomy of Great Voice-Over: A Casting & Recording Primer" — Andrea Toyias
(Blizzard Entertainment) & Dee Bradley Baker, GDC 2016.

### performance-naturalness-and-takes — Believable prosody; alternates for repeated lines
Dialogue craft demands natural emphasis placement, believable breaths and pacing, and — for
lines the player hears repeatedly (barks, combat callouts) — multiple distinct takes. TTS
output must be free of synthetic cadence (uniform sentence melody, misplaced stress), and any
line classed as repeatable must declare and store its alternate-take count.
Source: "Audio Bootcamp: Dialogue 101" — Michael Csurics (The Brightskull Entertainment
Group), GDC 2015.

### noise-floor-and-artifacts — Broadcast-clean signal
The professional delivery bar for spoken-word audio is a noise floor at or below −60 dBFS
with peaks around −3 dBFS and no clicks, pops, clipping, or processing artifacts (for TTS:
no glitches, phase smear, or word-boundary discontinuities). Measure the stored file's noise
floor in silent gaps and record it in metadata; audible artifacts anywhere in the line fail.
Source: ACX (Audible/Amazon) Audio Submission Requirements — noise floor ≤ −60 dB RMS,
peaks ≤ −3 dB.

### loudness-anchor-consistency — Dialogue sits at the platform anchor level
First-party loudness practice treats dialogue as the anchor element of the mix: cutscene VO
is measured and normalized so the program lands at the platform target (Sony: −24 LKFS ±2,
true peak ≤ −1 dBTP). Each stored line must carry a measured LUFS in metadata, and lines
within one scene must sit within a declared tolerance of each other and of the target.
Source: Sony ASWG-R001, "Average Loudness and Peak Levels of Audio Content on Sony Computer
Entertainment Platforms" — Sony Worldwide Studios Audio Standards Working Group, 2013 revision.

### batch-consistency-across-lines — One character, one sound, at any line count
Naughty Dog rebuilt its dialogue pipeline around batch processing precisely so thousands of
lines stay consistent: same voice identity, same processing chain, same loudness, regardless
of when a line was produced. Across a character's stored line set, timbre, accent, and
processing must not drift between generation batches; a regenerated line must be
indistinguishable in character from its neighbors.
Source: "Benefits of a Customized Reaper Pipeline for Dialogue at Naughty Dog" — Julius
Kukla, Thomas Barrett & Grayson Stone (Naughty Dog), GDC 2022.

### line-metadata-and-naming — Every line is identifiable and QC-able out of context
Industrial dialogue pipelines encode character, scene, and line ID in filenames and metadata
so any file is identifiable and auditable in isolation, and QC can run as a batch. Each
stored VO file must carry character ID, scene/step reference, line text, and the voice/model
used to generate it — a bare `output.mp3` with no provenance fails.
Source: "Benefits of a Customized Reaper Pipeline for Dialogue at Naughty Dog" — Julius
Kukla, Thomas Barrett & Grayson Stone (Naughty Dog), GDC 2022.

### intelligibility-in-mix — VO survives the bed it ships over
The Last of Us' audio tech prioritized one thing above all: important dialogue stays audible
against music, ambience, and combat. A cutscene VO deliverable must declare its mix
relationship (what ducks under it, expected bed level), and the line itself must have the
spectral clarity — controlled low end, present consonants — to remain intelligible at the
declared bed level rather than relying on solo playback.
Source: "Aural Immersion: Audio Technology in The Last of Us" — Naughty Dog (Sony), GDC 2014.

## Scoring guidance

- **A1 HOBBY** — lines play but fail basic delivery: audible noise/artifacts, loudness
  varying freely, no character spec or scene context recorded, synthetic cadence throughout.
- **A2 INDIE** — clean signal and a consistent voice per character; but thin direction
  context, single takes for repeated lines, and loudness consistent only within a batch.
- **A3 AA** — measured loudness at the anchor within tolerance, noise floor ≤ −60 dBFS,
  full line metadata, delivery matching recorded scene context; misses named AAA
  differentiators (cross-batch drift control, mix-aware intelligibility, ensemble-grade
  direction depth).
- **A4 AAA-PARITY** — all criteria met: casting-spec fit, context-true performances,
  batch-invariant character sound, and per-line technical metadata — indistinguishable in
  kind from the anchor pipelines' documented practice.

**Disqualifiers** (cap at A1 regardless of other merits):
1. Noise floor above −60 dBFS, or any audible glitch/clip/word-boundary artifact.
2. No measured LUFS in the line's metadata (loudness never gauged).
3. Delivery that contradicts the line's recorded emotional/scene context.
4. A character whose voice identity audibly changes between stored lines.
5. A VO file with no character/scene/line provenance in filename or metadata.

## Ceiling statement

Uncapped — A4 is reachable. The lens bets that TTS-generated voice-over, held to the same
measurable delivery standards as the anchor pipelines (spec-driven casting, recorded
direction context, batch-consistent processing, per-line metrics), can reach parity with
recorded performance for cutscene-class dialogue.
