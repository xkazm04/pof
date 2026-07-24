import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';

/**
 * One tab in the localization sub-tab nav. Follows the APG tabs pattern: the
 * parent owns arrow-key navigation, so only the selected tab stays in the page
 * tab order (`tabIndex 0` / `-1` roving) and each tab points at its panel via
 * `aria-controls`.
 */
export function SubTab({
  id,
  controls,
  label,
  active,
  onClick,
  count,
}: {
  id?: string;
  controls?: string;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative rounded-t ${FOCUS_RING_CLASS} ${
        active ? 'text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-2xs font-semibold tabular-nums transition-colors ${
            active
              ? 'bg-indigo-500/15 text-indigo-300'
              : 'bg-surface-2 text-text-muted'
          }`}
        >
          {count}
        </span>
      )}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-400" />}
    </button>
  );
}
