'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { useModuleActions } from '@/hooks/useModuleActions';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { formatTimeAgo } from '@/lib/format-time';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import type { ActivityEvent, ActivityEventType } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_BLOCKER, MODULE_COLORS, OPACITY_12 } from '@/lib/chart-colors';

// ── Layout constants ──

/** Fixed width of the feed (px) — inline column when wide, drawer when narrow. */
const PANEL_WIDTH = 320;
/**
 * At or below this viewport width the feed promotes from a layout-shifting inline
 * column to an overlay drawer, so narrow screens aren't crushed by the 320px rail.
 * Mirrors the `/layout` shell's collapse breakpoint.
 */
const OVERLAY_BREAKPOINT = 1100;

// ── Event type config ──

const EVENT_CONFIG: Record<ActivityEventType, { icon: typeof CheckCircle2; color: string; label: string }> = {
  'cli-complete': { icon: CheckCircle2, color: STATUS_SUCCESS, label: 'Task Complete' },
  'cli-error': { icon: XCircle, color: STATUS_ERROR, label: 'Task Failed' },
  'quality-change': { icon: TrendingUp, color: STATUS_WARNING, label: 'Quality' },
  'build-result': { icon: Hammer, color: MODULE_COLORS.core, label: 'Build' },
  'evaluator-recommendation': { icon: AlertTriangle, color: MODULE_COLORS.evaluator, label: 'Recommendation' },
  'checklist-progress': { icon: CheckSquare, color: STATUS_SUCCESS, label: 'Progress' },
};

// ── Time grouping ──

type TimePeriod = 'Today' | 'Yesterday' | 'Earlier this week' | 'Older';

function getTimePeriod(ts: number): TimePeriod {
  const now = new Date();
  const date = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - (now.getDay() * 86_400_000);

  if (ts >= todayStart) return 'Today';
  if (ts >= yesterdayStart) return 'Yesterday';
  if (ts >= weekStart) return 'Earlier this week';
  return 'Older';
}

interface EventGroup {
  type: ActivityEventType;
  moduleId: SubModuleId | undefined;
  events: ActivityEvent[];
}

/** Group consecutive events of the same type+module within a time period */
function groupConsecutive(events: ActivityEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.type === event.type && last.moduleId === event.moduleId) {
      last.events.push(event);
    } else {
      groups.push({ type: event.type, moduleId: event.moduleId as SubModuleId | undefined, events: [event] });
    }
  }
  return groups;
}

interface TimePeriodSection {
  period: TimePeriod;
  groups: EventGroup[];
}

function buildSections(events: ActivityEvent[]): TimePeriodSection[] {
  const periodOrder: TimePeriod[] = ['Today', 'Yesterday', 'Earlier this week', 'Older'];
  const buckets = new Map<TimePeriod, ActivityEvent[]>();
  for (const p of periodOrder) buckets.set(p, []);
  for (const e of events) {
    buckets.get(getTimePeriod(e.timestamp))!.push(e);
  }

  const sections: TimePeriodSection[] = [];
  for (const period of periodOrder) {
    const periodEvents = buckets.get(period)!;
    if (periodEvents.length === 0) continue;
    sections.push({ period, groups: groupConsecutive(periodEvents) });
  }
  return sections;
}

// ── Component ──

