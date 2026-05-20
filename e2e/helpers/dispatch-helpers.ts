import { type Page } from '@playwright/test';
import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { waitForCliComplete, type WaitResult } from './harness-mode';

/** Identifies one RoadmapChecklist item to dispatch. */
export interface RoadmapDispatchTarget {
  /** L1 sidebar nav testId, e.g. 'pof-sidebar-nav-item-core-engine'. */
  categoryTestId: string;
  /** L2 sidebar nav testId, e.g. 'pof-sidebar-l2-nav-item-arpg-combat'. */
  moduleTestId: string;
  /** Module id used in the checklist-item testId, e.g. 'arpg-combat'. */
  moduleId: string;
  /** Checklist item id, e.g. 'acb-1'. */
  itemId: string;
  /** Session label passed to waitForCliComplete. */
  sessionLabel: string;
}

/**
 * Navigate to a module, open its Roadmap tab in Cards layout, hover the
 * checklist row, click its "Claude" button, and wait for the CLI to complete.
 * Encapsulates the RoadmapChecklist dispatch pattern proven by D-spec Steps
 * 8/10. On a locator miss it returns a synthetic failure WaitResult (rather
 * than throwing) so the caller records a `fail` step and the run continues.
 */
export async function dispatchRoadmapChecklistItem(
  page: Page,
  target: RoadmapDispatchTarget,
  timeoutMs: number,
): Promise<WaitResult> {
  const start = Date.now();
  const fail = (msg: string): WaitResult => ({
    success: false,
    durationMs: Date.now() - start,
    timedOut: false,
    outputExcerpt: `dispatchRoadmapChecklistItem(${target.sessionLabel}): ${msg}`,
  });

  // SidebarL1 toggles: clicking an already-active category deactivates it
  // (SidebarL1.tsx handleClick). When dispatching consecutive items in the
  // same L1 category, only click the category if it is not already active
  // (aria-pressed). SidebarL2's setActiveSubModule is idempotent, so the L2
  // click is always safe.
  const category = page.getByTestId(target.categoryTestId);
  if ((await category.getAttribute('aria-pressed')) !== 'true') {
    await category.click();
  }
  await page.getByTestId(target.moduleTestId).click();

  const roadmapTab = page.getByRole('tab', { name: 'Roadmap' });
  if ((await roadmapTab.count()) === 0) return fail('no "Roadmap" tab');
  await roadmapTab.click();
  await page.waitForTimeout(500);

  const cardViewBtn = page.getByRole('button', { name: 'Card view' });
  if ((await cardViewBtn.count()) === 0) return fail('no "Card view" button');
  await cardViewBtn.click();
  await page.waitForTimeout(300);

  const row = page.getByTestId(`pof-module-${target.moduleId}-checklist-item-${target.itemId}`);
  if ((await row.count()) === 0) {
    return fail(`checklist row pof-module-${target.moduleId}-checklist-item-${target.itemId} not found`);
  }
  await row.hover();

  const claudeBtn = row.getByRole('button', { name: /^Claude$/i });
  if ((await claudeBtn.count()) === 0) return fail(`no "Claude" button in row ${target.itemId}`);
  await claudeBtn.click();

  return waitForCliComplete(page, target.sessionLabel, timeoutMs);
}

/** One expected artifact: a file found by name-substring under a root. */
export interface ArtifactExpectation {
  /** Human label for the findings note. */
  label: string;
  /** Substring matched against file names during a recursive search. */
  fileNameContains: string;
  /** Absolute directory to search recursively. */
  searchRoot: string;
  /** Optional symbol the matched file's content must contain. */
  mustContain?: string;
}

/** Recursively find the first file under `root` whose name includes `needle`. */
async function findFileByName(root: string, needle: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    let st;
    try {
      st = await stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const nested = await findFileByName(full, needle);
      if (nested) return nested;
    } else if (entry.includes(needle)) {
      return full;
    }
  }
  return null;
}

/**
 * Verify each expected artifact exists (by recursive name search) and, if
 * `mustContain` is set, contains the symbol. Returns an overall ok flag and a
 * human-readable note for the findings doc. Best-effort: intended for live mode
 * only — the chunk-1 run validates the expectations.
 */
export async function verifyExpectedArtifacts(
  expectations: ArtifactExpectation[],
): Promise<{ ok: boolean; note: string }> {
  let ok = true;
  const lines: string[] = [];
  for (const exp of expectations) {
    const found = await findFileByName(exp.searchRoot, exp.fileNameContains);
    if (!found) {
      ok = false;
      lines.push(`MISSING ${exp.label}: no file matching "*${exp.fileNameContains}*" under ${exp.searchRoot}`);
      continue;
    }
    if (exp.mustContain) {
      const content = await readFile(found, 'utf-8').catch(() => '');
      if (!content.includes(exp.mustContain)) {
        ok = false;
        lines.push(`PARTIAL ${exp.label}: found ${found} but missing symbol "${exp.mustContain}"`);
        continue;
      }
    }
    lines.push(`OK ${exp.label}: ${found}`);
  }
  return { ok, note: '\nArtifact check:\n' + lines.join('\n') };
}
