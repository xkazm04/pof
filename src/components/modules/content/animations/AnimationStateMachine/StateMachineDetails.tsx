import { MODULE_COLORS, OPACITY_20 } from '@/lib/chart-colors';
import type { AnimBPScanResult } from '@/app/api/filesystem/scan-animbp/route';
import { ANIM_ACCENT } from './constants';

interface StateMachineDetailsProps {
  scanResult: AnimBPScanResult | null;
  simMode: boolean;
}

export function StateMachineDetails({ scanResult, simMode }: StateMachineDetailsProps) {
  return (
    <>
      {/* Montage & variable detail (scanned mode, non-sim) */}
      {scanResult && scanResult.montageRefs.length > 0 && !simMode && (
        <div className="rounded-lg border border-border bg-surface-deep px-3 py-2.5">
          <h4 className="text-2xs font-semibold text-text-muted-hover mb-1.5">Montage References</h4>
          <div className="flex flex-wrap gap-1.5">
            {scanResult.montageRefs.map((ref) => (
              <span
                key={ref}
                className="text-2xs px-2 py-0.5 rounded-full font-mono"
                style={{
                  backgroundColor: `${MODULE_COLORS.content}0a`,
                  color: MODULE_COLORS.content,
                  border: `1px solid ${MODULE_COLORS.content}${OPACITY_20}`,
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {scanResult && scanResult.animVariables.length > 0 && !simMode && (
        <div className="rounded-lg border border-border bg-surface-deep px-3 py-2.5">
          <h4 className="text-2xs font-semibold text-text-muted-hover mb-1.5">Animation Variables</h4>
          <div className="flex flex-wrap gap-1.5">
            {scanResult.animVariables.map((v) => (
              <span
                key={v}
                className="text-2xs px-2 py-0.5 rounded-full font-mono"
                style={{
                  backgroundColor: `${ANIM_ACCENT}08`,
                  color: ANIM_ACCENT,
                  border: `1px solid ${ANIM_ACCENT}18`,
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
