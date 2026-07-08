export const pad2 = (n: number) => String(n).padStart(2, '0');

// Below this viewport width the catalog tree (260px) + pipeline (320px) columns
// crowd the work canvas, so they collapse into toggled slide-over drawers.
export const COLLAPSE_BREAKPOINT = 1100;
