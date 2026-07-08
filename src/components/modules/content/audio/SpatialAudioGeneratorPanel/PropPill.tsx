import { Volume2 } from 'lucide-react';

export function PropPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Volume2;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-2xs font-semibold border"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color,
      }}
    >
      <Icon className="w-3 h-3 opacity-80" />
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
