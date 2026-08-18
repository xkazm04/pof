'use client';

import { Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { SuspendContext } from '@/hooks/useSuspend';

// InlineTerminal is rendered with props *outside* the module Suspense boundary,
// so it stays eagerly imported (lazifying it would suspend with no boundary).
import { InlineTerminal } from '@/components/cli/InlineTerminal';

import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useActiveModuleId } from '@/hooks/useActiveModuleId';
import { ModuleErrorBoundary } from '../ModuleErrorBoundary';
import { ModuleSkeleton } from '../ModuleSkeleton';
import type { SubModuleId } from '@/types/modules';
import { MODULE_COMPONENTS, SPECIAL_CATEGORIES } from './registry';
import { moduleLabel, lruTouched, lruTouchedAll, describeEviction, reportEviction } from './helpers';

/** Max number of modules kept mounted simultaneously. Oldest are evicted. */
const LRU_CAP = 5;

/** Max number of inline terminal sessions kept mounted simultaneously. */
const SESSION_LRU_CAP = 5;

/**
 * Evictions recorded during render, reported from an effect (never in render).
 * A single pass can evict more than once (both module touches can push an id off
 * the tail), so this carries a list — one report per genuine eviction, no more.
 */
interface PendingEviction {
  evictedIds: string[];
  scope: 'module' | 'session';
  cap: number;
}

