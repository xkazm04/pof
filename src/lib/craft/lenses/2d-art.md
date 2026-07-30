---
lensId: 2d-art
lensVersion: 1
ceiling: A3
appliesTo: 2d-art deliverables
---

# 2D Game Art — craft lens

Gauges PoF's Leonardo-generated 2D imagery — item/ability icons, concept art, key art, and UI
art — against real AAA studio practice. Every criterion is checkable against a stored image plus
its metadata (style-DNA profile, intended display size, rarity tier), with a VLM assisting the
visual reads. PoF canon: single-player dark-fantasy ARPG; rarity Normal/Magic/Rare/Unique.

## Benchmark anchors

- **A4 AAA-PARITY** — Blizzard key art and illustration for *Diablo IV* (painterly, old-masters
  dark fantasy), *Overwatch* splash and hero art, Riot Games' *League of Legends* splash art and
  the *Arcane*-era style consistency program. **Described for orientation only — this level is
  above the recorded A3 ceiling for this lens.**
- **A3 AA** — *Path of Exile* (Grinding Gear Games) item and skill iconography, *Darksiders*
  (Vigil Games) concept and promotional art, *V Rising* (Stunlock Studios) UI and marketing art:
  professional, style-consistent, readable at gameplay scale, but without the named
  AAA-differentiating illustration depth above.
- **A2 INDIE** — shippable small-team dark-fantasy work in the vein of *Stoneshard* or
  *Halls of Torment*: coherent within itself and functional in the UI, with systematic gaps —
  limited value control, generic rendering, icon sets that drift in style across a batch.
- **A1 HOBBY** — imagery that would not survive a professional art review: no consistent style,
  broken anatomy or structure, illegible at intended size, visible generation artifacts.

## Criteria

### silhouette-readability — Silhouette readability
The subject must read from silhouette alone: fill the image with flat black over the background
and the item/character class is still identifiable. Blizzard treated readable silhouettes as a
founding art-direction pillar for hero and asset design. Check the stored image downscaled to
its intended display size; a muddy or ambiguous silhouette fails.
Source: Bill Petras & Arnold Tsang, "The Art of Overwatch: Evolving a Legacy", GDC 2017.

### value-structure-focal-hierarchy — Value structure and focal hierarchy
One dominant focal area holds the highest value contrast and detail density; detail falls off
toward edges and lower regions rather than spreading uniformly. Valve's published character
texture guidance mandates value gradients (darker toward the feet/base) and concentrating detail
where the eye should land. Check via luminance histogram regions and a VLM read of where
contrast clusters; uniform noise-level detail across the canvas fails.
Source: Valve, "Dota 2 Workshop — Character Texture Guide" (published Steam Workshop guide).

### style-dna-consistency — Style-DNA consistency
The image must match the project's recorded style-DNA profile (palette family, rendering
technique, linework/brushwork character, era/material vocabulary) and match sibling assets from
the same batch. Diablo IV's art direction succeeded by enforcing one painterly, old-masters-
derived language across every asset class. Compare the stored image against the stored style-DNA
profile and 2–3 sibling images; an asset that reads as from a different game fails.
Source: John Mueller (Diablo IV art director), "Diablo is the apex of dark fantasy in ARPGs",
PCGamesN interview, 2019.

### dark-fantasy-tonal-fidelity — Dark-fantasy tonal fidelity
Palette and rendering must sit inside the ARPG dark-fantasy register: grounded, desaturated
bases with deliberate accent color, stylized-but-grim forms — not high-fantasy pastel, not
photoreal render, not cartoon gloss. Blizzard's Diablo III art direction showed dark fantasy is
achieved through controlled stylization and bold value design, not literal darkness. Check hue/
saturation distribution plus a VLM genre read; a cheerful or sterile-photoreal result fails.
Source: Christian Lichtner, "The Art of Diablo III", GDC 2012.

