'use client';

import { useState, useMemo, useCallback } from 'react';
import { Sparkles, Search } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { BlenderConnectionBar } from '@/components/blender-mcp/BlenderConnectionBar';
import { tryApiFetch } from '@/lib/api-utils';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import { CATEGORY_META, SHADER_SCRIPT_MAP, MATERIAL_PATTERNS } from './constants';
import { PatternCard } from './PatternCard';
import type { MaterialCategory, MaterialPattern } from './types';

export type { MaterialCategory, MaterialPattern, MaterialPatternCatalogConfig } from './types';
export { MATERIAL_PATTERNS } from './constants';

// ── Component ──

interface MaterialPatternCatalogProps {
  onGenerate: (pattern: MaterialPattern) => void;
  isGenerating: boolean;
}

export function MaterialPatternCatalog({ onGenerate, isGenerating }: MaterialPatternCatalogProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blenderPreviewing, setBlenderPreviewing] = useState<string | null>(null);
  const [blenderResult, setBlenderResult] = useState<{ patternId: string; message: string; isError: boolean } | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  const handleBlenderPreview = useCallback(async (pattern: MaterialPattern) => {
    const scriptFn = SHADER_SCRIPT_MAP[pattern.id];
    if (!scriptFn) return;
    setBlenderPreviewing(pattern.id);
    setBlenderResult(null);
    try {
      const code = scriptFn();
      const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (result.ok) {
        setBlenderResult({ patternId: pattern.id, message: result.data.output || 'Shader created in Blender', isError: false });
      } else {
        setBlenderResult({ patternId: pattern.id, message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender preview failed', e);
      setBlenderResult({ patternId: pattern.id, message: e instanceof Error ? e.message : 'Preview failed', isError: true });
    } finally {
      setBlenderPreviewing(null);
    }
  }, []);

  const filtered = useMemo(() => {
    return MATERIAL_PATTERNS.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [search, selectedCategory]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-6 relative overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Blender Connection */}
        <BlenderConnectionBar />

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-violet-900/30 pb-4">
          <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Material Pattern Library</h3>
            <p className="text-xs text-violet-400/60 uppercase tracking-wider mt-0.5">
              DATABASE_ENTRIES: {MATERIAL_PATTERNS.length} — PROCEDURAL_SHADER_ARCHIVES
            </p>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-black/40 border border-violet-900/30 p-3 rounded-xl">
          <div className="flex-1 relative w-full xl:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="QUERY PATTERNS..."
              className="w-full pl-9 pr-4 py-2 bg-black/60 border border-violet-900/40 rounded-lg text-xs font-mono text-violet-100 placeholder-violet-500/40 outline-none focus:border-violet-500 transition-colors shadow-inner uppercase tracking-wider"
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {(['all', 'elemental', 'stylized', 'utility'] as const).map((cat) => {
              const isActive = selectedCategory === cat;
              const color = cat === 'all' ? MODULE_COLORS.content : CATEGORY_META[cat].color;
              const label = cat === 'all' ? 'All' : CATEGORY_META[cat].label;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all relative overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: isActive ? `${color}20` : 'rgba(0,0,0,0.4)',
                    color: isActive ? color : 'var(--text-muted)',
                    border: `1px solid ${isActive ? `${color}50` : 'rgba(139,92,246,0.2)'}`,
                    boxShadow: isActive ? `0 0 15px ${color}20` : 'none',
                  }}
                >
                  {isActive && <div className="absolute bottom-0 inset-x-0 h-0.5" style={{ backgroundColor: color }} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pattern List */}
        <div className="space-y-3">
          {filtered.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              isExpanded={expandedId === pattern.id}
              onToggle={() => handleToggle(pattern.id)}
              onGenerate={() => onGenerate(pattern)}
              isGenerating={isGenerating}
              blenderConnected={blenderConnected}
              hasBlenderScript={!!SHADER_SCRIPT_MAP[pattern.id]}
              isBlenderPreviewing={blenderPreviewing === pattern.id}
              onBlenderPreview={() => handleBlenderPreview(pattern)}
              blenderResult={blenderResult?.patternId === pattern.id ? blenderResult : null}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 bg-black/40 border border-violet-900/30 rounded-xl">
              <p className="text-xs font-mono text-violet-500/60">No Patterns Found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
