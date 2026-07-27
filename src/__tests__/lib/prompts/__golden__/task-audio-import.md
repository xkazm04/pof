## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\proj\PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.

## Known UE Pitfalls
- **verify unreal.* API names by introspection before calling — never guess** — Guessed unreal.* class/method/property names fail silently (return None/false) or crash the pythonscript commandlet, and each wrong guess burns tokens on retries. Before calling an unfamiliar API, confirm it exists and check its signature: use mcp-unreal lookup_class / lookup_docs / subsystem_query, or `dir(unreal.X)`, `help(unreal.X.method)`, and `unreal.X.__doc__` inside execute_script. Prefer EditorSubsystem getters (unreal.get_editor_subsystem(...)) over deprecated global helpers. (research: Claude-in-UE5 demo (Stefan 3D AI) + VibeUE introspection)

## Project Knowledge Tips
- **MetaSounds** — UE5 MetaSounds provides a node-based audio system. Use C++ to drive parameters, MetaSounds for DSP.

## Task: Import audio set into UE (import_audio_set.py)

Import the **footstep-stone** set into the UE project as USoundWaves + a
randomising USoundCue, and (best-effort) wire it to the corresponding
AnimNotify.

1. From the UE project root, set the env vars then run the FULL editor with
   `-ExecutePythonScript` (PowerShell):
   `$env:AUDIO_SET_NAME="footstep-stone"; $env:AUDIO_EVENT_KEY="AnimNotify_FootstepEffect"; $env:AUDIO_SURFACE="stone"; $env:AUDIO_SOURCES="C:\audio\step_01.wav;C:\audio\step_02.wav"; & "C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe" "<the .uproject>" -ExecutePythonScript="Content/Python/import_audio_set.py" -unattended -nopause -nosplash`
2. Read the script's final `[import_audio_set] DONE` line: it prints
   `assetsImported=N cuePath=/Game/Audio/<set>/SC_<set> wiredEvent=<name|null>`.
3. Submit the result via @@CALLBACK:

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "assetsImported": 3,
  "cuePath": "/Game/Audio/footstep-stone/SC_footstep_stone",
  "wiredEvent": "AnimNotify_FootstepEffect|stone"
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `setName`: `"footstep-stone"`
- `eventKey`: `"AnimNotify_FootstepEffect"`
- `surface`: `"stone"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds