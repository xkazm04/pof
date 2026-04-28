/** Available CSS custom property tokens in the Dzin default theme.
 *
 *  Each entry is a CSS-variable *name* (not a runtime hex value); the runtime
 *  value lives in `default.css`. Override the corresponding `--dzin-*` custom
 *  property in your app's CSS to retheme.
 *
 *  Naming policy: prefer overriding `surface*` to retheme globally; override
 *  `panel*` only to break the alias chain for component-specific exceptions
 *  (`--dzin-panel-bg` aliases `--dzin-surface-2`, `--dzin-panel-header-bg`
 *  aliases `--dzin-surface-1`).
 *
 *  Source-of-truth contract: this map MUST stay in lockstep with the variables
 *  declared in `default.css`. When adding/removing a variable, update both.
 */
export const DZIN_TOKENS = {
  // Surface colors (background layers)
  surface1: '--dzin-surface-1',
  surface2: '--dzin-surface-2',
  surface3: '--dzin-surface-3',

  // Border
  border: '--dzin-border',
  borderFocus: '--dzin-border-focus',

  // Text
  textPrimary: '--dzin-text-primary',
  textSecondary: '--dzin-text-secondary',
  textMuted: '--dzin-text-muted',

  // Accent
  accent: '--dzin-accent',
  accentMuted: '--dzin-accent-muted',

  // Spacing scale
  spaceXs: '--dzin-space-xs',
  spaceSm: '--dzin-space-sm',
  spaceMd: '--dzin-space-md',
  spaceLg: '--dzin-space-lg',
  spaceXl: '--dzin-space-xl',

  // Typography
  fontSm: '--dzin-font-sm',
  fontBase: '--dzin-font-base',
  fontLg: '--dzin-font-lg',

  // Radius
  radiusSm: '--dzin-radius-sm',
  radiusMd: '--dzin-radius-md',
  radiusLg: '--dzin-radius-lg',

  // Panel-specific
  panelBg: '--dzin-panel-bg',
  panelBorder: '--dzin-panel-border',
  panelRadius: '--dzin-panel-radius',
  panelHeaderBg: '--dzin-panel-header-bg',
  /** Header height at full density (default 36px). The compact-density rule
   *  shadows this variable to 28px on the matching `[data-dzin-density]`
   *  selector — read it via the cascade rather than overriding it directly
   *  unless you intend to break the density-dependent behaviour. */
  panelHeaderHeight: '--dzin-panel-header-height',
} as const;