### icon-legibility-at-size — Icon legibility at inventory size
An icon must stay identifiable and distinct from its set neighbors at 64px and degrade
gracefully to 32px, with at least 3:1 contrast between the subject and the UI panel background
it ships on (the WCAG non-text contrast floor, used here as a measurable proxy for HUD
legibility). Rarity tiers (Normal/Magic/Rare/Unique) must be distinguishable by more than hue
alone (shape, frame, or value cue). Check by downscaling the stored file and measuring contrast.
Source: W3C, "Web Content Accessibility Guidelines (WCAG) 2.1", Success Criterion 1.4.11
Non-text Contrast, 2018.

### concept-art-answers-design — Concept art answers design questions
Concept art is a design-communication document, not a mood painting: it must make materials,
construction, scale, and gameplay-relevant features unambiguous enough for a 3D artist to build
from, ideally with callouts or clear orthographic-adjacent views. Riot's published pipeline
education frames the concept artist's output as solving the design brief under constraints.
Check the stored image plus its brief metadata; a pretty rendering that leaves material or
construction ambiguous scores as mood art, not concept art.
Source: Riot Games, "So You Wanna Make Games?? — Episode 2: Concept Art", 2018.

### ui-art-material-coherence — UI art material coherence
UI art (frames, panels, slot backgrounds, buttons) must commit to a consistent material and
lighting logic — carved stone, aged parchment, dark iron — applied uniformly, so the interface
reads as one crafted object rather than assembled clip-art. Hearthstone's UI succeeded by
treating the whole interface as a single physical, tactile prop with consistent materials.
Check a stored UI sheet for one light logic and one material vocabulary across elements.
Source: Derek Sakamoto, "Hearthstone: How to Create an Immersive User Interface", GDC 2015.

### rendering-discipline-no-noise — Rendering discipline, no noise
Detail must be deliberate: controlled edge quality, a single coherent light direction, and no
high-frequency noise substituting for finish. Valve's texture guidance explicitly warns against
noisy, uniform detail that destroys readability. For generated imagery this also covers the
classic failure modes — smeared transitions, duplicated features, incoherent reflections. VLM
check on the stored image: one light source logic, clean structural edges, no artifact zones.
Source: Valve, "Dota 2 Workshop — Character Texture Guide" (published Steam Workshop guide).

## Scoring guidance

- **A1 HOBBY** — fails 3+ criteria, or any disqualifier below fires. Would not survive a
  professional review pass.
- **A2 INDIE** — passes silhouette-readability, icon-legibility-at-size, and
  dark-fantasy-tonal-fidelity; systematic gaps remain in value-structure-focal-hierarchy,
  style-dna-consistency across batches, or rendering-discipline-no-noise.
- **A3 AA** — passes all eight criteria including batch-level style-DNA consistency; misses only
  the AAA-differentiating depth of the A4 anchors (bespoke illustration quality, art-directed
  narrative staging in key art).
- **A4 AAA-PARITY** — indistinguishable from the named A4 anchors. Above this lens's recorded
  ceiling; do not award.

DISQUALIFIERS (any one caps the asset at A1):
1. Garbled embedded text or glyph-soup lettering anywhere in the image.
2. Structural generation artifacts: broken anatomy, extra/merged digits, melted or physically
   impossible object construction.
3. Two or more contradictory light directions within a single image.
4. An icon illegible or indistinguishable from set neighbors at 64px.
5. No style-DNA profile recorded in metadata, or the image directly contradicts the recorded
   profile (wrong palette family and wrong rendering technique).

## Ceiling statement

Recorded ceiling: **A3**. Market assumption as recorded: current image models (Leonardo-class,
gated by Qwen-VL) arguably reach AA-grade production 2D art today — consistent, readable,
style-governed asset sets — but parity with named AAA key-art and splash illustration
(Blizzard/Riot-tier bespoke work) is unproven. A4 is described above only to orient scoring;
it is not awardable under this lens version.
