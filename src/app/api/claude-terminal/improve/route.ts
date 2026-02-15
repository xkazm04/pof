/**
 * Claude Terminal Improve API Route
 *
 * GET: Retrieve current unresolved patterns for the UI
 * POST: Mark patterns as resolved (actual fix runs via /query with resumeSessionId)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPatterns, markPatternsResolved } from '@/lib/claude-terminal/signals/signal-store';

/**
 * GET: Return current unresolved patterns
 */
export async function GET() {
  try {
    const patterns = getPatterns().filter(p => !p.resolved);
    return NextResponse.json({ success: true, patterns });
  } catch (error) {
    console.error('Failed to get patterns:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve patterns' },
      { status: 500 }
    );
  }
}

/**
 * POST: Mark patterns as resolved
 * The actual improvement execution happens via the normal /query route
 * with resumeSessionId so the agent keeps session context.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternFingerprints } = body as { patternFingerprints?: string[] };

    if (patternFingerprints?.length) {
      markPatternsResolved(patternFingerprints);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark patterns resolved:', error);
    return NextResponse.json(
      { error: 'Failed to update patterns' },
      { status: 500 }
    );
  }
}
