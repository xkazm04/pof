'use client';

import { useState, useCallback, useRef, useMemo, useEffect, useDeferredValue, useReducer } from 'react';
import type { KeyboardEvent } from 'react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { tryApiFetch } from '@/lib/api-utils';
import { dungeonToGeometryScript, type CellType } from '@/lib/blender-mcp/scripts/dungeon-to-geometry';
import { levelMetadataScript } from '@/lib/blender-mcp/scripts/level-metadata';
import type { ExecuteOutput } from '@/lib/blender-mcp/types';
import { logger } from '@/lib/logger';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import { previewConfigFromSpec, type ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { ALGORITHMS, LEVEL_TYPES } from './constants';
import {
  MAX_EXPORT_SIZE, EXPORT_CELL_SIZE, EXPORT_WALL_HEIGHT,
  buildExportPlan, describeExportPlan, describeSpawnPlacement, type ExportPlan,
} from './exportPlan';
import { planSpawns, type SpawnPlacement } from './spawnPlacement';
import { procgenSpecReducer, initialProcgenSpecState, type ProcgenSpecStore } from './specState';
import type { GenAlgorithm, LevelType, SizeParams, GameplayConstraints } from './types';

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
  /** Dispatch the C++ codegen task for exactly this spec. */
  onGenerate: (spec: ProcgenSpec) => void;
  /**
   * Controlled mode: the spec lives in a reducer the caller owns, so it outlives
   * this component (the level-design view unmounts the wizard on every tab
   * switch). Omitted, the wizard keeps a private instance of the same reducer.
   */
  specStore?: ProcgenSpecStore;
}

export function useProceduralLevelWizard({ onGenerate, specStore }: UseProceduralLevelWizardArgs) {
  const [ownState, ownDispatch] = useReducer(procgenSpecReducer, undefined, initialProcgenSpecState);
  const { spec } = specStore?.state ?? ownState;
  const dispatch = specStore?.dispatch ?? ownDispatch;
  const { algorithm, levelType, constraints, seedLabel: seed } = spec;
  const size = useMemo<SizeParams>(() => ({
    gridWidth: spec.gridWidth,
    gridHeight: spec.gridHeight,
    roomCountMin: spec.roomCountMin,
    roomCountMax: spec.roomCountMax,
    corridorWidth: spec.corridorWidth,
  }), [spec.gridWidth, spec.gridHeight, spec.roomCountMin, spec.roomCountMax, spec.corridorWidth]);

  // Being on screen is what makes the spec adoptable: the UE handoff offers it
  // from the first time a designer has seen its preview.
  useEffect(() => { dispatch({ type: 'shown' }); }, [dispatch]);

  const [blenderExporting, setBlenderExporting] = useState(false);
  const [blenderResult, setBlenderResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [pendingExport, setPendingExport] = useState<PendingBlenderExport | null>(null);
  const blenderConnected = useBlenderMCPStore((s) => s.connection.connected);

  // ── Spec → live preview ──
  // The wizard's state IS a ProcgenSpec (see specState); the preview config is
  // derived from it rather than assembled beside it, and the seed was resolved
  // once, by the reducer. The preview runs the chosen algorithm purely in TypeScript
  // against FRandomStream — it judges the PARAMETERS. It is NOT a picture of the
  // level UE will bake: `ARPGLevelGenerator` places room-template actors from a
  // pool and has no algorithm parameter, and the C++ codegen path is authored
  // freehand by the CLI (see `layoutAgreement` in procgen-spec).
  // Deferred so dragging sliders / typing stays smooth.
  const deferredSpec = useDeferredValue(spec);
  const preview = useMemo(() => generatePreview(previewConfigFromSpec(deferredSpec)), [deferredSpec]);

  const setAlgorithm = useCallback((a: GenAlgorithm) => dispatch({ type: 'setAlgorithm', algorithm: a }), [dispatch]);
  const setSeed = useCallback((s: string) => dispatch({ type: 'setSeed', seed: s }), [dispatch]);
  const selectLevelType = useCallback((lt: LevelType) => dispatch({ type: 'selectLevelType', levelType: lt }), [dispatch]);
  const toggleConstraint = useCallback((key: keyof GameplayConstraints) => dispatch({ type: 'toggleConstraint', key }), [dispatch]);
  const updateSize = useCallback((key: keyof SizeParams, value: number) => dispatch({ type: 'updateSize', key, value }), [dispatch]);

  // The spec on screen, as is. What the C++ prompt uses of it is decided by the
  // prompt builder against `PROCGEN_ENGINES['llm-codegen'].reads` (enforced by
  // test), not by stripping fields here.
  const handleGenerate = useCallback(() => onGenerate(spec), [spec, onGenerate]);

  // ── Blender export: prepare → state the real numbers → confirm ──
  // The export does NOT ship the preview grid. The preview is capped at 96 per
  // side for interactive smoothness, so exporting it silently downscaled a
  // configured 256x256 level to 96x96. Preparing REGENERATES at the requested
  // size (bounded by MAX_EXPORT_SIZE, measured at 8-25ms for a 256x256 grid),
  // from the LIVE config rather than the deferred one, so the operator confirms
  // the settings currently on screen.
  const prepareBlenderExport = useCallback(() => {
    setBlenderResult(null);
    const full = generatePreview(previewConfigFromSpec(spec, MAX_EXPORT_SIZE));
    const plan = buildExportPlan({
      algorithm: spec.algorithm,
      requestedWidth: spec.gridWidth,
      requestedHeight: spec.gridHeight,
      grid: full.grid,
      scale: full.scale,
      seedLabel: spec.seedLabel,
      seedValue: full.seedValue,
    });
    setPendingExport({ plan, placement: planSpawns(full.grid, constraints, EXPORT_CELL_SIZE), grid: full.grid });
  }, [spec, constraints]);

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
    spec,
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
