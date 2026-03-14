import type { PanelFrameProps } from '../types/panel';
import { useDensity } from '../density/DensityContext';

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

  return (
    <div
      data-dzin-panel=""
      data-dzin-density={density}
      role="region"
      aria-label={title}
      className={className}
      {...rest}
    >
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
