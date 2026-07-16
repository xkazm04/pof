'use client';

import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ListOrdered } from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/components/ui/Stagger';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import type { SubModuleId } from '@/types/modules';
import { SIDEBAR_MIN, SIDEBAR_MAX, SNAP_POINTS } from './constants';
import { StatusBadge } from './StatusBadge';
import { ProgressRing } from './ProgressRing';
import { useSidebarL2 } from './useSidebarL2';

export function SidebarL2() {
  const {
    activeCategory,
    activeSubModule,
    setActiveSubModule,
    category,
    subModules,
    prefersReduced,
    listRef,
    width,
    isDraggingState,
    cursor,
    snapPulse,
    hydrated,
    handleResizeMouseDown,
    handleResizeDoubleClick,
    handleSeparatorKeyDown,
    handleKeyDown,
  } = useSidebarL2();

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
                    // Clamp against the viewport so the readout never renders
                    // off-screen near the right/bottom edge (wide-sidebar drag).
                    // ~64px pill width / ~26px height covers "{NNN}px" + padding;
                    // flip to the left of the cursor when it would overflow right.
                    left: cursor.x + 16 + 64 > window.innerWidth
                      ? Math.max(4, cursor.x - 16 - 64)
                      : cursor.x + 16,
                    top: Math.min(Math.max(4, cursor.y - 14), window.innerHeight - 30),
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
