import { apiSuccess } from '@/lib/api-utils';
import { generateProjectWrapped } from '@/lib/project-wrapped';

export async function GET() {
  const wrapped = generateProjectWrapped();
  return apiSuccess({ wrapped });
}
