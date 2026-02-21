'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Send, Loader2, ChevronDown,
  Swords, TreePine, Monitor, Music,
  Volume2, Zap,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MODULE_COLORS } from '@/lib/constants';
import {
  STATUS_ERROR, ACCENT_EMERALD, STATUS_INFO, ACCENT_VIOLET, STATUS_WARNING,
} from '@/lib/chart-colors';

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

const CATEGORY_CONFIG: Record<EventCategory, {
  color: string;
  label: string;
  icon: typeof Swords;
  description: string;
}> = {
  combat: {
    color: STATUS_ERROR,
    label: 'Combat',
    icon: Swords,
    description: 'Hit impacts, death cries, dodge whooshes, ability casts',
  },
  environment: {
    color: ACCENT_EMERALD,
    label: 'Environment',
    icon: TreePine,
    description: 'Ambient loops, footsteps, doors, weather',
  },
  ui: {
    color: STATUS_INFO,
    label: 'UI',
    icon: Monitor,
    description: 'Button clicks, menu open/close, notifications',
  },
  music: {
    color: ACCENT_VIOLET,
    label: 'Music',
    icon: Music,
    description: 'Combat layers, exploration, boss themes',
  },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { color: string; label: string; weight: number }> = {
  low: { color: 'var(--text-muted)', label: 'Low', weight: 0 },
  normal: { color: STATUS_INFO, label: 'Normal', weight: 1 },
  high: { color: STATUS_WARNING, label: 'High', weight: 2 },
  critical: { color: STATUS_ERROR, label: 'Critical', weight: 3 },
};

const CATEGORIES: EventCategory[] = ['combat', 'environment', 'ui', 'music'];

const DEFAULT_EVENTS: AudioEvent[] = [
  // Combat
  { id: 'evt-1', name: 'Melee Hit', category: 'combat', trigger: 'OnMeleeHitConfirm', priority: 'high', spatial: '3d', concurrency: 4, cooldownMs: 50, tags: ['impact'] },
  { id: 'evt-2', name: 'Player Death', category: 'combat', trigger: 'OnCharacterDeath', priority: 'critical', spatial: '3d', concurrency: 1, cooldownMs: 0, tags: ['death', 'voice'] },
  { id: 'evt-3', name: 'Dodge Roll', category: 'combat', trigger: 'OnDodgeExecute', priority: 'normal', spatial: '3d', concurrency: 1, cooldownMs: 200, tags: ['movement'] },
  { id: 'evt-4', name: 'Ability Cast', category: 'combat', trigger: 'OnAbilityActivated', priority: 'high', spatial: '3d', concurrency: 2, cooldownMs: 100, tags: ['ability', 'magic'] },
  // Environment
  { id: 'evt-5', name: 'Footstep', category: 'environment', trigger: 'OnFootstepNotify', priority: 'low', spatial: '3d', concurrency: 2, cooldownMs: 100, tags: ['movement', 'surface'] },
  { id: 'evt-6', name: 'Door Open', category: 'environment', trigger: 'OnInteractDoor', priority: 'normal', spatial: '3d', concurrency: 1, cooldownMs: 500, tags: ['interact'] },
  { id: 'evt-7', name: 'Ambient Loop', category: 'environment', trigger: 'OnZoneEnter', priority: 'low', spatial: '3d', concurrency: 3, cooldownMs: 0, tags: ['ambient', 'loop'] },
  // UI
  { id: 'evt-8', name: 'Button Click', category: 'ui', trigger: 'OnUIButtonPressed', priority: 'normal', spatial: '2d', concurrency: 1, cooldownMs: 50, tags: ['click'] },
  { id: 'evt-9', name: 'Menu Open', category: 'ui', trigger: 'OnMenuOpened', priority: 'normal', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['menu'] },
  { id: 'evt-10', name: 'Notification', category: 'ui', trigger: 'OnNotificationReceived', priority: 'high', spatial: '2d', concurrency: 2, cooldownMs: 300, tags: ['alert'] },
  // Music
  { id: 'evt-11', name: 'Combat Layer', category: 'music', trigger: 'OnCombatStateChange', priority: 'high', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['layer', 'combat'] },
  { id: 'evt-12', name: 'Exploration Layer', category: 'music', trigger: 'OnExplorationStart', priority: 'normal', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['layer', 'explore'] },
  { id: 'evt-13', name: 'Boss Theme', category: 'music', trigger: 'OnBossEncounterStart', priority: 'critical', spatial: '2d', concurrency: 1, cooldownMs: 0, tags: ['boss', 'layer'] },
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
    <div className="p-6 space-y-6 overflow-y-auto bg-[#03030a] rounded-2xl border border-blue-900/30 shadow-[inset_0_0_80px_rgba(59,130,246,0.05)] relative w-full h-full">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header & Stats */}
        <div className="flex items-start justify-between border-b border-blue-900/40 pb-4">
          <div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-blue-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              Acoustic Event Matrix
            </h3>
            <p className="text-[10px] text-blue-400/60 uppercase tracking-widest mt-1">
              SYSTEM_AUDIO_TRIGGERS_AND_ROUTING
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-blue-400/80">
            <span className="flex items-center gap-1.5 bg-blue-900/20 px-2.5 py-1.5 rounded-lg border border-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]">
              TOTAL_NODES: <span className="text-blue-200 font-bold">{stats.total}</span>
            </span>
            <span className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)] text-emerald-400">
              <Volume2 className="w-3.5 h-3.5" />
              3D_SPATIAL: {stats.spatial3d}
            </span>
            <span className="flex items-center gap-1.5 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.05)]">
              2D_STEREO: {stats.spatial2d}
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap bg-black/40 p-1.5 rounded-xl border border-blue-900/30 backdrop-blur-md shadow-lg">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${filterCategory === 'all'
                ? 'bg-blue-500/20 text-blue-200 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'text-blue-500/50 hover:text-blue-300 border border-transparent hover:bg-blue-900/30'
              }`}
          >
            GLOBAL_VIEW ({stats.total})
          </button>
          <div className="w-px h-6 bg-blue-900/40 mx-2" />
          {CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            const active = filterCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${active ? '' : 'border-transparent text-blue-500/50 hover:bg-blue-900/20 hover:text-blue-300'
                  }`}
                style={
                  active ? {
                    color: cfg.color,
                    borderColor: `${cfg.color}40`,
                    backgroundColor: `${cfg.color}15`,
                    boxShadow: `0 0 15px ${cfg.color}20`,
                  } : {}
                }
              >
                <Icon className="w-3.5 h-3.5" style={active ? {} : { color: 'currentColor' }} />
                {cfg.label} ({stats.byCat[cat]})
              </button>
            );
          })}
        </div>

        {/* Category groups */}
        <div className="space-y-6">
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
        <AnimatePresence>
          {editingEvent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-6 border-t border-blue-900/40 pt-6"
            >
              <EventEditor
                event={editingEvent}
                onUpdate={(patch) => updateEvent(editingEvent.id, patch)}
                onClose={() => setEditingEventId(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate */}
        <div className="pt-6">
          <button
            onClick={() => onGenerate(config)}
            disabled={isGenerating || events.length === 0}
            className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 group outline-none"
            style={{
              backgroundColor: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.5)',
              boxShadow: '0 0 20px rgba(59,130,246,0.2), inset 0 0 10px rgba(59,130,246,0.1)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
            <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                COMPILING_AUDIO_MANAGEMENT_SYSTEM...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                BUILD_AUDIO_MANAGER_NODE
              </>
            )}
          </button>
        </div>
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
    <div className="bg-black/20 rounded-xl border border-blue-900/20 p-4 shadow-inner">
      {/* Category header */}
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${cfg.color}30` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" style={{ backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.label}_ROUTING_GROUP
          </h4>
          <p className="text-[9px] font-mono text-blue-400/50 uppercase tracking-widest mt-0.5">{cfg.description}</p>
        </div>
        <button
          onClick={onAdd}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5 border border-transparent hover:border-white/10"
          style={{ color: cfg.color }}
        >
          <Plus className="w-3.5 h-3.5" />
          ATTACH_NODE
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-[10px] font-mono uppercase tracking-widest text-blue-500/40 bg-black/40 rounded-xl border border-dashed border-blue-900/30">
          NULL_ROUTING_NODES_FOUND
        </div>
      ) : (
        <div className="grid gap-2">
          {events.map((evt) => {
            const priCfg = PRIORITY_CONFIG[evt.priority];
            const isEditing = editingEventId === evt.id;
            return (
              <div
                key={evt.id}
                onClick={() => onSelect(evt.id)}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden"
                style={{
                  borderColor: isEditing ? `${cfg.color}60` : `${cfg.color}20`,
                  backgroundColor: isEditing ? `${cfg.color}15` : 'rgba(0,0,0,0.5)',
                  boxShadow: isEditing ? `0 0 20px ${cfg.color}15, inset 0 0 10px ${cfg.color}10` : 'none',
                }}
              >
                {isEditing && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: cfg.color, color: cfg.color }} />
                )}

                {/* Priority dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: priCfg.color, color: priCfg.color }}
                  title={`Priority: ${priCfg.label}`}
                />

                {/* Name */}
                <span className="text-xs font-bold text-white tracking-wide min-w-[120px]">
                  {evt.name}
                </span>

                {/* Trigger */}
                <span className="text-[10px] text-blue-300/60 font-mono flex-1 truncate uppercase tracking-widest bg-blue-900/20 px-2 py-1 rounded border border-blue-900/30">
                  {evt.trigger}
                </span>

                {/* Spatial badge */}
                <span
                  className="text-[9px] font-bold uppercase px-2 py-1 rounded shadow-inner"
                  style={{
                    color: evt.spatial === '3d' ? ACCENT_EMERALD : STATUS_INFO,
                    backgroundColor: evt.spatial === '3d' ? `${ACCENT_EMERALD}15` : `${STATUS_INFO}15`,
                    border: `1px solid ${evt.spatial === '3d' ? `${ACCENT_EMERALD}40` : `${STATUS_INFO}40`}`,
                  }}
                >
                  {evt.spatial}
                </span>

                {/* Concurrency */}
                <span className="text-[10px] font-mono text-blue-400/50 w-12 text-right uppercase tracking-widest border-r border-blue-900/30 pr-4">
                  ×{evt.concurrency} MAX
                </span>

                {/* Tags */}
                <div className="flex items-center gap-1.5 min-w-[100px]">
                  {evt.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border"
                      style={{
                        color: `${cfg.color}`,
                        borderColor: `${cfg.color}40`,
                        backgroundColor: `${cfg.color}10`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                  {evt.tags.length > 2 && (
                    <span className="text-[9px] text-blue-500/60 font-bold uppercase">+{evt.tags.length - 2} MORE</span>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(evt.id); }}
                  className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 w-8 h-8 rounded-lg flex items-center justify-center text-red-500/50 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all flex-shrink-0"
                >
                  <X className="w-4 h-4" />
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
    <div className="bg-black/60 border border-blue-900/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.1)_inset] relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20 blur-[80px] pointer-events-none" style={{ backgroundColor: cfg.color }} />

      <div className="flex items-center justify-between mb-6 relative z-10 border-b border-blue-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${cfg.color}20`, border: `1px solid ${cfg.color}50` }}>
            <Zap className="w-5 h-5" style={{ color: cfg.color }} />
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-white">Modify Routing Node</span>
            <p className="text-[9px] font-mono text-blue-400/60 uppercase tracking-widest mt-0.5">ID: {event.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500/60 hover:text-white hover:bg-blue-500/20 border border-transparent hover:border-blue-500/40 transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5 relative z-10">
        {/* Name */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Node Designation</label>
          <input
            type="text"
            value={event.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-4 py-2.5 bg-black/40 border border-blue-900/60 rounded-xl text-[11px] text-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all shadow-inner"
          />
        </div>

        {/* Trigger */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Execution Trigger</label>
          <input
            type="text"
            value={event.trigger}
            onChange={(e) => onUpdate({ trigger: e.target.value })}
            placeholder="OnGameEvent..."
            className="w-full px-4 py-2.5 bg-black/40 border border-blue-900/60 rounded-xl text-[11px] text-blue-200 font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all shadow-inner uppercase tracking-wider"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Subsystem Route</label>
          <div className="relative">
            <select
              value={event.category}
              onChange={(e) => onUpdate({ category: e.target.value as EventCategory })}
              className="w-full px-4 py-2.5 bg-black/40 border border-blue-900/60 rounded-xl text-[11px] font-bold text-white uppercase tracking-widest outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 appearance-none transition-all shadow-inner"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-gray-900">{CATEGORY_CONFIG[c].label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-blue-500/80 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Interrupt Priority</label>
          <div className="flex gap-2">
            {(['low', 'normal', 'high', 'critical'] as PriorityLevel[]).map((p) => {
              const pCfg = PRIORITY_CONFIG[p];
              const active = event.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => onUpdate({ priority: p })}
                  className="flex-1 py-2.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all border"
                  style={{
                    color: active ? pCfg.color : 'rgba(96,165,250,0.5)',
                    borderColor: active ? `${pCfg.color}50` : 'rgba(30,58,138,0.4)',
                    backgroundColor: active ? `${pCfg.color}15` : 'rgba(0,0,0,0.4)',
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
          <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Acoustic Projection</label>
          <div className="flex gap-2">
            {(['3d', '2d'] as SpatialMode[]).map((mode) => {
              const active = event.spatial === mode;
              const modeColor = mode === '3d' ? ACCENT_EMERALD : STATUS_INFO;
              return (
                <button
                  key={mode}
                  onClick={() => onUpdate({ spatial: mode })}
                  className="flex-1 py-2.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all border"
                  style={{
                    color: active ? modeColor : 'rgba(96,165,250,0.5)',
                    borderColor: active ? `${modeColor}50` : 'rgba(30,58,138,0.4)',
                    backgroundColor: active ? `${modeColor}15` : 'rgba(0,0,0,0.4)',
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
            <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Max Instantiations</label>
            <input
              type="number"
              value={event.concurrency}
              onChange={(e) => onUpdate({ concurrency: Math.max(1, Math.min(16, Number(e.target.value) || 1)) })}
              min={1} max={16}
              className="w-full px-4 py-2.5 bg-black/40 border border-blue-900/60 rounded-xl text-[11px] text-blue-200 font-mono text-center outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all shadow-inner"
            />
          </div>

          <div className="space-y-2 flex-1">
            <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Reset Latency (ms)</label>
            <input
              type="number"
              value={event.cooldownMs}
              onChange={(e) => onUpdate({ cooldownMs: Math.max(0, Number(e.target.value) || 0) })}
              min={0}
              className="w-full px-4 py-2.5 bg-black/40 border border-blue-900/60 rounded-xl text-[11px] text-blue-200 font-mono text-center outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-6 pt-5 border-t border-blue-900/40 relative z-10 space-y-3">
        <label className="text-[10px] uppercase tracking-widest text-blue-400 font-bold flex items-center gap-2">
          Metadata Tokens <span className="bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/20">{event.tags.length}</span>
        </label>

        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all hover:brightness-125"
                style={{
                  color: `${cfg.color}e0`,
                  borderColor: `${cfg.color}40`,
                  backgroundColor: `${cfg.color}15`,
                  boxShadow: `inset 0 0 8px ${cfg.color}10`,
                }}
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-white transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTag(); }}
            placeholder="ADD_TOKEN..."
            className="flex-1 px-4 py-2 bg-black/40 border border-blue-900/60 rounded-xl text-[11px] uppercase tracking-widest text-blue-200 placeholder-blue-500/40 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all shadow-inner"
          />
          <button
            onClick={addTag}
            disabled={!newTag.trim()}
            className="px-4 py-2 pl-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
            style={{
              backgroundColor: `${cfg.color}15`,
              color: cfg.color,
              border: `1px solid ${cfg.color}40`,
            }}
          >
            <Plus className="w-4 h-4" />
            APPEND
          </button>
        </div>
      </div>
    </div>
  );
}
