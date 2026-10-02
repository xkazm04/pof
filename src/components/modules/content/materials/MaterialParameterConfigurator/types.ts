import type { LucideIcon } from 'lucide-react';
import type { PPParamPlain } from '@/types/post-process-studio';

// ── Types ──

// SurfaceType / RenderFeature are owned by the one surface spec (lib depends on
// lib, not on this component folder); re-exported so no import site breaks.
import type { SurfaceType, RenderFeature } from '@/lib/materials/surface-spec';
export type { SurfaceType, RenderFeature };

export type MaterialOutputType = 'master' | 'instance';

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
}

/** One scalar a live UE master exposes; `defaultValue` is null when the manifest's is not a number. */
export interface ParentScalar {
  name: string;
  min: number;
  max: number;
  defaultValue: number | null;
  step: number;
}

/** A live UE master (from the bridge manifest) a generated instance is parented to. */
export interface ParentMaterialRef {
  path: string;
  scalars: ParentScalar[];
  vectors: string[];
  textures: string[];
  switches: string[];
}

export interface MaterialConfiguratorConfig {
  surfaceType: SurfaceType;
  features: RenderFeature[];
  outputType: MaterialOutputType;
  params: Record<string, ParameterRange>;
  /** Present only when an instance targets a live master; absent = byte-identical legacy prompt. */
  parentMaterial?: ParentMaterialRef;
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
