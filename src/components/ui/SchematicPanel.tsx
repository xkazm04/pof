'use client';

import { forwardRef, type ReactNode } from 'react';
import { ACCENT_VIOLET, ACCENT_CYAN, OPACITY_5, OPACITY_10, OPACITY_20 } from '@/lib/chart-colors';

/**
 * Re-themeable "schematic" surface — the signature dark blueprint look (grid
 * background + accent corner glow + inset glow) extracted from the animation
 * State Machine panel. The deep floor reads CSS tokens (`--schematic-surface` /
 * `--schematic-well` / `var(--surface-deep)`) and every tint derives from the
 * `accent` prop, so the surface re-themes with the app instead of being a
 * hardcoded dark island. Shared by AnimationStateMachine, the Visual State
 * Machine Editor canvas, and the Combo Choreographer graph.
 */

export type SchematicTone = 'panel' | 'well';

export interface SchematicPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tint for the grid lines, corner glow, and inset glow. Defaults to violet. */
  accent?: string;
  /** Second corner-glow tint (panel tone only). Defaults to cyan. */
  accentSecondary?: string;
  /** `panel` = framed outer surface with corner glows; `well` = recessed inset canvas. */
  tone?: SchematicTone;
  /** Render the 32px accent grid overlay. Default true. */
  grid?: boolean;
  /** Render the two blurred corner-glow blobs. Defaults on for `panel`. */
  glow?: boolean;
  /** Render a soft accent radial glow from the center. Default false. */
  radial?: boolean;
  children?: ReactNode;
}

const GRID_SIZE = '32px 32px';

export const SchematicPanel = forwardRef<HTMLDivElement, SchematicPanelProps>(function SchematicPanel(
  {
    accent = ACCENT_VIOLET,
    accentSecondary = ACCENT_CYAN,
    tone = 'panel',
    grid = true,
    glow,
    radial = false,
    className = '',
    style,
    children,
    ...rest
  },
  ref,
) {
  const isPanel = tone === 'panel';
  const showGlow = glow ?? isPanel;

  // Deep floor + frame + inset glow all read tokens / derive from the accent.
  const surfaceStyle: React.CSSProperties = isPanel
    ? {
        backgroundColor: 'var(--schematic-surface)',
        border: `1px solid ${accent}${OPACITY_20}`,
        boxShadow: `inset 0 0 80px ${accent}${OPACITY_5}`,
      }
    : {
        backgroundColor: 'var(--schematic-well)',
        border: '2px solid var(--surface-deep)',
        boxShadow: 'inset 0 0 40px var(--schematic-well-shadow)',
      };

  return (
    <div
      ref={ref}
      data-schematic-tone={tone}
      className={`relative overflow-hidden ${isPanel ? 'rounded-2xl' : 'rounded-xl'} ${className}`}
      style={{ ...surfaceStyle, ...style }}
      {...rest}
    >
      {/* Decorative schematic layers — behind content, never interactive. */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {grid && (
          <div
            data-schematic-grid
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
              backgroundSize: GRID_SIZE,
              opacity: 0.03,
            }}
          />
        )}
        {radial && (
          <div
            data-schematic-radial
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at center, ${accent}${OPACITY_20} 0%, transparent 70%)`,
              opacity: 0.2,
            }}
          />
        )}
        {showGlow && (
          <>
            <div
              data-schematic-glow
              className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px]"
              style={{ backgroundColor: `${accent}${OPACITY_10}` }}
            />
            <div
              data-schematic-glow
              className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[100px]"
              style={{ backgroundColor: `${accentSecondary}${OPACITY_10}` }}
            />
          </>
        )}
      </div>
      {children}
    </div>
  );
});
