import { apiSuccess, withRoute } from '@/lib/api-utils';
import { generateProjectWrapped } from '@/lib/project-wrapped';

export const GET = withRoute(async () => {
  const wrapped = generateProjectWrapped();
  return apiSuccess({ wrapped });
}, 'Failed to build Project Wrapped');
