/**
 * Test-fixture cleanup for `feature_matrix`: delete a module's rows of EXACTLY one project
 * scope (`''` = the unattributed legacy bucket), the same exact-scope rule as the production
 * `pruneReviewSnapshots`. It replaced the production `clearModuleFeatures`, whose named scope
 * also swept the shared legacy rows every other project reads.
 */
import { getDb } from '@/lib/db';
import { normalizeProjectId } from '@/lib/project-id';
import type { SubModuleId } from '@/types/modules';

export function clearFeatureMatrixExact(moduleId: SubModuleId | string, projectId?: string): void {
  getDb()
    .prepare('DELETE FROM feature_matrix WHERE module_id = ? AND project_id = ?')
    .run(moduleId, normalizeProjectId(projectId));
}
