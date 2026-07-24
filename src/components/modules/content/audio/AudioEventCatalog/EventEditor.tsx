'use client';

import { useState, useCallback } from 'react';
import { Plus, X, ChevronDown, Zap } from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_INFO,
  withOpacity, OPACITY_10, OPACITY_50,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { AudioEvent, EventCategory, PriorityLevel, SpatialMode } from './types';
import { CATEGORY_CONFIG, PRIORITY_CONFIG, CATEGORIES } from './constants';

// -- EventEditor --

export function EventEditor({
  event,
  onUpdate,
  onClose,
}: {
  event: AudioEvent;
  onUpdate: (patch: Partial<AudioEvent>) => void;
  onClose: () => void;
}) {
  const [newTag, setNewTag] = useState('');
  const cfg = CATEGORY_CONFIG[event.category];
  // Per-event ids so every label points at its own control (the editor is
  // remounted per selected event, but ids stay unique if two ever coexist).
  const fid = (field: string) => `audio-evt-${event.id}-${field}`;

  const addTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || event.tags.includes(tag)) return;
    onUpdate({ tags: [...event.tags, tag] });
    setNewTag('');
  }, [newTag, event.tags, onUpdate]);

  const removeTag = useCallback((tag: string) => {
    onUpdate({ tags: event.tags.filter((t) => t !== tag) });
  }, [event.tags, onUpdate]);

  return (
    <SurfaceCard className="p-6 relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20 blur-[80px] pointer-events-none" style={{ backgroundColor: cfg.color }} />

      <div className="flex items-center justify-between mb-6 relative z-10 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${cfg.color}20`, border: `1px solid ${cfg.color}50` }}>
            <Zap className="w-5 h-5" style={{ color: cfg.color }} aria-hidden="true" />
          </div>
          <div>
            <span className="text-base font-semibold text-text">Edit Event</span>
            <p className="text-xs text-text-muted mt-0.5">ID: {event.id}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close event editor"
          title="Close event editor"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-hover border border-transparent hover:border-border transition-all focus-ring"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
        {/* Name */}
        <div className="space-y-2">
          <label htmlFor={fid('name')} className="block text-sm text-text-muted font-semibold">Name</label>
          <input
            id={fid('name')}
            type="text"
            value={event.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-4 py-2.5 bg-surface-deep border border-border rounded-xl text-sm text-text focus-ring-inset transition-all shadow-inner"
          />
        </div>

        {/* Trigger */}
        <div className="space-y-2">
          <label htmlFor={fid('trigger')} className="block text-sm text-text-muted font-semibold">Trigger</label>
          <input
            id={fid('trigger')}
            type="text"
            value={event.trigger}
            onChange={(e) => onUpdate({ trigger: e.target.value })}
            placeholder="OnGameEvent..."
            aria-describedby={fid('trigger-hint')}
            className="w-full px-4 py-2.5 bg-surface-deep border border-border rounded-xl text-sm text-text font-mono focus-ring-inset transition-all shadow-inner"
          />
          <p id={fid('trigger-hint')} className="text-xs text-text-muted">
            Gameplay event name the audio manager binds to.
          </p>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label htmlFor={fid('category')} className="block text-sm text-text-muted font-semibold">Category</label>
          <div className="relative">
            <select
              id={fid('category')}
              value={event.category}
              onChange={(e) => onUpdate({ category: e.target.value as EventCategory })}
              className="w-full px-4 py-2.5 bg-surface-deep border border-border rounded-xl text-sm font-semibold text-text focus-ring-inset appearance-none transition-all shadow-inner"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-gray-900">{CATEGORY_CONFIG[c].label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <span id={fid('priority')} className="block text-sm text-text-muted font-semibold">Priority</span>
          <div className="flex gap-2" role="group" aria-labelledby={fid('priority')}>
            {(['low', 'normal', 'high', 'critical'] as PriorityLevel[]).map((p) => {
              const pCfg = PRIORITY_CONFIG[p];
              const active = event.priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onUpdate({ priority: p })}
                  aria-pressed={active}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border focus-ring-outline"
                  style={{
                    color: active ? pCfg.color : 'var(--text-muted)',
                    borderColor: active ? withOpacity(pCfg.color, OPACITY_50) : 'var(--border)',
                    backgroundColor: active ? withOpacity(pCfg.color, OPACITY_10) : 'var(--surface-deep)',
                    boxShadow: active ? `inset 0 0 10px ${pCfg.color}10` : 'none',
                  }}
                >
                  {pCfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spatial */}
        <div className="space-y-2">
          <span id={fid('spatial')} className="block text-sm text-text-muted font-semibold">2D / 3D Sound</span>
          <div className="flex gap-2" role="group" aria-labelledby={fid('spatial')}>
            {(['3d', '2d'] as SpatialMode[]).map((mode) => {
              const active = event.spatial === mode;
              const modeColor = mode === '3d' ? ACCENT_EMERALD : STATUS_INFO;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdate({ spatial: mode })}
                  aria-pressed={active}
                  aria-label={mode === '3d' ? '3D sound — positioned in the world' : '2D sound — non-positional'}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold uppercase transition-all border focus-ring-outline"
                  style={{
                    color: active ? modeColor : 'var(--text-muted)',
                    borderColor: active ? withOpacity(modeColor, OPACITY_50) : 'var(--border)',
                    backgroundColor: active ? withOpacity(modeColor, OPACITY_10) : 'var(--surface-deep)',
                    boxShadow: active ? `inset 0 0 10px ${modeColor}10` : 'none',
                  }}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Concurrency & Cooldown */}
        <div className="flex gap-4">
          <div className="space-y-2 flex-1">
            <label htmlFor={fid('concurrency')} className="block text-sm text-text-muted font-semibold">Max Simultaneous</label>
            <input
              id={fid('concurrency')}
              type="number"
              value={event.concurrency}
              onChange={(e) => onUpdate({ concurrency: Math.max(1, Math.min(16, Number(e.target.value) || 1)) })}
              min={1} max={16}
              aria-describedby={fid('concurrency-hint')}
              className="w-full px-4 py-2.5 bg-surface-deep border border-border rounded-xl text-sm text-text font-mono text-center focus-ring-inset transition-all shadow-inner"
            />
            <p id={fid('concurrency-hint')} className="text-xs text-text-muted">Voices allowed at once (1–16).</p>
          </div>

          <div className="space-y-2 flex-1">
            <label htmlFor={fid('cooldown')} className="block text-sm text-text-muted font-semibold">Cooldown ms</label>
            <input
              id={fid('cooldown')}
              type="number"
              value={event.cooldownMs}
              onChange={(e) => onUpdate({ cooldownMs: Math.max(0, Number(e.target.value) || 0) })}
              min={0}
              aria-describedby={fid('cooldown-hint')}
              className="w-full px-4 py-2.5 bg-surface-deep border border-border rounded-xl text-sm text-text font-mono text-center focus-ring-inset transition-all shadow-inner"
            />
            <p id={fid('cooldown-hint')} className="text-xs text-text-muted">Minimum gap between retriggers.</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-6 pt-5 border-t border-border relative z-10 space-y-3">
        <label htmlFor={fid('tag')} className="text-sm text-text-muted font-semibold flex items-center gap-2">
          Tags <span className="bg-surface text-text-muted px-1.5 py-0.5 rounded border border-border text-xs">{event.tags.length}</span>
        </label>

        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold border transition-all hover:brightness-125"
                style={{
                  color: `${cfg.color}e0`,
                  borderColor: `${cfg.color}40`,
                  backgroundColor: `${cfg.color}15`,
                  boxShadow: `inset 0 0 8px ${cfg.color}10`,
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  title={`Remove tag ${tag}`}
                  className="hover:text-text transition-colors focus-ring rounded"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            id={fid('tag')}
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="Add tag…"
            className="flex-1 px-4 py-2 bg-surface-deep border border-border rounded-xl text-sm text-text placeholder-text-muted focus-ring-inset transition-all shadow-inner"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!newTag.trim()}
            aria-label="Add tag"
            className="px-4 py-2 pl-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 focus-ring"
            style={{
              backgroundColor: `${cfg.color}15`,
              color: cfg.color,
              border: `1px solid ${cfg.color}40`,
            }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}
