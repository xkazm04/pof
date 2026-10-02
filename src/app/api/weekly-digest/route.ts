import type { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import { generateWeeklyDigest } from '@/lib/weekly-digest';
import { reportZone, weekWindow, previousWeek } from '@/lib/analytics/report-window';

/** Furthest week back a review may step (one year of Monday-first weeks). */
const MAX_WEEKS_AGO = 52;

/**
 * GET /api/weekly-digest[?weeksAgo=N] - the zone-local week N weeks before the current
 * one (N an integer 0-52; absent = the current week). Stepping walks `previousWeek()`
 * so every edge is the report-window's DST-safe cut, never `now - N * 7 days`.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const raw = request.nextUrl.searchParams.get('weeksAgo');
  if (raw === null) return apiSuccess({ digest: generateWeeklyDigest() });

  const weeksAgo = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
  if (!(weeksAgo >= 0 && weeksAgo <= MAX_WEEKS_AGO)) {
    return apiError(`weeksAgo must be an integer in 0-${MAX_WEEKS_AGO}, got '${raw}'`, 400);
  }

  const zone = reportZone();
  let win = weekWindow(new Date(), zone);
  for (let i = 0; i < weeksAgo; i++) win = previousWeek(win);
  return apiSuccess({ digest: generateWeeklyDigest(new Date(win.start), zone) });
}, 'Failed to build weekly digest');
