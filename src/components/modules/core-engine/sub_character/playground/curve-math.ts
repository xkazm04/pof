import type { FeelPreset } from '@/lib/character-feel-optimizer';
import type { CurvePoint, DerivedGenomeValues } from './types';
import { lerp, invLerp, VALUE_RANGES } from './types';

/* ── Default curve points derived from preset ──────────────────────────────── */

export function presetToAccelCurve(preset: FeelPreset): CurvePoint[] {
  const { maxWalkSpeed, maxSprintSpeed, acceleration } = preset.profile.movement;
  const accelT = invLerp(800, 4500, acceleration);
  // Shape: starts at 0, ramps up based on acceleration, plateaus at max speed
  const midY = invLerp(200, 1000, maxWalkSpeed);
  const topY = invLerp(200, 1000, maxSprintSpeed);
  const rampX = 0.1 + (1 - accelT) * 0.3; // fast accel = steeper ramp
  return [
    { x: 0, y: 0 },
    { x: rampX * 0.5, y: midY * 0.4 },
    { x: rampX, y: midY },
    { x: 0.5 + rampX * 0.25, y: midY + (topY - midY) * 0.7 },
    { x: 0.8, y: topY * 0.95 },
    { x: 1, y: topY },
  ];
}

export function presetToDodgeCurve(preset: FeelPreset): CurvePoint[] {
  const { distance, duration, iFrameStart, iFrameDuration } = preset.profile.dodge;
  const distT = invLerp(150, 600, distance);
  const durT = invLerp(0.15, 0.9, duration);
  const ifStartT = invLerp(0.0, 0.15, iFrameStart);
  const ifDurT = invLerp(0.05, 0.5, iFrameDuration);
  // Shape: quick burst up (dodge launch), peak at distance, fall-off
  return [
    { x: 0, y: 0 },
    { x: 0.1, y: distT * 0.6 },
    { x: 0.25 + ifStartT * 0.1, y: distT },
    { x: 0.5, y: distT * 0.9 + ifDurT * 0.1 },
    { x: 0.7 + durT * 0.1, y: distT * 0.3 },
    { x: 1, y: 0 },
  ];
}

export function presetToCameraCurve(preset: FeelPreset): CurvePoint[] {
  const { armLength, lagSpeed, fovBase } = preset.profile.camera;
  const armT = invLerp(300, 1200, armLength);
  const lagT = invLerp(3, 20, lagSpeed);
  const fovT = invLerp(70, 110, fovBase);
  // Shape: camera lag response curve - how fast camera catches up
  return [
    { x: 0, y: 0 },
    { x: 0.15, y: lagT * 0.5 },
    { x: 0.35, y: lagT * 0.85 },
    { x: 0.55, y: armT * 0.7 + fovT * 0.3 },
    { x: 0.8, y: armT },
    { x: 1, y: armT * 0.95 + fovT * 0.05 },
  ];
}

/* ── Derive genome values from curves ─────────────────────────────────────── */

export function derivedFromCurves(
  accel: CurvePoint[],
  dodge: CurvePoint[],
  camera: CurvePoint[],
): DerivedGenomeValues {
  // Acceleration curve: peak Y = sprint speed, mid Y = walk speed, steepness = acceleration
  const accelPeakY = Math.max(...accel.map(p => p.y));
  const accelMidY = accel[2]?.y ?? 0.5;
  const rampX = accel[2]?.x ?? 0.3;
  const steepness = accelMidY / Math.max(rampX, 0.05);

  // Dodge curve: peak Y = distance, width = duration, left shoulder = i-frame timing
  const dodgePeakY = Math.max(...dodge.map(p => p.y));
  const dodgePeakIdx = dodge.findIndex(p => p.y === dodgePeakY);
  const dodgePeakX = dodge[dodgePeakIdx]?.x ?? 0.3;
  const ifStartX = dodge[1]?.x ?? 0.1;
  const dodgeWidth = dodge[4]?.x ?? 0.7;

  // Camera curve: settling value = arm length, initial slope = lag speed, mid spread = FOV
  const cameraPeakY = Math.max(...camera.map(p => p.y));
  const cameraInitSlope = (camera[1]?.y ?? 0) / Math.max(camera[1]?.x ?? 0.15, 0.05);
  const cameraMidY = camera[3]?.y ?? 0.5;

  return {
    maxWalkSpeed: Math.round(lerp(...VALUE_RANGES.maxWalkSpeed, accelMidY)),
    maxSprintSpeed: Math.round(lerp(...VALUE_RANGES.maxSprintSpeed, accelPeakY)),
    acceleration: Math.round(lerp(...VALUE_RANGES.acceleration, Math.min(steepness, 1))),
    deceleration: Math.round(lerp(...VALUE_RANGES.deceleration, steepness * 0.8)),
    dodgeDistance: Math.round(lerp(...VALUE_RANGES.dodgeDistance, dodgePeakY)),
    dodgeDuration: parseFloat(lerp(...VALUE_RANGES.dodgeDuration, dodgeWidth).toFixed(2)),
    iFrameStart: parseFloat(lerp(...VALUE_RANGES.iFrameStart, ifStartX).toFixed(2)),
    iFrameDuration: parseFloat(lerp(...VALUE_RANGES.iFrameDuration, dodgePeakX * dodgePeakY).toFixed(2)),
    armLength: Math.round(lerp(...VALUE_RANGES.armLength, cameraPeakY)),
    lagSpeed: parseFloat(lerp(...VALUE_RANGES.lagSpeed, cameraInitSlope).toFixed(1)),
    fovBase: Math.round(lerp(...VALUE_RANGES.fovBase, cameraMidY)),
  };
}
