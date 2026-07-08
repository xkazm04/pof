import { type RowComponentProps } from 'react-window';
import { LOG_SEVERITY_BORDER, LOG_SEVERITY_TEXT } from './constants';
import { formatCookTimestamp } from './helpers';
import type { CookLogRowData } from './types';

// ── Virtualized row ──────────────────────────────────────────────────────────

export function CookLogRow({ index, style, lines, ariaAttributes }: RowComponentProps<CookLogRowData>) {
  const item = lines[index];
  if (!item) return null;
  const textColor = LOG_SEVERITY_TEXT[item.severity];
  return (
    <div
      {...ariaAttributes}
      style={{ ...style, borderLeftColor: LOG_SEVERITY_BORDER[item.severity] }}
      data-severity={item.severity}
      data-phase={item.phase ?? undefined}
      className="flex items-baseline gap-2 border-l-2 pl-2 pr-3 overflow-hidden"
      title={item.line}
    >
      <span className="shrink-0 tabular-nums text-text-muted select-none">{formatCookTimestamp(item.t)}</span>
      <span className="truncate" style={textColor ? { color: textColor } : undefined}>
        {item.line === '' ? ' ' : item.line}
      </span>
    </div>
  );
}
