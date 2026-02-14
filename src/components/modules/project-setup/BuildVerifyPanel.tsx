'use client';

import { useCallback } from 'react';
import { Hammer, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { DetectedEngine } from './useProjectScan';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

interface BuildVerifyPanelProps {
  engines: DetectedEngine[];
  isRunning: boolean;
  onSendPrompt: (prompt: string) => void;
}

export function BuildVerifyPanel({ engines, isRunning, onSendPrompt }: BuildVerifyPanelProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const handleBuild = useCallback(() => {
    const majorMinor = ueVersion.split('.').slice(0, 2).join('.');
    const matchedEngine = engines.find((e) => e.path.includes(`UE_${majorMinor}`)) ?? engines[0];
    const eng = (matchedEngine?.path ?? '').replace(/\\/g, '/');
    const proj = projectPath.replace(/\\/g, '/');

    const prompt = `Build-verify the UE ${majorMinor} project "${projectName}" at "${proj}" using engine at "${eng}".

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

    onSendPrompt(prompt);
  }, [projectName, projectPath, ueVersion, engines, onSendPrompt]);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Build & Verify
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-sm text-text-muted mb-3">
          Health-check your SDK toolchain and compile the project with UnrealBuildTool to
          verify everything is wired correctly.
        </p>
        <button
          onClick={handleBuild}
          disabled={isRunning || engines.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded-lg text-sm hover:bg-[#f59e0b]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Building & Verifying...
            </>
          ) : (
            <>
              <Hammer className="w-4 h-4" />
              Build & Verify Project
            </>
          )}
        </button>
      </SurfaceCard>
    </div>
  );
}
