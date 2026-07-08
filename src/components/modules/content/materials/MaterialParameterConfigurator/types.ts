import type { LucideIcon } from 'lucide-react';
import type { PPParamPlain } from '@/types/post-process-studio';

// ── Types ──

export type SurfaceType = 'metal' | 'cloth' | 'skin' | 'glass' | 'water' | 'emissive' | 'foliage' | 'stone';
export type RenderFeature = 'subsurface' | 'parallax' | 'emissive' | 'refraction' | 'tessellation' | 'worldPositionOffset';
export type MaterialOutputType = 'master' | 'instance';

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
}

export interface MaterialConfiguratorConfig {
  surfaceType: SurfaceType;
  features: RenderFeature[];
  outputType: MaterialOutputType;
  params: Record<string, ParameterRange>;
}

export interface SurfaceDef {
  id: SurfaceType;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
  defaultFeatures: RenderFeature[];
  /** Plain-English one-liner for the Explain Mode toggle. */
  plain: string;
}

export interface FeatureDef {
  id: RenderFeature;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  /** Plain-language label + explanation rendered in Explain Mode. */
  plain: { label: string; explanation: string };
}

export interface ParamDef {
  name: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  /** Which surface types this param applies to. Empty = all. */
  surfaces?: SurfaceType[];
  /** Plain-language decoder for Explain Mode. Shape mirrors PPParamPlain. */
  plain: PPParamPlain;
}

export interface GlossaryEntry { term: string; plain: string }
