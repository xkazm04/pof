import { useReducer, useCallback, useMemo } from 'react';
import {
  streamingPlanReducer, initialStreamingPlan, zoneAt as zoneAtIn,
  type StreamingPlanStore, type StreamingZonePlannerConfig, type StreamingZone, type ZoneTransition, type ZoneType,
} from '@/lib/level-design/streaming-plan';
import { CELL_SIZE } from './constants';
import type { TransitionLine } from './types';

/**
 * A thin adapter over the lib reducer (`@/lib/level-design/streaming-plan`).
 * With a `store` (the level-design view's), the plan outlives this component;
 * without one (tests, standalone renders) a private instance of the same
 * reducer is used. Every write is a named op through `dispatch`.
 */
export function useStreamingZonePlanner(store?: StreamingPlanStore) {
  const [ownState, ownDispatch] = useReducer(streamingPlanReducer, undefined, initialStreamingPlan);
  const state = store?.state ?? ownState;
  const dispatch = store?.dispatch ?? ownDispatch;
  const { zones, transitions, gridSize, mode, selectedZoneId } = state;

  // What the grid and cells draw — derived from the one mode.
  const paintType: ZoneType | 'erase' | null =
    mode.kind === 'paint' ? mode.zoneType : mode.kind === 'erase' ? 'erase' : null;
  const linkingFrom = mode.kind === 'link' ? mode.from : null;

  const zoneAt = useCallback((x: number, y: number) => zoneAtIn(zones, x, y), [zones]);

  const handleCellClick = useCallback((x: number, y: number) => {
    dispatch({ type: 'cellClick', x, y });
  }, [dispatch]);

  const updateZone = useCallback((zoneId: string, patch: Partial<Omit<StreamingZone, 'id'>>) => {
    dispatch({ type: 'updateZone', zoneId, patch });
  }, [dispatch]);

  const deleteTransition = useCallback((transitionId: string) => {
    dispatch({ type: 'deleteTransition', transitionId });
  }, [dispatch]);

  const updateTransition = useCallback((transitionId: string, patch: Partial<Omit<ZoneTransition, 'id'>>) => {
    dispatch({ type: 'updateTransition', transitionId, patch });
  }, [dispatch]);

  // ── Derived ──

  const selectedZone = useMemo(
    () => selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null,
    [selectedZoneId, zones]
  );

  const transitionLines = useMemo(() => {
    return transitions.map((tr) => {
      const from = zones.find((z) => z.id === tr.fromId);
      const to = zones.find((z) => z.id === tr.toId);
      if (!from || !to) return null;
      return {
        ...tr,
        x1: from.gridX * CELL_SIZE + CELL_SIZE / 2,
        y1: from.gridY * CELL_SIZE + CELL_SIZE / 2,
        x2: to.gridX * CELL_SIZE + CELL_SIZE / 2,
        y2: to.gridY * CELL_SIZE + CELL_SIZE / 2,
        fromName: from.name,
        toName: to.name,
      };
    }).filter(Boolean) as TransitionLine[];
  }, [transitions, zones]);

  // The document only: a selection or mode change keeps the same config.
  const config = useMemo<StreamingZonePlannerConfig>(
    () => ({ zones, transitions, gridSize }),
    [zones, transitions, gridSize],
  );

  const stats = useMemo(() => ({
    total: zones.length,
    alwaysLoaded: zones.filter((z) => z.alwaysLoaded).length,
    transitions: transitions.length,
  }), [zones, transitions]);

  return {
    zones,
    transitions,
    gridSize,
    mode,
    paintType,
    linkingFrom,
    selectedZoneId,
    dispatch,
    zoneAt,
    handleCellClick,
    updateZone,
    deleteTransition,
    updateTransition,
    selectedZone,
    transitionLines,
    config,
    stats,
  };
}
