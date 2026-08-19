'use client';

import { useState, useCallback, useRef } from 'react';
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

  // The target C++ module. It decides BOTH the `<MODULE>_API` macro baked into
  // the header and the `Source/<Module>/` directory the file is written to, so
  // it is owned here and threaded into codegen — the write modal used to hold
  // it privately, which let the two halves of one decision disagree.
  const [moduleName, setModuleName] = useState(() => sanitizeModule(projectName));
  const {
    blueprintJson, setBlueprintJson,
    existingCpp, setExistingCpp,
    asset, summary,
    transpileResult, diffResult,
    isLoading, error,
    parse, transpile, diff, reset,
  } = useBlueprintTranspiler();

  // Synchronous in-flight latch. `isLoading` briefly flips back to false in the
  // gap between the two awaited steps (parse → transpile/diff), momentarily
  // re-enabling the disabled buttons; a double-click in that window would fire a
  // second overlapping run. This ref guards the whole composite action the
  // instant it starts, independent of any render.
  const inFlightRef = useRef(false);

  const handleTranspile = useCallback(async () => {
    if (!blueprintJson.trim() || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await parse(blueprintJson);
      await transpile(blueprintJson, projectName || undefined, moduleName || undefined);
    } finally {
      inFlightRef.current = false;
    }
  }, [blueprintJson, projectName, moduleName, parse, transpile]);

  // Retargeting the module invalidates the generated header (its API macro is
  // module-derived), so the code is regenerated for the new target rather than
  // left declaring the old module. The write modal's staleness banners then
  // force a fresh dry-run before anything reaches disk.
  const handleModuleChange = useCallback((next: string) => {
    setModuleName(next);
    if (!transpileResult || !blueprintJson.trim() || inFlightRef.current) return;
    inFlightRef.current = true;
    void transpile(blueprintJson, projectName || undefined, next || undefined)
      .catch(() => { /* surfaced by the hook's `error` state */ })
      .finally(() => { inFlightRef.current = false; });
  }, [blueprintJson, projectName, transpile, transpileResult]);

  const handleDiff = useCallback(async () => {
    if (!blueprintJson.trim() || !existingCpp.trim() || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await parse(blueprintJson);
      await diff(blueprintJson, existingCpp, projectName || undefined);
    } finally {
      inFlightRef.current = false;
    }
  }, [blueprintJson, existingCpp, projectName, parse, diff]);

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
          {(transpileResult || diffResult || asset) && (
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
            isLoading={isLoading}
            error={error}
            asset={asset}
            summary={summary}
            result={transpileResult}
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
            isLoading={isLoading}
            error={error}
            result={diffResult}
          />
        )}
      </div>
    </div>
  );
}
