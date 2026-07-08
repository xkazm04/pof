import { Target } from 'lucide-react';

export function SummaryStat({ icon: Icon, label, value, color }: { icon: typeof Target; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="text-xs font-semibold text-text">{value}</span>
    </div>
  );
}
