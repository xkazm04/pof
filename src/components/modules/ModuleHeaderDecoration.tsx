'use client';

/**
 * Domain-specific background decorations for content module headers.
 *
 * Each content sub-module gets a unique visual pattern that appears
 * behind the header icon/title, providing instant visual orientation.
 * Decorations are subtle, non-interactive, and purely cosmetic.
 */

import type { SubModuleId } from '@/types/modules';

interface ModuleHeaderDecorationProps {
  moduleId: SubModuleId;
  /** 'full' for flat-layout headers, 'compact' for sidebar headers */
  variant?: 'full' | 'compact';
}

// ── Per-module CSS decoration styles ──

function getDecorationStyle(
  moduleId: SubModuleId,
  variant: 'full' | 'compact',
): React.CSSProperties | null {
  const isCompact = variant === 'compact';

  switch (moduleId) {
    // Materials — conic gradient mimicking material preview spheres
    case 'materials':
      return {
        position: 'absolute',
        top: isCompact ? -8 : -12,
        right: isCompact ? -8 : -16,
        width: isCompact ? 48 : 80,
        height: isCompact ? 48 : 80,
        borderRadius: '50%',
        background: `conic-gradient(
          from 45deg,
          #f59e0b08 0deg,
          #f59e0b15 90deg,
          #f59e0b06 180deg,
          #f59e0b12 270deg,
          #f59e0b08 360deg
        )`,
        opacity: 0.9,
        pointerEvents: 'none',
      };

    // Level Design — top-down grid pattern evoking a floor plan
    case 'level-design':
      return {
        position: 'absolute',
        top: 0,
        right: 0,
        width: isCompact ? 52 : 96,
        height: '100%',
        backgroundImage: `
          linear-gradient(#f59e0b08 1px, transparent 1px),
          linear-gradient(90deg, #f59e0b08 1px, transparent 1px)
        `,
        backgroundSize: isCompact ? '8px 8px' : '12px 12px',
        maskImage: 'linear-gradient(to left, rgba(0,0,0,0.6), transparent)',
        WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.6), transparent)',
        pointerEvents: 'none',
      };

    // 3D Models — isometric cube wireframe hint
    case 'models':
      return {
        position: 'absolute',
        top: isCompact ? -4 : -6,
        right: isCompact ? 4 : 8,
        width: isCompact ? 36 : 56,
        height: isCompact ? 36 : 56,
        border: '1px solid #f59e0b0c',
        borderRadius: 4,
        transform: 'rotate(45deg)',
        background: 'linear-gradient(135deg, #f59e0b08, transparent 60%)',
        pointerEvents: 'none',
      };

    // Animations — staggered horizontal motion lines
    case 'animations':
      return {
        position: 'absolute',
        top: 0,
        right: 0,
        width: isCompact ? 48 : 80,
        height: '100%',
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 5px,
            #f59e0b06 5px,
            #f59e0b06 6px
          )
        `,
        maskImage: 'linear-gradient(to left, rgba(0,0,0,0.5), transparent)',
        WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.5), transparent)',
        pointerEvents: 'none',
      };

    // UI / HUD — nested rectangles evoking UI panels
    case 'ui-hud':
      return {
        position: 'absolute',
        top: isCompact ? 2 : 4,
        right: isCompact ? 4 : 8,
        width: isCompact ? 40 : 64,
        height: isCompact ? 28 : 44,
        border: '1px solid #f59e0b08',
        borderRadius: 3,
        pointerEvents: 'none',
        boxShadow: `
          inset 4px 4px 0 0 #f59e0b06,
          inset -3px -3px 0 0 #f59e0b04
        `,
      };

    // Audio — concentric arcs evoking sound waves
    case 'audio':
      return {
        position: 'absolute',
        top: '50%',
        right: isCompact ? 0 : 4,
        width: isCompact ? 40 : 64,
        height: isCompact ? 40 : 64,
        transform: 'translateY(-50%)',
        borderRadius: '50%',
        border: '1px solid #f59e0b06',
        boxShadow: `
          0 0 0 ${isCompact ? '6px' : '10px'} #f59e0b04,
          0 0 0 ${isCompact ? '12px' : '20px'} #f59e0b02
        `,
        pointerEvents: 'none',
      };

    default:
      return null;
  }
}

export function ModuleHeaderDecoration({ moduleId, variant = 'full' }: ModuleHeaderDecorationProps) {
  const style = getDecorationStyle(moduleId, variant);
  if (!style) return null;

  return <div style={style} aria-hidden="true" />;
}
