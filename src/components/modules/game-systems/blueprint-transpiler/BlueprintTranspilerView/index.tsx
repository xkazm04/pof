'use client';

import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useBlueprintTranspiler } from '@/hooks/useBlueprintTranspiler';
import { useProjectStore } from '@/stores/projectStore';
import type { TranspilerTab } from '@/types/blueprint';
import { UI_TIMEOUTS } from '@/lib/constants';
import { TAB_CONFIG, SAMPLE_BLUEPRINT } from './constants';
import { TranspilePane } from './TranspilePane';
import { DiffPane } from './DiffPane';

export function BlueprintTranspilerView() {
  const [activeTab, setActiveTab] = useState<TranspilerTab>('transpile');
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [showCode, setShowCode] = useState<'header' | 'source'>('header');

  const projectName = useProjectStore((s) => s.projectName);
  const projectPath = useProjectStore((s) => s.projectPath);
  const {
    blueprintJson, setBlueprintJson,
    existingCpp, setExistingCpp,
    asset, summary,
    transpileResult, diffResult,
    isLoading, error,
    parse, transpile, diff, reset,
  } = useBlueprintTranspiler();

  const handleTranspile = useCallback(async () => {
    if (!blueprintJson.trim()) return;
    await parse(blueprintJson);
    await transpile(blueprintJson, projectName || undefined);
  }, [blueprintJson, projectName, parse, transpile]);

  const handleDiff = useCallback(async () => {
    if (!blueprintJson.trim() || !existingCpp.trim()) return;
    await parse(blueprintJson);
    await diff(blueprintJson, existingCpp, projectName || undefined);
  }, [blueprintJson, existingCpp, projectName, parse, diff]);

  const handleLoadSample = useCallback(() => {
    setBlueprintJson(SAMPLE_BLUEPRINT);
  }, [setBlueprintJson]);

  const copyToClipboard = useCallback(async (text: string, which: 'header' | 'source') => {
    await navigator.clipboard.writeText(text);
    if (which === 'header') { setCopiedHeader(true); setTimeout(() => setCopiedHeader(false), UI_TIMEOUTS.copyFeedback); }
    else { setCopiedSource(true); setTimeout(() => setCopiedSource(false), UI_TIMEOUTS.copyFeedback); }
  }, []);

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
            copiedHeader={copiedHeader}
            copiedSource={copiedSource}
            onCopy={copyToClipboard}
            projectName={projectName}
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
