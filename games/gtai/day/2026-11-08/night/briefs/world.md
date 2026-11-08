# Lane world: the whole city at one true 70-degree camera, then the dead

**The owner's note (verbatim):** "We cannot allow falling into any direction. our surface, angle of movement and dead bodies look very unnatural. Experiment with techniques from ARPGs (Diablo, Fallout). I think the problem is characters are in 70/55 angle, but the world is 90, and it does not fit together well"

**What the owner decided after the block test:** adopt the true 70 camera; half-height walls; grey print look; this lane builds it. Your branch has the test: the three new `p70` wall strips (flat elevations from `gtai-art/world-angle-r2/out/`, squashed for the full-height wall) and `dev/showcase/block70_still.tscn`.

In this order:
1. **The wall art at half height.** The strips were fitted to a full-height wall, and at `height_k` 0.5 they squash again, so windows go squat. Make half height read as a real shorter wall, showing fewer storeys rather than a squashed full one: recut or re-request, film the block at 32 and 48 px/m against the frames in `C:\Users\kazda\kiro\gtai-masters\d10\block70\`.
2. **One camera across the street.** List everything in the real city under combo that still reads as a plan view, and stand it up. Known: lamp posts lie flat with their arm on the ground in `block70_still` frames (check whether that is the test scene or the game; `city_facades.json` `props`, `PropCards`). Check parked cars, kerb furniture, fire escapes, and roof edges and contact shadows. Fix by measured gap, biggest first.
3. **The dead (the owner's note).** Research how classic isometric and three-quarter action RPGs make bodies sit on their ground (few drawn fall directions aligned to the camera, screen-facing corpse poses, contact shadows; describe techniques, never name a game in code or assets). Then restrict the fall directions: a corpse lies only in poses drawn for this camera, picked from a small set by the blow's screen direction, instead of a plan pose rotated to any angle. Keep neighbours from overlapping (n9's spread). Before/after at 32 and 64 px/m, riot and Dock 9. Do this in the sim-free view layer; replay and parity must hold.
4. **Movement angle.** The owner's note names "angle of movement": check diagonal runs and car paths at combo for feet or wheels that drift against the ground. Fix what is cheap; report the rest as a Call.

Do not change the character art's camera, and do not change the world to any angle but 70.
