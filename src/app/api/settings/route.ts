import { NextRequest, NextResponse } from 'next/server';
import { getSettings, setSettings, clearSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Filter to only string values
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        data[key] = value;
      } else if (value !== null && value !== undefined) {
        data[key] = JSON.stringify(value);
      }
    }

    setSettings(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearSettings();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear settings' },
      { status: 500 }
    );
  }
}
