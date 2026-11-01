# Lane: Unity 6

You are building `MVP.md` in **Unity 6000.6.4f1**, at `C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe`. Create the project in
`project/` inside your lane folder.

## Licence
The preflight verified that a batchmode run can obtain a licence (the owner activated Unity Personal through Unity
Hub before launch). If a batchmode run still fails with "No valid Unity Editor license" or exit code 198:
1. Log `BLOCKED: unity licence`.
2. Keep working on everything that does not need the editor (C# scripts, asset prep in Blender, the plan).
3. Retry the licence every iteration.
Never try to work around licensing.

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
