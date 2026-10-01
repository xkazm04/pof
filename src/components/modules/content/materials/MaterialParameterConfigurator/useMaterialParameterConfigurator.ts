import { useState, useCallback, useMemo } from 'react';
import { useManifest } from '@/hooks/useManifest';
import type {
  SurfaceType, RenderFeature, MaterialOutputType, ParameterRange, MaterialConfiguratorConfig,
} from './types';
import { SURFACE_SPEC, refusalFor } from '@/lib/materials/surface-spec';
import { SURFACES } from './constants';
import { surfaceParamDefaults, getApplicableParams } from './helpers';

const INITIAL_SURFACE: SurfaceType = 'metal';

export function useMaterialParameterConfigurator(onGenerate: (config: MaterialConfiguratorConfig) => void) {
  // The initial state is exactly what selectSurface(INITIAL_SURFACE) sets, so the
  // first Generate ships a real metal (Metallic 1), not the BASE_PARAMS fallback.
  const [surfaceType, setSurfaceType] = useState<SurfaceType>(INITIAL_SURFACE);
  const [features, setFeatures] = useState<RenderFeature[]>(() => [...SURFACE_SPEC[INITIAL_SURFACE].defaultFeatures]);
  const [outputType, setOutputType] = useState<MaterialOutputType>('master');
  const [paramValues, setParamValues] = useState<Record<string, number>>(() => surfaceParamDefaults(INITIAL_SURFACE));
  const [explainMode, setExplainMode] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  // ── Bridge data ──
  const { manifest, isConnected: bridgeConnected } = useManifest();

  const bridgeMaterials = useMemo(() => {
    if (!manifest?.materials?.length) return [];
    return manifest.materials.map((m) => ({
      path: m.path,
      domain: m.domain,
      blendMode: m.blendMode,
      shadingModel: m.shadingModel,
      paramCount: m.parameters.length,
      instanceCount: m.materialInstances.length,
      textureCount: m.textureReferences.length,
      parameters: m.parameters,
    }));
  }, [manifest]);

  const selectSurface = useCallback((s: SurfaceType) => {
    setSurfaceType(s);
    setFeatures([...SURFACE_SPEC[s].defaultFeatures]);
    // Reset params to surface defaults
    setParamValues(surfaceParamDefaults(s));
  }, []);

  const toggleFeature = useCallback((f: RenderFeature) => {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }, []);

  const setParam = useCallback((name: string, value: number) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const applicableParams = getApplicableParams(surfaceType);
  const surfaceDef = SURFACES.find((s) => s.id === surfaceType)!;

  // A forbidden feature combination (the estimator's error rows) never dispatches.
  const refusal = useMemo(() => refusalFor(features), [features]);

  const handleGenerate = useCallback(() => {
    if (refusal) return;
    const params: Record<string, ParameterRange> = {};
    for (const p of applicableParams) {
      const val = paramValues[p.name] ?? p.defaultValue;
      params[p.name] = { name: p.name, min: p.min, max: p.max, defaultValue: val, step: p.step };
    }
    onGenerate({ surfaceType, features, outputType, params });
  }, [refusal, surfaceType, features, outputType, paramValues, applicableParams, onGenerate]);

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
    bridgeMaterials,
    selectSurface,
    toggleFeature,
    setParam,
    applicableParams,
    surfaceDef,
    refusal,
    handleGenerate,
  };
}
