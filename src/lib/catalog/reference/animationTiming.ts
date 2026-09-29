function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer (got ${value})`);
  }
  return value;
}

/** Tick offset at which a zero-based animation frame is first processed by its mode handler. */
export function animationFrameTick(frame: number, ticksPerFrame: number): number {
  if (!Number.isInteger(frame) || frame < 0) {
    throw new Error(`animation frame must be a non-negative integer (got ${frame})`);
  }
  return frame * positiveInteger(ticksPerFrame, 'animation ticks per frame');
}

/** Engine action markers are one-based, while mode handlers inspect a zero-based current frame. */
export function actionMarkerTick(marker: number, ticksPerFrame: number): number {
  return animationFrameTick(positiveInteger(marker, 'animation action marker') - 1, ticksPerFrame);
}

/** Mode handlers end actions when the zero-based last frame is already active. */
export function animationEndTick(frameCount: number, ticksPerFrame: number): number {
  return animationFrameTick(positiveInteger(frameCount, 'animation frame count') - 1, ticksPerFrame);
}
