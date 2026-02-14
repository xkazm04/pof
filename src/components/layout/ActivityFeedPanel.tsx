'use client';

import { useMemo, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Hammer,
  AlertTriangle,
  Zap,
  CheckSquare,
  Inbox,
  Bell,
} from 'lucide-react';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { useModuleActions } from '@/hooks/useModuleActions';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import type { ActivityEvent, ActivityEventType } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';

// ── Event type config ──

const EVENT_CONFIG: Record<ActivityEventType, { icon: typeof CheckCircle2; color: string; label: string }> = {
  'cli-complete': { icon: CheckCircle2, color: '#4ade80', label: 'Task Complete' },
  'cli-error': { icon: XCircle, color: '#f87171', label: 'Task Failed' },
  'quality-change': { icon: TrendingUp, color: '#fbbf24', label: 'Quality' },
  'build-result': { icon: Hammer, color: '#3b82f6', label: 'Build' },
  'evaluator-recommendation': { icon: AlertTriangle, color: '#ef4444', label: 'Recommendation' },
  'checklist-progress': { icon: CheckSquare, color: '#22c55e', label: 'Progress' },
};

// ── Time formatting ──

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ──

export function ActivityFeedPanel() {
  const events = useActivityFeedStore((s) => s.events);
  const isOpen = useActivityFeedStore((s) => s.isOpen);
  const setOpen = useActivityFeedStore((s) => s.setOpen);
  const dismissEvent = useActivityFeedStore((s) => s.dismissEvent);
  const dismissAll = useActivityFeedStore((s) => s.dismissAll);
  const { sendPromptToModule } = useModuleActions();

  const unreadCount = useMemo(() => events.filter((e) => !e.dismissed).length, [events]);

  const handleDismiss = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      dismissEvent(id);
    },
    [dismissEvent],
  );

  const handleAct = useCallback(
    (event: ActivityEvent) => {
      if (!event.moduleId || !event.meta?.prompt) return;
      sendPromptToModule(event.moduleId as SubModuleId, event.meta.prompt);
      dismissEvent(event.id);
    },
    [sendPromptToModule, dismissEvent],
  );

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-border bg-surface-deep flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-[#ef4444]" />
          <h2 className="text-xs font-semibold text-text uppercase tracking-wider">Activity</h2>
          {unreadCount > 0 && (
            <span className="text-2xs font-bold text-[#ef4444] bg-[#ef444418] px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={dismissAll}
              className="text-2xs text-text-muted hover:text-text px-2 py-1 rounded transition-colors hover:bg-border"
            >
              Read all
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <Inbox className="w-8 h-8 text-border-bright mb-3" />
            <p className="text-xs text-text-muted text-center">
              No activity yet. Events from CLI tasks, builds, and evaluator scans will appear here.
            </p>
          </div>
        ) : (
          <StaggerContainer className="p-2 space-y-0.5">
            {events.map((event) => (
              <StaggerItem key={event.id}>
                <EventCard
                  event={event}
                  onDismiss={handleDismiss}
                  onAct={handleAct}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>

      {/* Footer — inbox zero */}
      {events.length > 0 && unreadCount === 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ade80]" />
            <span className="text-xs text-[#4ade80] font-medium">All caught up</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Event Card ──

function EventCard({
  event,
  onDismiss,
  onAct,
}: {
  event: ActivityEvent;
  onDismiss: (id: string, e: React.MouseEvent) => void;
  onAct: (event: ActivityEvent) => void;
}) {
  const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG['cli-complete'];
  const Icon = config.icon;
  const isUnread = !event.dismissed;

  // For quality changes, pick trending icon
  const TrendIcon = event.meta?.prevScore != null && event.meta?.score != null
    ? event.meta.score > event.meta.prevScore
      ? TrendingUp
      : TrendingDown
    : null;

  const trendColor = event.meta?.prevScore != null && event.meta?.score != null
    ? event.meta.score > event.meta.prevScore
      ? '#4ade80'
      : '#f87171'
    : undefined;

  return (
    <div
      className={`relative group rounded-lg px-3 py-2.5 transition-all ${
        isUnread
          ? 'bg-surface border border-border'
          : 'border border-transparent opacity-60 hover:opacity-80'
      }`}
    >
      {/* Unread indicator */}
      {isUnread && (
        <span
          className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
          style={{ backgroundColor: config.color }}
        />
      )}

      <div className="flex items-start gap-2.5 ml-1.5">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {TrendIcon ? (
            <TrendIcon className="w-3.5 h-3.5" style={{ color: trendColor }} />
          ) : (
            <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text truncate">
              {event.title}
            </span>
            {event.meta?.success !== undefined && (
              <span
                className="text-2xs font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                style={{
                  color: event.meta.success ? '#4ade80' : '#f87171',
                  backgroundColor: event.meta.success ? '#4ade8012' : '#f8717112',
                }}
              >
                {event.meta.success ? 'Success' : 'Failed'}
              </span>
            )}
            {event.meta?.priority && (
              <span
                className="text-2xs font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                style={{
                  color: priorityColor(event.meta.priority),
                  backgroundColor: `${priorityColor(event.meta.priority)}12`,
                }}
              >
                {event.meta.priority}
              </span>
            )}
          </div>

          <p className="text-2xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
            {event.description}
          </p>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xs text-[#4a4e6a]">{timeAgo(event.timestamp)}</span>
            {event.moduleId && (
              <span className="text-2xs text-[#4a4e6a]">{event.moduleId}</span>
            )}
            {event.meta?.score != null && (
              <span className="text-2xs font-medium" style={{ color: trendColor ?? 'var(--text-muted)' }}>
                {event.meta.prevScore != null ? `${event.meta.prevScore} → ` : ''}
                {event.meta.score}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {event.moduleId && event.meta?.prompt && (
            <button
              onClick={(e) => { e.stopPropagation(); onAct(event); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium opacity-0 group-hover:opacity-100 text-[#00ff88] hover:bg-[#00ff8815] transition-all"
              title="Fix with Claude"
            >
              <Zap className="w-2.5 h-2.5" />
              Fix
            </button>
          )}
          {isUnread && (
            <button
              onClick={(e) => onDismiss(event.id, e)}
              className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-text-muted hover:text-text hover:bg-border transition-all"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return '#f87171';
    case 'high': return '#fb923c';
    case 'medium': return '#fbbf24';
    default: return 'var(--text-muted)';
  }
}
