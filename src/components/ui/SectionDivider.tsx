'use client';

interface SectionDividerProps {
  /** Accent color for the center ornament */
  accent?: string;
  /** Show center diamond ornament */
  ornament?: boolean;
  className?: string;
}

/**
 * Ornamental section divider with gradient fade-out and optional center diamond.
 * Use between major content sections for visual breathing room.
 */
export function SectionDivider({ accent = 'var(--border-bright)', ornament = true, className = '' }: SectionDividerProps) {
  return (
    <div className={`flex items-center gap-2 py-1 ${className}`} aria-hidden="true">
      <div
        className="flex-1 h-[1px]"
        style={{ background: `linear-gradient(to right, transparent, ${accent}50)` }}
      />
      {ornament && (
        <div
          className="w-1.5 h-1.5 rotate-45 rounded-[1px] flex-shrink-0"
          style={{ backgroundColor: `${accent}60`, boxShadow: `0 0 6px ${accent}30` }}
        />
      )}
      <div
        className="flex-1 h-[1px]"
        style={{ background: `linear-gradient(to left, transparent, ${accent}50)` }}
      />
    </div>
  );
}
