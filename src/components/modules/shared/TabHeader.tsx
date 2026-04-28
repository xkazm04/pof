'use client';

interface TabHeaderProps {
  title: string;
  description?: string;
  /**
   * Layout alignment. The visual-gen cluster centers its tab headers; other
   * places may prefer left-align. Default `center` matches the established
   * AssetForge / AssetBrowser / BlenderPipeline pattern.
   */
  align?: 'center' | 'left';
  className?: string;
}

/**
 * Lightweight tab/section header used by `ReviewableModuleView` extra-tab
 * bodies. Subsumes the 6+ inline `<div className="text-center"><h2>…</h2><p>…</p></div>`
 * patterns across `src/components/modules/visual-gen/*` (see ui-perfectionist
 * 24.1).
 *
 * For dashboard-level headers with an icon-tile and primary action, prefer
 * `<DashboardHeader>` from `src/components/ui/`. This primitive intentionally
 * stays minimal — it is a tab-body sub-section header, not a page header.
 */
export function TabHeader({
  title,
  description,
  align = 'center',
  className = '',
}: TabHeaderProps) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left';
  return (
    <div className={`${alignClass} ${className}`}>
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {description && (
        <p className="text-xs text-text-muted mt-1">{description}</p>
      )}
    </div>
  );
}
