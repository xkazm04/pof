import { describe, it, expect } from 'vitest';
import { mermaidNodeIdToModuleId } from '@/lib/gdd-mermaid';

describe('mermaidNodeIdToModuleId', () => {
  it('maps a mermaid flowchart node id back to its sub-module id', () => {
    // The synthesizer emits `arpg_combat` (it replaces - with _); mermaid wraps
    // the node group id as `flowchart-arpg_combat-<n>`.
    expect(mermaidNodeIdToModuleId('flowchart-arpg_combat-1')).toBe('arpg-combat');
  });

  it('restores every underscore in a multi-word module id', () => {
    expect(mermaidNodeIdToModuleId('flowchart-arpg_enemy_ai-3')).toBe('arpg-enemy-ai');
  });

  it('accepts a bare node id with no flowchart prefix or numeric suffix', () => {
    expect(mermaidNodeIdToModuleId('arpg_loot')).toBe('arpg-loot');
  });

  it('returns null for a node that is not a known sub-module', () => {
    expect(mermaidNodeIdToModuleId('flowchart-not_a_module-2')).toBeNull();
  });

  it('returns null for empty / junk input', () => {
    expect(mermaidNodeIdToModuleId('')).toBeNull();
    expect(mermaidNodeIdToModuleId('flowchart--0')).toBeNull();
  });
});
