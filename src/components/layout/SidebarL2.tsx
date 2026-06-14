'use client';

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, ListOrdered } from 'lucide-react';
import { useNavigationStore } from '@/stores/navigationStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useCLIPanelStore, type CLISessionState } from '@/components/cli/store/cliPanelStore';
import { getSubModulesForCategory, SUB_MODULE_MAP, CATEGORY_MAP } from '@/lib/module-registry';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import type { SubModuleId } from '@/types/modules';
import { STATUS_ERROR, STATUS_INFO } from '@/lib/chart-colors';

const RING_SIZE = 16;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const SIDEBAR_MIN = 140;
const SIDEBAR_MAX = 260;
const SIDEBAR_DEFAULT = 180;
const STORAGE_KEY = 'pof-sidebar-l2-width';

// Magnetic snap points + keyboard tuning for the resize handle
const SNAP_POINTS: number[] = [140, 180, 220, 260];
const SNAP_THRESHOLD = 8;   // px proximity that pulls the drag onto a snap point
const SNAP_PULSE_MS = 120;  // border-bright "tick" duration when landing on a snap
const KEYBOARD_STEP = 10;       // ArrowLeft/Right
const KEYBOARD_STEP_SHIFT = 20; // Shift + ArrowLeft/Right

function getSavedWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWidth(category: string, width: number) {
  try {
    const widths = getSavedWidths();
    widths[category] = width;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch { /* noop */ }
}

function getWidthForCategory(category: string | null): number {
  if (!category) return SIDEBAR_DEFAULT;
  const widths = getSavedWidths();
  return widths[category] ?? SIDEBAR_DEFAULT;
}

export function SidebarL2() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const setActiveSubModule = useNavigationStore((s) => s.setActiveSubModule);

  const category = activeCategory ? CATEGORY_MAP[activeCategory] : null;
  const subModules = activeCategory ? getSubModulesForCategory(activeCategory) : [];
  const prefersReduced = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(() => getWidthForCategory(activeCategory));
  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  // Live readout pill: follows the cursor while dragging
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  // Snap "tick": brief border-bright pulse when landing on a snap point
  const [snapPulse, setSnapPulse] = useState(false);
  const lastSnapRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Portal guard — render the floating pill only after hydration (avoids SSR document access)
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Clear any pending snap-pulse timer on unmount
  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    };
  }, []);

  // Pull a raw width onto the nearest snap point when within threshold
  const applySnap = useCallback((raw: number): number => {
    for (const sp of SNAP_POINTS) {
      if (Math.abs(raw - sp) <= SNAP_THRESHOLD) return sp;
    }
    return raw;
  }, []);

  const triggerSnapPulse = useCallback(() => {
    setSnapPulse(true);
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(() => setSnapPulse(false), SNAP_PULSE_MS);
  }, []);

  // Sync width when category changes
  const [prevCategory, setPrevCategory] = useState(activeCategory);
  if (prevCategory !== activeCategory) {
    setPrevCategory(activeCategory);
    if (!isDraggingState) {
      setWidth(getWidthForCategory(activeCategory));
    }
  }

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsDraggingState(true);
    startX.current = e.clientX;
    startWidth.current = width;
    lastSnapRef.current = null;
    setCursor({ x: e.clientX, y: e.clientY });
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = ev.clientX - startX.current;
      const clamped = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + deltaX));
      const newWidth = Math.round(applySnap(clamped));
      // Pulse a "tick" only when newly landing on a snap point (not every frame held there)
      if (SNAP_POINTS.includes(newWidth)) {
        if (lastSnapRef.current !== newWidth) {
          lastSnapRef.current = newWidth;
          triggerSnapPulse();
        }
      } else {
        lastSnapRef.current = null;
      }
      setCursor({ x: ev.clientX, y: ev.clientY });
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      setIsDraggingState(false);
      lastSnapRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Persist on release
      setWidth((w) => {
        if (activeCategory) saveWidth(activeCategory, w);
        return w;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, activeCategory, applySnap, triggerSnapPulse]);

  const handleResizeDoubleClick = useCallback(() => {
    setWidth(SIDEBAR_DEFAULT);
    if (activeCategory) saveWidth(activeCategory, SIDEBAR_DEFAULT);
  }, [activeCategory]);

  // Keyboard resize on the role="separator" handle: ←/→ in 10px steps (20px with Shift),
  // Home/End jump to min/max. The aria-value* attrs are already wired, so this just
  // makes the announced values actually adjustable.
  const handleSeparatorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const isHomeEnd = e.key === 'Home' || e.key === 'End';
    if (!isArrow && !isHomeEnd) return;
    e.preventDefault();
    setWidth((w) => {
      let next = w;
      if (isArrow) {
        const step = e.shiftKey ? KEYBOARD_STEP_SHIFT : KEYBOARD_STEP;
        next = w + (e.key === 'ArrowRight' ? step : -step);
      } else {
        next = e.key === 'End' ? SIDEBAR_MAX : SIDEBAR_MIN;
      }
      next = Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, next)));
      if (SNAP_POINTS.includes(next)) triggerSnapPulse();
      if (activeCategory) saveWidth(activeCategory, next);
      return next;
    });
  }, [activeCategory, triggerSnapPulse]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-sidebar-item]');
      if (!buttons || buttons.length === 0) return;
      const idx = Array.from(buttons).indexOf(e.currentTarget);
      const next = e.key === 'ArrowDown'
        ? buttons[(idx + 1) % buttons.length]
        : buttons[(idx - 1 + buttons.length) % buttons.length];
      next?.focus();
    }
  }, []);

  return (
    <AnimatePresence mode="wait">
      {category && subModules.length > 0 && (
        <motion.nav
          key={activeCategory}
          aria-label={`${category.label} modules`}
          initial={prefersReduced ? { opacity: 1, width } : { width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { width: 0, opacity: 0 }}
          transition={
            isDraggingState
              ? { duration: 0 }
              : prefersReduced
                ? { duration: 0 }
                : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
          }
          className="relative h-full bg-surface-deep overflow-hidden"
          style={{ ['--focus-accent' as string]: 'var(--setup)' }}
        >
          <div style={{ width }} className="flex flex-col h-full">
            <div className="px-3 py-3 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <h2
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: category.accentColor }}
                >
                  {category.label}
                </h2>
                {activeCategory === 'core-engine' && (
                  <button
                    onClick={() => setActiveSubModule('core-engine-plan' as SubModuleId)}
                    className={`inline-flex items-center justify-center w-6 h-6 rounded text-2xs border transition-colors focus-ring ${
                      activeSubModule === 'core-engine-plan'
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        : 'text-text-muted hover:text-text hover:bg-surface border-border'
                    }`}
                    title="Open Core Engine aggregate Plan"
                    aria-label="Open Core Engine aggregate Plan"
                  >
                    <ListOrdered className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <StaggerContainer ref={listRef} className="flex-1 overflow-y-auto py-2" role="listbox" aria-label={`${category.label} modules`}>
              {subModules.map((mod) => {
                const isActive = activeSubModule === mod.id;
                const Icon = mod.icon;
                const isPlanItem = mod.id === 'core-engine-plan';
                return (
                  <StaggerItem key={mod.id}>
                  <button
                    data-sidebar-item
                    data-testid={`pof-sidebar-l2-nav-item-${mod.id}`}
                    onClick={() => setActiveSubModule(mod.id)}
                    onKeyDown={handleKeyDown}
                    role="option"
                    aria-selected={isActive}
                    aria-label={mod.label}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-fast
                      focus-ring-inset
                      ${isActive
                        ? 'bg-surface-hover'
                        : 'hover:bg-surface'
                      }
                      ${isPlanItem ? 'border-y border-border/40 bg-surface/40' : ''}
                    `}
                  >
                    <div className="relative flex-shrink-0">
                      <Icon
                        className="w-4 h-4"
                        style={{ color: isActive ? category.accentColor : 'var(--text-muted)' }}
                      />
                      <StatusBadge moduleId={mod.id} />
                    </div>
                    <TruncateWithTooltip
                      className={`text-xs truncate block ${isActive ? 'text-text' : 'text-text-muted'}`}
                      side="bottom"
                    >
                      {mod.label}
                    </TruncateWithTooltip>
                    <ProgressRing
                      moduleId={mod.id}
                      accentColor={category.accentColor}
                      sidebarWidth={width}
                    />
                  </button>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </div>
          {/* Resize handle — right edge (12px hit zone, 2px visual) */}
          <div
            onMouseDown={handleResizeMouseDown}
            onDoubleClick={handleResizeDoubleClick}
            onKeyDown={handleSeparatorKeyDown}
            tabIndex={0}
            className="absolute top-0 right-0 w-3 h-full cursor-ew-resize group z-10 rounded-sm focus-ring-inset"
            style={{ marginRight: -4 }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar (arrow keys to adjust, double-click to reset)"
            aria-valuenow={width}
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
          >
            {/* Border line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-border" />
            {/* Hover highlight + active-drag / snap-tick pulse */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-full bg-transparent group-hover:bg-border-bright transition-colors duration-fast"
              style={
                snapPulse
                  ? { backgroundColor: category.accentColor }
                  : isDraggingState
                    ? { backgroundColor: 'var(--border-bright)' }
                    : undefined
              }
            />
          </div>

          {/* Live width readout — floating pill anchored to the cursor while dragging */}
          {hydrated && createPortal(
            <AnimatePresence>
              {isDraggingState && (
                <motion.div
                  key="sidebar-l2-width-readout"
                  aria-hidden="true"
                  initial={prefersReduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: snapPulse && !prefersReduced ? 1.06 : 1 }}
                  exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.08 } }
                  }
                  className="fixed z-[100] pointer-events-none select-none rounded-md border px-2 py-1 text-2xs font-mono font-semibold tabular-nums shadow-lg"
                  style={{
                    left: cursor.x + 16,
                    top: cursor.y - 14,
                    backgroundColor: 'var(--surface)',
                    borderColor: SNAP_POINTS.includes(width) ? category.accentColor : 'var(--border)',
                    color: SNAP_POINTS.includes(width) ? category.accentColor : 'var(--text)',
                  }}
                >
                  {width}px
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  failed: STATUS_ERROR,   // red — CLI task failed
  running: STATUS_INFO,  // blue — CLI task running
} as const;

/**
 * Derive the badge status for a single module from the sessions map.
 * Returns a primitive ('failed' | 'running' | null) so the per-badge Zustand
 * subscription below settles under the default Object.is equality: a streamed
 * token that only bumps lastActivityAt on one session no longer invalidates
 * every badge — a badge re-renders only when its own module's status flips.
 * (Selecting a primitive, not a fresh object, also sidesteps the
 * "new object every render" selector trap.)
 */
function deriveStatusForModule(
  sessions: Record<string, CLISessionState>,
  moduleId: SubModuleId,
): 'failed' | 'running' | null {
  let hasRunning = false;
  for (const session of Object.values(sessions)) {
    if (session.moduleId !== moduleId) continue;
    // Failed takes priority over running — return as soon as we see one.
    if (session.lastTaskSuccess === false) return 'failed';
    if (session.isRunning) hasRunning = true;
  }
  return hasRunning ? 'running' : null;
}

const StatusBadge = memo(function StatusBadge({ moduleId }: { moduleId: SubModuleId }) {
  const status = useCLIPanelStore((s) => deriveStatusForModule(s.sessions, moduleId));

  if (!status) return null;

  const color = STATUS_COLORS[status];
  const label = status === 'failed' ? 'Task failed' : 'Task running';

  return (
    <span
      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface-deep"
      style={{ backgroundColor: color }}
      title={label}
      aria-label={label}
    >
      {status === 'running' && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: color, opacity: 0.4 }}
        />
      )}
    </span>
  );
});

// ─── Progress Ring ───────────────────────────────────────────────────────────

const WIDE_SIDEBAR_THRESHOLD = 200;

const ProgressRing = memo(function ProgressRing({
  moduleId,
  accentColor,
  sidebarWidth = 0,
}: {
  moduleId: SubModuleId;
  accentColor: string;
  sidebarWidth?: number;
}) {
  const progress = useModuleStore((s) => s.checklistProgress[moduleId]);
  const mod = SUB_MODULE_MAP[moduleId];
  const total = mod?.checklist?.length ?? 0;

  // No checklist → no ring, show nothing
  if (total === 0) return null;

  // progress === undefined means data hasn't loaded yet
  const isLoading = progress === undefined;
  const completed = progress
    ? Object.values(progress).filter(Boolean).length
    : 0;
  const pct = isLoading ? 0 : Math.min(completed / total, 1);
  const pctInt = Math.round(pct * 100);
  const dashOffset = isLoading
    ? RING_CIRCUMFERENCE * 0.75
    : RING_CIRCUMFERENCE * (1 - pct);

  const tooltipText = isLoading
    ? 'Loading…'
    : `${completed}/${total} complete (${pctInt}%)`;
  const showInlineCount = sidebarWidth > WIDE_SIDEBAR_THRESHOLD && !isLoading;

  // 100% complete → checkmark
  if (!isLoading && pct >= 1) {
    return (
      <div
        className="ml-auto flex-shrink-0 flex items-center gap-1.5"
        title={tooltipText}
      >
        {showInlineCount && (
          <span className="text-2xs text-text-muted whitespace-nowrap">{completed}/{total}</span>
        )}
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}24` }}
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${mod?.label ?? moduleId}: complete`}
        >
          <Check className="w-2.5 h-2.5" style={{ color: accentColor }} strokeWidth={3} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="ml-auto flex-shrink-0 flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={isLoading ? undefined : pctInt}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={
        isLoading
          ? `${mod?.label ?? moduleId}: loading progress`
          : `${mod?.label ?? moduleId}: ${pctInt}% complete`
      }
      title={tooltipText}
    >
      {showInlineCount && (
        <span className="text-2xs text-text-muted whitespace-nowrap">{completed}/{total}</span>
      )}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth={RING_STROKE}
        />
        {/* Fill */}
        {(pct > 0 || isLoading) && (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={accentColor}
            strokeWidth={RING_STROKE}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={isLoading ? 'animate-progress-spin' : ''}
            style={isLoading ? { opacity: 0.4 } : { transition: 'stroke-dashoffset 0.4s ease' }}
          />
        )}
      </svg>
    </div>
  );
});
