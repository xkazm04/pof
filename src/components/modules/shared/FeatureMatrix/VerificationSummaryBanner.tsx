import { ShieldCheck } from 'lucide-react';
import type { VerificationResult } from '@/types/pof-bridge';
import { STATUS_ERROR, STATUS_WARNING, STATUS_SUCCESS, ACCENT_CYAN_LIGHT, statusBg, statusBorder } from '@/lib/chart-colors';

export function VerificationSummaryBanner({ results }: { results: VerificationResult[] }) {
  const changed = results.filter((r) => r.previousStatus !== null && r.previousStatus !== r.newStatus);
  const writeError = results.find((r) => r.writeError)?.writeError;
  const implemented = results.filter((r) => r.newStatus === 'implemented' || r.newStatus === 'improved').length;
  const partial = results.filter((r) => r.newStatus === 'partial').length;
  const missing = results.filter((r) => r.newStatus === 'missing').length;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
      style={{
        backgroundColor: statusBg(STATUS_SUCCESS, 0.05),
        border: `1px solid ${statusBorder(STATUS_SUCCESS, 0.12)}`,
      }}
    >
      <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
      <span className="text-text">
        <span className="font-medium">Auto-Verify:</span>{' '}
        {results.length} rules checked
      </span>
      <span className="flex items-center gap-2 text-2xs">
        {implemented > 0 && (
          <span style={{ color: STATUS_SUCCESS }}>{implemented} found</span>
        )}
        {partial > 0 && (
          <span style={{ color: STATUS_WARNING }}>{partial} partial</span>
        )}
        {missing > 0 && (
          <span style={{ color: STATUS_ERROR }}>{missing} missing</span>
        )}
      </span>
      {changed.length > 0 && !writeError && (
        <span className="text-2xs" style={{ color: ACCENT_CYAN_LIGHT }}>
          {changed.length} status{changed.length !== 1 ? 'es' : ''} updated
        </span>
      )}
      {writeError && (
        <span className="text-2xs" style={{ color: STATUS_ERROR }}>
          write failed — statuses NOT saved: {writeError}
        </span>
      )}
    </div>
  );
}
