# Lane: Godot 4

You are building `MVP.md` in **Godot 4.7** (the standard build with GDScript, not .NET).
- The editor is in `../../tools/godot/`.
  - **Use `Godot_v*_win64_console.exe` for every command line.** The plain `.exe` detaches from stdout on Windows, so you would see no output.
  - The export templates for this version are installed.
- `project/` already exists: a `project.godot`, an empty `main.tscn`, and a "Windows Desktop" export preset that prep exported successfully. See `PREP.md`.

## Pick your 2D / 2.5D approach, and say why in the JOURNAL
- **Pure 2D:** `Sprite2D` / `AnimatedSprite2D` characters with sprite sheets that rotate freely under a top-down camera. Use `TileMapLayer` or polygons for the yard, and `CanvasItem` shaders for the style.
- **2.5D:** a 3D scene with an orthographic `Camera3D`, low-poly GLB robots from the shared pack (`AnimationPlayer` / `AnimationTree`), and a screen-space shader for the 2D look.
- A hybrid.

## Toolchain facts
- **Headless export:** `godot --headless --path project --export-release "Windows Desktop" ../build/GTAISpike.exe`. This needs an `export_presets.cfg`, which you can write by hand.
- **Import:** run `godot --headless --path project --import` after adding assets, so the `.import` files exist before an export.
- **`--headless` does not render.** For screenshots, run the game normally (windowed) and save `get_viewport().get_texture().get_image()` with `save_png()`.
  - Or use Godot's **Movie Maker**: `godot --path project --write-movie ../evidence/autoplay/frame.png --fixed-fps 30 -- --autoplay`, which writes a deterministic PNG sequence. It is the cleanest way to make `duel.mp4`.
- Read custom arguments after `--` with `OS.get_cmdline_user_args()`.
- Scenes (`.tscn`) and resources (`.tres`) are text. You can author and diff them directly, but keep the UIDs consistent, or let the editor regenerate them with an `--import` pass.
- Run a script headless with `godot --headless --path project --script res://tools/x.gd`, which is handy for asset processing.

## What makes this lane different
PoF has no Godot bridge today. Note in `REPORT.md` which PoF-style checks (static checks, runtime capture, packaging)
would be easy or hard to build against Godot, judged from what you did tonight.