export function ModuleRenderer() {
  const activeCategory = useNavigationStore((s) => s.activeCategory);
  const activeSubModule = useNavigationStore((s) => s.activeSubModule);
  const prefersReduced = useReducedMotion();

  // LRU list stored in a ref — mutations happen during render before JSX evaluation,
  // and navigation store changes already trigger re-renders.
  const [moduleLru, setModuleLru] = useState<string[]>([]);
  const [sessionLru, setSessionLru] = useState<string[]>([]);

  const activeModuleId = useActiveModuleId();

  // Show inline terminal only when the maximized tab belongs to the current module
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const maximizedSession = useCLIPanelStore((s) =>
    s.maximizedTabId ? s.sessions[s.maximizedTabId] : null
  );
  const inlineSessionId =
    maximizedTabId && maximizedSession?.moduleId === activeModuleId
      ? maximizedTabId
      : null;

  // An eviction UNMOUNTS a pane — any stream, poll or CLI session it held dies with
  // it. Record it here (pure: plain state, no side effects in the render body) and
  // report it from the effects below, so navigation can never tear down live work
  // silently. Nothing about WHEN eviction happens changes.
  const [moduleEviction, setModuleEviction] = useState<PendingEviction | null>(null);
  const [sessionEviction, setSessionEviction] = useState<PendingEviction | null>(null);

  // Track visited modules with LRU eviction (render-time state adjustment).
  // BOTH the sub-module and the special-category touch land on the SAME list, so
  // they must fold through it together: two `lruTouched` calls against the same
  // `moduleLru` binding would each set state from the stale list and the second
  // would discard the first, dropping a just-visited module. Order is
  // most-recent-last, matching the previous sequential calls (the special
  // category ends up MRU). Eviction timing and LRU_CAP are unchanged.
  const moduleTouches: string[] = [];
  if (activeSubModule) moduleTouches.push(activeSubModule);
  if (activeCategory && SPECIAL_CATEGORIES[activeCategory]) moduleTouches.push(activeCategory);
  const moduleTouch = lruTouchedAll(moduleLru, moduleTouches, LRU_CAP);
  if (moduleTouch) {
    setModuleLru(moduleTouch.next);
    if (moduleTouch.evicted.length > 0) {
      setModuleEviction({ evictedIds: moduleTouch.evicted, scope: 'module', cap: LRU_CAP });
    }
  }
  if (inlineSessionId) {
    const touch = lruTouched(sessionLru, inlineSessionId, SESSION_LRU_CAP);
    if (touch) {
      setSessionLru(touch.next);
      if (touch.evicted) {
        setSessionEviction({ evictedIds: [touch.evicted], scope: 'session', cap: SESSION_LRU_CAP });
      }
    }
  }

  // Report evictions. Sessions are read at report time via getState() (not
  // subscribed) so the classification costs nothing on the non-evicting path.
  useEffect(() => {
    if (!moduleEviction) return;
    const sessions = useCLIPanelStore.getState().sessions;
    for (const evictedId of moduleEviction.evictedIds) {
      reportEviction(describeEviction(evictedId, 'module', moduleEviction.cap, sessions));
    }
  }, [moduleEviction]);

  useEffect(() => {
    if (!sessionEviction) return;
    const sessions = useCLIPanelStore.getState().sessions;
    for (const evictedId of sessionEviction.evictedIds) {
      reportEviction(describeEviction(evictedId, 'session', sessionEviction.cap, sessions));
    }
  }, [sessionEviction]);

  // Determine what to render
  const isSpecialCategory = activeCategory && SPECIAL_CATEGORIES[activeCategory];
  const hasActiveContent = isSpecialCategory || activeSubModule;

  // Track module switches to trigger entrance animations (must be before early return)
  const [prevActiveId, setPrevActiveId] = useState<string | null>(null);
  const [switchKey, setSwitchKey] = useState(0);
  const currentActiveId = isSpecialCategory ? activeCategory : activeSubModule;
  if (currentActiveId !== prevActiveId) {
    setPrevActiveId(currentActiveId ?? null);
    setSwitchKey(k => k + 1);
  }

  // Welcome / empty state
  if (!hasActiveContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          {activeCategory ? (
            <p className="text-text-muted text-sm">Select a module from the sidebar</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-text mb-2">Welcome to POF</h2>
              <p className="text-text-muted text-sm">Select a category to begin</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const crossfadeDuration = prefersReduced ? 0 : DURATION.fast;

  // Render a single keep-alive module pane: visibility toggled via `display`,
  // suspended when hidden, crossfaded on entrance, guarded by an error boundary.
  // Shared by both special-category and sub-module panes (resolution differs only
  // in how `Component` and `isVisible` are derived below).
  const renderModulePane = (
    moduleId: string,
    Component: React.ComponentType,
    isVisible: boolean,
  ) => (
    <div
      key={moduleId}
      className="h-full"
      style={{ display: isVisible ? 'block' : 'none' }}
    >
      <SuspendContext.Provider value={!isVisible}>
        <motion.div
          key={`fade-${moduleId}-${isVisible ? switchKey : 'hidden'}`}
          initial={isVisible ? { opacity: 0, y: -4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: crossfadeDuration, ease: EASE_OUT }}
          className="h-full"
        >
          <ModuleErrorBoundary moduleName={moduleLabel(moduleId)}>
            <Suspense fallback={<ModuleSkeleton />}>
              <Component />
            </Suspense>
          </ModuleErrorBoundary>
        </motion.div>
      </SuspendContext.Provider>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Scrollable module content */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {moduleLru.map((moduleId) => {
          // Special category modules render without sub-modules.
          const SpecialComponent = SPECIAL_CATEGORIES[moduleId];
          if (SpecialComponent) {
            return renderModulePane(moduleId, SpecialComponent, activeCategory === moduleId);
          }

          // Regular sub-module views.
          const Component = MODULE_COMPONENTS[moduleId as SubModuleId];
          if (!Component) return null;
          return renderModulePane(moduleId, Component, activeSubModule === moduleId);
        })}

        {/* Crossfade veil — bg-colored overlay that fades out to reveal incoming module */}
        <AnimatePresence>
          {currentActiveId && (
            <motion.div
              key={`veil-${switchKey}`}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: crossfadeDuration, ease: EASE_OUT }}
              className="absolute inset-0 bg-background pointer-events-none z-10"
              aria-hidden
            />
          )}
        </AnimatePresence>
      </div>

      {/* Inline terminals — LRU keep-alive: toggle visibility via display */}
      {sessionLru.map((sessionId) => {
        const isVisible = sessionId === inlineSessionId;
        return (
          <div
            key={sessionId}
            className="shrink-0"
            style={{ display: isVisible ? 'block' : 'none' }}
          >
            <InlineTerminal sessionId={sessionId} visible={isVisible} />
          </div>
        );
      })}
    </div>
  );
}
