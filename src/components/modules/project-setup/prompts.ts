/**
 * Pure builders for the Project Setup CLI prompts. Extracted from the
 * Create / Build panels so the guided next-step banner can dispatch the exact
 * same prompt as the panel's own button — one source of truth, no drift.
 */

import type { DetectedEngine } from './useProjectScan';

export interface ProjectIdentity {
  projectName: string;
  projectPath: string;
  ueVersion: string;
}

export function buildCreateProjectPrompt({ projectName, projectPath, ueVersion }: ProjectIdentity): string {
  const majorMinor = ueVersion.split('.').slice(0, 2).join('.');

  return `Create a new Unreal Engine ${ueVersion} C++ project in the directory "${projectPath}". The project is called "${projectName}".

IMPORTANT: First, web search for "Unreal Engine ${ueVersion} C++ project setup structure" to confirm the correct file structure, Build.cs format, and Target.cs settings for UE ${ueVersion}.

CRITICAL VERSION SETTINGS — follow these exactly to avoid version mismatch errors:
- In the .uproject file, set "EngineAssociation": "${majorMinor}" (major.minor ONLY — the engine launcher registers as "${majorMinor}", using "${ueVersion}" will cause a version mismatch)
- In Target.cs files, use DefaultBuildSettings = BuildSettingsVersion.Latest and IncludeOrderVersion = EngineIncludeOrderVersion.Latest (do NOT use version-specific values like V5 or Unreal5_5 — they may not exist in all ${majorMinor}.x builds and cause compile errors)
- Set "FileVersion": 3 in the .uproject

Create all files directly inside "${projectPath}" (this IS the project root, do NOT create a subdirectory):
1. ${projectName}.uproject
2. Source/${projectName}.Target.cs (TargetType.Game)
3. Source/${projectName}Editor.Target.cs (TargetType.Editor)
4. Source/${projectName}/${projectName}.Build.cs (PCHUsage = UseExplicitOrSharedPCHs, deps: Core, CoreUObject, Engine, InputCore, EnhancedInput)
5. Source/${projectName}/${projectName}GameMode.h and .cpp
6. Source/${projectName}/${projectName}.h and .cpp (module impl with IMPLEMENT_PRIMARY_GAME_MODULE)
7. Config/DefaultEngine.ini and Config/DefaultGame.ini

Enable the EnhancedInput plugin in the .uproject.`;
}

export function buildBuildVerifyPrompt({
  projectName,
  projectPath,
  ueVersion,
  engines,
}: ProjectIdentity & { engines: DetectedEngine[] }): string {
  const majorMinor = ueVersion.split('.').slice(0, 2).join('.');
  const matchedEngine = engines.find((e) => e.path.includes(`UE_${majorMinor}`)) ?? engines[0];
  const eng = (matchedEngine?.path ?? '').replace(/\\/g, '/');
  const proj = projectPath.replace(/\\/g, '/');

  return `Build-verify the UE ${majorMinor} project "${projectName}" at "${proj}" using engine at "${eng}".

RULES: Be concise. Do NOT use TodoWrite. Maximize parallel Bash calls. Every Bash command MUST exit 0 — use \`test ... && echo "OK" || echo "FAIL"\` or append \`|| true\`.

STEP 1 — Pre-flight (run ALL in parallel):
  a) \`test -d "${proj}/Source" && echo "SOURCE OK" || echo "SOURCE MISSING"\`
  b) \`ls "C:/Program Files/dotnet/x64/shared/Microsoft.NETCore.App/" 2>/dev/null || true; echo "---"; ls "C:/Program Files/dotnet/shared/Microsoft.NETCore.App/" 2>/dev/null || true\` — look for 8.x in either path. If x64 has 8.x, use DOTNET="C:/Program Files/dotnet/x64/dotnet.exe". If default has 8.x, use DOTNET=dotnet.
  c) \`test -f "${eng}/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll" && echo "UBT OK" || echo "UBT MISSING"\`

Evaluate:
- If no .NET 8.x in either path → BLOCKING, stop.
- If UBT MISSING → BLOCKING, stop.
- If SOURCE MISSING → proceed to Step 2 to create it.

STEP 2 — Create C++ scaffolding (only if Source/ is missing):
The project is Blueprint-only. Create the minimal C++ module to enable compilation.
Use the Write tool to create these files (do NOT use Bash echo/cat). Use UE ${majorMinor} conventions:

  a) "${proj}/Source/${projectName}.Target.cs":
     \`\`\`csharp
     using UnrealBuildTool;
     public class ${projectName}Target : TargetRules {
       public ${projectName}Target(TargetInfo Target) : base(Target) {
         Type = TargetType.Game;
         DefaultBuildSettings = BuildSettingsVersion.Latest;
         IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
       }
     }
     \`\`\`

  b) "${proj}/Source/${projectName}Editor.Target.cs":
     \`\`\`csharp
     using UnrealBuildTool;
     public class ${projectName}EditorTarget : TargetRules {
       public ${projectName}EditorTarget(TargetInfo Target) : base(Target) {
         Type = TargetType.Editor;
         DefaultBuildSettings = BuildSettingsVersion.Latest;
         IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
       }
     }
     \`\`\`

  c) "${proj}/Source/${projectName}/${projectName}.Build.cs":
     \`\`\`csharp
     using UnrealBuildTool;
     public class ${projectName} : ModuleRules {
       public ${projectName}(ReadOnlyTargetRules Target) : base(Target) {
         PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
         PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" });
       }
     }
     \`\`\`

  d) "${proj}/Source/${projectName}/${projectName}Module.cpp":
     \`\`\`cpp
     #include "Modules/ModuleManager.h"
     IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, ${projectName}, "${projectName}");
     \`\`\`

Also update the .uproject to declare the module — Read "${proj}/${projectName}.uproject", add "Modules" array if missing:
\`\`\`json
"Modules": [{ "Name": "${projectName}", "Type": "Runtime", "LoadingPhase": "Default" }]
\`\`\`

STEP 3 — Build:
Run with 10-minute timeout:
\`\`\`
<DOTNET> "${eng}/Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll" ${projectName}Editor Win64 Development "-Project=${proj}/${projectName}.uproject" -WaitMutex -FromMsBuild
\`\`\`

STEP 4 — Report: One summary table. If Source/ was created, mention it. Show build pass/fail and first error lines if any.`;
}
