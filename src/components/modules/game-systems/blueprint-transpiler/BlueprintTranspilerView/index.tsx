'use client';

import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useBlueprintTranspiler } from '@/hooks/useBlueprintTranspiler';
import { useProjectStore } from '@/stores/projectStore';
import type { TranspilerTab } from '@/types/blueprint';
import { TAB_CONFIG, SAMPLE_BLUEPRINT } from './constants';
import { sanitizeModule } from './helpers';
import { TranspilePane } from './TranspilePane';
import { DiffPane } from './DiffPane';

export function BlueprintTranspilerView() {
  const [activeTab, setActiveTab] = useState<TranspilerTab>('transpile');
  const [showCode, setShowCode] = useState<'header' | 'source'>('header');

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);

  // The session (input, target module, runs) is kept per project, outside the
  // component, so an LRU eviction does not lose it. The target C++ module decides
  // BOTH the `<MODULE>_API` macro baked into the header and the `Source/<Module>/`
  // directory the file is written to, so it is part of the transpile's key.
  const {
    blueprintJson, setBlueprintJson,
    existingCpp, setExistingCpp,
    moduleName, setModuleName,
    asset, summary,
    transpileRun, diffRun,
    transpile, diff, reset,
  } = useBlueprintTranspiler({ projectPath, surface: 'transpiler', defaultModule: sanitizeModule(projectName) });

  // One request per click. The run is `running` from the synchronous dispatch,
  // and an identical in-flight run is joined, so no latch is needed.
  const handleTranspile = useCallback(() => {
    void transpile(projectName || undefined);
  }, [transpile, projectName]);

  // Retargeting the module invalidates the generated header (its API macro is
  // module-derived), so the code is regenerated for the new target; the reply
  // for the old target, if still in flight, is dropped (last request wins). The
  // write modal's staleness banners force a fresh dry-run before any write.
  const handleModuleChange = useCallback((next: string) => {
    setModuleName(next);
    if (transpileRun.result) void transpile(projectName || undefined);
  }, [setModuleName, transpile, transpileRun.result, projectName]);

  const handleDiff = useCallback(() => {
    void diff(projectName || undefined);
  }, [diff, projectName]);

  const handleLoadSample = useCallback(() => {
    setBlueprintJson(SAMPLE_BLUEPRINT);
  }, [setBlueprintJson]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border">
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-surface-hover text-text'
                  : 'text-text-muted hover:text-text hover:bg-surface'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {(transpileRun.result || diffRun.result || asset) && (
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'transpile' ? (
          <TranspilePane
            blueprintJson={blueprintJson}
            setBlueprintJson={setBlueprintJson}
            onTranspile={handleTranspile}
            onLoadSample={handleLoadSample}
            isLoading={transpileRun.running}
            error={transpileRun.error}
            asset={asset}
            summary={summary}
            result={transpileRun.result}
            stale={transpileRun.staleBecause.includes('blueprintJson')}
            showCode={showCode}
            setShowCode={setShowCode}
            moduleName={moduleName}
            onModuleChange={handleModuleChange}
            projectPath={projectPath}
          />
        ) : (
          <DiffPane
            blueprintJson={blueprintJson}
            setBlueprintJson={setBlueprintJson}
            existingCpp={existingCpp}
            setExistingCpp={setExistingCpp}
            onDiff={handleDiff}
            onLoadSample={handleLoadSample}
            isLoading={diffRun.running}
            error={diffRun.error}
            result={diffRun.result}
            stale={diffRun.stale}
          />
        )}
      </div>
    </div>
  );
}
