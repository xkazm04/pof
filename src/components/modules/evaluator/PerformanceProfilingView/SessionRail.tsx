'use client';

import { useState } from 'react';
import { History, Trash2, GitCompareArrows, RefreshCw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { usePerformanceProfilingStore } from '@/stores/performanceProfilingStore';

// ── Session Rail ────────────────────────────────────────────────────────────
// Every capture the server still holds: reopen one, delete one, or pick a
// baseline (A) and a head (B) to diff them in compare mode.

function PickButton({ letter, pressed, label, onClick }: {
  letter: 'A' | 'B';
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`focus-ring w-6 h-6 rounded text-2xs font-semibold border transition-colors ${
        pressed
          ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
          : 'bg-surface border-border text-text-muted hover:text-text'
      }`}
    >
      {letter}
    </button>
  );
}

export function SessionRail() {
  const sessionList = usePerformanceProfilingStore((s) => s.sessionList);
  const activeId = usePerformanceProfilingStore((s) => s.activeSession?.id ?? null);
  const isComparing = usePerformanceProfilingStore((s) => s.isComparing);
  const loadSession = usePerformanceProfilingStore((s) => s.loadSession);
  const deleteSession = usePerformanceProfilingStore((s) => s.deleteSession);
  const compare = usePerformanceProfilingStore((s) => s.compare);

  const [baseId, setBaseId] = useState<string | null>(null);
  const [headId, setHeadId] = useState<string | null>(null);

  if (sessionList.length === 0) return null;

  // A pick whose session was deleted no longer counts.
  const base = sessionList.some((s) => s.id === baseId) ? baseId : null;
  const head = sessionList.some((s) => s.id === headId) ? headId : null;
  const canCompare = base !== null && head !== null && base !== head && !isComparing;

  return (
    <SurfaceCard className="p-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-3.5 h-3.5 text-rose-400" />
        <h2 className="text-xs font-medium text-text">Captures</h2>
        <span className="text-2xs text-text-muted">
          {sessionList.length} held · pick A (before) and B (after) to diff
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => { if (base && head) void compare(base, head); }}
          disabled={!canCompare}
          className="focus-ring flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-400 text-2xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-50"
        >
          {isComparing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <GitCompareArrows className="w-3 h-3" />}
          Compare A → B
        </button>
      </div>

      <ul aria-label="Profiling sessions" className="space-y-1 max-h-40 overflow-y-auto">
        {sessionList.map((row) => {
          const isActive = row.id === activeId;
          return (
            <li
              key={row.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                isActive ? 'border-rose-500/30 bg-rose-500/5' : 'border-transparent'
              }`}
            >
              <button
                type="button"
                aria-label={`Open session ${row.name}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => void loadSession(row.id)}
                className="focus-ring flex-1 min-w-0 flex items-baseline gap-2 text-left rounded hover:text-text"
              >
                <span className="truncate text-xs text-text">{row.name}</span>
                <span className="flex-shrink-0 text-2xs text-text-muted">
                  {new Date(row.importedAt).toLocaleTimeString()} · {row.avgFPS.toFixed(0)} fps
                  {' · '}
                  {row.overallScore === null ? 'untriaged' : `score ${row.overallScore}`}
                </span>
              </button>
              <PickButton
                letter="A"
                label={`Use ${row.name} as baseline (A)`}
                pressed={base === row.id}
                onClick={() => { setBaseId(row.id); if (head === row.id) setHeadId(null); }}
              />
              <PickButton
                letter="B"
                label={`Use ${row.name} as head (B)`}
                pressed={head === row.id}
                onClick={() => { setHeadId(row.id); if (base === row.id) setBaseId(null); }}
              />
              <button
                type="button"
                aria-label={`Delete session ${row.name}`}
                onClick={() => void deleteSession(row.id)}
                className="focus-ring p-1 rounded text-text-muted hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </SurfaceCard>
  );
}
