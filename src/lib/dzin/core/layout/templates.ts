import type { CSSProperties } from 'react';
import type { PanelRole, PanelSizeClass } from '../types/panel';
import type { LayoutTemplate, LayoutTemplateId, SlotSpec } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_SIZES: PanelSizeClass[] = ['compact', 'standard', 'wide'];

function slot(
  style: CSSProperties,
  acceptsSizes: PanelSizeClass[],
  preferredRole: PanelRole,
  isNarrow = false,
): SlotSpec {
  return { style, acceptsSizes, preferredRole, isNarrow };
}

// ---------------------------------------------------------------------------
// Layout Templates
// ---------------------------------------------------------------------------

/**
 * All 8 layout templates (7 selectable + stack mobile fallback).
 * Each template defines CSS Grid properties and slot specifications.
 *
 * Ported from src/workspace/engine/layoutEngine.ts with framework-agnostic
 * CSSProperties (no React.CSSProperties import needed at runtime).
 */
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // -- Stack (mobile fallback) ------------------------------------------------
  {
    id: 'stack',
    label: 'Stack',
    gridTemplateRows: 'repeat(auto-fill, minmax(200px, 1fr))',
    gridTemplateColumns: '1fr',
    slots: [
      slot({ gridColumn: '1' }, ALL_SIZES, 'primary'),
      slot({ gridColumn: '1' }, ALL_SIZES, 'secondary'),
      slot({ gridColumn: '1' }, ALL_SIZES, 'tertiary'),
      slot({ gridColumn: '1' }, ALL_SIZES, 'sidebar'),
    ],
  },

  // -- Single -----------------------------------------------------------------
  {
    id: 'single',
    label: 'Single',
    gridTemplateRows: '1fr',
    gridTemplateColumns: '1fr',
    slots: [
      slot({ gridRow: '1', gridColumn: '1' }, ALL_SIZES, 'primary'),
    ],
  },

  // -- Split 2 ----------------------------------------------------------------
  {
    id: 'split-2',
    label: 'Split',
    gridTemplateRows: '1fr',
    gridTemplateColumns: '3fr 2fr',
    slots: [
      slot({ gridRow: '1', gridColumn: '1' }, ALL_SIZES, 'primary'),
      slot({ gridRow: '1', gridColumn: '2' }, ALL_SIZES, 'secondary'),
    ],
  },

  // -- Split 3 ----------------------------------------------------------------
  {
    id: 'split-3',
    label: 'Triple',
    gridTemplateRows: '1fr 1fr',
    gridTemplateColumns: '3fr 2fr',
    slots: [
      slot({ gridRow: '1 / -1', gridColumn: '1' }, ALL_SIZES, 'primary'),
      slot({ gridRow: '1', gridColumn: '2' }, ALL_SIZES, 'secondary'),
      slot({ gridRow: '2', gridColumn: '2' }, ALL_SIZES, 'tertiary'),
    ],
  },

  // -- Grid 4 -----------------------------------------------------------------
  {
    id: 'grid-4',
    label: 'Grid',
    gridTemplateRows: '1fr 1fr',
    gridTemplateColumns: '1fr 1fr',
    slots: [
      slot({ gridRow: '1', gridColumn: '1' }, ALL_SIZES, 'primary'),
      slot({ gridRow: '1', gridColumn: '2' }, ALL_SIZES, 'secondary'),
      slot({ gridRow: '2', gridColumn: '1' }, ALL_SIZES, 'tertiary'),
      slot({ gridRow: '2', gridColumn: '2' }, ALL_SIZES, 'sidebar'),
    ],
  },

  // -- Primary + Sidebar ------------------------------------------------------
  {
    id: 'primary-sidebar',
    label: 'Sidebar',
    gridTemplateRows: '1fr',
    gridTemplateColumns: '1fr clamp(200px, 18vw, 280px)',
    slots: [
      slot({ gridRow: '1', gridColumn: '1' }, ALL_SIZES, 'primary'),
      slot({ gridRow: '1', gridColumn: '2' }, ['compact'], 'sidebar', true),
    ],
  },

  // -- Triptych ---------------------------------------------------------------
  {
    id: 'triptych',
    label: 'Triptych',
    gridTemplateRows: '1fr',
    gridTemplateColumns: 'clamp(200px, 18vw, 250px) 1fr clamp(200px, 18vw, 280px)',
    slots: [
      slot({ gridRow: '1', gridColumn: '1' }, ['compact'], 'sidebar', true),
      slot({ gridRow: '1', gridColumn: '2' }, ALL_SIZES, 'primary'),
      slot({ gridRow: '1', gridColumn: '3' }, ['compact'], 'sidebar', true),
    ],
  },

  // -- Studio -----------------------------------------------------------------
  {
    id: 'studio',
    label: 'Studio',
    gridTemplateRows: '42px 1fr 160px',
    gridTemplateColumns: 'clamp(200px, 18vw, 240px) 1fr clamp(200px, 18vw, 260px)',
    slots: [
      slot({ gridRow: '1', gridColumn: '1 / -1' }, ['compact'], 'tertiary', true),
      slot({ gridRow: '2', gridColumn: '1' }, ['compact'], 'sidebar', true),
      slot({ gridRow: '2', gridColumn: '2' }, ALL_SIZES, 'primary'),
      slot({ gridRow: '2', gridColumn: '3' }, ['compact'], 'sidebar', true),
      slot({ gridRow: '3', gridColumn: '1 / -1' }, ['compact', 'standard'], 'secondary'),
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Map for O(1) template lookup by id. */
const TEMPLATE_MAP = new Map<LayoutTemplateId, LayoutTemplate>(
  LAYOUT_TEMPLATES.map((t) => [t.id, t]),
);

/** Get a template by its id. Returns undefined if not found. */
export function getTemplate(id: LayoutTemplateId): LayoutTemplate | undefined {
  return TEMPLATE_MAP.get(id);
}

/**
 * Ordered list of all template IDs from simplest to most complex.
 */
export const LAYOUT_ORDER: LayoutTemplateId[] = [
  'stack',
  'single',
  'split-2',
  'split-3',
  'grid-4',
  'primary-sidebar',
  'triptych',
  'studio',
];
