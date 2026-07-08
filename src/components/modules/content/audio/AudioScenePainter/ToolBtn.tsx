import { withOpacity, OPACITY_20, OPACITY_60 } from '@/lib/chart-colors';
import { CHROME_ACCENT } from './constants';

export function ToolBtn({ active, onClick, label, icon }: {
  active: boolean; onClick: () => void; label: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-2xs font-semibold uppercase tracking-widest transition-all border ${active
        ? 'text-text'
        : 'bg-transparent border-transparent text-text-muted hover:bg-surface-hover hover:text-text'
        }`}
      style={active
        ? { color: CHROME_ACCENT, backgroundColor: withOpacity(CHROME_ACCENT, OPACITY_20), borderColor: withOpacity(CHROME_ACCENT, OPACITY_60) }
        : { borderColor: 'transparent' }}
    >
      {icon}
      {label}
    </button>
  );
}
