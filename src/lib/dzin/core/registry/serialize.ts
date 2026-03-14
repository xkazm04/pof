import type { PanelRegistry, SerializedRegistry, SerializedPanel } from './types';

/**
 * Serialize a registry into a structured object for LLM context injection.
 *
 * The output contains all panel metadata (type, label, description,
 * capabilities, IO schema, density modes, etc.) but explicitly excludes
 * the `component` reference since React components are not serializable.
 *
 * @param registry - The panel registry to serialize.
 * @returns A plain object with a `panels` array and `count`.
 */
export function serializeRegistry(registry: PanelRegistry): SerializedRegistry {
  const allPanels = registry.getAll();

  const panels: SerializedPanel[] = allPanels.map((panel) => {
    const serialized: SerializedPanel = {
      type: panel.type,
      label: panel.label,
      description: panel.description,
      defaultRole: panel.defaultRole,
      sizeClass: panel.sizeClass,
      complexity: panel.complexity,
      domains: panel.domains,
      capabilities: panel.capabilities,
      useCases: panel.useCases,
      inputs: panel.inputs,
      outputs: panel.outputs,
      densityModes: panel.densityModes,
    };

    // Only include optional fields if they have values
    if (panel.suggestedCompanions) {
      serialized.suggestedCompanions = panel.suggestedCompanions;
    }

    if (panel.dataSliceExamples) {
      serialized.dataSliceExamples = panel.dataSliceExamples;
    }

    return serialized;
  });

  return {
    panels,
    count: panels.length,
  };
}
