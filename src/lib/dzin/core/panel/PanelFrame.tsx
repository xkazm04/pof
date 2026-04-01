import { useEffect, useRef, useState } from 'react';
import type { PanelFrameProps } from '../types/panel';
import { useDensity } from '../density/DensityContext';

/** Human-readable labels for density announcements. */
const DENSITY_LABELS: Record<string, string> = {
  micro: 'icon-only view',
  compact: 'compact view',
  full: 'full view',
};

/**
 * Headless panel frame that provides structure and data attributes
 * without any visual styling. The default theme (or any custom theme)
 * targets the `data-dzin-*` attributes to apply visual treatment.
 *
 * Density behavior:
 * - `micro`: No header rendered; body only with minimal chrome.
 * - `compact`: Header with title only (no actions).
 * - `full`: Complete header with title, icon, and actions.
 *
 * Accessibility:
 * - Always declares `role="region"` with `aria-label` matching the panel title.
 * - Micro-density panels include a `title` attribute for hover/AT fallback.
 * - Density transitions inject an `aria-live="polite"` announcement.
 *
 * The density prop overrides the value from DensityContext.
 */
export function PanelFrame({
  title,
  density: densityProp,
  icon,
  actions,
  children,
  className,
  ...rest
}: PanelFrameProps & Record<string, unknown>) {
  const contextDensity = useDensity();
  const density = densityProp ?? contextDensity;

  // Track density changes for aria-live announcements
  const prevDensityRef = useRef(density);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (prevDensityRef.current !== density) {
      setAnnouncement(`Panel switched to ${DENSITY_LABELS[density] ?? density}`);
      prevDensityRef.current = density;
    }
  }, [density]);

  return (
    <div
      data-dzin-panel=""
      data-dzin-density={density}
      role="region"
      aria-label={title}
      // In micro density the header is hidden — title attr provides hover/AT fallback
      title={density === 'micro' ? title : undefined}
      className={className}
      {...rest}
    >
      {/* Density-change announcement for screen readers */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </span>

      {density !== 'micro' && (
        <div data-dzin-panel-header="" data-dzin-density={density}>
          {icon && <span data-dzin-panel-icon="">{icon}</span>}
          <span data-dzin-panel-title="">{title}</span>
          {density === 'full' && actions && (
            <div data-dzin-panel-actions="">{actions}</div>
          )}
        </div>
      )}
      <div data-dzin-panel-body="" data-dzin-density={density}>
        {children}
      </div>
    </div>
  );
}
