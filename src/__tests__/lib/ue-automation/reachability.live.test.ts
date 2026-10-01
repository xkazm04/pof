import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  auditReachability,
  formatReachabilityReport,
  parseAutomationList,
  type SourceFile,
} from '@/lib/ue-automation/reachability';

/**
 * Read-only audit of the REAL UE tree. SKIPPED by default; it never launches the engine and writes
 * nothing. It reads `Source/PoF/Test` (C++) and `Content/Python` (placement scripts) once, then prints
 * the report twice from those same contents: scan alone, and (when a capture is given) against a
 * captured `Automation List` log. Enable with:
 *   POF_REACHABILITY_UE_ROOT="C:/Users/<you>/Documents/Unreal Projects/PoF" \
 *   [POF_REACHABILITY_LIST="<path to a captured `Automation List` log>"] \
 *   npx vitest run src/__tests__/lib/ue-automation/reachability.live.test.ts --reporter=verbose
 * A capture is produced by the engine, not by this test:
 *   UnrealEditor-Cmd PoF.uproject -ExecCmds="Automation List;Quit" -unattended -nullrhi -log -abslog=<file>
 * The only assertions are that the instrument had input; the tree's state is reported, not asserted.
 */
const UE_ROOT = process.env.POF_REACHABILITY_UE_ROOT;
const LIST_PATH = process.env.POF_REACHABILITY_LIST;

function walk(dir: string, keep: (name: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__pycache__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, keep, out);
    else if (keep(name)) out.push(p);
  }
  return out;
}
const readAll = (paths: string[], root: string): SourceFile[] =>
  paths.map((p) => ({ path: p.slice(root.length + 1).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

describe.skipIf(!UE_ROOT)('reachability audit over the real UE tree (read-only)', () => {
  it('scans Source/PoF/Test and Content/Python and prints what the audit can and cannot say', () => {
    const root = UE_ROOT as string;
    const testDir = join(root, 'Source', 'PoF', 'Test');
    const pyDir = join(root, 'Content', 'Python');
    expect(existsSync(testDir), `no ${testDir}`).toBe(true);
    expect(existsSync(pyDir), `no ${pyDir}`).toBe(true);

    const sources = readAll(walk(testDir, (n) => /\.(h|cpp)$/.test(n)), root);
    const scripts = readAll(walk(pyDir, (n) => n.endsWith('.py')), root);

    const out: string[] = ['', '=== scan alone (no Automation List) ==='];
    const alone = auditReachability({ sources, scripts, listText: null });
    out.push(formatReachabilityReport(alone));

    if (LIST_PATH) {
      const text = readFileSync(LIST_PATH, 'utf8');
      const parsed = parseAutomationList(text);
      out.push(
        '',
        `=== capture ${LIST_PATH} ===`,
        `parser check: header declares ${parsed.declaredCounts.join(' + ') || 'nothing'}, ${parsed.nameLines} quoted names read, ${parsed.names.length} distinct, truncated=${parsed.truncated}`,
        formatReachabilityReport(auditReachability({ sources, scripts, listText: text })),
      );
    }
    process.stdout.write(`${out.join('\n')}\n`);

    expect(alone.examined.sourceFiles).toBeGreaterThan(0);
    expect(alone.examined.declaredTests).toBeGreaterThan(0);
  });
});
