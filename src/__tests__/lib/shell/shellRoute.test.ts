import { describe, it, expect } from 'vitest';
import {
  parseShellRoute,
  moduleHref,
  MODULE_DESTINATIONS,
  SPECIAL_MODULE_IDS,
} from '@/lib/shell/shellRoute';
import { SUB_MODULE_IDS } from '@/types/modules';
import { MODULE_LABELS, CATEGORY_MAP } from '@/lib/module-registry';
import { SPECIAL_CATEGORIES } from '@/components/layout/ModuleRenderer/registry';

/**
 * The root page's address codec. One parser decides which shell a URL means and which
 * module it names, so Back after a shell flip lands where it says, and a deep link is
 * validated against the closed module vocabulary before it reaches navigation.
 */
describe('parseShellRoute - which shell a URL means', () => {
  it('an explicit ?legacy=0 is the lab, even when the stored preference says legacy', () => {
    // The entry "Legacy shell" leaves behind. Before: the stored value won and Back was dead.
    expect(parseShellRoute('?legacy=0', 'legacy').shell).toBe('ecw');
  });

  it('?legacy=1&module=<id> names the legacy shell AND a valid module', () => {
    expect(parseShellRoute('?legacy=1&module=packaging', 'ecw')).toEqual({ shell: 'legacy', moduleId: 'packaging' });
  });

  it('an unknown module id is dropped (a deep link is validated, never trusted)', () => {
    expect(parseShellRoute('?legacy=1&module=not-a-module', null)).toEqual({ shell: 'legacy', moduleId: null });
  });

  it('[guard] a plain load keeps the stored preference, and the default is the lab', () => {
    expect(parseShellRoute('', 'legacy').shell).toBe('legacy');
    expect(parseShellRoute('', null).shell).toBe('ecw');
  });
});

describe('MODULE_DESTINATIONS - every module has an address', () => {
  it('lists all 37 sub-modules plus the 3 special categories, labelled from the registry', () => {
    expect(SUB_MODULE_IDS.length).toBe(37);
    expect(MODULE_DESTINATIONS).toHaveLength(40);
    const ids = MODULE_DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(40);
    for (const id of [...SUB_MODULE_IDS, 'project-setup', 'evaluator', 'game-director']) expect(ids).toContain(id);
    for (const d of MODULE_DESTINATIONS) {
      const registryLabel = MODULE_LABELS[d.id] ?? CATEGORY_MAP[d.id]?.label;
      expect(registryLabel, `${d.id} has no registry label`).toBeTruthy();
      expect(d.label).toBe(registryLabel);
      expect(d.href).toBe(moduleHref(d.id));
      // Every row's address parses back to itself: the codec round-trips.
      expect(parseShellRoute(d.href.slice(d.href.indexOf('?')), null)).toEqual({ shell: 'legacy', moduleId: d.id });
    }
    expect(moduleHref('evaluator')).toBe('/?legacy=1&module=evaluator');
  });

  it('the special ids are exactly the categories the module renderer draws without sub-modules', () => {
    expect([...SPECIAL_MODULE_IDS].sort()).toEqual(Object.keys(SPECIAL_CATEGORIES).sort());
  });
});
