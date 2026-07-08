import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatTimeAgo } from '@/lib/format-time';
import type { ActivityEvent } from '@/stores/activityFeedStore';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { EVENT_CONFIG } from './constants';
import type { EventGroup } from './types';
import { EventCard } from './EventCard';

export function CollapsedGroup({
  group,
  onDismiss,
  onAct,
}: {
  group: EventGroup;
  onDismiss: (id: string, e: React.MouseEvent) => void;
  onAct: (event: ActivityEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[group.type] ?? EVENT_CONFIG['cli-complete'];
  const Icon = config.icon;
  const count = group.events.length;
  const moduleLabel = group.moduleId ?? '';

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover/30 transition-colors focus-ring-inset"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        }
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: config.color }} />
        <TruncateWithTooltip className="text-xs font-medium text-text truncate block" side="bottom">
          {count} {config.label.toLowerCase()} events{moduleLabel ? ` in ${moduleLabel}` : ''}
        </TruncateWithTooltip>
        <span className="text-2xs text-text-muted ml-auto flex-shrink-0">
          {formatTimeAgo(group.events[0].timestamp)}
        </span>
      </button>

      {/* Expanded events */}
      {expanded && (
        <div className="border-t border-border/40 space-y-0.5 px-1 py-0.5">
          {group.events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onDismiss={onDismiss}
              onAct={onAct}
            />
          ))}
        </div>
      )}
    </div>
  );
}
