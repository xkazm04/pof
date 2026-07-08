'use client';

import { ChevronRight, ChevronDown, Info } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { getModuleName, getAPIMacro, getEnginePath, getBuildCommand } from '@/lib/prompt-context';

export function ContextPreview({
  projectName,
  projectPath,
  ueVersion,
  moduleLabel,
  isExpanded,
  onToggle,
}: {
  projectName: string;
  projectPath: string;
  ueVersion: string;
  moduleLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const moduleName = getModuleName(projectName);
  const apiMacro = getAPIMacro(moduleName);
  const enginePath = getEnginePath(ueVersion);
  const buildCmd = getBuildCommand(enginePath, moduleName, projectPath);

  const fields = [
    { label: 'Project', value: moduleName },
    { label: 'Path', value: projectPath || '(not set)' },
    { label: 'Module', value: `${moduleName} → ${moduleLabel}` },
    { label: 'API Macro', value: apiMacro },
    { label: 'UE Version', value: ueVersion || '(not set)' },
    { label: 'Build Cmd', value: buildCmd },
    { label: 'Rules', value: 'No TodoWrite, no Explore, verify build, quote paths' },
  ];

  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label="Toggle injected context preview"
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-muted transition-colors"
      >
        {isExpanded
          ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3" aria-hidden="true" />
        }
        <Info className="w-3 h-3" aria-hidden="true" />
        Injected context preview
      </button>
      {isExpanded && (
        <SurfaceCard level={2} className="mt-2 px-3 py-2.5 space-y-1.5">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-2 text-xs">
              <span className="text-text-muted flex-shrink-0 w-16 text-right">{f.label}</span>
              <span className="text-text-muted-hover font-mono break-all">{f.value}</span>
            </div>
          ))}
        </SurfaceCard>
      )}
    </div>
  );
}
