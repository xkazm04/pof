import type { SurfaceType, RenderFeature } from '../MaterialParameterConfigurator';

// ── Types ──

export interface AnalyzedProperties {
  /** Dominant colors extracted (hex strings) */
  colorPalette: string[];
  /** Inferred surface type */
  surfaceType: SurfaceType;
  /** Confidence 0-1 */
  surfaceConfidence: number;
  /** Material properties 0-1 (or appropriate range) */
  roughness: number;
  metallic: number;
  emissiveIntensity: number;
  subsurfacePresence: number;
  parallaxDepth: number;
  opacity: number;
  /** Inferred rendering features */
  features: RenderFeature[];
  /** Free-form description from analysis */
  description: string;
  /** Suggested adjustments */
  suggestions: string[];
}

export interface StyleTransferConfig {
  /** Base64 data URL of the reference image */
  imageDataUrl: string | null;
  /** User-provided description of what they want */
  referenceDescription: string;
  /** Analyzed properties (null until analysis runs) */
  analysis: AnalyzedProperties | null;
  /** User adjustments applied on top of analysis */
  adjustments: Partial<AnalyzedProperties>;
}
