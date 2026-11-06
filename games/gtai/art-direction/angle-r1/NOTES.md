# Angle round 1 (2026-11-06): 55 vs 70 degree view sheets

- **Owner ask (09:30):** 55 degrees as the focus, and a few main characters and bosses at 70 degrees to compare before anything goes into the game. Bosses may use a wider palette and regenerated art. main keeps the 90-degree view as the default.
- **Round:**
  - 12 Codex `image_gen` jobs, each usable on the first try (86-145 s): 55 degrees for Rivet, Dent, Tonnage, Kerf, Ohm, the King, the King's car and Servo; 70 degrees for Rivet, Tonnage, the King and Servo.
  - Prompts are in `jobs.json`. The full-size PNGs are in `C:\Users\kazda\kiro\gtai-art\angle-r1\out\`.
- **Page:** https://claude.ai/artifact/Wzv6jpYGGSf5Ewbn4m9N6S (source `index.html`; the owner's answers live in its `decisions` db).

## How the mocks are made
- Each sheet's top-row facings are keyed off the green and scaled to their on-screen height: `h*cos(pitch) + depth*sin(pitch)` metres times px/m.
- They sit on the arena's asphalt grey and are enlarged pixel for pixel. A mock is not a game frame.
- King 55 and Servo 55 have touching figures, so their crop boxes were read off the sheet by hand (`MANUAL` in the build script).

## Findings from reviewing each sheet
- **The image model follows a requested camera loosely.**
  - The 70 sheets are clearly steeper for the King and Tonnage.
  - Rivet's 70 sheet is only a little steeper than his 55.
  - The game's real pitch is `view.json`; the sheets only set how the art is drawn.
- **Rivet:** the identity held (the logo's visor, tan plating, the vermilion collar). The 'side' facing came out nearer a back three-quarter, so the cards must be drawn to exact directions.
  - **Open call:** the logo's visor vs the plain head the owner picked on day d7 (cast-8).
- **Ghosts:** teal on chroma green keys poorly, so production part sheets go on magenta.
- **The King:**
  - The crown's velvet cap is blood-red on both sheets; it should be plum.
  - The 70 sheet's cape drifts to brick red with gold embroidery; the colour law keeps the cape vermilion.
- **The King's car:**
  - The grille and hood ornament are too close to a real luxury maker's trade dress (LEG-02), so they will be reshaped.
  - The red tail lamps become amber (red is for blood only).
- **Servo:** the 70 sheet drifted from his design: closed ochre boxes instead of the open shelf racks. The 55 sheet keeps the design.
