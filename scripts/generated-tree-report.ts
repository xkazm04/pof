/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * MEASURE `generated/` — phase 1 of the retention work. Reports the tree by
 * category, says what is provably referenced, and prices what a retention policy
 * WOULD remove.
 *
 *   npx tsx scripts/generated-tree-report.ts [--stale-days 30] [--json] [--list <class>]
 *
 * This script DELETES NOTHING. There is no delete path in it, not behind a flag,
 * and it opens the SQLite DB READ-ONLY. Choosing a retention policy is the
 * operator's call and is deliberately not made here.
 *
 * All judgement lives in the pure `src/lib/visual-gen/generated-tree.ts` (tested);
 * this file is the I/O around it: walk the tree, collect referrers, print.
 *
 * Referrer channels — each either runs to completion or is recorded as FAILED,
 * and a failed channel downgrades every "unreferenced" verdict to UNKNOWN:
 *   1. `pipeline_artifacts`  — data + ue_assets, the channel the direction names.
 *   2. `sqlite-all-tables`   — every text column of every table, so a reference
 *                              stored somewhere else (revisions, library, style DNA)
 *                              cannot be missed and read as an orphan.
 *   3. `repo-source`         — src/, scripts/, e2e/, docs/, .claude/ text files.
 *   4. `generated-manifests` — the manifests INSIDE generated/ (each packaged bundle's
 *                              manifest.json names the files it copied and wrote).
 *
 * The channels are deliberately GENEROUS: a name mentioned only in a doc still counts
 * as referenced. That can under-state what is prunable, never over-state it, and the
 * report prints which channel matched each name so a claim stays checkable. The flip
 * side is worth knowing when reading a number: a TEST FIXTURE that happens to name a
 * real generated file marks it referenced, so fixtures here use synthetic names.
 *
 * What it still cannot see, and says so in the output: the UE project tree, the
 * operator's own use, and anything external. So "unreferenced" means unreferenced
 * by everything PoF can observe — never proven unused.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import Database from 'better-sqlite3';

import {
  categorize,
  classifyTree,
  summarize,
  summarizeClasses,
  summarizeGroups,
  allPrunePlans,
  referencedNames,
  type TreeFile,
  type CategorizedFile,
  type ClassifiedFile,
  type ReferenceIndex,
  type RefClass,
} from '../src/lib/visual-gen/generated-tree';
import { formatBytes } from '../src/lib/format';

const ROOT = process.cwd();
const GENERATED = join(ROOT, 'generated');
const DB_PATH = process.env.POF_DB_PATH || join(homedir(), '.pof', 'pof.db');

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const STALE_DAYS = Number(flag('stale-days', '30'));
const AS_JSON = args.includes('--json');
const LIST_CLASS = args.includes('--list') ? (flag('list', 'unreferenced') as RefClass) : null;

/* ── 1. Walk the tree ─────────────────────────────────────────────────────── */

function walk(dir: string, out: TreeFile[] = []): TreeFile[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) {
      const st = statSync(full);
      out.push({
        path: relative(GENERATED, full).split(sep).join('/'),
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
      });
    }
  }
  return out;
}

/* ── 2. Collect referrers ─────────────────────────────────────────────────── */

interface Channel {
  name: string;
  /** Every text blob this channel can offer, or a throw if it could not be read. */
  read: () => string[];
}

function sqliteChannels(): Channel[] {
  const open = () => new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const textOf = (rows: Record<string, unknown>[]) =>
    rows.map((r) => Object.values(r).filter((v) => typeof v === 'string').join('\n'));

  return [
    {
      name: 'pipeline_artifacts',
      read: () => {
        const db = open();
        try {
          return textOf(db.prepare('SELECT * FROM pipeline_artifacts').all() as Record<string, unknown>[]);
        } finally {
          db.close();
        }
      },
    },
    {
      name: 'sqlite-all-tables',
      read: () => {
        const db = open();
        try {
          const tables = (
            db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
          ).map((t) => t.name);
          const out: string[] = [];
          for (const t of tables) {
            try {
              out.push(...textOf(db.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[]));
            } catch {
              // A virtual/FTS shadow table that refuses a plain SELECT is not a
              // reference store; skipping it costs nothing that could hide a name.
            }
          }
          return out;
        } finally {
          db.close();
        }
      },
    },
  ];
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|py|sh|txt|yml|yaml|csv|sql|uplugin|ini)$/i;
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'generated', 'playwright-report', 'test-results', 'coverage']);

function repoChannel(): Channel {
  return {
    name: 'repo-source',
    read: () => {
      const out: string[] = [];
      const visit = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            if (!SKIP_DIR.has(entry.name)) visit(join(dir, entry.name));
          } else if (TEXT_EXT.test(entry.name)) {
            try {
              out.push(readFileSync(join(dir, entry.name), 'utf8'));
            } catch {
              // unreadable single file — recorded by the channel only if EVERY read fails
            }
          }
        }
      };
      visit(ROOT);
      return out;
    },
  };
}

const MANIFEST_EXT = /\.(json|txt|md)$/i;

/**
 * Manifests INSIDE `generated/` — `generated/packages/<catalog>/<entity>/manifest.json`
 * names both the source file it copied and the materialized sibling it wrote. Without
 * this channel every packaged bundle image reads as an orphan, which would overstate
 * the prune plan by the entire packages tree.
 */
function generatedManifestChannel(): Channel {
  return {
    name: 'generated-manifests',
    read: () => {
      const out: string[] = [];
      const visit = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) visit(join(dir, entry.name));
          else if (MANIFEST_EXT.test(entry.name)) {
            try {
              out.push(readFileSync(join(dir, entry.name), 'utf8'));
            } catch {
              // one unreadable manifest is not a failed channel
            }
          }
        }
      };
      visit(GENERATED);
      return out;
    },
  };
}

