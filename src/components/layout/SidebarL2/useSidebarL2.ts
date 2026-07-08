'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useNavigationStore } from '@/stores/navigationStore';
import { getSubModulesForCategory, CATEGORY_MAP } from '@/lib/module-registry';
import {
  SIDEBAR_MIN,
  SIDEBAR_MAX,
  SIDEBAR_DEFAULT,
  SNAP_POINTS,
  SNAP_THRESHOLD,
  SNAP_PULSE_MS,
  KEYBOARD_STEP,
  KEYBOARD_STEP_SHIFT,
} from './constants';
import { getWidthForCategory, saveWidth } from './helpers';

export function useSidebarL2() {
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

  return {
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
  };
}
