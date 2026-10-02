import { useState, useCallback, useMemo } from 'react';
import { useManifest } from '@/hooks/useManifest';
import type { MaterialEntry } from '@/types/pof-bridge';
import type {
  SurfaceType, RenderFeature, MaterialOutputType, ParameterRange, MaterialConfiguratorConfig, ParentMaterialRef,
} from './types';
import { SURFACE_SPEC, refusalFor } from '@/lib/materials/surface-spec';
import { SURFACES } from './constants';
import { surfaceParamDefaults, getApplicableParams } from './helpers';
import { masterCandidates, toParentRef, parentParamDefaults, parentParamDefs } from './liveParent';

const INITIAL_SURFACE: SurfaceType = 'metal';

export function useMaterialParameterConfigurator(onGenerate: (config: MaterialConfiguratorConfig) => void) {
  // The initial state is exactly what selectSurface(INITIAL_SURFACE) sets, so the
  // first Generate ships a real metal (Metallic 1), not the BASE_PARAMS fallback.
  const [surfaceType, setSurfaceType] = useState<SurfaceType>(INITIAL_SURFACE);
  const [features, setFeatures] = useState<RenderFeature[]>(() => [...SURFACE_SPEC[INITIAL_SURFACE].defaultFeatures]);
  const [outputType, setOutputTypeState] = useState<MaterialOutputType>('master');
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => surfaceParamDefaults(INITIAL_SURFACE));
  const [explainMode, setExplainMode] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  // A live UE master the instance is parented to (null = the surface's own sliders).
  const [parent, setParent] = useState<ParentMaterialRef | null>(null);

  // ── Bridge data ──
  const { manifest, isConnected: bridgeConnected } = useManifest();
  const bridgeMaterialCount = manifest?.materials?.length ?? 0;

  // The masters in the live project, most-instanced first — each one can be instanced.
  const liveMasters = useMemo<MaterialEntry[]>(() => {
    const materials = manifest?.materials;
    if (!materials?.length) return [];
    const byPath = new Map(materials.map((m) => [m.path, m]));
    return masterCandidates(materials).map((p) => byPath.get(p)!);
  }, [manifest]);

  const selectSurface = useCallback((s: SurfaceType) => {
    setSurfaceType(s);
    setFeatures([...SURFACE_SPEC[s].defaultFeatures]);
    // Reset params to surface defaults — unless a live parent owns the sliders.
    if (!parent) setParamValues(surfaceParamDefaults(s));
  }, [parent]);

  const adoptParent = useCallback((entry: MaterialEntry) => {
    const ref = toParentRef(entry);
    setParent(ref);
    setOutputTypeState('instance');
    setParamValues(parentParamDefaults(ref));
  }, []);

  const clearParent = useCallback(() => {
    setParent(null);
    setParamValues(surfaceParamDefaults(surfaceType));
  }, [surfaceType]);

  // A master is never parented: choosing Master Material drops the live parent.
  const setOutputType = useCallback((t: MaterialOutputType) => {
    setOutputTypeState(t);
    if (t === 'master' && parent) clearParent();
  }, [parent, clearParent]);

  const toggleFeature = useCallback((f: RenderFeature) => {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }, []);

  const setParam = useCallback((name: string, value: number) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const applicableParams = useMemo(
    () => (parent ? parentParamDefs(parent) : getApplicableParams(surfaceType)),
    [parent, surfaceType],
  );
  const surfaceDef = SURFACES.find((s) => s.id === surfaceType)!;

  // A forbidden feature combination (the estimator's error rows) never dispatches.
  const refusal = useMemo(() => refusalFor(features), [features]);

  const handleGenerate = useCallback(() => {
    if (refusal) return;
    const params: Record<string, ParameterRange> = {};
    if (parent) {
      // Only what the parent exposes; a scalar with no manifest default ships only once moved.
      for (const s of parent.scalars) {
        const val = paramValues[s.name] ?? s.defaultValue;
        if (val === null) continue;
        params[s.name] = { name: s.name, min: s.min, max: s.max, defaultValue: val, step: s.step };
      }
      onGenerate({ surfaceType, features, outputType, params, parentMaterial: parent });
      return;
    }
    for (const p of applicableParams) {
      const val = paramValues[p.name] ?? p.defaultValue;
      params[p.name] = { name: p.name, min: p.min, max: p.max, defaultValue: val, step: p.step };
    }
    onGenerate({ surfaceType, features, outputType, params });
  }, [refusal, parent, surfaceType, features, outputType, paramValues, applicableParams, onGenerate]);

  return {
    surfaceType,
    features,
    outputType,
    paramValues,
    explainMode,
    showGlossary,
    setExplainMode,
    setShowGlossary,
    setOutputType,
    bridgeConnected,
    bridgeMaterialCount,
    liveMasters,
    parent,
    adoptParent,
    clearParent,
    selectSurface,
    toggleFeature,
    setParam,
    applicableParams,
    surfaceDef,
    refusal,
    handleGenerate,
  };
}
