import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { PanelDensity } from '../types/panel';

const DensityContext = createContext<PanelDensity>('full');

export interface DensityProviderProps {
  density: PanelDensity;
  children: ReactNode;
}

/**
 * Provides a density value to all descendant Dzin components.
 * Panels read this via `useDensity()` to adapt their rendering.
 */
export function DensityProvider({ density, children }: DensityProviderProps) {
  return (
    <DensityContext.Provider value={density}>
      {children}
    </DensityContext.Provider>
  );
}

/**
 * Returns the current density from the nearest DensityProvider.
 * Defaults to 'full' when no provider is present.
 */
export function useDensity(): PanelDensity {
  return useContext(DensityContext);
}
