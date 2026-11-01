# Lane: Unreal Engine 5.8

You are building `MVP.md` in **Unreal Engine 5.8**, installed at `C:\Program Files\Epic Games\UE_5.8`. Create a
**new C++ project** in `project/` inside your lane folder (for example `project/GTAISpike.uproject`). Never open or
modify the existing PoF project in `C:\Users\kazda\Documents\Unreal Projects\PoF`.

## Pick your 2D / 2.5D approach, and say why in the JOURNAL
- **Paper2D** (the built-in plugin, under `Engine/Plugins/2D/Paper2D`): flipbooks of sprites. PaperZD is a Marketplace plugin and is NOT installed; do not depend on it.
- **3D low-poly with a near-orthographic top-down camera and a post-process material** for the 2D look: skeletal meshes from the shared pack's GLB/FBX.
- A hybrid: 3D blocks with sprite characters, the GTA 2 way.

Choose the one you believe gives the best feel for the chosen style. The verdict must cover UE as a 2D/2.5D
engine, so record what the approach cost you.

## Toolchain facts (from this machine's history)
- **Build:** `Engine\Build\BatchFiles\Build.bat <Target>Editor Win64 Development -Project=<abs .uproject> -WaitMutex`. Package with `Engine\Build\BatchFiles\RunUAT.bat BuildCookRun -project=<abs> -platform=Win64 -clientconfig=Shipping -build -cook -stage -pak -archive -archivedirectory=<lane>\build`.
- **Headless run and capture:** `UnrealEditor.exe <proj> <map> -game -RenderOffScreen -windowed -ResX=1280 -ResY=720 -unattended`.
  - A bare `-ExecCmds="Quit"` does NOT exit the editor. Have the game exit itself (`FGenericPlatformMisc::RequestExit` or `UKismetSystemLibrary::QuitGame`) from your `--autoplay` code.
  - Read custom flags with `FParse::Param(FCommandLine::Get(), TEXT("autoplay"))`.
- **Python editor scripting** works for asset import: `UnrealEditor-Cmd.exe <proj> -ExecutePythonScript=<file.py> -unattended`. Enable the `PythonScriptPlugin` and `EditorScriptingUtilities` plugins.
  - Editor shutdown after a commandlet may crash and exit non-zero even when the work succeeded. **Judge success by the log** (`-abslog=<file>`), not by the exit code.
  - In Python, `set_editor_property` drops a bool's leading `b` (`bAlignToSurface` becomes `align_to_surface`).
- **C++ traps on 5.8:**
  - IWYU is hard-enforced: a `.cpp` must include its own header FIRST.
  - In `AActor` subclasses, do not name locals `Owner`, `Tags` or `FolderPath`; they shadow members.
  - Keep editor-only APIs out of runtime modules.
- **Frame capture:** `HighResShot` or `FScreenshotRequest::RequestScreenshot`, or read back from a `SceneCapture2D`. Write the PNGs to `evidence/autoplay/` with an absolute path.
- Enhanced Input is the input system on 5.8.

## What makes this lane different
UE is what the PoF tool already integrates with: verification, static checks, runtime acceptance and packaging all
exist for UE. You do not use PoF tonight. Note in `REPORT.md` anything you did that PoF's existing UE bridge would
have done for you, or would have verified.