export function ActivityFeedPanel() {
  const events = useActivityFeedStore((s) => s.events);
  const isOpen = useActivityFeedStore((s) => s.isOpen);
  const setOpen = useActivityFeedStore((s) => s.setOpen);
  const dismissEvent = useActivityFeedStore((s) => s.dismissEvent);
  const dismissAll = useActivityFeedStore((s) => s.dismissAll);
  const { sendPromptToModule } = useModuleActions();

  const prefersReduced = useReducedMotion();
  const viewportWidth = useViewportWidth();
  // Wide → inline column that smoothly pushes ModuleRenderer; narrow → overlay drawer.
  const overlay = viewportWidth < OVERLAY_BREAKPOINT;

  // Refresh relative timestamps every 60s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // In overlay mode, Escape dismisses the drawer (parity with the search palette / lab drawers).
  useEffect(() => {
    if (!isOpen || !overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, overlay, setOpen]);

  const unreadCount = useMemo(() => events.filter((e) => !e.dismissed).length, [events]);
  const sections = useMemo(() => buildSections(events), [events]);

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

  // Header + scrollable list + footer — shared by the inline-column and overlay-drawer shells.
  const body = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" style={{ color: MODULE_COLORS.evaluator }} />
          <h2 className="text-xs font-semibold text-text uppercase tracking-wider">Activity</h2>
          {unreadCount > 0 && (
            <span className="text-2xs font-bold bg-status-red-subtle px-1.5 py-0.5 rounded-full" style={{ color: MODULE_COLORS.evaluator }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={dismissAll}
              className="text-2xs text-text-muted hover:text-text px-2 py-1 rounded transition-colors hover:bg-border focus-ring"
            >
              Read all
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-border transition-colors focus-ring"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4">
              <Inbox className="w-6 h-6 text-border-bright" />
            </div>
            <h3 className="text-sm font-semibold text-text mb-1">No Activity Yet</h3>
            <p className="text-xs text-text-muted text-center max-w-[220px] leading-relaxed">
              CLI task results, build outcomes, quality changes, and evaluator recommendations will appear here as you work.
            </p>
          </div>
        ) : (
          <StaggerContainer className="p-2 space-y-0.5">
            {sections.map((section) => (
              <div key={section.period}>
                {/* Sticky time separator */}
                <div className="sticky top-0 z-10 bg-surface-deep/95 backdrop-blur-sm px-2 py-1.5 -mx-2">
                  <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                    {section.period}
                  </span>
                </div>

                {/* Event groups */}
                {section.groups.map((group, gi) =>
                  group.events.length > 1 ? (
                    <StaggerItem key={`${section.period}-g${gi}`}>
                      <CollapsedGroup
                        group={group}
                        onDismiss={handleDismiss}
                        onAct={handleAct}
                      />
                    </StaggerItem>
                  ) : (
                    <StaggerItem key={group.events[0].id}>
                      <EventCard
                        event={group.events[0]}
                        onDismiss={handleDismiss}
                        onAct={handleAct}
                      />
                    </StaggerItem>
                  ),
                )}
              </div>
            ))}
          </StaggerContainer>
        )}
      </div>

      {/* Footer — inbox zero */}
      {events.length > 0 && unreadCount === 0 && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
            <span className="text-xs font-medium" style={{ color: STATUS_SUCCESS }}>All caught up</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <AnimatePresence>
      {isOpen && (overlay ? (
        // ── Narrow: overlay drawer over a dimmed backdrop (no layout shift) ──
        <motion.div
          key="activity-feed-overlay"
          data-testid="activity-feed-backdrop"
          className="fixed inset-0 z-[90] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReduced ? 0 : DURATION.fast }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Activity feed"
            className="absolute top-0 right-0 h-full w-80 max-w-[85vw] flex flex-col border-l border-border bg-surface-deep shadow-2xl"
            style={{ ['--focus-accent' as string]: 'var(--setup)' }}
            onClick={(e) => e.stopPropagation()}
            initial={prefersReduced ? { opacity: 0 } : { x: '100%' }}
            animate={prefersReduced ? { opacity: 1 } : { x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { x: '100%' }}
            transition={prefersReduced ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }}
          >
            {body}
          </motion.aside>
        </motion.div>
      ) : (
        // ── Wide: inline column whose width animates 0 → 320px, gently reflowing the canvas ──
        <motion.aside
          key="activity-feed-column"
          aria-label="Activity feed"
          initial={prefersReduced ? { opacity: 1, width: PANEL_WIDTH } : { width: 0, opacity: 0 }}
          animate={{ width: PANEL_WIDTH, opacity: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { width: 0, opacity: 0 }}
          transition={prefersReduced ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }}
          className="h-full flex-shrink-0 overflow-hidden"
          style={{ ['--focus-accent' as string]: 'var(--setup)' }}
        >
          {/* Fixed-width inner shell so content doesn't reflow while the column grows. */}
          <div style={{ width: PANEL_WIDTH }} className="flex flex-col h-full border-l border-border bg-surface-deep">
            {body}
          </div>
        </motion.aside>
      ))}
    </AnimatePresence>
  );
}

// ── Collapsed Group ──

function CollapsedGroup({
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

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return STATUS_ERROR;
    case 'high': return STATUS_BLOCKER;
    case 'medium': return STATUS_WARNING;
    default: return 'var(--text-muted)';
  }
}
