import type { LabTheme } from '../theme';
import type { LabDetail, LabGroup } from '../useLabCatalogData';

export interface Props {
  theme: LabTheme;
  groups: LabGroup[];
  detail: LabDetail | null;
  onSelectCatalog: (id: string) => void;
  entityId: string | null;
  onSelectEntity: (id: string) => void;
  /**
   * Controlled step position: when `onSelectStep` is supplied the step index lives in
   * the parent (LayoutLab), so it survives the view toggles that remount this component.
   * Omit both to run uncontrolled with an internal `stepIdx` (direct-render tests).
   */
  stepIdx?: number;
  onSelectStep?: (i: number) => void;
}
