import type { LabTheme } from '../theme';
import type { LabEntity } from '../useLabCatalogData';

/** Every per-step composition component receives the theme, the selected entity,
 *  and its own step name (the key it reads/writes in the lab pipeline store). */
export interface StepProps {
  t: LabTheme;
  entity: LabEntity;
  step: string;
}
