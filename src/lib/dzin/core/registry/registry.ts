import type { PanelDefinition, PanelRegistry } from './types';

/**
 * Create an isolated panel registry instance.
 *
 * Each call returns a fresh registry with its own internal Map, so
 * multiple registries can coexist without interfering.
 *
 * @example
 * ```ts
 * const registry = createRegistry();
 * registry.register(myPanelDef);
 * const panel = registry.get('my-panel');
 * ```
 */
export function createRegistry(): PanelRegistry {
  const panels = new Map<string, PanelDefinition>();

  return {
    register(definition: PanelDefinition): void {
      if (panels.has(definition.type)) {
        throw new Error(
          `Panel type "${definition.type}" is already registered. ` +
            `Each panel type must be unique.`,
        );
      }
      panels.set(definition.type, definition);
    },

    get(type: string): PanelDefinition | undefined {
      return panels.get(type);
    },

    getByDomain(domain: string): PanelDefinition[] {
      const result: PanelDefinition[] = [];
      for (const panel of panels.values()) {
        if (panel.domains.includes(domain)) {
          result.push(panel);
        }
      }
      return result;
    },

    getAll(): PanelDefinition[] {
      return Array.from(panels.values());
    },

    has(type: string): boolean {
      return panels.has(type);
    },
  };
}
