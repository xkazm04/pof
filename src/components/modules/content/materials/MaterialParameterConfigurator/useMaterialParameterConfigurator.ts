import { useState, useCallback, useMemo } from 'react';
import { useManifest } from '@/hooks/useManifest';
import type {
  SurfaceType, RenderFeature, MaterialOutputType, ParameterRange, MaterialConfiguratorConfig,
} from './types';
import { SURFACES } from './constants';
import { getDefaultMetallic, getDefaultRoughness, getApplicableParams } from './helpers';

export function useMaterialParameterConfigurator(onGenerate: (config: MaterialConfiguratorConfig) => void) {
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('metal');
  const [features, setFeatures] = useState<RenderFeature[]>([]);
  const [outputType, setOutputType] = useState<MaterialOutputType>('master');
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
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
    const def = SURFACES.find((x) => x.id === s);
    setFeatures(def?.defaultFeatures ?? []);
    // Reset params to surface defaults
    setParamValues({
      Roughness: getDefaultRoughness(s),
      Metallic: getDefaultMetallic(s),
    });
  }, []);

  const toggleFeature = useCallback((f: RenderFeature) => {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }, []);

  const setParam = useCallback((name: string, value: number) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const applicableParams = getApplicableParams(surfaceType);
  const surfaceDef = SURFACES.find((s) => s.id === surfaceType)!;

  const handleGenerate = useCallback(() => {
    const params: Record<string, ParameterRange> = {};
    for (const p of applicableParams) {
      const val = paramValues[p.name] ?? p.defaultValue;
      params[p.name] = { name: p.name, min: p.min, max: p.max, defaultValue: val, step: p.step };
    }
    onGenerate({ surfaceType, features, outputType, params });
  }, [surfaceType, features, outputType, paramValues, applicableParams, onGenerate]);

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
    handleGenerate,
  };
}
