// @dzin/core layout module public API

// Types
export type {
  LayoutTemplateId,
  SlotSpec,
  LayoutTemplate,
  PanelDirective,
  SlotAssignment,
  ResolvedLayout,
} from './types';

// Templates
export { LAYOUT_TEMPLATES, LAYOUT_ORDER, getTemplate } from './templates';

// Hungarian algorithm
export { hungarianSolve } from './hungarian';

// Scoring
export { scorePanelForSlot, scoreTemplateForDirectives } from './scoring';

// Assignment
export { assignPanelsToSlots } from './assignment';

// Spatial budget
export { parseGridFractions, estimateSlotDimensions, computeSpatialBudget } from './spatial';
export type { SlotDimensions, SpatialOption, SpatialBudget } from './spatial';

// Density
export { assignSlotDensity } from './density';

// Viewport
export { VIEWPORT_BREAKPOINTS, getAllowedLayouts, clampLayoutToViewport } from './viewport';

// Resolver (top-level pipeline)
export { resolveLayout } from './resolver';
export type { ResolveLayoutOptions } from './resolver';

// React integration
export { useLayout } from './useLayout';
export type { UseLayoutOptions, UseLayoutResult, ContainerProps, SlotProps } from './useLayout';
export { DzinLayout } from './LayoutProvider';
export type { DzinLayoutProps } from './LayoutProvider';
