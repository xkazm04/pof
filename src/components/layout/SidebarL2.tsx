'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, ListOrdered } from 'lucide-react';
import { useNavigationStore } from '@/stores/navigationStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
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
  const startX = useRef(0);
  const startWidth = useRef(width);

  // Sync width when category changes
  useEffect(() => {
    if (!isDragging.current) {
      setWidth(getWidthForCategory(activeCategory));
    }
  }, [activeCategory]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = ev.clientX - startX.current;
      const newWidth = Math.round(
        Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth.current + deltaX))
      );
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
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
  }, [width, activeCategory]);

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
            isDragging.current
              ? { duration: 0 }
              : prefersReduced
                ? { duration: 0 }
                : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
          }
          className="relative h-full bg-surface-deep overflow-hidden"
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
                    className={`inline-flex items-center justify-center w-6 h-6 rounded text-2xs border transition-colors ${
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
                    onClick={() => setActiveSubModule(mod.id)}
                    onKeyDown={handleKeyDown}
                    role="option"
                    aria-selected={isActive}
                    aria-label={mod.label}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-fast
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
          {/* Resize handle — right edge */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute top-0 right-0 w-[5px] h-full cursor-ew-resize group z-10"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuenow={width}
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
          >
            {/* Border line */}
            <div className="absolute top-0 right-0 w-px h-full bg-border" />
            {/* Hover highlight */}
            <div className="absolute top-0 right-0 w-[2px] h-full bg-transparent group-hover:bg-border-bright transition-colors duration-fast" />
          </div>
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

const StatusBadge = memo(function StatusBadge({ moduleId }: { moduleId: SubModuleId }) {
  const sessions = useCLIPanelStore((s) => s.sessions);

  const status = useMemo(() => {
    let hasFailed = false;
    let hasRunning = false;

    for (const session of Object.values(sessions)) {
      if (session.moduleId !== moduleId) continue;
      if (session.isRunning) hasRunning = true;
      if (session.lastTaskSuccess === false) hasFailed = true;
    }

    // Failed takes priority over running
    if (hasFailed) return 'failed' as const;
    if (hasRunning) return 'running' as const;
    return null;
  }, [sessions, moduleId]);

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
    ? 'Loading...'
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