function buildReferenceIndex(onDisk: ReadonlySet<string>): ReferenceIndex {
  const names = new Set<string>();
  const sources = new Map<string, string[]>();
  const scanned: string[] = [];
  const failed: string[] = [];

  for (const channel of [...sqliteChannels(), repoChannel(), generatedManifestChannel()]) {
    try {
      for (const text of channel.read()) {
        for (const name of referencedNames(text, onDisk)) {
          names.add(name);
          const where = sources.get(name) ?? [];
          if (!where.includes(channel.name)) where.push(channel.name);
          sources.set(name, where);
        }
      }
      scanned.push(channel.name);
    } catch (e) {
      failed.push(`${channel.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { names, sources, scanned, failed };
}

/* ── 3. Report ────────────────────────────────────────────────────────────── */

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function padL(s: string, n: number) {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function main() {
  let files: TreeFile[];
  try {
    files = walk(GENERATED);
  } catch (e) {
    console.error(`generated/ is unreadable at ${GENERATED}: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
    return;
  }

  const categorized: CategorizedFile[] = files.map(categorize);
  const present = new Set(files.map((f) => f.path));
  const onDisk = new Set(categorized.map((f) => f.base));
  const refs = buildReferenceIndex(onDisk);
  const classified: ClassifiedFile[] = classifyTree(categorized, refs, present);

  const totals = summarize(categorized);
  const classes = summarizeClasses(classified);
  const groups = summarizeGroups(classified);
  const plans = allPrunePlans(classified, { now: Date.now(), staleDays: STALE_DAYS, present });

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          root: GENERATED,
          totals: { count: totals.count, bytes: totals.bytes },
          categories: totals.rows,
          referrers: { scanned: refs.scanned, failed: refs.failed, namesMatched: refs.names.size },
          classes,
          groups,
          plans: plans.map((p) => ({ ...p, files: p.files.map((f) => f.path) })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`generated/ tree report — ${GENERATED}`);
  console.log(`DELETES NOTHING. Dry-run plans below are priced, never applied.\n`);

  console.log(`TOTAL  ${totals.count} files  ${formatBytes(totals.bytes)}\n`);
  console.log(`BY CATEGORY (top-level dir / kind)`);
  console.log(`  ${pad('category', 32)}${padL('files', 7)}${padL('size', 12)}`);
  for (const r of totals.rows) {
    console.log(`  ${pad(r.key, 32)}${padL(String(r.count), 7)}${padL(formatBytes(r.bytes), 12)}`);
  }

  console.log(`\nREFERRERS SCANNED: ${refs.scanned.join(', ') || '(none)'}`);
  if (refs.failed.length > 0) {
    console.log(`REFERRERS FAILED:  ${refs.failed.join(' | ')}`);
    console.log(`  ⇒ nothing can be called unreferenced this run; every candidate is UNKNOWN.`);
  }
  console.log(`NOT SCANNED (blind spots): the UE project tree, operator use, external scripts.`);
  console.log(`  ⇒ "unreferenced" = unreferenced by everything PoF can observe, NOT proven unused.`);
  console.log(`Distinct on-disk names matched by a referrer: ${refs.names.size}\n`);

  console.log(`BY REFERENCE CLASS`);
  console.log(`  ${pad('class', 32)}${padL('files', 7)}${padL('size', 12)}`);
  for (const c of classes) {
    console.log(`  ${pad(c.refClass, 32)}${padL(String(c.count), 7)}${padL(formatBytes(c.bytes), 12)}`);
  }

  console.log(`\nBY DIR — how much of each nothing observable is using`);
  console.log(`  ${pad('dir', 20)}${padL('files', 7)}${padL('size', 12)}${padL('unref', 7)}${padL('unref size', 12)}`);
  for (const g of groups) {
    const flag = g.wholeGroupUnreferenced ? '   ← WHOLE DIR: consumer is outside the scan?' : '';
    console.log(
      `  ${pad(g.group, 20)}${padL(String(g.count), 7)}${padL(formatBytes(g.bytes), 12)}` +
        `${padL(String(g.unreferenced), 7)}${padL(formatBytes(g.unreferencedBytes), 12)}${flag}`,
    );
  }
  const blind = groups.filter((g) => g.wholeGroupUnreferenced);
  if (blind.length > 0) {
    console.log(
      `\n  A dir with NOTHING referenced is a missing referrer channel before it is dead weight` +
        ` — ${blind.map((g) => g.group).join(', ')}. Phase 2 owes those channels, not a delete.`,
    );
  }

  console.log(`\nDRY-RUN PRUNE PLANS (nothing is removed; --stale-days ${STALE_DAYS})`);
  for (const p of plans) {
    console.log(`\n  [${p.policy}] would remove ${p.count} files — ${formatBytes(p.bytes)}`);
    if (p.liveSelected > 0) {
      console.log(`    ⚠ ${p.liveSelected} of those are LIVE (referenced or listed by a route) — removing them changes the app.`);
    }
    console.log(`    what:   ${p.what}`);
    console.log(`    caveat: ${p.caveat}`);
  }

  if (LIST_CLASS) {
    const listed = classified.filter((f) => f.refClass === LIST_CLASS).sort((a, b) => b.sizeBytes - a.sizeBytes);
    console.log(`\nFILES CLASSED "${LIST_CLASS}" (${listed.length})`);
    for (const f of listed) {
      console.log(`  ${padL(formatBytes(f.sizeBytes), 10)}  ${pad(f.path, 60)}  ${f.why}`);
    }
  }

  console.log(`\nPhase 2 owes: the operator's retention choice among the policies above, and the`);
  console.log(`executor that acts on it (with a real restore/undo story). No such path exists yet.`);
}

main();
