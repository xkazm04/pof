'use client';

import { useMemo } from 'react';
import { waveformBars } from '@/lib/audio-library/waveform';

interface WaveformThumbnailProps {
  /** Stable seed — pass the asset's promptHash (falls back to its id). */
  seed: string;
  color: string;
  width?: number;
  height?: number;
  bars?: number;
  className?: string;
}

/**
 * A compact, deterministic waveform sparkline for an audio asset. The bars are
 * a stable visual fingerprint derived from the seed (see `waveformBars`) — not
 * decoded PCM — so the same variation always looks the same and distinct
 * variations look different, which is what makes the library scannable.
 */
export function WaveformThumbnail({
  seed,
  color,
  width = 96,
  height = 28,
  bars = 28,
  className = '',
}: WaveformThumbnailProps) {
  const heights = useMemo(() => waveformBars(seed, bars), [seed, bars]);
  const gap = 1.5;
  const barWidth = (width - gap * (bars - 1)) / bars;
  const mid = height / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Audio waveform"
      preserveAspectRatio="none"
    >
      {heights.map((h, i) => {
        const barHeight = Math.max(1, h * (height - 2));
        const x = i * (barWidth + gap);
        return (
          <rect
            key={i}
            x={x}
            y={mid - barHeight / 2}
            width={Math.max(0.5, barWidth)}
            height={barHeight}
            rx={Math.min(1, barWidth / 2)}
            fill={color}
            opacity={0.55 + 0.45 * h}
          />
        );
      })}
    </svg>
  );
}
