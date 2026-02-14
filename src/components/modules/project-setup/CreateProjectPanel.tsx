'use client';

import { useCallback } from 'react';
import { Rocket, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import type { DetectedEngine } from './useProjectScan';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

interface CreateProjectPanelProps {
  engines: DetectedEngine[];
  isRunning: boolean;
  onSendPrompt: (prompt: string) => void;
}

export function CreateProjectPanel({ engines, isRunning, onSendPrompt }: CreateProjectPanelProps) {
  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ueVersion = useProjectStore((s) => s.ueVersion);

  const handleCreate = useCallback(() => {
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

Enable the EnhancedInput plugin in the .uproject.`;
    onSendPrompt(prompt);
  }, [projectName, projectPath, ueVersion, onSendPrompt]);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Create Project
      </h2>
      <SurfaceCard className="p-4">
        <p className="text-sm text-text-muted mb-3">
          Let Claude scaffold a new UE C++ project. This will create the folder structure,
          .uproject, Source/, Build.cs, and basic GameMode class.
        </p>
        <button
          onClick={handleCreate}
          disabled={!projectName.trim() || engines.length === 0 || isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20 rounded-lg text-sm hover:bg-[#00ff88]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRunning ? (
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
          <p className="text-xs text-red-400/80 mt-2">
            Install Unreal Engine first to enable project creation.
          </p>
        )}
      </SurfaceCard>
    </div>
  );
}
