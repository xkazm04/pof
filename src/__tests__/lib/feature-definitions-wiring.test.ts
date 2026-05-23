import { describe, it, expect } from 'vitest';
import { SUB_MODULE_IDS } from '@/types/modules';
import {
  MODULE_WIRING_ASSETS,
  getWiringAssets,
  moduleNeedsBinaryContent,
  type WiringAsset,
} from '@/lib/feature-definitions';

const VALID_KINDS: WiringAsset['kind'][] = [
  'WidgetBlueprint',
  'AnimBlueprint',
  'BehaviorTree',
  'DataTable',
  'InputMappingContext',
  'GameMode',
  'Material',
  'Other',
];

describe('MODULE_WIRING_ASSETS coverage', () => {
  it('has an explicit entry for every SubModuleId', () => {
    for (const id of SUB_MODULE_IDS) {
      expect(id in MODULE_WIRING_ASSETS, `missing wiring entry for "${id}"`).toBe(true);
    }
  });

  it('every wiring asset has a non-empty name/note and a valid kind', () => {
    for (const id of SUB_MODULE_IDS) {
      for (const a of getWiringAssets(id)) {
        expect(a.name, `name in ${id}`).toBeTruthy();
        expect(a.note, `note in ${id}`).toBeTruthy();
        expect(VALID_KINDS, `kind in ${id}`).toContain(a.kind);
      }
    }
  });
});

describe('moduleNeedsBinaryContent', () => {
  it('is true for arpg-ui (Widget Blueprint)', () => {
    expect(moduleNeedsBinaryContent('arpg-ui')).toBe(true);
  });

  it('is true for arpg-enemy-ai (Behavior Tree)', () => {
    expect(moduleNeedsBinaryContent('arpg-enemy-ai')).toBe(true);
  });

  it('is false for a module with only DataTable assets', () => {
    expect(moduleNeedsBinaryContent('arpg-progression')).toBe(false);
  });

  it('is false for a module with no wiring assets', () => {
    expect(moduleNeedsBinaryContent('arpg-gas')).toBe(false);
  });
});
