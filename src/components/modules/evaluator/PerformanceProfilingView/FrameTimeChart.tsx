'use client';

import { BarChart3 } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FrameTimingSample } from '@/types/performance-profiling';

// ── Frame Time Chart ────────────────────────────────────────────────────────

export function FrameTimeChart({ samples, budgetMs }: { samples: FrameTimingSample[]; budgetMs: number }) {
  if (samples.length === 0) return null;

  const step = Math.max(1, Math.floor(samples.length / 60));
  const sampled = samples.filter((_, i) => i % step === 0);
  const maxMs = Math.max(...sampled.map((s) => s.totalFrameMs), budgetMs * 1.5);

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-rose-400" />
        <h2 className="text-sm font-medium text-text">Frame Time</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-2xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Game</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Render</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> GPU</span>
        </div>
      </div>

      <div className="relative">
        {/* Budget line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-emerald-500/40 z-10"
          style={{ bottom: `${(budgetMs / maxMs) * 100}%` }}
        >
          <span className="absolute right-0 -top-3.5 text-2xs text-emerald-400/60">
            {budgetMs.toFixed(1)}ms ({Math.round(1000 / budgetMs)}fps)
          </span>
        </div>

        <div className="flex items-end gap-px h-36">
          {sampled.map((s, i) => {
            const gtH = (s.gameThreadMs / maxMs) * 100;
            const rtH = (s.renderThreadMs / maxMs) * 100;
            const gpuH = (s.gpuMs / maxMs) * 100;
            const overBudget = s.totalFrameMs > budgetMs;
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                  <div className="bg-surface-deep border border-border rounded-lg px-2.5 py-1.5 text-2xs whitespace-nowrap shadow-lg">
                    <div className="text-text-muted">Frame {s.frameIndex}</div>
                    <div className="text-blue-400">Game: {s.gameThreadMs.toFixed(2)}ms</div>
                    <div className="text-violet-400">Render: {s.renderThreadMs.toFixed(2)}ms</div>
                    <div className="text-orange-400">GPU: {s.gpuMs.toFixed(2)}ms</div>
                    <div className={overBudget ? 'text-red-400' : 'text-emerald-400'}>
                      Total: {s.totalFrameMs.toFixed(2)}ms ({Math.round(1000 / s.totalFrameMs)}fps)
                    </div>
                    <div className="text-text-muted">Draw calls: {s.drawCalls}</div>
                  </div>
                </div>
                <div className="w-full flex flex-col gap-px h-full justify-end">
                  <div className={`w-full rounded-t-sm ${overBudget ? 'bg-blue-400/60' : 'bg-blue-400/40'}`} style={{ height: `${gtH}%` }} />
                  <div className="w-full bg-violet-400/40" style={{ height: `${rtH}%` }} />
                  <div className="w-full bg-orange-400/40" style={{ height: `${gpuH}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}
