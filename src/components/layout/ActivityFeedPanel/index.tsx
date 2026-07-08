'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  X,
  CheckCircle2,
  Inbox,
  Bell,
} from 'lucide-react';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { useModuleActions } from '@/hooks/useModuleActions';
import { useViewportAtLeast } from '@/hooks/useViewportWidth';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import type { ActivityEvent } from '@/stores/activityFeedStore';
import type { SubModuleId } from '@/types/modules';
import { STATUS_SUCCESS, MODULE_COLORS } from '@/lib/chart-colors';
import { PANEL_WIDTH, OVERLAY_BREAKPOINT } from './constants';
import { buildSections } from './helpers';
import { CollapsedGroup } from './CollapsedGroup';
import { EventCard } from './EventCard';

// ── Component ──

export function ActivityFeedPanel() {
  const events = useActivityFeedStore((s) => s.events);
  const isOpen = useActivityFeedStore((s) => s.isOpen);
  const setOpen = useActivityFeedStore((s) => s.setOpen);
  const dismissEvent = useActivityFeedStore((s) => s.dismissEvent);
  const dismissAll = useActivityFeedStore((s) => s.dismissAll);
  const { sendPromptToModule } = useModuleActions();

  const prefersReduced = useReducedMotion();
  // Wide → inline column that smoothly pushes ModuleRenderer; narrow → overlay drawer.
  // Only the breakpoint boolean matters, so subscribe to the threshold rather than
  // the raw width — a resize that stays on one side of OVERLAY_BREAKPOINT is a no-op.
  const overlay = !useViewportAtLeast(OVERLAY_BREAKPOINT);

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
