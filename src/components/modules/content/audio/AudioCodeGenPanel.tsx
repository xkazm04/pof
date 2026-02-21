'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, FileCode, Copy, Check, ChevronDown, ChevronRight,
  Loader2, Download, Layers, Volume2, Radio, Zap, Music,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { apiFetch } from '@/lib/api-utils';
import type { AudioSceneDocument } from '@/types/audio-scene';
import type { GeneratedFile, CodeGenResult } from '@/lib/audio-codegen';
import { UI_TIMEOUTS, MODULE_COLORS } from '@/lib/constants';
import {
  ACCENT_VIOLET, STATUS_INFO, STATUS_SUCCESS, STATUS_WARNING, ACCENT_PINK, STATUS_ERROR,
} from '@/lib/chart-colors';

const CATEGORY_META: Record<GeneratedFile['category'], { icon: typeof Code2; label: string; color: string }> = {
  reverb: { icon: Volume2, label: 'Reverb Presets', color: ACCENT_VIOLET },
  attenuation: { icon: Radio, label: 'Sound Attenuation', color: STATUS_INFO },
  volume: { icon: Layers, label: 'Audio Volumes', color: STATUS_SUCCESS },
  emitter: { icon: Music, label: 'Emitter Spawner', color: STATUS_WARNING },
  metasound: { icon: Zap, label: 'MetaSounds', color: ACCENT_PINK },
  manager: { icon: Code2, label: 'Scene Manager', color: MODULE_COLORS.content },
};

interface AudioCodeGenPanelProps {
  doc: AudioSceneDocument;
  accentColor: string;
}

export function AudioCodeGenPanel({ doc, accentColor }: AudioCodeGenPanelProps) {
  const [result, setResult] = useState<CodeGenResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState('');
  const [apiMacro, setApiMacro] = useState('');

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await apiFetch<CodeGenResult>('/api/audio-codegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: doc.id,
          moduleName: moduleName || undefined,
          apiMacro: apiMacro || undefined,
        }),
      });
      setResult(result);
      setExpandedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
    setGenerating(false);
  }, [doc.id, moduleName, apiMacro]);

  const handleCopy = useCallback(async (file: GeneratedFile) => {
    await navigator.clipboard.writeText(file.content);
    setCopiedFile(file.filename);
    setTimeout(() => setCopiedFile(null), UI_TIMEOUTS.copyFeedback);
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (!result) return;
    const allContent = result.files.map(f =>
      `// ═══════════════════════════════════════════\n// File: ${f.filename}\n// ═══════════════════════════════════════════\n\n${f.content}`
    ).join('\n\n');
    await navigator.clipboard.writeText(allContent);
    setCopiedFile('__all__');
    setTimeout(() => setCopiedFile(null), UI_TIMEOUTS.copyFeedback);
  }, [result]);

  // Group files by category
  const grouped = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, GeneratedFile[]>();
    for (const file of result.files) {
      const list = map.get(file.category) ?? [];
      list.push(file);
      map.set(file.category, list);
    }
    return [...map.entries()];
  }, [result]);

  return (
    <div className="space-y-4">
      {/* Config + Generate */}
      <SurfaceCard level={1}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-xs font-semibold text-text">Generate UE5 C++ from Scene</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-2xs text-text-muted block mb-1">Module Name</label>
              <input
                value={moduleName}
                onChange={e => setModuleName(e.target.value)}
                placeholder="MyProject"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-text outline-none focus:border-border-bright font-mono"
              />
            </div>
            <div>
              <label className="text-2xs text-text-muted block mb-1">API Macro</label>
              <input
                value={apiMacro}
                onChange={e => setApiMacro(e.target.value)}
                placeholder="MYPROJECT_API"
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-text outline-none focus:border-border-bright font-mono"
              />
            </div>
          </div>

          {/* Scene summary */}
          <div className="flex items-center gap-3 mb-3 text-2xs text-text-muted">
            <span>{doc.zones.length} zone{doc.zones.length !== 1 ? 's' : ''}</span>
            <span className="text-border">|</span>
            <span>{doc.emitters.length} emitter{doc.emitters.length !== 1 ? 's' : ''}</span>
            <span className="text-border">|</span>
            <span>Global reverb: {doc.globalReverbPreset}</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || doc.zones.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}30` }}
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />}
            {generating ? 'Generating...' : 'Generate C++ Code'}
          </button>

          {error && (
            <p className="text-2xs text-[#f87171] mt-2">{error}</p>
          )}
        </div>
      </SurfaceCard>

      {/* Results */}
      {result && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <MiniStat label="Files" value={result.stats.totalFiles} color={accentColor} />
            <MiniStat label="Lines" value={result.stats.totalLines} color={STATUS_INFO} />
            <MiniStat label="Zones" value={result.stats.zonesProcessed} color={STATUS_SUCCESS} />
            <MiniStat label="Emitters" value={result.stats.emittersProcessed} color={STATUS_WARNING} />
          </div>

          {/* Copy all */}
          <div className="flex justify-end">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-2xs font-medium text-text-muted hover:text-text bg-surface-hover/50 hover:bg-surface-hover transition-colors"
            >
              {copiedFile === '__all__' ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
              {copiedFile === '__all__' ? 'Copied!' : 'Copy All Files'}
            </button>
          </div>

          {/* File groups */}
          {grouped.map(([category, files]) => {
            const meta = CATEGORY_META[category as GeneratedFile['category']];
            const CatIcon = meta.icon;

            return (
              <SurfaceCard key={category} level={2}>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CatIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    <span className="text-xs font-semibold text-text">{meta.label}</span>
                    <span className="text-2xs text-text-muted ml-auto">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="space-y-1.5">
                    {files.map(file => {
                      const isExpanded = expandedFile === file.filename;
                      const isCopied = copiedFile === file.filename;

                      return (
                        <div key={file.filename} className="rounded-md border border-border/50 overflow-hidden">
                          <button
                            onClick={() => setExpandedFile(isExpanded ? null : file.filename)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-hover/30 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                            }
                            <FileCode className="w-3 h-3 flex-shrink-0" style={{ color: file.language === 'h' ? STATUS_INFO : STATUS_SUCCESS }} />
                            <span className="text-2xs font-mono text-text flex-1">{file.filename}</span>
                            <span className="text-2xs text-text-muted">{file.lineCount} lines</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopy(file); }}
                              className="p-0.5 rounded text-text-muted hover:text-text transition-colors"
                              title="Copy file contents"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <pre className="px-3 py-2 bg-[#0a0c14] text-2xs font-mono text-[#b0b4cc] overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed border-t border-border/30">
                                  {file.content}
                                </pre>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </>
      )}

      {/* Empty state */}
      {!result && !generating && (
        <div className="text-center py-8 text-text-muted text-xs">
          Configure your module settings and click Generate to produce UE5 C++ code from your audio scene.
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <SurfaceCard level={2}>
      <div className="px-3 py-2 text-center">
        <div className="text-sm font-bold" style={{ color }}>{value}</div>
        <div className="text-2xs text-text-muted mt-0.5">{label}</div>
      </div>
    </SurfaceCard>
  );
}
