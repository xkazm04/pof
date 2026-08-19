'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
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
import {
  moduleLabel,
  lruTouched,
  lruTouchedAll,
  describeEviction,
  reportEviction,
  resolveVisibleModule,
  observedLiveKey,
  observedLiveProbe,
} from './helpers';

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
  /** Subset of `evictedIds` the LRU had to evict over observed live work. */
  forcedIds: string[];
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

  // Show inline terminal only when the maximized tab belongs to the module the
  // user is LOOKING AT. `useActiveModuleId` now resolves that through the same
  // `resolveVisibleModule` rule as `currentActiveId` below, so this attribution
  // and the pane visibility can no longer disagree inside this one component.
  const maximizedTabId = useCLIPanelStore((s) => s.maximizedTabId);
  const maximizedSession = useCLIPanelStore((s) =>
    s.maximizedTabId ? s.sessions[s.maximizedTabId] : null
  );
  const inlineSessionId =
    maximizedTabId && maximizedSession?.moduleId === activeModuleId
      ? maximizedTabId
      : null;

  // The ONE thing this shell can observe about live work: which CLI sessions are
  // running, and which module each is attributed to. Subscribed as an order-stable
  // STRING (never a fresh Set/array) because the LRU below adjusts state during
  // render — a new identity every render would loop, which this component has
  // already been bitten by once.
  //
  // What the probe cannot see is the honest part: a module's own SSE streams,
  // polls and in-flight fetches are invisible here, so `false` means "nothing
  // observed", not "idle". `lruTouched` treats it as a preference, never a licence
  // (see `ObservedLiveProbe` / `EvictionBasis` in ./helpers).
  const liveKey = useCLIPanelStore((s) => observedLiveKey(s.sessions));
  const isModuleLive = useMemo(() => observedLiveProbe(liveKey, 'module'), [liveKey]);
  const isSessionLive = useMemo(() => observedLiveProbe(liveKey, 'session'), [liveKey]);

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
  //
  // The probe makes liveness an INPUT to the choice rather than an epitaph for it:
  // the victim is the least-recently-used pane with no observed live work, and the
  // classic tail is evicted only when every candidate is live (cap unchanged,
  // memory still bounded) — reported as `forced-over-live-work` so it surfaces.
  const moduleTouch = lruTouchedAll(moduleLru, moduleTouches, LRU_CAP, isModuleLive);
  if (moduleTouch) {
    setModuleLru(moduleTouch.next);
    if (moduleTouch.evicted.length > 0) {
      setModuleEviction({
        evictedIds: moduleTouch.evicted,
        forcedIds: moduleTouch.forced,
        scope: 'module',
        cap: LRU_CAP,
      });
    }
  }
  if (inlineSessionId) {
    const touch = lruTouched(sessionLru, inlineSessionId, SESSION_LRU_CAP, isSessionLive);
    if (touch) {
      setSessionLru(touch.next);
      if (touch.evicted) {
        setSessionEviction({
          evictedIds: [touch.evicted],
          forcedIds: touch.basis === 'forced-over-live-work' ? [touch.evicted] : [],
          scope: 'session',
          cap: SESSION_LRU_CAP,
        });
      }
    }
  }

  // Report evictions. Sessions are read at report time via getState() (not
  // subscribed) so the classification costs nothing on the non-evicting path.
  useEffect(() => {
    if (!moduleEviction) return;
    const sessions = useCLIPanelStore.getState().sessions;
    for (const evictedId of moduleEviction.evictedIds) {
      const basis = moduleEviction.forcedIds.includes(evictedId)
        ? 'forced-over-live-work'
        : 'no-observed-live-work';
      reportEviction(describeEviction(evictedId, 'module', moduleEviction.cap, sessions, basis));
    }
  }, [moduleEviction]);

  useEffect(() => {
    if (!sessionEviction) return;
    const sessions = useCLIPanelStore.getState().sessions;
    for (const evictedId of sessionEviction.evictedIds) {
      const basis = sessionEviction.forcedIds.includes(evictedId)
        ? 'forced-over-live-work'
        : 'no-observed-live-work';
      reportEviction(describeEviction(evictedId, 'session', sessionEviction.cap, sessions, basis));
    }
  }, [sessionEviction]);

  // Determine what to render. `currentActiveId` is the ONE visible module —
  // `resolveVisibleModule` states the rule (a set sub-module wins over its owning
  // special category) and is the single source for the pane predicates below, the
  // crossfade veil and the welcome state, so those three can never disagree.
  // A sub-module with no view cannot win the rule — navigation state is persisted
  // to localStorage, so a stale id from an older build stays readable here. Letting
  // it win would render an empty canvas; instead it defers to its category (or to
  // the welcome state), which is what the user saw before this rule existed.
  const isSpecialCategory = Boolean(activeCategory && SPECIAL_CATEGORIES[activeCategory]);
  const renderableSubModule =
    activeSubModule && MODULE_COMPONENTS[activeSubModule] ? activeSubModule : null;
  const currentActiveId = resolveVisibleModule(activeCategory, renderableSubModule, isSpecialCategory);
  const hasActiveContent = currentActiveId !== null;

  // Track module switches to trigger entrance animations (must be before early return)
  const [prevActiveId, setPrevActiveId] = useState<string | null>(null);
  const [switchKey, setSwitchKey] = useState(0);
  if (currentActiveId !== prevActiveId) {
    setPrevActiveId(currentActiveId);
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
      <div className="flex-1 overflow-y-auto min-h-0 relative" data-active-module={currentActiveId}>
        {moduleLru.map((moduleId) => {
          // ONE predicate for both pane kinds. The special-category pane used to
          // test `activeCategory === moduleId` and the sub-module pane
          // `activeSubModule === moduleId` — independent predicates, so the
          // dual-set state showed BOTH and whichever painted last won by stacking
          // order rather than by navigational intent. `currentActiveId` decides.
          const isVisible = currentActiveId === moduleId;

          // Special category modules render without sub-modules.
          const SpecialComponent = SPECIAL_CATEGORIES[moduleId];
          if (SpecialComponent) {
            return renderModulePane(moduleId, SpecialComponent, isVisible);
          }

          // Regular sub-module views.
          const Component = MODULE_COMPONENTS[moduleId as SubModuleId];
          if (!Component) return null;
          return renderModulePane(moduleId, Component, isVisible);
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
