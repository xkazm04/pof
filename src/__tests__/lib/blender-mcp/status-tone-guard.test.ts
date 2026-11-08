/**
 * The Blender pipeline surface takes its status TEXT tone from
 * `@/lib/blender-mcp/status-tokens`, never raw palette classes — so one theme edit
 * recolours every status, and "success" is one green (not green here, emerald there).
 * (scan-sweep night 2026-11-08, context blender-pipeline)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SUCCESS_TEXT, ERROR_TEXT, WARNING_TEXT } from '@/lib/blender-mcp/status-tokens';

const DIR = path.resolve(__dirname, '../../../components/modules/visual-gen/blender-pipeline');
const RAW_TONE = /text-(?:emerald|green|amber|red)-400/g;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('blender-pipeline status tones come from status-tokens', () => {
  it('exports a text tone per status', () => {
    expect([SUCCESS_TEXT, ERROR_TEXT, WARNING_TEXT]).toEqual(['text-green-400', 'text-red-400', 'text-amber-400']);
  });

  it('uses no raw status-tone classes (comments stripped)', () => {
    const hits: string[] = [];
    for (const f of walk(DIR)) {
      const m = stripComments(fs.readFileSync(f, 'utf-8')).match(RAW_TONE) ?? [];
      for (const x of m) hits.push(`${path.basename(f)}: ${x}`);
    }
    expect(hits).toEqual([]);
  });
});
