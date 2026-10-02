import type { SubModuleId } from '@/types/modules';
import { getSections, type SectionDef, type SectionId } from '@/components/modules/core-engine/unique-tabs/feature-map-config';

/**
 * Pure projection of the Feature Map registry onto a module's stored visibility.
 *
 * Only a gated section is a toggle. A sub-panel (`in: parent`) follows its parent's
 * visibility and a `locked: 'no-gate'` section is always shown — any stored value for
 * either (written by the old free-string map) is ignored, and a stored key for a section
 * that no longer exists never reaches the model at all. So this model can only ever hide
 * what a `<VisibleSection>` gate actually hides.
 */
export interface SectionToggleEntry {
  id: SectionId;
  label: string;
  tab: string;
  summary?: string;
  /** True only for sections a `<VisibleSection>` gate reads. */
  toggleable: boolean;
  /** The gated panel this sub-panel renders inside, else null. */
  parentId: SectionId | null;
  /** 'no-gate' when nothing in the module can hide this section. */
  locked: 'no-gate' | null;
  /** Whether the section is on screen given `vis` (a child follows its parent). */
  effectiveVisible: boolean;
}

const shown = (vis: Readonly<Record<string, boolean>>, id: string) => vis[id] !== false;

/** The ids a `<VisibleSection>` gate reads in this module — the Feature Map's toggles. */
export function gatedSectionIds(moduleId: SubModuleId): SectionId[] {
  return getSections(moduleId).filter((s) => s.gated).map((s) => s.id);
}

function toEntry(sec: SectionDef<SectionId>, vis: Readonly<Record<string, boolean>>): SectionToggleEntry {
  const base = { id: sec.id, label: sec.label, tab: sec.tab, ...(sec.summary && { summary: sec.summary }) };
  if (sec.gated) {
    return { ...base, toggleable: true, parentId: null, locked: null, effectiveVisible: shown(vis, sec.id) };
  }
  if (sec.in) {
    const parentId = sec.in as SectionId;
    return { ...base, toggleable: false, parentId, locked: null, effectiveVisible: shown(vis, parentId) };
  }
  return { ...base, toggleable: false, parentId: null, locked: 'no-gate', effectiveVisible: true };
}

/** Every declared section of `moduleId`, in map order, projected onto `vis`. */
export function sectionToggleModel(
  moduleId: SubModuleId,
  vis: Readonly<Record<string, boolean>>,
): SectionToggleEntry[] {
  return getSections(moduleId).map((sec) => toEntry(sec, vis));
}
