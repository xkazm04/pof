import { apiSuccess } from '@/lib/api-utils';
import { generateWeeklyDigest } from '@/lib/weekly-digest';

export async function GET() {
  const digest = generateWeeklyDigest();
  return apiSuccess({ digest });
}
