'use client';

import { useState, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import type { KeyboardEvent } from 'react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { tryApiFetch } from '@/lib/api-utils';
import { dungeonToGeometryScript, type CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { levelMetadataScript } from '@/lib/blender-mcp/scripts/level-metadata';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import { generatePreview, type PreviewConfig } from '@/lib/level-design/procgen-preview';
import { ALGORITHMS, LEVEL_TYPES, DEFAULT_SIZE } from './constants';
import {
  MAX_EXPORT_SIZE, EXPORT_CELL_SIZE, EXPORT_WALL_HEIGHT,
  buildExportPlan, describeExportPlan, describeSpawnPlacement, type ExportPlan,
} from './exportPlan';
import { planSpawns, type SpawnPlacement } from './spawnPlacement';
import type {
  GenAlgorithm, LevelType, SizeParams, GameplayConstraints, ProceduralLevelConfig,
} from './types';

/** A prepared export, held until the operator confirms the size it states. */
export interface PendingBlenderExport {
  plan: ExportPlan;
  placement: SpawnPlacement;
  /** The regenerated full-size grid this export will ship — NOT the preview grid. */
  grid: CellType[][];
}

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
  const [pendingExport, setPendingExport] = useState<PendingBlenderExport | null>(null);
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

  // ── Blender export: prepare → state the real numbers → confirm ──
  // The export does NOT ship the preview grid. The preview is capped at 96 per
  // side for interactive smoothness, so exporting it silently downscaled a
  // configured 256x256 level to 96x96. Preparing REGENERATES at the requested
  // size (bounded by MAX_EXPORT_SIZE, measured at 8-25ms for a 256x256 grid),
  // from the LIVE config rather than the deferred one, so the operator confirms
  // the settings currently on screen.
  const prepareBlenderExport = useCallback(() => {
    setBlenderResult(null);
    const full = generatePreview({ ...previewConfig, maxPreviewSize: MAX_EXPORT_SIZE });
    const plan = buildExportPlan({
      algorithm: previewConfig.algorithm,
      requestedWidth: previewConfig.gridWidth,
      requestedHeight: previewConfig.gridHeight,
      grid: full.grid,
      scale: full.scale,
      seedLabel: previewConfig.seed,
      seedValue: full.seedValue,
    });
    setPendingExport({ plan, placement: planSpawns(full.grid, constraints, EXPORT_CELL_SIZE), grid: full.grid });
  }, [previewConfig, constraints]);

  const cancelBlenderExport = useCallback(() => setPendingExport(null), []);

  const confirmBlenderExport = useCallback(async () => {
    if (!pendingExport) return;
    const { plan, placement, grid } = pendingExport;
    setBlenderExporting(true);
    setBlenderResult(null);
    try {
      // The header carries the same numbers the confirm step showed, so the
      // script stays honest once it is read in Blender with no UI beside it.
      const geometryCode = dungeonToGeometryScript({
        grid,
        cellSize: EXPORT_CELL_SIZE,
        wallHeight: EXPORT_WALL_HEIGHT,
        meta: {
          algorithm: plan.algorithm,
          requestedWidth: plan.requestedWidth,
          requestedHeight: plan.requestedHeight,
          scale: plan.scale,
          seedLabel: plan.seedLabel,
          seedValue: plan.seedValue,
        },
      });
      const metadataCode = levelMetadataScript({ spawnPoints: placement.spawns });
      const combinedCode = geometryCode + '\n\n' + metadataCode;

      const result = await tryApiFetch<ExecuteOutput>('/api/blender-mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: combinedCode }),
      });
      if (result.ok) {
        // Report the size that was actually shipped, never the configured one.
        const shipped = `Exported ${plan.width}x${plan.height} ${plan.isFullSize ? '' : `(${Math.round(plan.scale * 100)}% of requested) `}level to Blender. ${describeSpawnPlacement(placement)}`;
        setBlenderResult({ message: result.data.output || shipped, isError: false });
        setPendingExport(null);
      } else {
        setBlenderResult({ message: result.error, isError: true });
      }
    } catch (e) {
      logger.warn('Blender export failed', e);
      setBlenderResult({ message: e instanceof Error ? e.message : 'Export failed', isError: true });
    } finally {
      setBlenderExporting(false);
    }
  }, [pendingExport]);

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
    pendingExport,
    exportPlanSummary: pendingExport ? describeExportPlan(pendingExport.plan) : null,
    spawnPlacementSummary: pendingExport ? describeSpawnPlacement(pendingExport.placement) : null,
    preview,
    selectLevelType,
    toggleConstraint,
    updateSize,
    handleGenerate,
    prepareBlenderExport,
    cancelBlenderExport,
    confirmBlenderExport,
    algNav,
    ltNav,
    algDef,
    ltDef,
  };
}
