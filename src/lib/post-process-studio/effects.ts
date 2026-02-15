/**
 * Default post-process effects with tunable parameters and GPU cost models.
 *
 * Each effect mirrors a real UE5 FPostProcessSettings subsystem with
 * parameters exposed as UPROPERTY(EditAnywhere). GPU costs are approximate
 * estimates at 1080p based on UE5 profiling data.
 */

import type { PPStudioEffect } from '@/types/post-process-studio';

export const DEFAULT_EFFECTS: PPStudioEffect[] = [
  {
    id: 'bloom',
    name: 'Bloom',
    category: 'lighting',
    ueClass: 'FPostProcessSettings::Bloom*',
    description: 'Glow around bright areas via convolution kernel',
    enabled: true,
    priority: 0,
    gpuCostMs: 0.3,
    params: [
      { name: 'Intensity', description: 'Overall brightness multiplier', type: 'float', defaultValue: 0.675, value: 0.675, min: 0, max: 8, step: 0.025, ueProperty: 'BloomIntensity' },
      { name: 'Threshold', description: 'Minimum brightness to trigger bloom', type: 'float', defaultValue: -1, value: -1, min: -1, max: 8, step: 0.1, ueProperty: 'BloomThreshold' },
      { name: 'Size Scale', description: 'Kernel radius multiplier', type: 'float', defaultValue: 4, value: 4, min: 0.1, max: 64, step: 0.5, ueProperty: 'BloomSizeScale' },
    ],
  },
  {
    id: 'color-grading',
    name: 'Color Grading',
    category: 'color',
    ueClass: 'FPostProcessSettings::ColorGrading*',
    description: 'White balance, saturation, contrast, and tone mapping',
    enabled: true,
    priority: 1,
    gpuCostMs: 0.1,
    params: [
      { name: 'Temperature', description: 'Color temperature in Kelvin', type: 'float', defaultValue: 6500, value: 6500, min: 1500, max: 15000, step: 100, ueProperty: 'WhiteTemp' },
      { name: 'Tint', description: 'Green ↔ Magenta shift', type: 'float', defaultValue: 0, value: 0, min: -1, max: 1, step: 0.01, ueProperty: 'WhiteTint' },
      { name: 'Saturation', description: 'Global color saturation', type: 'float', defaultValue: 1, value: 1, min: 0, max: 2, step: 0.01, ueProperty: 'ColorSaturation' },
      { name: 'Contrast', description: 'Global contrast', type: 'float', defaultValue: 1, value: 1, min: 0, max: 2, step: 0.01, ueProperty: 'ColorContrast' },
      { name: 'Gamma', description: 'Midtone gamma adjustment', type: 'float', defaultValue: 1, value: 1, min: 0.5, max: 2, step: 0.01, ueProperty: 'ColorGamma' },
    ],
  },
  {
    id: 'depth-of-field',
    name: 'Depth of Field',
    category: 'blur',
    ueClass: 'FPostProcessSettings::DepthOfField*',
    description: 'Cinematic focus blur with bokeh',
    enabled: false,
    priority: 2,
    gpuCostMs: 0.8,
    params: [
      { name: 'Focal Distance', description: 'Distance to sharp focus plane (cm)', type: 'float', defaultValue: 0, value: 0, min: 0, max: 10000, step: 50, ueProperty: 'DepthOfFieldFocalDistance' },
      { name: 'F-Stop', description: 'Aperture (lower = more blur)', type: 'float', defaultValue: 4, value: 4, min: 0.7, max: 32, step: 0.1, ueProperty: 'DepthOfFieldFstop' },
      { name: 'Sensor Width', description: 'Sensor width in mm', type: 'float', defaultValue: 24.576, value: 24.576, min: 0.1, max: 100, step: 0.5, ueProperty: 'DepthOfFieldSensorWidth' },
    ],
  },
  {
    id: 'ambient-occlusion',
    name: 'Ambient Occlusion',
    category: 'lighting',
    ueClass: 'FPostProcessSettings::AmbientOcclusion*',
    description: 'Screen-space darkening in crevices and corners',
    enabled: true,
    priority: 3,
    gpuCostMs: 0.5,
    params: [
      { name: 'Intensity', description: 'Darkening strength', type: 'float', defaultValue: 0.5, value: 0.5, min: 0, max: 1, step: 0.01, ueProperty: 'AmbientOcclusionIntensity' },
      { name: 'Radius', description: 'World-space sampling radius (cm)', type: 'float', defaultValue: 200, value: 200, min: 0.1, max: 500, step: 5, ueProperty: 'AmbientOcclusionRadius' },
      { name: 'Quality', description: 'Sample count quality level', type: 'float', defaultValue: 50, value: 50, min: 0, max: 100, step: 5, ueProperty: 'AmbientOcclusionQuality' },
    ],
  },
  {
    id: 'motion-blur',
    name: 'Motion Blur',
    category: 'blur',
    ueClass: 'FPostProcessSettings::MotionBlur*',
    description: 'Per-object and camera velocity blur',
    enabled: false,
    priority: 4,
    gpuCostMs: 0.4,
    params: [
      { name: 'Amount', description: 'Blur strength multiplier', type: 'float', defaultValue: 0.5, value: 0.5, min: 0, max: 1, step: 0.01, ueProperty: 'MotionBlurAmount' },
      { name: 'Max', description: 'Max blur in % of screen', type: 'float', defaultValue: 5, value: 5, min: 0, max: 100, step: 1, ueProperty: 'MotionBlurMax' },
    ],
  },
  {
    id: 'vignette',
    name: 'Vignette',
    category: 'atmosphere',
    ueClass: 'FPostProcessSettings::VignetteIntensity',
    description: 'Darkened screen edges for a cinematic feel',
    enabled: true,
    priority: 5,
    gpuCostMs: 0.05,
    params: [
      { name: 'Intensity', description: 'Edge darkening strength', type: 'float', defaultValue: 0.4, value: 0.4, min: 0, max: 1, step: 0.01, ueProperty: 'VignetteIntensity' },
    ],
  },
  {
    id: 'exposure',
    name: 'Auto Exposure',
    category: 'lighting',
    ueClass: 'FPostProcessSettings::AutoExposure*',
    description: 'Eye adaptation with min/max brightness and speed',
    enabled: false,
    priority: 6,
    gpuCostMs: 0.15,
    params: [
      { name: 'Min Brightness', description: 'Minimum auto-exposure EV', type: 'float', defaultValue: 0.03, value: 0.03, min: 0, max: 10, step: 0.01, ueProperty: 'AutoExposureMinBrightness' },
      { name: 'Max Brightness', description: 'Maximum auto-exposure EV', type: 'float', defaultValue: 2, value: 2, min: 0, max: 10, step: 0.1, ueProperty: 'AutoExposureMaxBrightness' },
      { name: 'Speed Up', description: 'Dark→bright adaptation speed', type: 'float', defaultValue: 3, value: 3, min: 0.1, max: 20, step: 0.1, ueProperty: 'AutoExposureSpeedUp' },
      { name: 'Speed Down', description: 'Bright→dark adaptation speed', type: 'float', defaultValue: 1, value: 1, min: 0.1, max: 20, step: 0.1, ueProperty: 'AutoExposureSpeedDown' },
    ],
  },
  {
    id: 'chromatic-aberration',
    name: 'Chromatic Aberration',
    category: 'special',
    ueClass: 'FPostProcessSettings::ChromaticAberration*',
    description: 'RGB channel offset simulating lens imperfection',
    enabled: false,
    priority: 7,
    gpuCostMs: 0.1,
    params: [
      { name: 'Intensity', description: 'Aberration strength', type: 'float', defaultValue: 0, value: 0, min: 0, max: 5, step: 0.1, ueProperty: 'SceneFringeIntensity' },
      { name: 'Start Offset', description: 'Distance from center to start effect', type: 'float', defaultValue: 0, value: 0, min: 0, max: 1, step: 0.01, ueProperty: 'ChromaticAberrationStartOffset' },
    ],
  },
  {
    id: 'film-grain',
    name: 'Film Grain',
    category: 'special',
    ueClass: 'FPostProcessSettings::FilmGrain*',
    description: 'Cinematic noise overlay for analog film aesthetic',
    enabled: false,
    priority: 8,
    gpuCostMs: 0.08,
    params: [
      { name: 'Intensity', description: 'Grain visibility', type: 'float', defaultValue: 0, value: 0, min: 0, max: 1, step: 0.01, ueProperty: 'FilmGrainIntensity' },
      { name: 'Jitter', description: 'Temporal grain variation', type: 'float', defaultValue: 0.5, value: 0.5, min: 0, max: 1, step: 0.01, ueProperty: 'FilmGrainIntensityHighlights' },
    ],
  },
  {
    id: 'fog',
    name: 'Exponential Height Fog',
    category: 'atmosphere',
    ueClass: 'AExponentialHeightFog / FPostProcessSettings',
    description: 'Volumetric distance and height-based fog',
    enabled: false,
    priority: 9,
    gpuCostMs: 0.6,
    params: [
      { name: 'Density', description: 'Base fog density', type: 'float', defaultValue: 0.02, value: 0.02, min: 0, max: 0.5, step: 0.001, ueProperty: 'FogDensity' },
      { name: 'Height Falloff', description: 'Density decay rate with height', type: 'float', defaultValue: 0.2, value: 0.2, min: 0.001, max: 2, step: 0.01, ueProperty: 'FogHeightFalloff' },
      { name: 'Start Distance', description: 'Distance before fog appears (cm)', type: 'float', defaultValue: 0, value: 0, min: 0, max: 50000, step: 100, ueProperty: 'FogStartDistance' },
      { name: 'Inscattering R', description: 'Fog color — red channel', type: 'float', defaultValue: 0.45, value: 0.45, min: 0, max: 1, step: 0.01, ueProperty: 'FogInscatteringColorR' },
      { name: 'Inscattering G', description: 'Fog color — green channel', type: 'float', defaultValue: 0.55, value: 0.55, min: 0, max: 1, step: 0.01, ueProperty: 'FogInscatteringColorG' },
      { name: 'Inscattering B', description: 'Fog color — blue channel', type: 'float', defaultValue: 0.7, value: 0.7, min: 0, max: 1, step: 0.01, ueProperty: 'FogInscatteringColorB' },
    ],
  },
];

/**
 * Resolution multipliers for GPU cost scaling.
 * Costs are defined at 1080p, then scaled by pixel count ratio.
 */
export const RESOLUTION_MULTIPLIERS: Record<string, number> = {
  '720p': 0.56,
  '1080p': 1.0,
  '1440p': 1.78,
  '4K': 4.0,
};

/** Frame-time budget targets per resolution */
export const FRAME_BUDGETS_MS: Record<string, number> = {
  '720p': 4.0,
  '1080p': 5.0,
  '1440p': 6.0,
  '4K': 8.0,
};
