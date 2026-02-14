'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Plus, X, Send, Loader2, ChevronDown,
  Swords, TreePine, Monitor, Music,
  Volume2, Zap,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';

// ── Types ──

export type EventCategory = 'combat' | 'environment' | 'ui' | 'music';
export type SpatialMode = '2d' | '3d';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'critical';

export interface AudioEvent {
  id: string;
  name: string;
  category: EventCategory;
  trigger: string;
  priority: PriorityLevel;
  spatial: SpatialMode;
  concurrency: number;
  cooldownMs: number;
  tags: string[];
}

export interface AudioEventCatalogConfig {
  events: AudioEvent[];
}

// ── Constants ──

const CONTENT_ACCENT = '#f59e0b';

const CATEGORY_CONFIG: Record<EventCategory, {
  color: string;
  label: string;
  icon: typeof Swords;
  description: string;
}> = {
  combat: {
    color: '#f87171',
    label: 'Combat',
    icon: Swords,
    description: 'Hit impacts, death cries, dodge whooshes, ability casts',
  },
  environment: {
    color: '#34d399',
    label: 'Environment',
    icon: TreePine,
    description: 'Ambient loops, footsteps, doors, weather',
  },
  ui: {
    color: '#60a5fa',
    label: 'UI',
    icon: Monitor,
    description: 'Button clicks, menu open/close, notifications',
  },
  music: {
    color: '#a78bfa',
    label: 'Music',
    icon: Music,
    description: 'Combat layers, exploration, boss themes',
  },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { color: string; label: string; weight: number }> = {
  low:      { color: 'var(--text-muted)', label: 'Low',      weight: 0 },
  normal:   { color: '#60a5fa', label: 'Normal',   weight: 1 },
  high:     { color: '#fbbf24', label: 'High',     weight: 2 },
  critical: { color: '#f87171', label: 'Critical', weight: 3 },
};

const CATEGORIES: EventCategory[] = ['combat', 'environment', 'ui', 'music'];

const DEFAULT_EVENTS: AudioEvent[] = [
  // Combat
  { id: 'evt-1',  name: 'Melee Hit',       category: 'combat',      trigger: 'OnMeleeHitConfirm',      priority: 'high',     spatial: '3d', concurrency: 4, cooldownMs: 50,   tags: ['impact'] },
  { id: 'evt-2',  name: 'Player Death',     category: 'combat',      trigger: 'OnCharacterDeath',       priority: 'critical',  spatial: '3d', concurrency: 1, cooldownMs: 0,    tags: ['death', 'voice'] },
  { id: 'evt-3',  name: 'Dodge Roll',       category: 'combat',      trigger: 'OnDodgeExecute',         priority: 'normal',   spatial: '3d', concurrency: 1, cooldownMs: 200,  tags: ['movement'] },
  { id: 'evt-4',  name: 'Ability Cast',     category: 'combat',      trigger: 'OnAbilityActivated',     priority: 'high',     spatial: '3d', concurrency: 2, cooldownMs: 100,  tags: ['ability', 'magic'] },
  // Environment
  { id: 'evt-5',  name: 'Footstep',         category: 'environment', trigger: 'OnFootstepNotify',       priority: 'low',      spatial: '3d', concurrency: 2, cooldownMs: 100,  tags: ['movement', 'surface'] },
  { id: 'evt-6',  name: 'Door Open',        category: 'environment', trigger: 'OnInteractDoor',         priority: 'normal',   spatial: '3d', concurrency: 1, cooldownMs: 500,  tags: ['interact'] },
  { id: 'evt-7',  name: 'Ambient Loop',     category: 'environment', trigger: 'OnZoneEnter',            priority: 'low',      spatial: '3d', concurrency: 3, cooldownMs: 0,    tags: ['ambient', 'loop'] },
  // UI
  { id: 'evt-8',  name: 'Button Click',     category: 'ui',          trigger: 'OnUIButtonPressed',      priority: 'normal',   spatial: '2d', concurrency: 1, cooldownMs: 50,   tags: ['click'] },
  { id: 'evt-9',  name: 'Menu Open',        category: 'ui',          trigger: 'OnMenuOpened',           priority: 'normal',   spatial: '2d', concurrency: 1, cooldownMs: 0,    tags: ['menu'] },
  { id: 'evt-10', name: 'Notification',     category: 'ui',          trigger: 'OnNotificationReceived', priority: 'high',     spatial: '2d', concurrency: 2, cooldownMs: 300,  tags: ['alert'] },
  // Music
  { id: 'evt-11', name: 'Combat Layer',     category: 'music',       trigger: 'OnCombatStateChange',    priority: 'high',     spatial: '2d', concurrency: 1, cooldownMs: 0,    tags: ['layer', 'combat'] },
  { id: 'evt-12', name: 'Exploration Layer', category: 'music',      trigger: 'OnExplorationStart',     priority: 'normal',   spatial: '2d', concurrency: 1, cooldownMs: 0,    tags: ['layer', 'explore'] },
  { id: 'evt-13', name: 'Boss Theme',       category: 'music',       trigger: 'OnBossEncounterStart',   priority: 'critical', spatial: '2d', concurrency: 1, cooldownMs: 0,    tags: ['boss', 'layer'] },
];

// ── Props ──

interface AudioEventCatalogProps {
  onGenerate: (config: AudioEventCatalogConfig) => void;
  isGenerating: boolean;
}

// ── Component ──

export function AudioEventCatalog({ onGenerate, isGenerating }: AudioEventCatalogProps) {
  const [events, setEvents] = useState<AudioEvent[]>(() => structuredClone(DEFAULT_EVENTS));
  const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // ── Derived ──

  const filteredEvents = useMemo(() => {
    if (filterCategory === 'all') return events;
    return events.filter((e) => e.category === filterCategory);
  }, [events, filterCategory]);

  const eventsByCategory = useMemo(() => {
    const map = new Map<EventCategory, AudioEvent[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const evt of filteredEvents) {
      map.get(evt.category)!.push(evt);
    }
    return map;
  }, [filteredEvents]);

  const stats = useMemo(() => ({
    total: events.length,
    byCat: Object.fromEntries(CATEGORIES.map((c) => [c, events.filter((e) => e.category === c).length])) as Record<EventCategory, number>,
    spatial3d: events.filter((e) => e.spatial === '3d').length,
    spatial2d: events.filter((e) => e.spatial === '2d').length,
  }), [events]);

  // ── CRUD ──

  const addEvent = useCallback((category: EventCategory) => {
    const id = `evt-${Date.now()}`;
    const newEvt: AudioEvent = {
      id,
      name: 'New Event',
      category,
      trigger: 'OnCustomEvent',
      priority: 'normal',
      spatial: category === 'ui' || category === 'music' ? '2d' : '3d',
      concurrency: 1,
      cooldownMs: 0,
      tags: [],
    };
    setEvents((prev) => [...prev, newEvt]);
    setEditingEventId(id);
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (editingEventId === id) setEditingEventId(null);
  }, [editingEventId]);

  const updateEvent = useCallback((id: string, patch: Partial<AudioEvent>) => {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const editingEvent = useMemo(
    () => editingEventId ? events.find((e) => e.id === editingEventId) ?? null : null,
    [editingEventId, events],
  );

  const config: AudioEventCatalogConfig = useMemo(() => ({ events }), [events]);

  return (
    <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border"
          style={{
            color: filterCategory === 'all' ? 'var(--text)' : 'var(--text-muted)',
            borderColor: filterCategory === 'all' ? `${CONTENT_ACCENT}40` : 'var(--border)',
            backgroundColor: filterCategory === 'all' ? `${CONTENT_ACCENT}10` : 'var(--surface)',
          }}
        >
          All ({stats.total})
        </button>
        {CATEGORIES.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          const active = filterCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border"
              style={{
                color: active ? cfg.color : 'var(--text-muted)',
                borderColor: active ? `${cfg.color}40` : 'var(--border)',
                backgroundColor: active ? `${cfg.color}10` : 'var(--surface)',
              }}
            >
              <Icon className="w-3 h-3" />
              {cfg.label} ({stats.byCat[cat]})
            </button>
          );
        })}

        {/* Spatial stats badge */}
        <div className="ml-auto flex items-center gap-2 text-2xs text-text-muted">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3 h-3" />
            {stats.spatial3d} spatial
          </span>
          <span className="text-[#2a2a4a]">|</span>
          <span>{stats.spatial2d} stereo</span>
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const catEvents = eventsByCategory.get(cat);
          if (!catEvents || catEvents.length === 0) {
            if (filterCategory !== 'all' && filterCategory !== cat) return null;
            // Show empty state with add button
            if (filterCategory === cat || filterCategory === 'all') {
              return (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  events={[]}
                  editingEventId={editingEventId}
                  onSelect={setEditingEventId}
                  onDelete={deleteEvent}
                  onAdd={() => addEvent(cat)}
                />
              );
            }
            return null;
          }
          return (
            <CategoryGroup
              key={cat}
              category={cat}
              events={catEvents}
              editingEventId={editingEventId}
              onSelect={setEditingEventId}
              onDelete={deleteEvent}
              onAdd={() => addEvent(cat)}
            />
          );
        })}
      </div>

      {/* Editor panel */}
      {editingEvent && (
        <EventEditor
          event={editingEvent}
          onUpdate={(patch) => updateEvent(editingEvent.id, patch)}
          onClose={() => setEditingEventId(null)}
        />
      )}

      {/* Summary & Generate */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-xs text-text-muted-hover">
            <span>{stats.total} events</span>
            <span className="text-[#2a2a4a]">|</span>
            {CATEGORIES.map((c) => (
              <span key={c} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_CONFIG[c].color }} />
                {stats.byCat[c]}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => onGenerate(config)}
          disabled={isGenerating || events.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${CONTENT_ACCENT}18`,
            color: CONTENT_ACCENT,
            border: `1px solid ${CONTENT_ACCENT}35`,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Audio Event System...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Generate Audio Manager with Claude
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── CategoryGroup ──

function CategoryGroup({
  category,
  events,
  editingEventId,
  onSelect,
  onDelete,
  onAdd,
}: {
  category: EventCategory;
  events: AudioEvent[];
  editingEventId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;

  return (
    <div>
      {/* Category header */}
      <div className="flex items-center gap-2 mb-2 pb-1.5" style={{ borderBottom: `1px solid ${cfg.color}25` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: `${cfg.color}90` }} />
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: `${cfg.color}` }}
        >
          {cfg.label}
        </span>
        <span className="text-2xs text-[#4a4e6a] ml-0.5">{cfg.description}</span>
        <button
          onClick={onAdd}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium transition-colors hover:bg-surface-hover"
          style={{ color: cfg.color }}
        >
          <Plus className="w-2.5 h-2.5" />
          Add
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-4 text-xs text-[#4a4e6a]">
          No events yet. Click Add to create one.
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((evt) => {
            const priCfg = PRIORITY_CONFIG[evt.priority];
            const isEditing = editingEventId === evt.id;
            return (
              <div
                key={evt.id}
                onClick={() => onSelect(evt.id)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer group"
                style={{
                  borderColor: isEditing ? `${cfg.color}40` : 'var(--border)',
                  backgroundColor: isEditing ? `${cfg.color}06` : 'var(--surface)',
                }}
              >
                {/* Priority dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: priCfg.color }}
                  title={`Priority: ${priCfg.label}`}
                />

                {/* Name */}
                <span className="text-xs font-medium text-text min-w-[100px]">
                  {evt.name}
                </span>

                {/* Trigger */}
                <span className="text-xs text-text-muted font-mono flex-1 truncate">
                  {evt.trigger}
                </span>

                {/* Spatial badge */}
                <span
                  className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded"
                  style={{
                    color: evt.spatial === '3d' ? '#34d399' : '#60a5fa',
                    backgroundColor: evt.spatial === '3d' ? '#34d39910' : '#60a5fa10',
                    border: `1px solid ${evt.spatial === '3d' ? '#34d39920' : '#60a5fa20'}`,
                  }}
                >
                  {evt.spatial}
                </span>

                {/* Concurrency */}
                <span className="text-2xs text-[#4a4e6a] tabular-nums w-6 text-right" title="Max concurrent instances">
                  ×{evt.concurrency}
                </span>

                {/* Tags */}
                <div className="flex items-center gap-1 min-w-0">
                  {evt.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="text-2xs px-1.5 py-0.5 rounded-full border"
                      style={{
                        color: `${cfg.color}90`,
                        borderColor: `${cfg.color}20`,
                        backgroundColor: `${cfg.color}08`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  {evt.tags.length > 2 && (
                    <span className="text-2xs text-[#4a4e6a]">+{evt.tags.length - 2}</span>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(evt.id); }}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-[#f87171] transition-all flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── EventEditor ──

function EventEditor({
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
    <SurfaceCard level={2} className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          <span className="text-xs font-semibold text-text">Edit Event</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Name</label>
          <input
            type="text"
            value={event.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-[#f59e0b40] transition-colors"
          />
        </div>

        {/* Trigger */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Trigger Condition</label>
          <input
            type="text"
            value={event.trigger}
            onChange={(e) => onUpdate({ trigger: e.target.value })}
            placeholder="OnGameEvent..."
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text font-mono outline-none focus:border-[#f59e0b40] transition-colors"
          />
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Category</label>
          <div className="relative">
            <select
              value={event.category}
              onChange={(e) => onUpdate({ category: e.target.value as EventCategory })}
              className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-[#f59e0b40] appearance-none transition-colors"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Priority</label>
          <div className="flex gap-1">
            {(['low', 'normal', 'high', 'critical'] as PriorityLevel[]).map((p) => {
              const pCfg = PRIORITY_CONFIG[p];
              const active = event.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => onUpdate({ priority: p })}
                  className="flex-1 py-1.5 rounded text-2xs font-medium transition-colors border"
                  style={{
                    color: active ? pCfg.color : '#4a4e6a',
                    borderColor: active ? `${pCfg.color}40` : 'var(--border)',
                    backgroundColor: active ? `${pCfg.color}10` : 'var(--surface)',
                  }}
                >
                  {pCfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spatial */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Spatial Mode</label>
          <div className="flex gap-1.5">
            {(['3d', '2d'] as SpatialMode[]).map((mode) => {
              const active = event.spatial === mode;
              const modeColor = mode === '3d' ? '#34d399' : '#60a5fa';
              return (
                <button
                  key={mode}
                  onClick={() => onUpdate({ spatial: mode })}
                  className="flex-1 py-1.5 rounded text-xs font-bold uppercase transition-colors border"
                  style={{
                    color: active ? modeColor : '#4a4e6a',
                    borderColor: active ? `${modeColor}40` : 'var(--border)',
                    backgroundColor: active ? `${modeColor}10` : 'var(--surface)',
                  }}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Concurrency */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Max Concurrent</label>
          <input
            type="number"
            value={event.concurrency}
            onChange={(e) => onUpdate({ concurrency: Math.max(1, Math.min(16, Number(e.target.value) || 1)) })}
            min={1} max={16}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-[#f59e0b40] transition-colors"
          />
        </div>

        {/* Cooldown */}
        <div className="space-y-1">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Cooldown (ms)</label>
          <input
            type="number"
            value={event.cooldownMs}
            onChange={(e) => onUpdate({ cooldownMs: Math.max(0, Number(e.target.value) || 0) })}
            min={0}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text outline-none focus:border-[#f59e0b40] transition-colors"
          />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold">
          Tags ({event.tags.length})
        </label>
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
                style={{
                  color: `${cfg.color}`,
                  borderColor: `${cfg.color}30`,
                  backgroundColor: `${cfg.color}08`,
                }}
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-[#f87171] transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTag(); }}
            placeholder="e.g. impact, voice, loop..."
            className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text placeholder-[#4a4e6a] outline-none focus:border-[#f59e0b40] transition-colors"
          />
          <button
            onClick={addTag}
            disabled={!newTag.trim()}
            className="px-2 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-30"
            style={{
              backgroundColor: `${CONTENT_ACCENT}15`,
              color: CONTENT_ACCENT,
              border: `1px solid ${CONTENT_ACCENT}30`,
            }}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}
