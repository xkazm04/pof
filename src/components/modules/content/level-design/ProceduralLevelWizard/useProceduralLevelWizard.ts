'use client';

import { useState, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import type { KeyboardEvent } from 'react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { tryApiFetch } from '@/lib/api-utils';
import { dungeonToGeometryScript } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { levelMetadataScript } from '@/lib/blender-mcp/scripts/level-metadata';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import { generatePreview, type PreviewConfig } from '@/lib/level-design/procgen-preview';
import { ALGORITHMS, LEVEL_TYPES, DEFAULT_SIZE } from './constants';
import type {
  GenAlgorithm, LevelType, SizeParams, GameplayConstraints, ProceduralLevelConfig,
} from './types';

/**
 * Roving-tabindex keyboard navigation for a single-select `role="radiogroup"`.
 * Arrow keys (and Home/End) move selection + focus between the radios so the
 * group is a single tab stop, per the WAI-ARIA radio group pattern.
 */
export function useRovingRadioGroup(count: number, onSelectIndex: (i: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      let next = -1;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (idx + 1) % count;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (idx - 1 + count) % count;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      onSelectIndex(next);
      refs.current[next]?.focus();
    },
    [count, onSelectIndex],
  );
  return { refs, onKeyDown };
}

interface UseProceduralLevelWizardArgs {
  onGenerate: (config: ProceduralLevelConfig) => void;
}

export function useProceduralLevelWizard({ onGenerate }: UseProceduralLevelWizardArgs) {
  const [algorithm, setAlgorithm] = useState<GenAlgorithm>('bsp');
  const [levelType, setLevelType] = useState<LevelType>('dungeon');
  const [size, setSize] = useState<SizeParams>(DEFAULT_SIZE.dungeon);
  const [constraints, setConstraints] = useState<GameplayConstraints>({
    spawnPoints: true,
    lootPlacement: true,
    bossRoom: true,
    secretRooms: false,
    safeZones: false,
  });
  const [seed, setSeed] = useState('');
  const [blenderExporting, setBlenderExporting] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  // ── Live preview ──
  // Runs the chosen algorithm purely in TypeScript with the same FRandomStream
  // seed the UE codegen targets, so the layout the designer sees here matches
  // what UE will produce. Deferred so dragging sliders / typing stays smooth.
  const previewConfig = useMemo<PreviewConfig>(() => ({
    algorithm,
    gridWidth: size.gridWidth,
    gridHeight: size.gridHeight,
    roomCountMin: size.roomCountMin,
    roomCountMax: size.roomCountMax,
    corridorWidth: size.corridorWidth,
    seed,
  }), [algorithm, size, seed]);
  const deferredConfig = useDeferredValue(previewConfig);
  const preview = useMemo(() => generatePreview(deferredConfig), [deferredConfig]);

  const selectLevelType = useCallback((lt: LevelType) => {
    setLevelType(lt);
    setSize(DEFAULT_SIZE[lt]);
  }, []);

  const toggleConstraint = useCallback((key: keyof GameplayConstraints) => {
    setConstraints((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const updateSize = useCallback((key: keyof SizeParams, value: number) => {
    setSize((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    onGenerate({ algorithm, levelType, size, constraints, seed });
  }, [algorithm, levelType, size, constraints, seed, onGenerate]);

  const handleExportToBlender = useCallback(async () => {
    setBlenderExporting(true);
    setBlenderResult(null);
    try {
      // Export the *actual* previewed layout (same seed + algorithm the designer
      // is looking at), not a placeholder border. The preview grid is already a
      // CellType[][], so dungeonToGeometryScript consumes it directly.
      const grid = preview.grid;
      const rows = preview.height;
      const cols = preview.width;

      const geometryCode = dungeonToGeometryScript({
        grid,
        cellSize: 2,
        wallHeight: 3,
      });

      // Build spawn points from constraints
      const spawnPoints: { x: number; y: number; type: string }[] = [];
      if (constraints.spawnPoints) {
        spawnPoints.push({ x: 2, y: 2, type: 'player' });
      }
      if (constraints.bossRoom) {
        spawnPoints.push({ x: (cols - 2) * 2, y: (rows - 2) * 2, type: 'boss' });
      }
      if (constraints.lootPlacement) {
        spawnPoints.push({ x: Math.floor(cols / 2) * 2, y: Math.floor(rows / 2) * 2, type: 'loot' });
      }

      const metadataCode = levelMetadataScript({ spawnPoints });
      const combinedCode = geometryCode + '\n\n' + metadataCode;

      const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: combinedCode }),
      });
      if (result.ok) {
        setBlenderResult({ message: result.data.output || `Exported ${rows}x${cols} dungeon to Blender`, isError: false });
      } else {
        setBlenderResult({ message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender export failed', e);
      setBlenderResult({ message: e instanceof Error ? e.message : 'Export failed', isError: true });
    } finally {
      setBlenderExporting(false);
    }
  }, [preview, constraints]);

  const algNav = useRovingRadioGroup(ALGORITHMS.length, (i) => setAlgorithm(ALGORITHMS[i].id));
  const ltNav = useRovingRadioGroup(LEVEL_TYPES.length, (i) => selectLevelType(LEVEL_TYPES[i].id));

  const algDef = ALGORITHMS.find((a) => a.id === algorithm)!;
  const ltDef = LEVEL_TYPES.find((lt) => lt.id === levelType)!;

  return {
    algorithm,
    setAlgorithm,
    levelType,
    size,
    constraints,
    seed,
    setSeed,
    blenderExporting,
    blenderResult,
    blenderConnected,
    preview,
    selectLevelType,
    toggleConstraint,
    updateSize,
    handleGenerate,
    handleExportToBlender,
    algNav,
    ltNav,
    algDef,
    ltDef,
  };
}
