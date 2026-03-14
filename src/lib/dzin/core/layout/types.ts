import type { CSSProperties } from 'react';
import type {
  PanelDensity,
  PanelRole,
  PanelSizeClass,
  PanelDataSlice,
} from '../types/panel';

// ---------------------------------------------------------------------------
// Layout Template ID
// ---------------------------------------------------------------------------

/**
 * Union of all supported layout template identifiers.
 * 7 selectable layouts + 1 mobile fallback (stack).
 */
export type LayoutTemplateId =
  | 'single'
  | 'split-2'
  | 'split-3'
  | 'grid-4'
  | 'primary-sidebar'
  | 'triptych'
  | 'studio'
  | 'stack';

// ---------------------------------------------------------------------------
// Slot Specification
// ---------------------------------------------------------------------------

/**
 * Describes a single slot within a layout template.
 * Each slot declares its CSS Grid placement, the panel sizes it can accept,
 * its preferred panel role, and whether it is a narrow column.
 */
export interface SlotSpec {
  /** CSS Grid placement properties for this slot. */
  style: CSSProperties;
  /** Panel size classes this slot can accommodate. */
  acceptsSizes: PanelSizeClass[];
  /** The panel role this slot is designed for. */
  preferredRole: PanelRole;
  /** Whether the slot is a narrow column (e.g. sidebar). */
  isNarrow: boolean;
}

// ---------------------------------------------------------------------------
// Layout Template
// ---------------------------------------------------------------------------

/**
 * A complete layout template defining CSS Grid properties and slot specs.
 */
export interface LayoutTemplate {
  /** Unique template identifier. */
  id: LayoutTemplateId;
  /** Human-readable label. */
  label: string;
  /** CSS `grid-template-rows` value. */
  gridTemplateRows: string;
  /** CSS `grid-template-columns` value. */
  gridTemplateColumns: string;
  /** Ordered list of slots this template provides. */
  slots: SlotSpec[];
}

// ---------------------------------------------------------------------------
// Panel Directive
// ---------------------------------------------------------------------------

/**
 * A request to place a specific panel type in the layout.
 * Includes optional overrides for role, density, and data slice.
 */
export interface PanelDirective {
  /** Panel type string matching a PanelDefinition.type. */
  type: string;
  /** Override the panel's default role for this composition. */
  role?: PanelRole;
  /** Override the panel's density for this composition. */
  density?: PanelDensity;
  /** Data slice to pass to the panel instance. */
  dataSlice?: PanelDataSlice;
}

// ---------------------------------------------------------------------------
// Slot Assignment
// ---------------------------------------------------------------------------

/**
 * The result of assigning a panel to a specific slot in a layout template.
 */
export interface SlotAssignment {
  /** Index of the slot in the template's slots array. */
  slotIndex: number;
  /** Panel type that was assigned to this slot. */
  panelType: string;
  /** Resolved role for this assignment. */
  role: PanelRole;
  /** Resolved density for this assignment. */
  density: PanelDensity;
  /** CSS style properties from the slot. */
  style: CSSProperties;
  /** Estimated width in pixels. */
  widthPx: number;
  /** Estimated height in pixels. */
  heightPx: number;
  /** Optional data slice passed through from the directive. */
  dataSlice?: PanelDataSlice;
}

// ---------------------------------------------------------------------------
// Resolved Layout
// ---------------------------------------------------------------------------

/**
 * The fully resolved layout: a chosen template with panels assigned to slots.
 */
export interface ResolvedLayout {
  /** The selected template. */
  template: LayoutTemplateId;
  /** CSS `grid-template-rows` value from the template. */
  gridTemplateRows: string;
  /** CSS `grid-template-columns` value from the template. */
  gridTemplateColumns: string;
  /** Ordered slot assignments. */
  assignments: SlotAssignment[];
}
