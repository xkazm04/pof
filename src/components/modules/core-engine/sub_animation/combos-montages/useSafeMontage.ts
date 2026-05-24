import { useMemo } from 'react';
import type { MontageEntry, NotifyLane } from '../_shared/data';
import { SCRUBBER_TOTAL_FRAMES } from '../_shared/data';

export interface SafeMontageState {
  isEmpty: boolean;
  selectedMontage: MontageEntry | null;
  safeTotalFrames: number;
  scaledLanes: NotifyLane[];
  framePercent: (frame: number) => number;
}

/**
 * Guards scrubber math against zero-frame assets and empty montage lists.
 * Why: an empty ALL_MONTAGES crashes `montages[0].id`, and a 0-frame asset
 * produces NaN%-width bars in three different `frame / totalFrames` divisors.
 */
export function useSafeMontage(
  montages: MontageEntry[],
  lanes: NotifyLane[],
  selectedId: string,
): SafeMontageState {
  return useMemo(() => {
    if (!Array.isArray(montages) || montages.length === 0) {
      return {
        isEmpty: true,
        selectedMontage: null,
        safeTotalFrames: 1,
        scaledLanes: [],
        framePercent: () => 0,
      };
    }

    const selected = montages.find((m) => m.id === selectedId) ?? montages[0];
    const rawFrames = Number(selected.totalFrames);
    const safeTotalFrames =
      Number.isFinite(rawFrames) && rawFrames > 0 ? Math.floor(rawFrames) : 1;

    const baseFrames = SCRUBBER_TOTAL_FRAMES > 0 ? SCRUBBER_TOTAL_FRAMES : 1;
    const scaledLanes: NotifyLane[] = lanes.map((lane) => ({
      ...lane,
      startFrame: Math.round((lane.startFrame / baseFrames) * safeTotalFrames),
      endFrame: Math.round((lane.endFrame / baseFrames) * safeTotalFrames),
    }));

    const framePercent = (frame: number) => {
      if (!Number.isFinite(frame)) return 0;
      const pct = (frame / safeTotalFrames) * 100;
      if (pct < 0) return 0;
      if (pct > 100) return 100;
      return pct;
    };

    return { isEmpty: false, selectedMontage: selected, safeTotalFrames, scaledLanes, framePercent };
  }, [montages, lanes, selectedId]);
}
