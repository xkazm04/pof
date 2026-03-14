'use client';

import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useLayout } from './useLayout';
import type { UseLayoutOptions } from './useLayout';
import type { PanelDirective, SlotAssignment } from './types';
import type { PanelRegistry } from '../registry/types';
import { DensityProvider } from '../density';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DzinLayoutProps {
  /** Panel directives to resolve and render. */
  directives: PanelDirective[];
  /** Panel registry for looking up definitions. */
  registry: PanelRegistry;
  /** Render callback for each assigned slot. */
  renderPanel: (assignment: SlotAssignment) => ReactNode;
  /** Optional CSS class name for the grid container. */
  className?: string;
  /** Options passed to useLayout (preferredTemplate, containerRef). */
  options?: UseLayoutOptions;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Convenience component that wraps useLayout and renders a CSS Grid container.
 * Each assigned slot is rendered via the renderPanel callback,
 * wrapped in a DensityProvider set to the slot's resolved density.
 */
export function DzinLayout({
  directives,
  registry,
  renderPanel,
  className,
  options,
}: DzinLayoutProps): ReactElement {
  const { layout, containerProps, getSlotProps } = useLayout(
    directives,
    registry,
    options,
  );

  return (
    <div {...containerProps} className={className}>
      {layout.assignments.map((assignment) => {
        const slotProps = getSlotProps(assignment.slotIndex);
        return (
          <div key={assignment.slotIndex} {...slotProps}>
            <DensityProvider density={assignment.density}>
              {renderPanel(assignment)}
            </DensityProvider>
          </div>
        );
      })}
    </div>
  );
}
