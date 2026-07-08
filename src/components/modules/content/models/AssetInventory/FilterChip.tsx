export function FilterChip({ label, count, active, color, onClick }: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all"
      style={{
        backgroundColor: active ? color + '18' : 'transparent',
        color: active ? color : 'var(--text-muted)',
        border: `1px solid ${active ? color + '35' : 'var(--border)'}`,
      }}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}
