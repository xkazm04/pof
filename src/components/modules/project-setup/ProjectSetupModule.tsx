'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Rocket,
  RefreshCw,
  Copy,
  FolderOpen,
  FileCode,
  Loader2,
  Check,
  ExternalLink,
  Hammer,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleCLI } from '@/hooks/useModuleCLI';

interface DetectedEngine {
  version: string;
  path: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
  hasUProject: boolean;
}

interface ListResponse {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
  uprojectFiles: string[];
  isUEProject: boolean;
}

interface DetectedTool {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
  path?: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  subDetail?: string;
}

const INSTALL_URLS: Record<string, { url: string; label: string }> = {
  engine: { url: 'https://www.unrealengine.com/download', label: 'Get Epic Launcher' },
  'tool-vs': { url: 'https://visualstudio.microsoft.com/downloads/', label: 'Get Visual Studio' },
  'tool-msvc': { url: 'https://visualstudio.microsoft.com/visual-cpp-build-tools/', label: 'Get C++ Build Tools' },
  'tool-wsdk': { url: 'https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/', label: 'Get Windows SDK' },
  'tool-dotnet': { url: 'https://dotnet.microsoft.com/en-us/download/dotnet/8.0', label: 'Get .NET 8.0 Runtime' },
};

export function ProjectSetupModule() {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);
  const gameGenre = useProjectStore((s) => s.gameGenre);

  // Ref for scan callback — allows hooks to call scan() without circular dependency
  const scanRef = useRef<() => void>(() => {});

  const setupCLI = useModuleCLI({
    moduleId: 'project-setup',
    sessionKey: 'project-setup',
    label: 'Project Setup',
    accentColor: '#00ff88',
    onComplete: () => scanRef.current(),
  });

  const buildCLI = useModuleCLI({
    moduleId: 'project-setup',
    sessionKey: 'project-build-verify',
    label: 'Build & Verify',
    accentColor: '#f59e0b',
    onComplete: () => scanRef.current(),
  });

  const [engines, setEngines] = useState<DetectedEngine[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const initialScanDone = useRef(false);

  const scan = useCallback(async () => {
    setScanning(true);
    const items: ChecklistItem[] = [];
    let detectedEngines: DetectedEngine[] = [];
    let dirData: ListResponse | null = null;

    // 1. Detect engines
    try {
      const res = await fetch('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect-engines' }),
      });
      if (res.ok) {
        const data = await res.json();
        detectedEngines = data.engines ?? [];
      }
    } catch {
      // Non-critical
    }
    setEngines(detectedEngines);

    if (detectedEngines.length > 0) {
      const eng = detectedEngines[0];
      items.push({
        id: 'engine',
        label: 'Unreal Engine',
        ok: true,
        detail: `UE ${eng.version} detected`,
        subDetail: eng.path,
      });
    } else {
      items.push({
        id: 'engine',
        label: 'Unreal Engine',
        ok: false,
        detail: 'Not found',
      });
    }

    // 2. Detect developer tooling
    let detectedTools: DetectedTool[] = [];
    try {
      const res = await fetch('/api/filesystem/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect-tooling' }),
      });
      if (res.ok) {
        const data = await res.json();
        detectedTools = data.tools ?? [];
      }
    } catch {
      // Non-critical
    }

    for (const tool of detectedTools) {
      items.push({
        id: `tool-${tool.id}`,
        label: tool.name,
        ok: tool.ok,
        detail: tool.detail,
        subDetail: tool.path,
      });
    }

    // Project path
    if (projectPath.trim()) {
      items.push({
        id: 'path',
        label: 'Project Path',
        ok: true,
        detail: projectPath,
      });
    } else {
      items.push({
        id: 'path',
        label: 'Project Path',
        ok: false,
        detail: 'No path configured',
      });
    }

    // Scan project directory
    if (projectPath.trim()) {
      try {
        const res = await fetch('/api/filesystem/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', path: projectPath }),
        });
        if (res.ok) {
          dirData = await res.json();
        }
      } catch {
        // Non-critical
      }
    }

    // UE Project check
    if (dirData?.isUEProject) {
      items.push({
        id: 'uproject',
        label: 'UE Project',
        ok: true,
        detail: dirData.uprojectFiles[0],
      });
    } else {
      items.push({
        id: 'uproject',
        label: 'UE Project',
        ok: false,
        detail: 'No .uproject found',
      });
    }

    // Source directory check
    const hasSource = dirData?.directories.some((d) => d.name === 'Source') ?? false;
    items.push({
      id: 'source',
      label: 'Source Directory',
      ok: hasSource,
      detail: hasSource ? 'Source/ found' : 'No Source/ folder',
    });

    // Build files check
    let hasBuildFiles = false;
    if (hasSource) {
      try {
        const sourceRes = await fetch('/api/filesystem/browse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list', path: `${projectPath}\\Source` }),
        });
        if (sourceRes.ok) {
          const sourceData: ListResponse = await sourceRes.json();
          hasBuildFiles = sourceData.directories.length > 0;
        }
      } catch {
        // Non-critical
      }
    }
    items.push({
      id: 'build',
      label: 'Build Files',
      ok: hasBuildFiles,
      detail: hasBuildFiles ? 'Build files found' : 'No build files',
    });

    setChecklist(items);

    // Build project files list if project exists
    const files: string[] = [];
    if (dirData?.isUEProject && projectPath.trim()) {
      for (const uf of dirData.uprojectFiles) {
        files.push(`${projectPath}\\${uf}`);
      }
      if (hasSource) {
        try {
          const sourceRes = await fetch('/api/filesystem/browse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list', path: `${projectPath}\\Source` }),
          });
          if (sourceRes.ok) {
            const sourceData: ListResponse = await sourceRes.json();
            for (const d of sourceData.directories) {
              files.push(`Source\\${d.name}\\`);
            }
            for (const uf of sourceData.uprojectFiles) {
              files.push(`Source\\${uf}`);
            }
          }
        } catch {
          // Non-critical
        }
      }
    }
    setProjectFiles(files);
    setScanning(false);
  }, [projectPath]);

  // Wire scanRef so the hooks' onComplete can call scan() without circular deps
  scanRef.current = scan;

  useEffect(() => {
    if (initialScanDone.current) return;
    initialScanDone.current = true;
    scan();
  }, [scan]);

  const handleCreateProject = () => {
    // Extract major.minor for EngineAssociation (launcher builds use "5.5" not "5.5.4")
    const majorMinor = ueVersion.split('.').slice(0, 2).join('.');

    const prompt = `Create a new Unreal Engine ${ueVersion} C++ project in the directory "${projectPath}". The project is called "${projectName}".

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

Configure for ${gameGenre ?? 'general'} game type. Enable the EnhancedInput plugin in the .uproject.`;
    setupCLI.sendPrompt(prompt);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPath(text);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const openInExplorer = () => {
    setupCLI.sendPrompt(`Open the folder "${projectPath}" in Windows Explorer.`);
  };

  const handleBuildVerify = () => {
    // Match engine to project's ueVersion (e.g. "5.5" matches engine path containing "UE_5.5")
    const majorMinor = ueVersion.split('.').slice(0, 2).join('.');
    const matchedEngine = engines.find((e) => e.path.includes(`UE_${majorMinor}`)) ?? engines[0];
    // Normalize all paths to forward slashes for bash compatibility
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

    buildCLI.sendPrompt(prompt);
  };

  const hasProject = checklist.find((c) => c.id === 'uproject')?.ok ?? false;
  const okCount = checklist.filter((c) => c.ok).length;

  return (
    <div className="flex h-full">
      {/* Left rail — checklist */}
      <div className="w-56 shrink-0 border-r border-[#1e1e3a] bg-[#0a0a1a]/50 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold text-[#6b7294] uppercase tracking-wider">
            Status
          </span>
          {scanning ? (
            <Loader2 className="w-3 h-3 text-[#6b7294] animate-spin" />
          ) : (
            <button
              onClick={scan}
              className="p-0.5 text-[#6b7294] hover:text-[#e0e4f0] transition-colors"
              title="Re-scan"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="space-y-3 flex-1">
          {checklist.map((item, i) => (
            <div key={item.id} className="flex items-start gap-2.5">
              {/* Colored circle bullet */}
              <div className="relative mt-[3px] shrink-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    item.ok ? 'bg-[#00ff88]' : 'bg-red-400'
                  }`}
                />
                {/* Connector line to next item */}
                {i < checklist.length - 1 && (
                  <div className="absolute top-3 left-[4px] w-px h-4 bg-[#1e1e3a]" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-medium text-[#e0e4f0] leading-none block">
                  {item.label}
                </span>
                <span
                  className={`text-[10px] leading-tight block mt-0.5 truncate ${
                    item.ok ? 'text-[#00ff88]/70' : 'text-red-400/70'
                  }`}
                  title={item.detail}
                >
                  {item.detail}
                </span>
                {!item.ok && INSTALL_URLS[item.id] && (
                  <a
                    href={INSTALL_URLS[item.id].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[#3b82f6] hover:text-[#60a5fa] mt-0.5 transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    {INSTALL_URLS[item.id].label}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {checklist.length > 0 && (
          <div className="pt-3 mt-3 border-t border-[#1e1e3a]">
            <span className="text-[10px] text-[#6b7294]">
              {okCount}/{checklist.length} checks passing
            </span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Rocket className="w-6 h-6 text-[#00ff88]" />
          <h1 className="text-xl font-semibold text-[#e0e4f0]">Project Setup</h1>
        </div>
        <p className="text-sm text-[#6b7294] mb-6">
          Create and configure your Unreal Engine project
        </p>

        {/* Create Project */}
        {!hasProject && projectPath.trim() && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-[#6b7294] uppercase tracking-wider mb-3">
              Create Project
            </h2>
            <div className="bg-[#111128] border border-[#1e1e3a] rounded-lg p-4">
              <p className="text-sm text-[#6b7294] mb-3">
                Let Claude scaffold a new UE C++ project. This will create the folder structure,
                .uproject, Source/, Build.cs, and basic GameMode class.
              </p>
              <button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || engines.length === 0 || setupCLI.isRunning}
                className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-lg text-sm hover:bg-[#00ff88]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {setupCLI.isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Create Project with Claude
                  </>
                )}
              </button>
              {engines.length === 0 && (
                <p className="text-[10px] text-red-400/80 mt-2">
                  Install Unreal Engine first to enable project creation.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Project Files */}
        {hasProject && projectFiles.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-[#6b7294] uppercase tracking-wider mb-3">
              Project Files
            </h2>
            <div className="bg-[#111128] border border-[#1e1e3a] rounded-lg divide-y divide-[#1e1e3a]">
              {projectFiles.map((filePath) => (
                <div
                  key={filePath}
                  className="flex items-center gap-2 px-4 py-2 group"
                >
                  <FileCode className="w-3.5 h-3.5 text-[#6b7294] shrink-0" />
                  <span className="text-xs text-[#e0e4f0] font-mono truncate flex-1">
                    {filePath}
                  </span>
                  <button
                    onClick={() => copyToClipboard(filePath)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#6b7294] hover:text-[#00ff88] transition-all"
                    title="Copy path"
                  >
                    {copiedPath === filePath ? (
                      <Check className="w-3.5 h-3.5 text-[#00ff88]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={openInExplorer}
                  className="flex items-center gap-1.5 text-xs text-[#6b7294] hover:text-[#e0e4f0] transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open in Explorer
                </button>
                <button
                  onClick={() => copyToClipboard(projectPath)}
                  className="flex items-center gap-1.5 text-xs text-[#6b7294] hover:text-[#e0e4f0] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedPath === projectPath ? 'Copied!' : 'Copy Root Path'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Build & Verify */}
        {hasProject && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-[#6b7294] uppercase tracking-wider mb-3">
              Build & Verify
            </h2>
            <div className="bg-[#111128] border border-[#1e1e3a] rounded-lg p-4">
              <p className="text-sm text-[#6b7294] mb-3">
                Health-check your SDK toolchain and compile the project with UnrealBuildTool to
                verify everything is wired correctly.
              </p>
              <button
                onClick={handleBuildVerify}
                disabled={buildCLI.isRunning || engines.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 rounded-lg text-sm hover:bg-[#f59e0b]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {buildCLI.isRunning ? (
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
            </div>
          </div>
        )}

        {/* Empty state when no project path */}
        {!projectPath.trim() && (
          <div className="bg-[#111128] border border-[#1e1e3a] rounded-lg p-6 text-center">
            <p className="text-sm text-[#6b7294]">
              Complete the setup wizard to configure your project path.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
