import { X, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { formatTimeAgo } from '@/lib/format-time';
import type { ActivityEvent } from '@/stores/activityFeedStore';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { STATUS_SUCCESS, STATUS_ERROR, OPACITY_12 } from '@/lib/chart-colors';
import { EVENT_CONFIG } from './constants';
import { priorityColor } from './helpers';

export function EventCard({
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
      ? STATUS_SUCCESS
      : STATUS_ERROR
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
            <TruncateWithTooltip className="text-xs font-semibold text-text truncate block" side="bottom">
              {event.title}
            </TruncateWithTooltip>
            {event.meta?.success !== undefined && (
              <span
                className="text-2xs font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                style={{
                  color: event.meta.success ? STATUS_SUCCESS : STATUS_ERROR,
                  backgroundColor: event.meta.success ? STATUS_SUCCESS + OPACITY_12 : STATUS_ERROR + OPACITY_12,
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
            <span className="text-2xs text-text-muted">{formatTimeAgo(event.timestamp)}</span>
            {event.moduleId && (
              <span className="text-2xs text-text-muted">{event.moduleId}</span>
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
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-medium opacity-30 group-hover:opacity-100 focus-visible:opacity-100 text-accent-setup hover:bg-accent-subtle transition-all scale-95 group-hover:scale-100 focus-visible:scale-100 focus-ring"
              title="Fix with Claude"
            >
              <Zap className="w-2.5 h-2.5" />
              Fix
            </button>
          )}
          {isUnread && (
            <button
              onClick={(e) => onDismiss(event.id, e)}
              className="flex-shrink-0 p-0.5 rounded opacity-30 group-hover:opacity-100 focus-visible:opacity-100 text-text-muted hover:text-text hover:bg-border transition-all scale-95 group-hover:scale-100 focus-visible:scale-100 focus-ring"
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
