import type { LabTheme } from '../theme';
import type { LabDetail, LabGroup } from '../useLabCatalogData';

export interface Props {
  theme: LabTheme;
  groups: LabGroup[];
  detail: LabDetail | null;
  onSelectCatalog: (id: string) => void;
  entityId: string | null;
  onSelectEntity: (id: string) => void;
  /** Step to open on mount (e.g. jumped to from the catalog-wide matrix). Defaults to 0. */
  initialStepIdx?: number;
}
