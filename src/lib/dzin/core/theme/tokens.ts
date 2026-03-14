/** Available CSS custom property tokens in the Dzin default theme.
 *  Import and reference for autocomplete; these are not runtime values.
 *  Override these variables in your app's CSS to customize the theme. */
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
  panelHeaderHeight: '--dzin-panel-header-height',
} as const;
