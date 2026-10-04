'use client';

/**
 * React's half of the wheel: it owns the engine's lifetime and feeds it the four things only React
 * knows — the element sizes, the resolved theme, the motion preference, and whether this pane is
 * suspended. It owns no frame and no pixel.
 *
 * ── Why almost nothing here is React state ──────────────────────────────────────────────────────
 * The camera lives in the engine, behind a ref. A pan therefore produces no `setState` and no
 * re-render: the handler mutates the transform and the engine blits. The ONLY React state in the
 * stage is the hover target (which moves a DOM tooltip, not the wheel) — everything else that
 * changes during a gesture changes inside the engine and is published afterwards through
 * `onStats`, once per bake.
 *
 * ── Suspension ──────────────────────────────────────────────────────────────────────────────────
 * Panes in this app are kept mounted in an LRU and told they are hidden. A hidden wheel must cost
 * nothing, so the engine is paused through `useSuspendableEffect` — its rAF is cancelled and its
 * settle timer cleared — and re-baked on resume. There is no idle loop to stop: the engine only ever
 * schedules a frame it has a reason for.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import type { DrawStats } from '@/components/story/orrery/render/ctx';
import {
  createOrreryEngine,
  type EngineProps,
  type OrreryEngine,
} from '@/components/story/orrery/render/engine';
import { readOrreryPalette } from '@/components/story/orrery/render/palette';
import type { Hit } from '@/components/story/orrery/render/hitTest';

/** The attribute the theme layer keys off, and therefore the one a repaint has to watch. */
const THEME_ATTR = 'data-orrery-theme';

export interface OrreryCameraHost {
  props: EngineProps;
  /** Called once per bake with the drawn counts. Never called during a gesture. */
  onStats: (stats: DrawStats & { bakes: number }) => void;
  onHover: (hit: Hit | null) => void;
}

export interface OrreryCameraBinding {
  stageRef: React.RefObject<HTMLDivElement | null>;
  mainRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  engine: () => OrreryEngine | null;
}

export function useOrreryCamera(host: OrreryCameraHost): OrreryCameraBinding {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<OrreryEngine | null>(null);
  const reduced = useReducedMotion() ?? false;

  // The callbacks the engine holds for its whole life; the latest host functions are read through a
  // ref so the engine is never rebuilt just because a parent re-rendered with new closures.
  const hostRef = useRef(host);
  useEffect(() => {
    // Written in an effect, never during render: the engine reads it only from a frame or an
    // event, both of which happen after the commit that updated it.
    hostRef.current = host;
  });

  const callbacks = useMemo(
    () => ({
      onStats: (stats: DrawStats & { bakes: number }) => hostRef.current.onStats(stats),
      onHover: (hit: Hit | null) => hostRef.current.onHover(hit),
    }),
    [],
  );

  const engine = useCallback(() => engineRef.current, []);

  // Build the engine once, attach the canvases, and tear it down on unmount.
  useEffect(() => {
    const created = createOrreryEngine(hostRef.current.props, callbacks);
    engineRef.current = created;
    const main = mainRef.current;
    const overlay = overlayRef.current;
    if (main && overlay) created.attach(main, overlay);
    return () => {
      created.dispose();
      engineRef.current = null;
    };
  }, [callbacks]);

  /** Resolve the palette from the nearest themed ancestor and hand it to the engine. */
  const refreshPalette = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const themedHost = (stage.closest(`[${THEME_ATTR}]`) as HTMLElement | null) ?? stage;
    // The palette goes straight into the engine, not into React state: it is paint, not data, and
    // routing it through a render would make a theme switch a remount of the whole wheel.
    engineRef.current?.setPalette(readOrreryPalette(themedHost));
  }, []);

  // One repaint per theme change, no remount. The attribute can be set on any ancestor, so the
  // observer watches the document for it rather than guessing which element carries it.
  useEffect(() => {
    refreshPalette();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => refreshPalette());
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: [THEME_ATTR],
    });
    return () => observer.disconnect();
  }, [refreshPalette]);

  // Size tracking. `useSuspendableEffect` so a hidden pane is not measuring either.
  useSuspendableEffect(() => {
    const stage = stageRef.current;
    const current = engineRef.current;
    if (!stage || !current) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      current.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Pause while suspended; re-bake on resume. The engine has no idle loop to stop.
  useSuspendableEffect(() => {
    const current = engineRef.current;
    if (!current) return;
    current.invalidate();
    return () => current.pause();
  }, []);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reduced);
  }, [reduced]);

  // Props in, one call. The engine decides what that means — a re-root glide, a re-bake, or only an
  // overlay repaint.
  useEffect(() => {
    engineRef.current?.setProps(host.props);
  }, [host.props]);

  return { stageRef, mainRef, overlayRef, engine };
}
