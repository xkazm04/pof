---
lensId: animation
lensVersion: 1
ceiling: A2
appliesTo: animation deliverables (Mixamo retargets, code-authored slashes, Tripo generative rigs — clips + their specs)
---

# Game animation — craft lens

Gauges animation deliverables — retargeted locomotion sets, code-authored combat clips, generative rigs —
against shipped game-animation practice: frame discipline in attacks, silhouette-readable poses, complete
locomotion coverage, and honest root motion. Criteria are checkable against stored clips plus their specs
(frame counts, contact frames, curves, transition tables) with the VLM/filmstrip assist; controller-in-hand
feel is out of scope here.

## Benchmark anchors

- **A4 AAA-PARITY** *(described for calibration — above this lens's recorded ceiling)* — *God of War* 2018
  (Santa Monica: hand-keyed hero combat layered over mocap, animation quality holding through a no-cut
  camera); *The Last of Us Part II* (Naughty Dog: motion-matched locomotion with dense transition coverage);
  *Overwatch* (Blizzard: per-hero personality authored into even functional first-person moves). All rest on
  hand-keyed + mocap pipelines and senior animator iteration.
- **A3 AA** — *Darksiders III*, *Remnant II*: competent mocap/keyframe combat with correct phase structure,
  but thinner transition coverage and less per-character personality than the A4 anchors.
- **A2 INDIE** — *Last Epoch* (shippable ARPG combat from a small team, visible blend seams); *Overgrowth*
  (Wolfire: deliberate procedural coverage from very few keyframes). Systematic gaps versus professional
  practice, but coherent and shippable.
- **A1 HOBBY** — raw retargets dropped in unedited: T-pose bleed, foot sliding, attacks with no anticipation
  or recovery, single looping idle, poses that do not read at gameplay camera distance.

## Criteria

### attack-phase-frame-discipline — Attack anticipation / contact / recovery frames
Every combat clip must declare its three phases in frames: anticipation (windup that telegraphs commitment),
contact (the few frames where the hit lands, aligned with the gameplay hit window), and recovery (including
any cancel window). God of War's combat team treated these commitments as gameplay data, not animation
decoration. Checkable: the spec's frame numbers exist, sum to clip length, and the filmstrip shows distinct
poses per phase.
Source: "Evolving Combat in 'God of War' for a New Perspective" — Mihir Sheth, Santa Monica Studio, GDC 2019

### contact-pose-silhouette — Silhouette-readable key poses
The contact pose and the anticipation extreme must read in silhouette at the gameplay camera distance — the
core pose test professional game animators apply before polish. Checkable via filmstrip: blacked-out or
squinted frames of the declared key poses should still communicate the action; mushy mid-blend poses at the
declared contact frame fail.
Source: "Game Anim: Video Game Animation Explained" — Jonathan Cooper (Naughty Dog/Ubisoft), CRC Press, 2019 (2nd ed. 2021)

### locomotion-set-coverage — Locomotion set completeness
A professional locomotion set covers the movement graph, not just idle/walk/run loops: starts, stops, turns,
leans, and speed-matched cycles — the coverage problem motion matching was invented to solve. Checkable: the
set's clip manifest against a declared movement graph; loops must be seamless (first/last pose match) and
each cycle's declared travel speed must match the gameplay speed it is assigned to.
Source: "Motion Matching and The Road to Next-Gen Animation" — Kristjan Zadziuk, Ubisoft Toronto, GDC 2016

### twelve-principles-application — Classical principles applied to game constraints
Clips must show the classical principles adapted to interactivity: motion on arcs, follow-through and
overlapping action on secondary parts (cloth, pouches, off-hand), and weight expressed through spacing —
while respecting game constraints like response-time limits on player actions. Checkable in the filmstrip
and curve data: straight-line limb paths, simultaneous stop of all parts, and uniform key spacing are the
failure tells.
Source: "Game Anim: Video Game Animation Explained" — Jonathan Cooper, CRC Press, 2019 (2nd ed. 2021)

### state-machine-blend-hygiene — State machine and blend hygiene
Transitions between states must be declared (blend durations, sync groups / foot-phase matching, interrupt
rules), and blends must not produce pops or double-bounces — game animation is judged in motion between
clips as much as within them. Checkable: the transition table exists in the spec, every reachable state pair
has a declared blend, and sampled transitions in the filmstrip show no frame-to-frame discontinuity.
Source: "Game Anim: Video Game Animation Explained" — Jonathan Cooper, CRC Press, 2019 (2nd ed. 2021)

### root-motion-integrity — Root motion integrity
Where clips carry root motion, the root curve must be declared and honest: capsule speed matches root
velocity (no foot-sliding), attack lunges declare their displacement and any warp/alignment targets, and the
root returns to a poseable neutral. Santa Monica's Kratos work shows the standard: traversal and combat
driven by authored root trajectories that gameplay can trust. Checkable from stored root curves versus
declared gameplay speeds and lunge distances.
Source: "Animating 'God of War'" — Bruno Velazquez, Santa Monica Studio, GDC 2019

### personality-and-character — Personality in functional moves
Even purely functional moves — idles, fidgets, weapon raises, hit reactions — should express who the
character is; Overwatch's team authored distinct personality into every hero's first-person reloads and
idles. Checkable: the spec names the character intent (e.g. PoF's grim, weight-forward dark-fantasy warrior)
and the clip set includes at least distinct idle variation/fidget material consistent with it, rather than
one generic loop shared across characters.
Source: "Animation Bootcamp: The First Person Animation of Overwatch" — Matthew Boehm, Blizzard Entertainment, GDC 2017

### keyframe-economy-procedural-augmentation — Deliberate procedural augmentation
With small clip libraries (the PoF reality), gaps must be covered deliberately by procedural means —
additive leans, IK foot placement, code-generated transitions and interpolation between sparse keys — the
approach Wolfire used to ship fluid movement from 13 keyframes. Checkable: the spec declares which states
are asset-backed versus procedurally derived and with what technique; silent gaps (states that snap or reuse
a wrong clip) fail.
Source: "Animation Bootcamp: An Indie Approach to Procedural Animation" — David Rosen, Wolfire Games, GDC 2014

## Scoring guidance

- **A1 → A2**: no T-pose bleed or gross retarget artifacts; attacks have declared anticipation/contact/
  recovery frames; loops are seamless; root motion (or its absence) is declared and foot-sliding is not
  gross; a transition table exists for the states actually used.
- **A2 (achievable maximum)**: the full criteria set holds at indie-shippable quality — complete-enough
  locomotion coverage with deliberate procedural augmentation, silhouette-readable contact poses, honest
  root curves, and a stated character intent.
- **A3/A4 (calibration only)**: reserved for hand-keyed/mocap pipelines with dense transition coverage and
  per-character performance; not reachable by this deliverable class — do not award above A2.

DISQUALIFIERS (caps the score regardless of other strengths):
1. T-pose/bind-pose frames or scrambled bones visible in the clip — caps at A1.
2. Attack clip with no declared contact frame, or contact misaligned with the gameplay hit window — caps at A1.
3. Foot-sliding from root/capsule speed mismatch on primary locomotion — caps at A1.
4. Non-seamless core loop (idle/walk/run first-last pose mismatch) — caps at A1.
5. Spec claims phases/curves the stored clip does not actually contain — caps at A1 (fabricated metadata).

## Ceiling statement

Recorded PERMANENT assumption: generative and retarget-based animation pipelines (Mixamo, code-authored
clips, Tripo rigs) will not reach AAA motion quality — hand-keyed and mocap pipelines with senior animator
iteration stay ahead on pose appeal, transition density, and performance nuance. A2 is therefore the
achievable maximum for this deliverable class and a clip scored A2 here is at its ceiling, not deficient;
the A3/A4 anchors exist only to calibrate what is deliberately not being attempted.
