'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Radio, Trash2, Filter, Zap } from 'lucide-react';
import { eventBus } from '@/lib/event-bus';
import type { BusEvent, EventChannel } from '@/types/event-bus';

const MAX_DISPLAY = 200;

const NAMESPACE_COLORS: Record<string, string> = {
  cli: '#3b82f6',
  eval: '#ef4444',
  build: '#f59e0b',
  checklist: '#22c55e',
  file: '#8b5cf6',
  nav: '#06b6d4',
};

function getNamespace(channel: string): string {
  return channel.split('.')[0];
}

function getColor(channel: string): string {
  return NAMESPACE_COLORS[getNamespace(channel)] ?? '#7d82a8';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function EventBusDevTools() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<BusEvent[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [paused, setPaused] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<BusEvent | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  // Toggle with Ctrl+Shift+E
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Subscribe to all events
  useEffect(() => {
    if (!open) return;

    // Hydrate from replay buffer
    setEvents(eventBus.getReplayBuffer().slice(-MAX_DISPLAY));

    return eventBus.onAny((event: BusEvent) => {
      if (pausedRef.current) return;
      setEvents((prev) => [...prev, event].slice(-MAX_DISPLAY));
    });
  }, [open]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current && !paused) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events, paused]);

  const handleClear = useCallback(() => {
    setEvents([]);
    setSelectedEvent(null);
  }, []);

  const filteredEvents = filter
    ? events.filter((e) => e.channel.includes(filter) || (e.source ?? '').includes(filter))
    : events;

  // Unique namespaces for filter chips
  const namespaces = Array.from(new Set(events.map((e) => getNamespace(e.channel))));

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed right-0 top-0 bottom-0 w-[420px] z-50 flex flex-col border-l border-border bg-surface-deep shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#00ff88]" />
            <h2 className="text-xs font-semibold text-text uppercase tracking-wider">Event Bus</h2>
            <span className="text-2xs text-text-muted font-mono bg-border px-1.5 py-0.5 rounded">
              {filteredEvents.length}
            </span>
            <span className="text-2xs text-text-muted">
              {eventBus.subscriberCount} subs
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaused((p) => !p)}
              className={`px-2 py-1 rounded text-2xs font-medium transition-colors ${
                paused
                  ? 'text-[#f59e0b] bg-[#f59e0b14] hover:bg-[#f59e0b24]'
                  : 'text-text-muted hover:text-text hover:bg-border'
              }`}
            >
              {paused ? 'Paused' : 'Pause'}
            </button>
            <button
              onClick={handleClear}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-border transition-colors"
              title="Clear"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-text-muted hover:text-text hover:bg-border transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-wrap">
          <Filter className="w-3 h-3 text-text-muted flex-shrink-0" />
          {namespaces.map((ns) => (
            <button
              key={ns}
              onClick={() => setFilter((f) => (f === ns ? '' : ns))}
              className={`px-2 py-0.5 rounded-full text-2xs font-medium transition-colors border ${
                filter === ns
                  ? 'border-current'
                  : 'border-transparent hover:border-border'
              }`}
              style={{ color: NAMESPACE_COLORS[ns] ?? '#7d82a8' }}
            >
              {ns}
            </button>
          ))}
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="text-2xs text-text-muted hover:text-text transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Event list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <Zap className="w-8 h-8 text-border-bright mb-3" />
              <p className="text-xs text-text-muted text-center">
                {events.length === 0
                  ? 'No events emitted yet. Events will appear as you interact with the app.'
                  : 'No events match the current filter.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                  className={`w-full text-left px-3 py-2 hover:bg-surface transition-colors ${
                    selectedEvent?.id === event.id ? 'bg-surface' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getColor(event.channel) }}
                    />
                    <span className="text-2xs font-mono font-medium text-text truncate">
                      {event.channel}
                    </span>
                    <span className="ml-auto text-2xs text-text-muted font-mono flex-shrink-0">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  {event.source && (
                    <span className="text-2xs text-text-muted ml-3.5 mt-0.5 block">
                      from {event.source}
                    </span>
                  )}
                  {/* Expanded payload */}
                  {selectedEvent?.id === event.id && (
                    <pre className="mt-2 ml-3.5 text-2xs text-text-muted bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer — stats */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="text-2xs text-text-muted">
            Channels: {eventBus.activeChannels.length}
          </span>
          <span className="text-2xs text-text-muted font-mono">
            Ctrl+Shift+E
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
