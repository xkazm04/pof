# Rhubarb lip-sync — powering the `Facial / Lipsync` step

> **Status:** specced, NOT built. Two blockers, both named below. Written 2026-09-07 from
> `/research` on *Can GPT-6 Astra Make AI Characters Game Ready?* (Building Aeon, 11:21).
> The half that WAS buildable shipped in the same run — see "What already landed".

## The gap this targets

`src/lib/status/step-facts.json` carries a pipeline step whose own note reads:

> `"note": "minLength(300) shape check; step is honest that no lipsync pipeline exists."`

and `src/lib/catalog/pipelines/cutscenes.ts:245-268` labels it `Facial / Lipsync`, with its
own entries prefixed `[GAP]`. Its acceptance is `minCount('facialChecks', '≥1 facial/lipsync
check or gap-note listed', 1)` — a **shape-only checker over a step with no engine**, which is
both cells the `/status` map flags at once. The step is unusually honest about it; what it has
never had is a candidate engine cheap enough to close it.

Meanwhile `ElevenLabs` is wired app-wide (`src/lib/audio-gen/providers/elevenlabs.ts`,
`POST /api/audio-gen`) and the step-facts note says it is "wired app-wide but unused/inapplicable
here". So the **audio input already exists**; what is missing is everything between audio and a
moving face.

## Why Rhubarb rather than the alternatives

The step's own deferral names `Wav2Lip / MetaHuman Animator`. Both are heavy: Wav2Lip is a
video-domain model (it repaints pixels, not a rig), and MetaHuman Animator needs a live editor
plus a capture — PoF already carries two gotchas about driving it headlessly
(`metahuman-animator-headless-memory-window`, `metahuman-animator-window-root-stitch`).

Rhubarb Lip Sync is the opposite shape, and it is the shape PoF's standing user-preference
selects for (headless, API/CLI-driven, no GUI):

| Property | Value | Verified |
|---|---|---|
| Licence | MIT | github.com/DanielSWolf/rhubarb-lip-sync, 2026-09-07 |
| Interface | command line: `rhubarb -f json -o out.json take.wav` | ditto |
| Input | audio ALONE; optional `--dialogFile` transcript raises accuracy | ditto |
| Output | JSON / TSV / XML — a timeline of `{ start, value }` cues | ditto |
| Platforms | Windows, macOS, Linux (prebuilt binaries) | ditto |
| Determinism | same wav → same cues; no model server, no network | by construction |

It does **not** animate words. It emits a timeline of nine mouth-shape classes, which is why it
composes with a rig instead of replacing one:

| Cue | Mouth shape | Phonemes |
|---|---|---|
| `A` | closed | P, B, M |
| `B` | slightly open, clenched teeth | most consonants, "EE" |
| `C` | open | "EH", "AE" |
| `D` | wide open | "AA" |
| `E` | slightly rounded | "AO", "ER" |
| `F` | puckered | "UW", "OW", "W" |
| `G` | upper teeth on lower lip *(optional)* | F, V |
| `H` | tongue raised *(optional)* | L |
| `X` | idle / rest | pauses |

## Design — three layers, each gateable on its own

1. **Cue producer** (`src/lib/visual-gen/lipsync/rhubarb.ts`) — spawn the binary, parse the JSON
   timeline into a typed `MouthCue[]`. Layer-0 gate: a captured real `rhubarb -f json` payload
   as the fixture. *This is the layer that must NOT be written until the binary has actually
   run once* — see Blocker 1.
2. **Cue → channel planner** (pure) — map each cue to the target's facial channels: a morph-target
   name set (ARKit/MetaHuman convention) plus a jaw-bone rotation for the open shapes, with
   hold/blend windows between cues. Verifiable against a hand-authored answer only once one
   exists in the repo — today there is none (`grep` for `jawOpen`/`mouthClose`/`CTRL_expressions`
   returns nothing anywhere in `src/`), so this layer would currently be checkable only against
   its own opinion. Authoring that mapping table deliberately, as `rig-presets.ts` does for
   bones, is the prerequisite — not a detail of the planner.
3. **Applier** — writes the curves onto the asset (Blender for GLB, or UE for a Skeletal Mesh).
   Editor/DCC-side, so it lands through the proven probe series and is not gateable in-session,
   per the standing preference on UE-side findings.

Layered on top, as the video does and PoF should copy: **automatic blinking, small eye saccades
and brow motion driven by voice intensity**. These are the cheapest realism-per-line in the
whole pipeline — they need no phoneme data at all, only the audio envelope and a timer — and
they are what separates "the mouth moves" from "the character is alive".

## Blockers

1. **The binary is not installed.** `which rhubarb` → nothing, on this machine. Writing the cue
   parser now means inventing its fixture, and this repo has shipped a guard built against
   imagined data before (it did nothing until a live run exposed it, twice). So layer 1 waits
   for one real invocation.
2. **There is nothing to drive.** Measured 2026-09-07 across every `.glb` under `generated/`:
   **52 of 52 declare zero morph targets**, so no asset PoF has ever produced has a facial
   channel for a cue to move. A lip-sync pipeline landing today would have a correct timeline
   and no face to apply it to. This blocker is upstream of the lip-sync work entirely: it is an
   ASSET-GENERATION gap, not a pipeline gap.

## What already landed (2026-09-07)

Blocker 2 was invisible before this run — nothing measured or reported the facial channel, and
the Tier-1 rig gate scored a face-less character 100/100 because it only ever read skin weights.
`rig-gate.ts` now reads `meshes[].primitives[].targets`, records `morphTargetCount` /
`morphTargetNames` on every gate, surfaces the count in the persisted rig artifact
(`rigArtifact.ts`), and fails a `RigExpectation` that sets `facialDeformation: true`. Proof on
the real SkinTokens fixture: **pass=true score=90 with no expectation, pass=false with the
facial one**, naming "the mesh declares 0 morph targets".

No caller sets `facialDeformation: true` yet — that flag is for the pipeline this document
describes, and is logged as such in the impact-map.

## Reconsider trigger

When **either** blocker clears: a `rhubarb` binary is on the box and one real cue payload has
been captured (→ build layer 1 immediately, it is ~80 lines against a real fixture), **or** a
generation path starts producing meshes with morph targets (→ layer 2's mapping table becomes
authorable against a real channel set, and the `facialDeformation` expectation gets its first
caller). Whichever arrives first, the other is worth doing in the same session; separately they
each land a half that cannot be demonstrated.
