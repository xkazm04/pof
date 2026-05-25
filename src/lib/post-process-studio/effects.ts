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
      { name: 'Intensity', description: 'Overall brightness multiplier', type: 'float', defaultValue: 0.675, value: 0.675, min: 0, max: 8, step: 0.025, ueProperty: 'BloomIntensity',
        plain: { label: 'Glow Strength', explanation: 'How strongly bright spots — lamps, the sun, glowing magic — bleed a soft halo into the picture.', cue: 'glow', lowLabel: 'None', highLabel: 'Dreamy' } },
      { name: 'Threshold', description: 'Minimum brightness to trigger bloom', type: 'float', defaultValue: -1, value: -1, min: -1, max: 8, step: 0.1, ueProperty: 'BloomThreshold',
        plain: { label: 'Glow Cutoff', explanation: 'How bright something must be before it starts to glow — higher means only the very brightest things light up.', cue: 'threshold', lowLabel: 'Everything', highLabel: 'Only brightest' } },
      { name: 'Size Scale', description: 'Kernel radius multiplier', type: 'float', defaultValue: 4, value: 4, min: 0.1, max: 64, step: 0.5, ueProperty: 'BloomSizeScale',
        plain: { label: 'Glow Spread', explanation: 'How far the glow spreads out from bright spots — a tight rim, or a wide soft bloom.', cue: 'blur', lowLabel: 'Tight', highLabel: 'Wide' } },
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
      { name: 'Temperature', description: 'Color temperature in Kelvin', type: 'float', defaultValue: 6500, value: 6500, min: 1500, max: 15000, step: 100, ueProperty: 'WhiteTemp',
        plain: { label: 'Warmth', explanation: 'Shifts the whole picture toward cozy orange (warm) or cool blue, like swapping a light bulb.', cue: 'temperature', lowLabel: 'Cool blue', highLabel: 'Warm orange' } },
      { name: 'Tint', description: 'Green ↔ Magenta shift', type: 'float', defaultValue: 0, value: 0, min: -1, max: 1, step: 0.01, ueProperty: 'WhiteTint',
        plain: { label: 'Green–Pink Tint', explanation: 'Nudges colors toward green or magenta-pink to correct or stylize the overall tint.', cue: 'tint', lowLabel: 'Green', highLabel: 'Pink' } },
      { name: 'Saturation', description: 'Global color saturation', type: 'float', defaultValue: 1, value: 1, min: 0, max: 2, step: 0.01, ueProperty: 'ColorSaturation',
        plain: { label: 'Color Vividness', explanation: 'How rich and punchy colors look — from drained black-and-white to super-vivid.', cue: 'saturation', lowLabel: 'Grey', highLabel: 'Vivid' } },
      { name: 'Contrast', description: 'Global contrast', type: 'float', defaultValue: 1, value: 1, min: 0, max: 2, step: 0.01, ueProperty: 'ColorContrast',
        plain: { label: 'Contrast', explanation: 'The gap between the darkest darks and brightest brights — flat and soft, or bold and punchy.', cue: 'contrast', lowLabel: 'Flat', highLabel: 'Punchy' } },
      { name: 'Gamma', description: 'Midtone gamma adjustment', type: 'float', defaultValue: 1, value: 1, min: 0.5, max: 2, step: 0.01, ueProperty: 'ColorGamma',
        plain: { label: 'Midtone Brightness', explanation: 'Brightens or darkens the mid-tones without crushing shadows or blowing out highlights.', cue: 'brightness', lowLabel: 'Darker', highLabel: 'Brighter' } },
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
      { name: 'Focal Distance', description: 'Distance to sharp focus plane (cm)', type: 'float', defaultValue: 0, value: 0, min: 0, max: 10000, step: 50, ueProperty: 'DepthOfFieldFocalDistance',
        plain: { label: 'Focus Distance', explanation: 'How far from the camera things are razor-sharp; anything nearer or farther softens out.', cue: 'distance', lowLabel: 'Near', highLabel: 'Far' } },
      { name: 'F-Stop', description: 'Aperture (lower = more blur)', type: 'float', defaultValue: 4, value: 4, min: 0.7, max: 32, step: 0.1, ueProperty: 'DepthOfFieldFstop',
        plain: { label: 'Background Blur', explanation: 'Low numbers blur the background heavily like a portrait photo; high numbers keep almost everything in focus.', cue: 'aperture', lowLabel: 'Heavy blur', highLabel: 'All sharp' } },
      { name: 'Sensor Width', description: 'Sensor width in mm', type: 'float', defaultValue: 24.576, value: 24.576, min: 0.1, max: 100, step: 0.5, ueProperty: 'DepthOfFieldSensorWidth',
        plain: { label: 'Camera Sensor Size', explanation: 'Simulates a bigger or smaller camera sensor — larger sensors give a more cinematic, shallow look.', cue: 'level', lowLabel: 'Compact', highLabel: 'Cinema' } },
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
      { name: 'Intensity', description: 'Darkening strength', type: 'float', defaultValue: 0.5, value: 0.5, min: 0, max: 1, step: 0.01, ueProperty: 'AmbientOcclusionIntensity',
        plain: { label: 'Contact Shadows', explanation: 'Soft shadows where surfaces meet — corners, crevices, under objects — that add depth and grounding.', cue: 'corners', lowLabel: 'Subtle', highLabel: 'Strong' } },
      { name: 'Radius', description: 'World-space sampling radius (cm)', type: 'float', defaultValue: 200, value: 200, min: 0.1, max: 500, step: 5, ueProperty: 'AmbientOcclusionRadius',
        plain: { label: 'Shadow Reach', explanation: 'How far these contact shadows spread out from where surfaces touch.', cue: 'level', lowLabel: 'Tight', highLabel: 'Wide' } },
      { name: 'Quality', description: 'Sample count quality level', type: 'float', defaultValue: 50, value: 50, min: 0, max: 100, step: 5, ueProperty: 'AmbientOcclusionQuality',
        plain: { label: 'Shadow Quality', explanation: 'More samples mean smoother, cleaner contact shadows — at a higher GPU cost.', cue: 'level', lowLabel: 'Fast', highLabel: 'Best' } },
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
      { name: 'Amount', description: 'Blur strength multiplier', type: 'float', defaultValue: 0.5, value: 0.5, min: 0, max: 1, step: 0.01, ueProperty: 'MotionBlurAmount',
        plain: { label: 'Motion Smear', explanation: 'How much fast-moving things streak and blur, like a slow camera shutter.', cue: 'speed', lowLabel: 'Crisp', highLabel: 'Streaky' } },
      { name: 'Max', description: 'Max blur in % of screen', type: 'float', defaultValue: 5, value: 5, min: 0, max: 100, step: 1, ueProperty: 'MotionBlurMax',
        plain: { label: 'Max Smear Length', explanation: 'Caps how long motion streaks can get, measured as a share of the screen.', cue: 'speed', lowLabel: 'Short', highLabel: 'Long' } },
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
      { name: 'Intensity', description: 'Edge darkening strength', type: 'float', defaultValue: 0.4, value: 0.4, min: 0, max: 1, step: 0.01, ueProperty: 'VignetteIntensity',
        plain: { label: 'Edge Darkening', explanation: 'Darkens the corners and edges of the screen to draw the eye toward the center.', cue: 'vignette', lowLabel: 'None', highLabel: 'Heavy' } },
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
      { name: 'Min Brightness', description: 'Minimum auto-exposure EV', type: 'float', defaultValue: 0.03, value: 0.03, min: 0, max: 10, step: 0.01, ueProperty: 'AutoExposureMinBrightness',
        plain: { label: 'Darkest Auto-Brightness', explanation: 'The dimmest the view is allowed to get in bright scenes — like your eyes squinting in sunlight.', cue: 'brightness', lowLabel: 'Very dark', highLabel: 'Bright' } },
      { name: 'Max Brightness', description: 'Maximum auto-exposure EV', type: 'float', defaultValue: 2, value: 2, min: 0, max: 10, step: 0.1, ueProperty: 'AutoExposureMaxBrightness',
        plain: { label: 'Brightest Auto-Brightness', explanation: 'The brightest the view is allowed to get in dark scenes — like your eyes adjusting to a dark room.', cue: 'brightness', lowLabel: 'Dim', highLabel: 'Very bright' } },
      { name: 'Speed Up', description: 'Dark→bright adaptation speed', type: 'float', defaultValue: 3, value: 3, min: 0.1, max: 20, step: 0.1, ueProperty: 'AutoExposureSpeedUp',
        plain: { label: 'Adjust Speed (to Bright)', explanation: 'How quickly the view adapts when stepping from a dark area into a bright one.', cue: 'speed', lowLabel: 'Slow', highLabel: 'Instant' } },
      { name: 'Speed Down', description: 'Bright→dark adaptation speed', type: 'float', defaultValue: 1, value: 1, min: 0.1, max: 20, step: 0.1, ueProperty: 'AutoExposureSpeedDown',
        plain: { label: 'Adjust Speed (to Dark)', explanation: 'How quickly the view adapts when stepping from a bright area into a dark one.', cue: 'speed', lowLabel: 'Slow', highLabel: 'Instant' } },
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
      { name: 'Intensity', description: 'Aberration strength', type: 'float', defaultValue: 0, value: 0, min: 0, max: 5, step: 0.1, ueProperty: 'SceneFringeIntensity',
        plain: { label: 'Color Fringing', explanation: 'Splits colors into red and blue edges, mimicking a cheap or stylized camera lens.', cue: 'fringe', lowLabel: 'Clean', highLabel: 'Trippy' } },
      { name: 'Start Offset', description: 'Distance from center to start effect', type: 'float', defaultValue: 0, value: 0, min: 0, max: 1, step: 0.01, ueProperty: 'ChromaticAberrationStartOffset',
        plain: { label: 'Fringe Start', explanation: 'How far out from the center the color-splitting begins — the center stays clean, only the edges fringe.', cue: 'distance', lowLabel: 'From center', highLabel: 'Edges only' } },
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
      { name: 'Intensity', description: 'Grain visibility', type: 'float', defaultValue: 0, value: 0, min: 0, max: 1, step: 0.01, ueProperty: 'FilmGrainIntensity',
        plain: { label: 'Film Grain', explanation: 'Adds a fine speckle of analog-film noise over the picture for a gritty, cinematic feel.', cue: 'grain', lowLabel: 'Clean', highLabel: 'Gritty' } },
      { name: 'Jitter', description: 'Temporal grain variation', type: 'float', defaultValue: 0.5, value: 0.5, min: 0, max: 1, step: 0.01, ueProperty: 'FilmGrainIntensityHighlights',
        plain: { label: 'Grain Liveliness', explanation: 'How much the grain flickers and shifts frame to frame, versus sitting perfectly still.', cue: 'grain', lowLabel: 'Static', highLabel: 'Lively' } },
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
      { name: 'Density', description: 'Base fog density', type: 'float', defaultValue: 0.02, value: 0.02, min: 0, max: 0.5, step: 0.001, ueProperty: 'FogDensity',
        plain: { label: 'Fog Thickness', explanation: 'How thick the haze is — a light mist or a soupy, can’t-see-far fog.', cue: 'fog', lowLabel: 'Clear', highLabel: 'Soupy' } },
      { name: 'Height Falloff', description: 'Density decay rate with height', type: 'float', defaultValue: 0.2, value: 0.2, min: 0.001, max: 2, step: 0.01, ueProperty: 'FogHeightFalloff',
        plain: { label: 'Fog Settling', explanation: 'How quickly fog thins out as it rises — high values keep it hugging the ground.', cue: 'level', lowLabel: 'Fills air', highLabel: 'Hugs ground' } },
      { name: 'Start Distance', description: 'Distance before fog appears (cm)', type: 'float', defaultValue: 0, value: 0, min: 0, max: 50000, step: 100, ueProperty: 'FogStartDistance',
        plain: { label: 'Fog Start Distance', explanation: 'How far away the fog begins; everything nearer than this stays clear.', cue: 'distance', lowLabel: 'Right away', highLabel: 'Far off' } },
      { name: 'Inscattering R', description: 'Fog color — red channel', type: 'float', defaultValue: 0.45, value: 0.45, min: 0, max: 1, step: 0.01, ueProperty: 'FogInscatteringColorR',
        plain: { label: 'Fog Color — Red', explanation: 'How much red is mixed into the fog’s tint.', cue: 'channel-r', lowLabel: 'None', highLabel: 'Full' } },
      { name: 'Inscattering G', description: 'Fog color — green channel', type: 'float', defaultValue: 0.55, value: 0.55, min: 0, max: 1, step: 0.01, ueProperty: 'FogInscatteringColorG',
        plain: { label: 'Fog Color — Green', explanation: 'How much green is mixed into the fog’s tint.', cue: 'channel-g', lowLabel: 'None', highLabel: 'Full' } },
      { name: 'Inscattering B', description: 'Fog color — blue channel', type: 'float', defaultValue: 0.7, value: 0.7, min: 0, max: 1, step: 0.01, ueProperty: 'FogInscatteringColorB',
        plain: { label: 'Fog Color — Blue', explanation: 'How much blue is mixed into the fog’s tint.', cue: 'channel-b', lowLabel: 'None', highLabel: 'Full' } },
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
