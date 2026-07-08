import { useState, useCallback, useMemo } from 'react';
import { CELL_SIZE, ZONE_TYPES, DEFAULT_ZONES, DEFAULT_TRANSITIONS } from './constants';
import type { StreamingZone, ZoneTransition, StreamingZonePlannerConfig, ZoneType } from './types';

export function useStreamingZonePlanner() {
  const [zones, setZones] = useState<StreamingZone[]>(() => structuredClone(DEFAULT_ZONES));
  const [transitions, setTransitions] = useState<ZoneTransition[]>(() => structuredClone(DEFAULT_TRANSITIONS));
  const [gridSize] = useState(7);
  const [paintType, setPaintType] = useState<ZoneType | 'erase' | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);

  // ── Grid helpers ──

  const zoneAt = useCallback((x: number, y: number) => {
    return zones.find((z) => z.gridX === x && z.gridY === y) ?? null;
  }, [zones]);

  const getAdjacentZoneIds = useCallback((zone: StreamingZone): string[] => {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const adj: string[] = [];
    for (const [dx, dy] of dirs) {
      const neighbor = zoneAt(zone.gridX + dx, zone.gridY + dy);
      if (neighbor) adj.push(neighbor.id);
    }
    return adj;
  }, [zoneAt]);

  // ── Zone CRUD ──

  const handleCellClick = useCallback((x: number, y: number) => {
    const existing = zoneAt(x, y);

    if (linkingFrom) {
      // Linking mode — connect linkingFrom to clicked zone
      if (existing && existing.id !== linkingFrom) {
        const exists = transitions.some(
          (t) => (t.fromId === linkingFrom && t.toId === existing.id) ||
            (t.fromId === existing.id && t.toId === linkingFrom)
        );
        if (!exists) {
          setTransitions((prev) => [
            ...prev,
            {
              id: `tr-${Date.now()}`,
              fromId: linkingFrom,
              toId: existing.id,
              style: 'seamless',
              triggerType: 'proximity',
              condition: '',
            },
          ]);
        }
      }
      setLinkingFrom(null);
      return;
    }

    if (paintType === 'erase') {
      if (existing) {
        setZones((prev) => prev.filter((z) => z.id !== existing.id));
        setTransitions((prev) => prev.filter((t) => t.fromId !== existing.id && t.toId !== existing.id));
        if (selectedZoneId === existing.id) setSelectedZoneId(null);
      }
      return;
    }

    if (paintType) {
      if (existing) {
        // Overwrite the zone type
        setZones((prev) => prev.map((z) =>
          z.id === existing.id ? { ...z, type: paintType, name: ZONE_TYPES[paintType].label } : z
        ));
        setSelectedZoneId(existing.id);
      } else {
        // Place a new zone
        const id = `z-${Date.now()}`;
        const newZone: StreamingZone = {
          id,
          name: ZONE_TYPES[paintType].label,
          type: paintType,
          gridX: x,
          gridY: y,
          loadPriority: 'normal',
          alwaysLoaded: false,
          preloadRadius: 1,
        };
        setZones((prev) => [...prev, newZone]);
        setSelectedZoneId(id);
      }
      return;
    }

    // No paint mode — select
    if (existing) {
      setSelectedZoneId(existing.id);
    } else {
      setSelectedZoneId(null);
    }
  }, [zoneAt, paintType, linkingFrom, transitions, selectedZoneId, zones]);

  const updateZone = useCallback((id: string, patch: Partial<StreamingZone>) => {
    setZones((prev) => prev.map((z) => z.id === id ? { ...z, ...patch } : z));
  }, []);

  const deleteTransition = useCallback((id: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTransition = useCallback((id: string, patch: Partial<ZoneTransition>) => {
    setTransitions((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }, []);

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
    }).filter(Boolean) as (ZoneTransition & { x1: number; y1: number; x2: number; y2: number; fromName: string; toName: string })[];
  }, [transitions, zones]);

  const config: StreamingZonePlannerConfig = useMemo(() => ({ zones, transitions, gridSize }), [zones, transitions, gridSize]);

  const stats = useMemo(() => ({
    total: zones.length,
    alwaysLoaded: zones.filter((z) => z.alwaysLoaded).length,
    transitions: transitions.length,
  }), [zones, transitions]);

  return {
    zones,
    transitions,
    gridSize,
    paintType,
    setPaintType,
    selectedZoneId,
    setSelectedZoneId,
    linkingFrom,
    setLinkingFrom,
    zoneAt,
    getAdjacentZoneIds,
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
