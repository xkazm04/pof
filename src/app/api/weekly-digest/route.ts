import { NextResponse } from 'next/server';
import { generateWeeklyDigest } from '@/lib/weekly-digest';

export async function GET() {
  const digest = generateWeeklyDigest();
  return NextResponse.json({ ok: true, digest });
}
