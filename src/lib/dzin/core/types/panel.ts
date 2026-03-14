import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Core Enums / Unions
// ---------------------------------------------------------------------------

/**
 * Controls the information density of a panel.
 *
 * - `micro`   -- Minimal chrome, badge-only representation (e.g. 80x60 px).
 * - `compact` -- Reduced header, abbreviated content (e.g. sidebar width).
 * - `full`    -- Standard rendering with all details visible.
 */
export type PanelDensity = 'micro' | 'compact' | 'full';

/**
 * Position / size priority hint used by the layout engine when assigning
 * panels to grid slots.
 *
 * - `primary`   -- Largest slot, main workspace focus.
 * - `secondary` -- Supporting content alongside the primary panel.
 * - `tertiary`  -- Smallest slot, supplementary detail.
 * - `sidebar`   -- Fixed-width side rail (e.g. navigation, property inspector).
 */
export type PanelRole = 'primary' | 'secondary' | 'tertiary' | 'sidebar';

/**
 * Hint for minimum dimension requirements of a panel.
 *
 * - `compact`  -- Can render in narrow / short spaces (min ~200px wide).
 * - `standard` -- Needs moderate space (min ~400px wide).
 * - `wide`     -- Requires large viewport area (min ~600px wide).
 */
export type PanelSizeClass = 'compact' | 'standard' | 'wide';

/**
 * Rendering cost hint so the layout engine can avoid placing too many
 * expensive panels in one composition.
 *
 * - `low`    -- Static or mostly-text content.
 * - `medium` -- Interactive controls, small charts.
 * - `high`   -- Heavy canvas, 3D, real-time streaming, or large data sets.
 */
export type PanelComplexity = 'low' | 'medium' | 'high';

// ---------------------------------------------------------------------------
// Density Configuration
// ---------------------------------------------------------------------------

/**
 * Per-density constraints that describe the minimum viewport area a panel
 * needs when rendered at a given density, plus a human/LLM-readable
 * description of what the panel shows in that mode.
 */
export interface DensityConfig {
  /** Minimum width in pixels for this density mode. */
  minWidth: number;
  /** Minimum height in pixels for this density mode. */
  minHeight: number;
  /** LLM-readable description of what the panel displays at this density. */
  description: string;
}

// ---------------------------------------------------------------------------
// IO Schema
// ---------------------------------------------------------------------------

/**
 * Describes a single input prop that a panel accepts. Used by the manifest
 * system so the LLM (and layout engine) can wire data between panels.
 */
export interface PanelPropSchema {
  /** Prop name (camelCase). */
  name: string;
  /** JSON-compatible type descriptor. */
  type: 'string' | 'number' | 'boolean' | 'object' | 'string[]';
  /** Human-readable explanation of what this prop controls. */
  description: string;
  /** Whether the panel cannot render without this prop. */
  required?: boolean;
  /** Optional hint for where the value should come from (e.g. "characterStore.selectedId"). */
  source?: string;
}

/**
 * Describes a single output that a panel can produce or emit (e.g. via
 * callback, store update, or event). Allows the manifest system to express
 * panel-to-panel data flow.
 */
export interface PanelOutput {
  /** Output name (camelCase). */
  name: string;
  /** TypeScript-style type string (e.g. "string", "Character[]"). */
  type: string;
  /** Human-readable explanation of when and what is emitted. */
  description: string;
}

// ---------------------------------------------------------------------------
// Data Slice
// ---------------------------------------------------------------------------

/**
 * Tells a panel exactly what subset of data to display. Passed at composition
 * time so multiple instances of the same panel type can show different views.
 */
export interface PanelDataSlice {
  /** Primary entity identifier to focus on (e.g. a character ID). */
  entityId?: string;
  /** Free-form filter expression (e.g. "status:active"). */
  filter?: string;
  /** Named view mode (e.g. "grid", "list", "timeline"). */
  view?: string;
  /** Array of IDs or keys to visually highlight. */
  highlight?: string[];
  /** Sort descriptor (e.g. "name:asc", "createdAt:desc"). */
  sort?: string;
}

// ---------------------------------------------------------------------------
// Panel Frame Props
// ---------------------------------------------------------------------------

/**
 * Props for the headless PanelFrame component that wraps every panel with
 * consistent chrome (title bar, density-aware sizing, action slots).
 */
export interface PanelFrameProps {
  /** Panel title shown in the header bar. */
  title: string;
  /** Current density mode; controls chrome visibility and sizing. */
  density?: PanelDensity;
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Optional action buttons rendered in the header's trailing slot. */
  actions?: ReactNode;
  /** Panel body content. */
  children: ReactNode;
  /** Additional CSS class names for the outer frame element. */
  className?: string;
}
