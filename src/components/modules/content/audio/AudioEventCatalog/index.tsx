'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Loader2,
  Volume2, Zap,
} from 'lucide-react';
import {
  ACCENT_EMERALD,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_30, OPACITY_50,
} from '@/lib/chart-colors';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';
import type {
  EventCategory, AudioEvent, AudioEventCatalogConfig,
} from './types';
import {
  ACCENT, CATEGORY_CONFIG, CATEGORIES, DEFAULT_EVENTS,
} from './constants';
import { CategoryGroup } from './CategoryGroup';
import { EventEditor } from './EventEditor';

export type {
  EventCategory, SpatialMode, PriorityLevel, AudioEvent, AudioEventCatalogConfig,
} from './types';

// -- Props --

interface AudioEventCatalogProps {
  /** Active audio scene id — the catalog is scoped per scene. */
  sceneId: string;
  onGenerate: (config: AudioEventCatalogConfig) => void;
  isGenerating: boolean;
}

// -- Component --

export function AudioEventCatalog({ sceneId, onGenerate, isGenerating }: AudioEventCatalogProps) {
  // Seed from the persisted, per-scene store. AudioView mounts tab panels
  // conditionally (local-only state was wiped on every Painter ↔ Catalog tab
  // switch) and remounts this component per scene (keyed on sceneId), so each
  // scene owns an independent catalog that also survives reloads.
  const [events, setEvents] = useState<AudioEvent[]>(
    () => useAudioEventCatalogStore.getState().getEvents(sceneId) ?? structuredClone(DEFAULT_EVENTS),
  );
  const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Write-through: every edit lands in this scene's slot in the persisted store
  // immediately, so unmount (tab switch) and reload both keep the curated
  // catalog — without leaking into any other scene's catalog.
  useEffect(() => {
    useAudioEventCatalogStore.getState().setEvents(sceneId, events);
  }, [sceneId, events]);

  // -- Derived --

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

  // -- CRUD --

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
    <div className="p-6 space-y-6 overflow-y-auto bg-surface-deep rounded-2xl border border-border relative w-full h-full">
      <div className="relative z-10 space-y-6">
        {/* Header & Stats */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-semibold text-text flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: ACCENT }} />
              Audio Events
            </h3>
            <p className="text-sm text-text-muted mt-1">
              Define triggers, routing, and playback rules
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span className="flex items-center gap-1.5 bg-surface px-2.5 py-1.5 rounded-lg border border-border">
              Total <span className="text-text font-semibold">{stats.total}</span>
            </span>
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
              style={{ color: ACCENT_EMERALD, backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_10), borderColor: withOpacity(ACCENT_EMERALD, OPACITY_20) }}
            >
              <Volume2 className="w-3.5 h-3.5" />
              3D sound <span className="font-semibold">{stats.spatial3d}</span>
            </span>
            <span
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
              style={{ color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_10), borderColor: withOpacity(ACCENT, OPACITY_20) }}
            >
              2D sound <span className="font-semibold">{stats.spatial2d}</span>
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap bg-surface p-1.5 rounded-xl border border-border backdrop-blur-md">
          <button
            onClick={() => setFilterCategory('all')}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all border"
            style={filterCategory === 'all'
              ? { color: ACCENT, backgroundColor: withOpacity(ACCENT, OPACITY_20), borderColor: withOpacity(ACCENT, OPACITY_50) }
              : { borderColor: 'transparent' }}
          >
            <span className={filterCategory === 'all' ? '' : 'text-text-muted'}>All ({stats.total})</span>
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          {CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            const active = filterCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${active ? '' : 'border-transparent text-text-muted hover:bg-surface-hover hover:text-text'
                  }`}
                style={
                  active ? {
                    color: cfg.color,
                    borderColor: withOpacity(cfg.color, OPACITY_30),
                    backgroundColor: withOpacity(cfg.color, OPACITY_10),
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
              className="mt-6 border-t border-border pt-6"
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
            className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 group outline-none"
            style={{
              backgroundColor: withOpacity(ACCENT, OPACITY_10),
              color: ACCENT,
              border: `1px solid ${withOpacity(ACCENT, OPACITY_50)}`,
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
            <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Audio Manager...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                Generate Audio Manager
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
