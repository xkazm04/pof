# D4 Ink and Hatch: regeneration prompts

Source: Codex CLI 0.160.0 built-in `image_gen` (ChatGPT Pro plan, no API key), run 2026-11-02.

## The command (one image per call, serial only)

```bash
cd <scratch dir with ./refs and ./out>
codex exec --skip-git-repo-check -s workspace-write --json -o logs/<name>.last.txt -C . \
  -i <ref 1> -i <ref 2> -- "<prompt below> Then copy the generated file to ./out/<name>.png (create ./out if needed) and print the original path. Do not edit, resize or post-process the image yourself." < /dev/null
```

Stdin must be closed (`< /dev/null`), or codex hangs on "Reading additional input from stdin".

## Style block (the only part that differs between directions)

```text
STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.
```

## `d4_mock`

Image inputs, in order: Image 1 = `trivet/ref-1-camera-90-TARGET.jpg`, Image 2 = `gtai-spike/cutout/codex/v2/ref_turnaround.png (Rivet turnaround, panel 5 = TOP)`

Runs: 13:09:44 ok=yes 112s

```text
Use the built-in image_gen tool to generate ONE image, landscape 16:9. Do not write code and do not draw it yourself.

Image 1 is the CAMERA reference. Copy its camera exactly: the camera is DIRECTLY ABOVE, an orthographic PLAN VIEW looking straight down at 90 degrees, like the 1999 game GTA 2. We see only the tops of heads, shoulders, car roofs and building roofs. There are no building walls or facades, no perspective, no horizon and no three-quarter view. Copy Image 1's camera and character scale, NOT its rendering style.
Image 2 is RIVET's character design. From directly above, only his top reads: the boxy welder-mask helmet lid, the shoulders, a vermilion-and-black hazard-striped collar ring, a welding-torch arm with a teal tip, and a clamp arm.

SCENE: an in-game screenshot of a top-down crime game, with no HUD and no interface. A city street intersection at night, seen from directly above:
- two crossing asphalt roads with zebra crosswalks and lane markings;
- four corner blocks whose flat ROOFS fill the corners: AC units, vents, skylights, a round water tank seen from above as a circle, and one painted roof sign reading "LOCAL 9";
- pavements with props seen from above: lamp posts (small circles), a dumpster, a hydrant, barrels, crates and a traffic cone.

RIVET stands near the centre of the intersection, fighting two riot cops:
- one cop swings a baton right next to him;
- the other cop fires a pistol from behind a police cruiser parked diagonally at a corner. We see the cruiser's roof and light bar, and a muzzle flash.
A vermilion rubber-stamp splat lies on the asphalt. Four faint teal ghost robots trail behind Rivet. One civilian car drives through, also seen only from above.

SCALE (critical): characters are VERY SMALL. Each person is about 1/20 of the image height, the same as in Image 1. The view covers about 40 x 22 metres of the city. The cars are about 4 x 2 metres.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.

No real logos, no watermark, and no text except the roof sign.
```

## `d4_sample`

Image inputs, in order: Image 1 = `gtai-spike/cutout/codex/v2/ref_turnaround.png (Rivet turnaround, panel 5 = TOP)`, Image 2 = `trivet/ref-4-rivet-concept.jpg`

Runs: 13:10:54 ok=yes 70s

```text
Use the built-in image_gen tool to generate ONE image, square 1:1. Do not write code and do not draw it yourself.

Image 1 is RIVET's design turnaround; Image 2 is his concept art. Draw RIVET, the small, narrow welding robot, seen from DIRECTLY ABOVE: an orthographic PLAN VIEW with the camera looking straight down at 90 degrees, like the "(5) TOP" panel of Image 1. He stands in a ready combat stance with his FRONT pointing to the RIGHT edge of the image.
- We see the top of the boxy welder-mask helmet lid with two cable loops, the vermilion-and-black hazard-striped collar ring around it, the shoulder plates and the back plate.
- The right arm reaches forward (to the right), holding the welding torch with its teal tip.
- The left arm holds the clamp claw.
- The feet just poke out under the body.
- No face, no visor, no perspective and no side view.
He fills about 70% of the frame, on a plain cream paper background with no cast shadow.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.

No text, no labels, no watermark.
```

