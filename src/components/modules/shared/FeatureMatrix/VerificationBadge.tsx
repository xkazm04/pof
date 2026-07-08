import type { VerificationResult } from '@/types/pof-bridge';
import { VERIFY_BADGE_CONFIG } from './constants';

export function VerificationBadge({ result }: { result: VerificationResult }) {
  const cfg = VERIFY_BADGE_CONFIG[result.newStatus] ?? VERIFY_BADGE_CONFIG.unknown;
  const Icon = cfg.icon;
  const changed = result.previousStatus !== null && result.previousStatus !== result.newStatus;

  return (
    <span
      className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
      style={{
        backgroundColor: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
      }}
      title={
        changed
          ? `Auto-verified: ${result.previousStatus} -> ${result.newStatus}`
          : `Auto-verified: ${result.newStatus}`
      }
    >
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
      {changed && (
        <span className="text-2xs opacity-70">*</span>
      )}
    </span>
  );
}
