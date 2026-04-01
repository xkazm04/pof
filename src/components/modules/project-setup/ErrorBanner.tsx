import { AlertTriangle } from 'lucide-react';
import { STATUS_ERROR, OPACITY_10 } from '@/lib/chart-colors';

interface ErrorBannerProps {
  message: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * Standardized error banner for project-setup panels.
 * Colored background at 10% opacity + icon + message.
 */
export function ErrorBanner({ message, className, ...rest }: ErrorBannerProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${className ?? ''}`}
      style={{ background: `${STATUS_ERROR}${OPACITY_10}`, color: STATUS_ERROR }}
      role="alert"
      {...rest}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{message}</span>
    </div>
  );
}
