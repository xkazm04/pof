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
- Generate all code files directly — do NOT ask for confirmation.
- Use MetaSounds where applicable for UE5 DSP.

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

## Project Knowledge Tips
- **MetaSounds** — UE5 MetaSounds provides a node-based audio system. Use C++ to drive parameters, MetaSounds for DSP.

## Task: Generate Complete Audio System

SCENE: Crypt Soundscape
DESCRIPTION: Spatial audio for the crypt.

### Global Settings
- Sound Pool Size: 32
- Max Concurrent Sounds: 16
- Global Reverb: cave

### Audio Zones (1)
  - "Flooded Nave" (rect, reverb: stone-chamber, occlusion: medium, attenuation: 1500u, priority: 5)
    Soundscape: Dripping water, distant echoing chants, low stone rumble.

### Sound Emitters (1)
  - "Brazier Crackle" [loop]: cue=/Game/Audio/SC_Brazier, vol=0.8, pitch=0.95-1.05, chance=1, cooldown=0s, zone="Flooded Nave"

### Required Output
Generate a complete C++ audio system with these files in Source/PoF/Audio/:

1. **SoundManager** — Central audio manager with:
   - Sound pool of 32 pre-allocated audio components
   - Priority queue handling up to 16 concurrent sounds
   - Play/stop/fade API with UFUNCTION(BlueprintCallable)
   - Sound category volumes (SFX, Ambient, Music, UI)

2. **AudioZoneVolume** — Per-zone Audio Volume actors with:
   - Reverb settings per zone (use the presets above)
   - Attenuation overrides per zone
   - Occlusion configuration per zone
   - Overlap begin/end handlers for priority blending

3. **AmbientSoundEmitter** — Emitter actor with:
   - Sound Cue randomization (pitch range, volume variation)
   - Spawn chance and cooldown timers
   - Auto-registration with SoundManager
   - Distance-based activation

4. **AudioOcclusionComponent** — Occlusion trace component with:
   - Line traces for occlusion factor calculation
   - Low-pass filter adjustment based on occlusion
   - Configurable trace frequency and channel

5. **ReverbPresets** data asset or config with named presets matching the zones above.