## `d4_parts`

Image inputs, in order: Image 1 = `out/d4_sample.png`, Image 2 = `gtai-spike/cutout/codex/v2/ref_turnaround.png (Rivet turnaround, panel 5 = TOP)`

Runs: 13:12:24 ok=yes 90s

```text
Use the built-in image_gen tool to generate ONE image, landscape 3:2. Do not write code and do not draw it yourself.

PRODUCTION ART for a 2D cutout (skeletal) animation rig. Image 1 is RIVET seen from directly above in the TARGET STYLE: match its rendering EXACTLY (line quality, shading method, texture, palette, level of detail). Image 2 is his design turnaround, with the "(5) TOP" panel showing the view from above.

Draw FOUR separate parts of Rivet, each seen from DIRECTLY ABOVE (an orthographic plan view: only the top surface, no side faces, no perspective). Lay them out in a 2 x 2 grid, one part per cell, centred, all at ONE consistent scale, with wide gaps between them:
1. top left: the HELMET lid. The top of the boxy welder mask with two cable loops; no face and no visor eyes.
2. top right: the TORSO back plate with both shoulder plates and the vermilion-and-black hazard-striped COLLAR ring lying flat around the neck hole.
3. bottom left: the right FOREARM holding the WELDING TORCH, lying horizontal. Its rounded joint cap is on the LEFT end and the teal torch tip on the RIGHT end.
4. bottom right: the CLAMP CLAW, open, lying horizontal, with its rounded joint cap on the LEFT end.
Each part has a bold outline all round, and a rounded joint cap so that it can rotate under its neighbour without a gap.

BACKGROUND: flat, solid, pure chroma green #00B140 everywhere outside the parts: one colour, with no paper texture, no gradient, no shadow and no halftone on the green. Any paper texture or grain stays INSIDE the parts. No part touches another part or the image edge.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.

No text, no labels, no numbers, no grid lines, no watermark.
```

## `d4_sheet`

Image inputs, in order: Image 1 = `trivet/ref-1-camera-90-TARGET.jpg`, Image 2 = `out/d4_mock.png`

Runs: 13:30:14 ok=yes 116s

```text
Use the built-in image_gen tool to generate ONE image, landscape 3:2. Do not write code and do not draw it yourself.

ENVIRONMENT CONTACT SHEET for a top-down crime game. Image 1 is the game camera: orthographic, directly overhead, looking straight down at 90 degrees, like GTA 2. Image 2 shows the TARGET STYLE: match its rendering exactly (line quality, shading method, texture, palette, level of detail).

Draw EIGHT separate objects, each seen from DIRECTLY ABOVE as an orthographic PLAN VIEW, lying flat so that only its TOP surface shows: no side faces, no legs, no wheels showing, no perspective. Lay them out in a 4 x 2 grid, one object per cell, centred, with wide gaps between them:
1. a police cruiser, nose pointing RIGHT, roof with a light bar;
2. a civilian sedan, nose pointing RIGHT;
3. a dumpster lid;
4. a cluster of three oil barrels (three circles);
5. a wooden crate;
6. a street lamp seen from above (a round lamp head on a short arm);
7. a rooftop water tank seen from above (a circle with a conical lid);
8. a rooftop AC unit with a fan grille.
All objects use one consistent scale, where the cars are about 4 x 2 metres.

BACKGROUND: flat, solid, pure chroma green #00B140 everywhere outside the objects: one colour, with no paper texture, no gradient, no shadow and no halftone on the green. Any paper texture or grain stays INSIDE the objects. No object touches another or the image edge.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 is not used on this sheet. It is hand-made but clean enough to read at a small size.

Teal is NOT used anywhere on this sheet. No text, no labels, no numbers, no grid lines, no watermark.
```

## `d4_mock_b`

Image inputs, in order: Image 1 = `trivet/ref-1-camera-90-TARGET.jpg`, Image 2 = `gtai-spike/cutout/codex/v2/ref_turnaround.png (Rivet turnaround, panel 5 = TOP)`

Runs: 13:33:05 ok=yes 96s

```text
Use the built-in image_gen tool to generate ONE image, landscape 16:9. Do not write code and do not draw it yourself.

Image 1 is the CAMERA reference. Copy its camera exactly: the camera is DIRECTLY ABOVE, an orthographic PLAN VIEW looking straight down at 90 degrees, like the 1999 game GTA 2. We see only the tops of heads, shoulders, car roofs and building roofs. There are no building walls or facades, no perspective, no horizon and no three-quarter view. Copy Image 1's camera and character scale, NOT its rendering style.
Image 2 is RIVET's character design. From directly above, only his top reads: the boxy welder-mask helmet lid, the shoulders, a vermilion-and-black hazard-striped collar ring, a welding-torch arm with a teal tip, and a clamp arm.

SCENE: an in-game screenshot of a top-down crime game, with no HUD and no interface. A city street intersection at night, seen from directly above:
- two crossing asphalt roads with zebra crosswalks and lane markings;
- four corner blocks whose flat ROOFS fill the corners: AC units, vents, skylights, a round water tank seen from above as a circle, and one painted roof sign reading "LOCAL 9";
- pavements with props seen from above: lamp posts (small circles), a dumpster, a hydrant, barrels, crates and a traffic cone.

RIVET stands near the centre of the intersection, fighting two riot cops:
- one cop swings a baton right next to him;
- the other cop fires a pistol from behind a police cruiser parked diagonally at a corner. We see the cruiser's roof and light bar, and a muzzle flash.
A vermilion rubber-stamp splat lies on the asphalt. Four faint teal ghost robots trail behind Rivet. One civilian car drives through, also seen only from above.

SCALE (critical): characters are VERY SMALL. Each person is about 1/20 of the image height, the same as in Image 1. The view covers about 40 x 22 metres of the city. The cars are about 4 x 2 metres.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.

No real logos, no watermark, and no text except the roof sign.
```

## `d4h_mock`

Image inputs, in order: Image 1 = `trivet/ref-1-camera-90-TARGET.jpg`, Image 2 = `gtai-spike/cutout/codex/v2/ref_turnaround.png (Rivet turnaround, panel 5 = TOP)`

Runs: 13:35:01 ok=yes 116s

```text
Use the built-in image_gen tool to generate ONE image, landscape 16:9. Do not write code and do not draw it yourself.

Image 1 is the CAMERA reference. Copy its camera exactly: the camera is DIRECTLY ABOVE, an orthographic PLAN VIEW looking straight down at 90 degrees, like the 1999 game GTA 2. We see only the tops of heads, shoulders, car roofs and building roofs. There are no building walls or facades, no perspective, no horizon and no three-quarter view. Copy Image 1's camera and character scale, NOT its rendering style.
Image 2 is RIVET's character design. From directly above, only his top reads: the boxy welder-mask helmet lid, the shoulders, a vermilion-and-black hazard-striped collar ring, a welding-torch arm with a teal tip, and a clamp arm.

SCENE: an in-game screenshot of a top-down crime game, with no HUD and no interface. A city street intersection at night, seen from directly above:
- two crossing asphalt roads with zebra crosswalks and lane markings;
- four corner blocks whose flat ROOFS fill the corners: AC units, vents, skylights, a round water tank seen from above as a circle, and one painted roof sign reading "LOCAL 9";
- pavements with props seen from above: lamp posts (small circles), a dumpster, a hydrant, barrels, crates and a traffic cone.

RIVET stands near the centre of the intersection, fighting two riot cops:
- one cop swings a baton right next to him;
- the other cop fires a pistol from behind a police cruiser parked diagonally at a corner. We see the cruiser's roof and light bar, and a muzzle flash.
A vermilion rubber-stamp splat lies on the asphalt. Four faint teal ghost robots trail behind Rivet. One civilian car drives through, also seen only from above.

SCALE (critical): characters are VERY SMALL. Each person is about 1/20 of the image height, the same as in Image 1. The view covers about 40 x 22 metres of the city. The cars are about 4 x 2 metres.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.

READABILITY RULES (this is a game frame; the player must find the characters instantly):
- Every character (Rivet, both cops, the four ghosts) is a bold cut-out with a THICK cream paper rim and an ink outline around its whole silhouette, like a sticker, so that it pops off the street. Characters use flat light values; no hatching on the characters.
- Hatching is a budget, not a texture: the asphalt is a flat, mid-grey ink WASH with only sparse hatching near the kerbs and in the shadows under cars and roof edges. The roofs carry the densest pen work.

No real logos, no watermark, and no text except the roof sign.
```

