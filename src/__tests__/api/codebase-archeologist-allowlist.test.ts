/**
 * `/api/codebase-archeologist` used to stat/read whatever `projectPath` the
 * client sent, with no check against a known project root. Real route against
 * the real SQLite schema. Throwaway DB in a per-file mkdtemp dir.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-archeologist-allowlist-'));
process.env.POF_DB_PATH = path.join(DIR, 'pof.db');

const { getDb } = await import('@/lib/db');
const { POST } = await import('@/app/api/codebase-archeologist/route');

afterAll(() => {
  try { getDb().close(); } catch { /* already closed */ }
  fs.rmSync(DIR, { recursive: true, force: true });
});

const KNOWN_PROJECT = path.join(DIR, 'KnownProject');

beforeEach(() => {
  getDb().prepare('DELETE FROM recent_projects').run();
  fs.rmSync(KNOWN_PROJECT, { recursive: true, force: true });
  fs.mkdirSync(path.join(KNOWN_PROJECT, 'Source'), { recursive: true });
  getDb()
    .prepare(
      `INSERT INTO recent_projects (id, project_name, project_path, ue_version, checklist_json, last_opened_at)
       VALUES ('known', 'Known', ?, '5.5', '{}', datetime('now'))`,
    )
    .run(KNOWN_PROJECT);
});

function post(projectPath: string): NextRequest {
  return new NextRequest('http://localhost/api/codebase-archeologist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath }),
  });
}

describe('POST /api/codebase-archeologist — path allowlist', () => {
  it('refuses a projectPath that was never opened through Project Setup', async () => {
    const arbitrary = path.join(DIR, 'NotRegistered');
    fs.mkdirSync(path.join(arbitrary, 'Source'), { recursive: true });
    const res = await POST(post(arbitrary));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('matches a known project path case/slash-insensitively (backslash vs forward, trailing slash)', async () => {
    const variant = `${KNOWN_PROJECT.replace(/\\/g, '/')}/`.toUpperCase();
    const res = await POST(post(variant));
    // Passes the allowlist; may still fail later in analysis for unrelated reasons,
    // but must never be rejected with the allowlist's 403.
    expect(res.status).not.toBe(403);
  });
});
