# Lane: Unity 6

You are building `MVP.md` in **Unity 6000.6.4f1**, at `C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe`.

`project/` already exists. It was created from the `urp-blank` template (URP serves both 2D and 3D), with these packages resolved:
- `com.unity.inputsystem`
- `com.unity.2d.animation`, `com.unity.2d.sprite`, `com.unity.2d.tilemap`
- `com.unity.cloud.gltfast`

Prep also built a Windows player from it once in batchmode. See `PREP.md`.

## Licence
Batchmode takes its licence token from **Unity Hub, which must stay running**.
- Measured 2026-11-01: exit code 198 with the Hub closed, 0 with it open.
- The Hub belongs to the owner's session. **Never close it or kill it.**
- If a batchmode run fails with "No valid Unity Editor license", "Access token is unavailable" or exit code 198:
  1. Log `BLOCKED: unity licence (Hub not running?)`.
  2. Keep working on everything that does not need the editor (C# scripts, Blender asset prep, the plan).
  3. Retry each iteration.
- Never try to work around licensing.

## Pick your 2D / 2.5D approach, and say why in the JOURNAL
- **URP 2D:** the 2D Renderer, `SpriteRenderer`, sprite sheets that rotate under a top-down camera, Tilemap for the yard, and optionally the **2D Animation** package for skeletal cutout rigs.
- **2.5D:** URP 3D with an orthographic camera, low-poly FBX/GLB robots from the shared pack (glTFast for GLB, or FBX from Blender), an Animator, and a full-screen renderer feature for the 2D look.
- A hybrid.

## Toolchain facts
- **Create the project:** `Unity.exe -batchmode -quit -createProject <abs path>`.
- **Add packages:** edit `Packages/manifest.json` (URP `com.unity.render-pipelines.universal`, `com.unity.inputsystem`, `com.unity.2d.animation`, `com.unity.cloud.gltfast`), then let a batchmode open resolve them.
- **Build:** write an editor script with `public static void Build()` that calls `BuildPipeline.BuildPlayer(...)`, then run `Unity.exe -batchmode -nographics -quit -projectPath <p> -executeMethod BuildScript.Build -logFile <lane>/logs/build.log`. **Read the log.** Batchmode exit codes hide a lot.
- Scenes are YAML but hard to hand-author. Build scenes from an editor script (`EditorSceneManager.NewScene`, then add GameObjects, then `SaveScene`), not by writing YAML.
- **Capture frames:** run the built player windowed with `--autoplay` and call `ScreenCapture.CaptureScreenshot(path)` at 0.5 s intervals. Read the arguments with `System.Environment.GetCommandLineArgs()`.
- Domain reloads and script compiles happen on every batchmode open. **Measure that loop honestly** in `LOOP:` lines.

## What makes this lane different
PoF has no Unity bridge today. Note in `REPORT.md` which PoF-style checks would be easy or hard to build against
Unity, judged from what you did tonight.
