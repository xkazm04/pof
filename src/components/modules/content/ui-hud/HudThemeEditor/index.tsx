'use client';

import { useState, useCallback, useMemo } from 'react';
import { Palette, Play, Pause, RotateCcw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN,
  OPACITY_10,
} from '@/lib/chart-colors';
import { DEFAULT_THEME } from './constants';
import { generateUE5Config } from './helpers';
import { writeParam, type HudThemeParam } from './themeSchema';
import { useAnimationLoop } from './useAnimationLoop';
import { LivePreviewScene } from './LivePreviewScene';
import { ParameterEditor } from './ParameterEditor';
import { ExportPanel } from './ExportPanel';
import { ApplyToProjectBar } from './ApplyToProjectBar';
import { useHudDesignStore } from '@/stores/hudDesignStore';
import { useProjectStore } from '@/stores/projectStore';
import type { HudTheme, RGBA } from './types';

// ── Main component ─────────────────────────────────────────────────────────

export function HudThemeEditor() {
  // The draft lives per project in hudDesignStore: this tab unmounts on every tab switch.
  const projectPath = useProjectStore((s) => s.projectPath);
  const theme = useHudDesignStore((s) => s.byProject[projectPath]?.themeDraft ?? DEFAULT_THEME);
  const setThemeDraft = useHudDesignStore((s) => s.setThemeDraft);
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<'health' | 'damage' | 'enemy'>('health');

  const time = useAnimationLoop(playing);

  const setParam = useCallback((p: HudThemeParam, value: number | RGBA) => {
    const prev = useHudDesignStore.getState().getThemeDraft(projectPath);
    setThemeDraft(projectPath, writeParam(prev, p, value));
  }, [projectPath, setThemeDraft]);

  // A pasted .h (parseUE5Config, already clamped and reported) replaces the theme.
  const handleImport = useCallback((next: HudTheme) => {
    setThemeDraft(projectPath, next);
  }, [projectPath, setThemeDraft]);

  const handleReset = useCallback(() => {
    setThemeDraft(projectPath, structuredClone(DEFAULT_THEME));
  }, [projectPath, setThemeDraft]);

  const exportConfig = useMemo(() => generateUE5Config(theme), [theme]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportConfig]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([exportConfig], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HUDThemeConfig.h';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportConfig]);

  // Section config tabs
  const sections = [
    { id: 'health' as const, label: 'Health & Mana',  color: STATUS_SUCCESS },
    { id: 'damage' as const, label: 'Damage Numbers', color: STATUS_WARNING },
    { id: 'enemy' as const,  label: 'Enemy HP Bar',   color: STATUS_ERROR },
  ];

  return (
    <div className="space-y-3" data-testid="hud-theme-editor">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg relative overflow-hidden"
            style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}
          >
            <Palette className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text">HUD Theme Editor</h3>
            <p className="text-2xs text-text-muted">Visual tuning for all HUD UPROPERTYs with live preview</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!playing)}
            className="p-1.5 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            title={playing ? 'Pause preview' : 'Play preview'}
          >
            {playing ? (
              <Pause className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <Play className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-md bg-surface-deep border border-border hover:border-border-bright transition-colors"
            title="Reset to C++ defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <SurfaceCard level={2} className="p-3">
        <div className="text-xs font-bold text-text-muted uppercase mb-2">
          Live Combat Preview
        </div>
        <LivePreviewScene theme={theme} time={time} />
      </SurfaceCard>

      {/* Editor panels */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3">
        {/* ── Left: Parameter Editor ── */}
        <ParameterEditor
          theme={theme}
          setParam={setParam}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          sections={sections}
        />

        {/* ── Right: UE5 Export ── */}
        <ExportPanel
          theme={theme}
          exportConfig={exportConfig}
          copied={copied}
          handleCopy={handleCopy}
          handleDownload={handleDownload}
          onImport={handleImport}
        />
      </div>

      {/* ── Apply the changed UPROPERTYs to the project ── */}
      <ApplyToProjectBar projectPath={projectPath} theme={theme} />
    </div>
  );
}
