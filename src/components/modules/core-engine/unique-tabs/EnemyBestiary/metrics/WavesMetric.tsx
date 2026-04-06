'use client';

import { EXPANDED_WAVES } from '../data';
import { STATUS_WARNING, withOpacity, OPACITY_50 } from '@/lib/chart-colors';

const waveCount = EXPANDED_WAVES.length;
const totalEnemies = EXPANDED_WAVES.reduce((sum, w) => sum + w.count, 0);

export function WavesMetric() {
  return (
    <div className="text-[10px] font-mono leading-tight">
      <span className="font-bold" style={{ color: STATUS_WARNING }}>{waveCount}</span>
      <span style={{ color: withOpacity(STATUS_WARNING, OPACITY_50) }}> waves / </span>
      <span className="font-bold" style={{ color: STATUS_WARNING }}>{totalEnemies}</span>
      <span style={{ color: withOpacity(STATUS_WARNING, OPACITY_50) }}> enemies</span>
    </div>
  );
}
