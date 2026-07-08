import { Cpu } from 'lucide-react';
import { statusBg, statusBorder } from '@/lib/chart-colors';

export function ZonePill({
  icon: Icon,
  label,
  active,
  color,
}: {
  icon: typeof Cpu;
  label: string;
  active: boolean;
  color: string;
}) {
  return (
    <span
      data-active={active}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono transition-colors"
      style={{
        color: active ? color : 'var(--text-muted)',
        backgroundColor: active ? statusBg(color) : 'transparent',
        borderColor: active ? statusBorder(color) : 'var(--border)',
        opacity: active ? 1 : 0.55,
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
