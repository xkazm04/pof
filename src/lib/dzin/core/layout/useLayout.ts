'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { resolveLayout } from './resolver';
import type { PanelDirective, ResolvedLayout, SlotAssignment } from './types';
import type { PanelRegistry } from '../registry/types';
import type { PanelDensity } from '../types/panel';
import type { ResolveLayoutOptions } from './resolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseLayoutOptions extends ResolveLayoutOptions {
  /** Optional ref to a container element for ResizeObserver. Falls back to documentElement. */
  containerRef?: RefObject<HTMLElement | null>;
}

export interface ContainerProps {
  style: CSSProperties;
  'data-dzin-layout': string;
}

export interface SlotProps {
  style: CSSProperties;
  'data-dzin-slot': number;
  'data-dzin-density': PanelDensity;
}

export interface UseLayoutResult {
  layout: ResolvedLayout;
  containerProps: ContainerProps;
  getSlotProps: (slotIndex: number) => SlotProps;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook that resolves a layout from panel directives and tracks
 * viewport dimensions via ResizeObserver (debounced ~100ms).
 *
 * @param directives - Panel directives to place
 * @param registry - Panel registry for looking up definitions
 * @param options - Optional: preferredTemplate, containerRef
 * @returns Resolved layout, container props with CSS Grid styles, and getSlotProps function
 */
export function useLayout(
  directives: PanelDirective[],
  registry: PanelRegistry,
  options?: UseLayoutOptions,
): UseLayoutResult {
  // SSR guard: initialize from window or sensible defaults
  const [viewport, setViewport] = useState(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1920, height: 1080 };
  });

  // ResizeObserver with debounce
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const target = options?.containerRef?.current ?? document.documentElement;

    const observer = new ResizeObserver((entries) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setViewport((prev) => {
            if (prev.width === Math.round(width) && prev.height === Math.round(height)) {
              return prev;
            }
            return { width: Math.round(width), height: Math.round(height) };
          });
        }
      }, 100);
    });

    observer.observe(target);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [options?.containerRef]);

  // Resolve layout when inputs change
  const layout = useMemo(
    () =>
      resolveLayout(directives, registry, viewport, {
        preferredTemplate: options?.preferredTemplate,
      }),
    [directives, registry, viewport, options?.preferredTemplate],
  );

  // Container props with CSS Grid styles
  const containerProps: ContainerProps = useMemo(
    () => ({
      style: {
        display: 'grid' as const,
        gridTemplateRows: layout.gridTemplateRows,
        gridTemplateColumns: layout.gridTemplateColumns,
        width: '100%',
        height: '100%',
      },
      'data-dzin-layout': layout.template,
    }),
    [layout],
  );

  // Slot props accessor
  const getSlotProps = useCallback(
    (slotIndex: number): SlotProps => {
      const assignment = layout.assignments.find((a) => a.slotIndex === slotIndex);
      return {
        style: assignment?.style ?? {},
        'data-dzin-slot': slotIndex,
        'data-dzin-density': assignment?.density ?? 'full',
      };
    },
    [layout],
  );

  return { layout, containerProps, getSlotProps };
}
