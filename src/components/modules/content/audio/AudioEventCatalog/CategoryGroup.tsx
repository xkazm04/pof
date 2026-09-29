'use client';

import { Plus, X } from 'lucide-react';
import {
  ACCENT_EMERALD, STATUS_INFO,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_30, OPACITY_50,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { AudioEvent, EventCategory } from './types';
import { CATEGORY_CONFIG, PRIORITY_CONFIG } from './constants';
import { StatusTag } from '@/components/ui/StatusTag';
import type { EventSoundStatus } from '@/lib/audio-event-sound';

/** Each row's sound status, worded — never implied by colour alone. */
const SOUND_WORD: Record<EventSoundStatus, string> = {
  imported: 'sound imported',
  'not-imported': 'sound not imported',
  'set-missing': 'sound set missing',
  unbound: 'no sound',
  unknown: 'sound unknown',
};

function SoundChip({ status }: { status: EventSoundStatus }) {
  if (status === 'imported') return <StatusTag level="ok" word="imported" iconClassName="w-2.5 h-2.5" />;
  if (status === 'not-imported') return <StatusTag level="warn" word="not imported" iconClassName="w-2.5 h-2.5" />;
  if (status === 'set-missing') return <StatusTag level="bad" word="set missing" iconClassName="w-2.5 h-2.5" />;
  return <span className="text-xs text-text-muted whitespace-nowrap">{SOUND_WORD[status]}</span>;
}

// -- CategoryGroup --

export function CategoryGroup({
  category,
  events,
  editingEventId,
  onSelect,
  onDelete,
  onAdd,
  soundStatus,
}: {
  category: EventCategory;
  events: AudioEvent[];
  editingEventId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  /** eventId → its library-sound status (absent until the catalog computes it). */
  soundStatus?: Record<string, EventSoundStatus>;
}) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;

  return (
    <SurfaceCard className="p-4">
      {/* Category header */}
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `1px solid ${withOpacity(cfg.color, OPACITY_30)}` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" style={{ backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.color}30` }}>
          <Icon className="w-4 h-4" style={{ color: cfg.color }} aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-sm font-semibold" style={{ color: cfg.color }}>
            {cfg.label}
          </h4>
          <p className="text-sm text-text-muted mt-0.5">{cfg.description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add ${cfg.label} event`}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:bg-white/5 border border-transparent hover:border-white/10 focus-ring"
          style={{ color: cfg.color }}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          Add event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 px-4 bg-surface-deep rounded-xl border border-dashed border-border">
          <p className="text-sm text-text-muted">No {cfg.label} events yet</p>
          <p className="text-xs text-text-muted/80 mt-1">
            Use “Add event” to define a trigger the audio manager will listen for.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {events.map((evt) => {
            const priCfg = PRIORITY_CONFIG[evt.priority];
            const isEditing = editingEventId === evt.id;
            const sound = soundStatus?.[evt.id];
            return (
              <div
                key={evt.id}
                role="button"
                tabIndex={0}
                aria-pressed={isEditing}
                aria-label={`Edit ${evt.name} — ${priCfg.label} priority, ${evt.spatial === '3d' ? '3D' : '2D'} sound${sound ? `, ${SOUND_WORD[sound]}` : ''}`}
                onClick={() => onSelect(evt.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(evt.id);
                  }
                }}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-all cursor-pointer group relative overflow-hidden focus-ring text-left"
                style={{
                  borderColor: isEditing ? withOpacity(cfg.color, OPACITY_50) : withOpacity(cfg.color, OPACITY_20),
                  backgroundColor: isEditing ? withOpacity(cfg.color, OPACITY_10) : 'var(--surface-deep)',
                }}
              >
                {isEditing && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: cfg.color, color: cfg.color }} aria-hidden="true" />
                )}

                {/* Priority dot — colour alone can't carry the level, so the row's
                    aria-label names it and this stays decorative. */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: priCfg.color, color: priCfg.color }}
                  title={`Priority: ${priCfg.label}`}
                  aria-hidden="true"
                />

                {/* Name */}
                <span className="text-sm font-semibold text-text min-w-[120px]">
                  {evt.name}
                </span>

                {/* Trigger */}
                <span className="text-xs text-text-muted font-mono flex-1 truncate bg-surface px-2 py-1 rounded border border-border">
                  {evt.trigger}
                </span>

                {/* Spatial badge */}
                <span
                  className="text-xs font-semibold uppercase px-2 py-1 rounded shadow-inner"
                  style={{
                    color: evt.spatial === '3d' ? ACCENT_EMERALD : STATUS_INFO,
                    backgroundColor: evt.spatial === '3d' ? `${ACCENT_EMERALD}15` : `${STATUS_INFO}15`,
                    border: `1px solid ${evt.spatial === '3d' ? `${ACCENT_EMERALD}40` : `${STATUS_INFO}40`}`,
                  }}
                >
                  {evt.spatial}
                </span>

                {/* Concurrency */}
                <span
                  className="text-sm text-text-muted w-16 text-right border-r border-border pr-4"
                  title={`Max ${evt.concurrency} simultaneous instances`}
                >
                  Max {evt.concurrency}
                </span>

                {/* Tags */}
                <div className="flex items-center gap-1.5 min-w-[100px]">
                  {evt.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="text-xs font-semibold px-2 py-0.5 rounded border"
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
                    <span className="text-xs text-text-muted font-semibold">+{evt.tags.length - 2}</span>
                  )}
                </div>

                {/* Library sound status */}
                {sound && <SoundChip status={sound} />}

                {/* Delete — revealed on hover, and on keyboard focus so it is
                    reachable without a pointer. */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(evt.id); }}
                  aria-label={`Delete event ${evt.name}`}
                  title={`Delete event ${evt.name}`}
                  className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 focus-visible:opacity-100 focus-visible:translate-x-0 w-8 h-8 rounded-lg flex items-center justify-center text-red-500/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all flex-shrink-0 focus-ring"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SurfaceCard>
  );
}
