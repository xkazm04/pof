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

  // `missing` marks a value the user still has to set — rendered as a warning so an
  // unconfigured project never reads like a real injected value.
  const fields: { label: string; value: string; missing?: boolean }[] = [
    { label: 'Project', value: moduleName },
    { label: 'Path', value: projectPath || 'Not set — open Project Setup', missing: !projectPath },
    { label: 'Module', value: `${moduleName} → ${moduleLabel}` },
    { label: 'API Macro', value: apiMacro },
    { label: 'UE Version', value: ueVersion || 'Not set — open Project Setup', missing: !ueVersion },
    { label: 'Build Cmd', value: buildCmd },
    { label: 'Rules', value: 'No TodoWrite, no Explore, verify build, quote paths' },
  ];

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="focus-ring rounded flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
      >
        {isExpanded
          ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3" aria-hidden="true" />
        }
        <Info className="w-3 h-3" aria-hidden="true" />
        Injected context preview
      </button>
      {isExpanded && (
        <SurfaceCard level={2} className="mt-2 px-3 py-2.5">
          <p className="text-xs text-text-subtle mb-2">
            Prepended to every prompt this module sends to the terminal.
          </p>
          <dl className="space-y-1.5">
            {fields.map((f) => (
              <div key={f.label} className="flex items-start gap-2 text-xs">
                <dt className="text-text-muted flex-shrink-0 w-16 text-right">{f.label}</dt>
                <dd className={`font-mono break-all ${f.missing ? 'text-amber-400' : 'text-text-muted-hover'}`}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </SurfaceCard>
      )}
    </div>
  );
}
