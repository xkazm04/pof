import type { Severity } from '@/types/codebase-archeologist';
import { SEVERITY_CONFIG } from './constants';

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-2xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Icon className="w-2.5 h-2.5" />
      {severity}
    </span>
  );
}
