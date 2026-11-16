# Lane: art (the shared asset pack)

You do not build a game. You build the **shared asset pack** that the three engine lanes (UE 5.8, Godot 4, Unity 6)
import tonight, and you **train the art style** on it. The chosen art direction is in `../../shared/style/`: read
its `DESIGN.md` and look at every image. **Hold the idea, not the pixels.** The owner has been burned by locking a
style through image-matching instead of holding it as a high-level idea and perfecting it in its own way.

## The policy: Blender + code only
- Production assets are made with **Blender** (`C:\Program Files\Blender Foundation\Blender 4.2\blender.exe`, headless: `blender -b --python <script.py> -- <args>`) and code.
- No AI-generated production images or meshes. The concept images are reference only.
- Every asset must be **reproducible from a script** in `scripts/`, so tomorrow's pipeline can regenerate it.

## The pack, versioned
Publish to `../../shared/assets/pack-vN/`, then write `N` to `../../shared/assets/LATEST` **last**, so a reader never sees a half-written pack.
- **Ship pack v1 within about 2 hours.** The engine lanes are greyboxing until it lands.
- Then iterate on quality: v2, v3, and so on. Each version gets a `CHANGES.md` line.

### Contents of every pack
- `robots/rivet.glb` and `robots/copbot.glb`: low-poly, rigged, with clips named exactly **`idle`, `walk`, `roll`, `shoot`, `hit`, `death`**. Use the same skeleton for both robots if you can.
  - Scale is metres, Z-up in Blender; export glTF with +Y up.
  - Rivet is about 1.9 m tall; the cop-bot about 1.8 m.
  - Also ship `.fbx` copies for UE and Unity.
- `sprites/<robot>/<clip>/frame_000.png...`: **pre-rendered top-down sprite frames** of every clip.
  - Render from **directly above (90 degrees, the owner's camera lock)** with an orthographic camera and a transparent background, at two sizes: 128 px and 256 px. The silhouette from above must tell Rivet from the cop-bot (see `../../shared/style/DESIGN.md`).
  - Also ship an atlas, `sprites/<robot>.png`, with `sprites/<robot>.json` (`{frameW, frameH, clips: {name: {start, count, fps, loop}}}`).
  - Top-down sprites rotate freely in engine, so **one facing direction is enough.** Face +X (right) in every frame.
- `env/`: crate, concrete block, wall segment, forklift (static), floor texture (tileable, 1024 px), all as GLB + FBX, plus top-down sprite renders of each.
- `fx/`: muzzle flash, spark burst, hit flash, as sprite frames.
- `style/STYLE.md`: the palette with hex values, outline rules, lighting direction, and how to reproduce the look's shader in **each** engine (post-process material in UE, `CanvasItem`/spatial shader in Godot, URP renderer feature in Unity). Pseudocode is fine. Make it exact about the parameters.
- `preview.png`: a contact sheet of everything, rendered by your script. It is what the morning review looks at first.

## Quality bar
- Readable at gameplay scale (a 64 to 96 px tall robot on a 1280x720 screen).
- Rivet and the cop-bot are distinguishable by silhouette alone.
- Every clip is readable: the walk has weight, the roll has a tuck, the death is a satisfying collapse.

Record in `REPORT.md` the per-asset cost (minutes) and which steps resisted automation. That tells the owner what a
600-asset game costs in this pipeline.

Your scorecard uses the same JSON shape with `"lane": "art"`. Fill only the keys that apply and leave the rest
`null`. Add `packVersions` and `assetCount`.