## `d4h2_mock`

Image inputs, in order: Image 1 = `trivet/ref-1-camera-90-TARGET.jpg`, Image 2 = `gtai-spike/cutout/codex/v2/ref_turnaround.png (Rivet turnaround, panel 5 = TOP)`

Runs: 13:43:34 ok=yes 180s

```text
Use the built-in image_gen tool to generate ONE image, landscape 16:9. Do not write code and do not draw it yourself.

Image 1 is the CAMERA reference. Copy its camera exactly: the camera is DIRECTLY ABOVE, an orthographic PLAN VIEW looking straight down at 90 degrees, like the 1999 game GTA 2. We see only the tops of heads, shoulders, car roofs and building roofs. There are no building walls or facades, no perspective, no horizon and no three-quarter view. Copy Image 1's camera and character scale, NOT its rendering style.
Image 2 is RIVET's character design. From directly above, only his top reads: the boxy welder-mask helmet lid, the shoulders, a vermilion-and-black hazard-striped collar ring, a welding-torch arm with a teal tip, and a clamp arm.

SCENE: an in-game screenshot of a top-down crime game, with no HUD and no interface. A city street intersection at night, seen from directly above:
- two crossing asphalt roads with zebra crosswalks and lane markings;
- four corner blocks whose flat ROOFS fill the corners: AC units, vents, skylights, a round water tank seen from above as a circle, and one painted roof sign reading "LOCAL 9";
- pavements with props seen from above: lamp posts (small circles), a dumpster, a hydrant, barrels, crates and a traffic cone.

RIVET stands near the centre of the intersection, fighting two riot cops:
- one cop swings a baton right next to him;
- the other cop fires a pistol from behind a police cruiser parked diagonally at a corner. We see the cruiser's roof and light bar, and a muzzle flash.
A vermilion rubber-stamp splat lies on the asphalt. Four faint teal ghost robots trail behind Rivet. One civilian car drives through, also seen only from above.

SCALE (critical): characters are VERY SMALL. Each person is about 1/20 of the image height, the same as in Image 1. The view covers about 40 x 22 metres of the city. The cars are about 4 x 2 metres.

STYLE "Ink and Hatch": a pen-and-ink comic panel printed in two spot colours. Confident, hand-inked violet-black 17131B linework with varying line weight. Shading is done ONLY with pen HATCHING and CROSS-HATCHING (parallel ink strokes): no halftone dots and no gradients. Warm cream paper F2E8D5 with grain. FLAT vermilion E8502A spot-colour fills are printed slightly off-register from the line plate. Teal 1FB5A8 appears ONLY on the ghost robots and the torch tip, as loose translucent washes. It is hand-made but clean enough to read at a small size.

READABILITY RULES (this is a game frame; the player must find the characters instantly):
- CHARACTER CAMERA: the characters are seen from DIRECTLY ABOVE too, exactly like Image 1: we see only the TOP of each helmet or head, the shoulders and the arms. NO faces, NO visors, NO eyes, NO front views and NO chibi or three-quarter characters.
- Every character (Rivet, both cops, the four ghosts) is a bold cut-out with a THICK cream paper rim and an ink outline around its whole silhouette, like a sticker, so that it pops off the street. Characters use flat light values; no hatching on the characters.
- Hatching is a budget, not a texture: the asphalt is a flat, mid-grey ink WASH with only sparse hatching near the kerbs and in the shadows under cars and roof edges. The roofs carry the densest pen work.

No real logos, no watermark, and no text except the roof sign.
```

## Verdicts

- `d4h_mock` was REJECTED: the environment kept the 90-degree camera, but the characters came back as three-quarter "chibi" figures with visors and faces. It is kept only as `../rejected_d4h_mock.jpg`.
- `d4h2_mock` adds the CHARACTER CAMERA rule ("only the TOP of each helmet or head... NO faces, NO visors...") and was accepted. **It is the recommended target frame.**
- `d4_mock_b` is a plain re-run of `d4_mock`, used to test run-to-run consistency.
