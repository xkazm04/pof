import type { ComponentType } from 'react';
import type {
  PanelDensity,
  PanelRole,
  PanelSizeClass,
  PanelComplexity,
  DensityConfig,
  PanelPropSchema,
  PanelOutput,
  PanelDataSlice,
} from '../types/panel';

// ---------------------------------------------------------------------------
// Panel Definition
// ---------------------------------------------------------------------------

/**
 * Unified panel definition that merges registration metadata and
 * machine-readable manifest data into a single interface.
 *
 * This replaces the previous separation between panelRegistry entries and
 * panelManifests, ensuring a single source of truth for every panel.
 */
export interface PanelDefinition {
  // -- Identity ---------------------------------------------------------------

  /** Unique type string used as the panel's key in the registry. */
  type: string;

  /** Human-readable label shown in UI (e.g. "Scene Editor"). */
  label: string;

  /** Icon name hint; consuming app resolves to actual icon component. */
  icon?: string;

  // -- Layout metadata --------------------------------------------------------

  /** Preferred grid slot priority (primary, secondary, tertiary, sidebar). */
  defaultRole: PanelRole;

  /** Minimum dimension requirements hint (compact, standard, wide). */
  sizeClass: PanelSizeClass;

  /** Rendering cost hint (low, medium, high). */
  complexity: PanelComplexity;

  /** Domains this panel belongs to (e.g. ['story', 'scene']). */
  domains: string[];

  // -- LLM-readable manifest --------------------------------------------------

  /** One-sentence description of what this panel does. */
  description: string;

  /** List of capabilities the panel provides (e.g. "editing", "viewing"). */
  capabilities: string[];

  /** Example use cases for LLM context (e.g. "View story beats timeline"). */
  useCases: string[];

  /** Other panel types that work well alongside this one. */
  suggestedCompanions?: string[];

  // -- IO schema --------------------------------------------------------------

  /** Input props the panel accepts (for LLM wiring). */
  inputs: PanelPropSchema[];

  /** Outputs the panel can produce (callbacks, store updates, events). */
  outputs: PanelOutput[];

  // -- Density ----------------------------------------------------------------

  /** Per-density constraints (min dimensions + description). */
  densityModes: Partial<Record<PanelDensity, DensityConfig>>;

  /** Example data slices showing how to configure different views. */
  dataSliceExamples?: Array<{
    scenario: string;
    dataSlice: PanelDataSlice;
  }>;

  // -- Component (excluded from serialization) --------------------------------

  /** React component to render. Excluded from serialization output. */
  component: ComponentType<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Panel Registry API
// ---------------------------------------------------------------------------

/**
 * Interface for the registry returned by `createRegistry()`.
 * Provides registration, lookup, domain query, and existence check.
 */
export interface PanelRegistry {
  /** Register a panel definition. Throws if the type is already registered. */
  register(definition: PanelDefinition): void;

  /** Retrieve a panel by its type string, or undefined if not found. */
  get(type: string): PanelDefinition | undefined;

  /** Return all panels whose `domains` array includes the given domain. */
  getByDomain(domain: string): PanelDefinition[];

  /** Return all registered panels. */
  getAll(): PanelDefinition[];

  /** Check whether a panel type has been registered. */
  has(type: string): boolean;
}

// ---------------------------------------------------------------------------
// Serialized Registry
// ---------------------------------------------------------------------------

/** A single panel entry in the serialized registry (no component ref). */
export interface SerializedPanel {
  type: string;
  label: string;
  description: string;
  defaultRole: PanelRole;
  sizeClass: PanelSizeClass;
  complexity: PanelComplexity;
  domains: string[];
  capabilities: string[];
  useCases: string[];
  suggestedCompanions?: string[];
  inputs: PanelPropSchema[];
  outputs: PanelOutput[];
  densityModes: Partial<Record<PanelDensity, DensityConfig>>;
  dataSliceExamples?: Array<{ scenario: string; dataSlice: PanelDataSlice }>;
}

/**
 * Structured representation of the full registry, suitable for injection
 * into an LLM prompt. Explicitly excludes `component` references.
 */
export interface SerializedRegistry {
  panels: SerializedPanel[];
  count: number;
}
