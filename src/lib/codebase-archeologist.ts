/**
 * UE5 Codebase Archeologist — anti-pattern detection + git churn analysis.
 *
 * Detects:
 *  1. Missing GENERATED_BODY() in UCLASS/USTRUCT declarations
 *  2. Circular include chains (A.h → B.h → A.h)
 *  3. Hard-coded asset paths (/Game/... string literals)
 *  4. NewObject<> calls on members missing UPROPERTY() (GC leak risk)
 *  5. Deprecated UE5 API usage patterns
 *  6. God classes (>1000 lines or >20 methods)
 *
 * Also performs git-log churn analysis and shotgun-surgery detection.
 */

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
  AntiPatternHit,
  AntiPatternCategory,
  Severity,
  FileChurn,
  ShotgunSurgery,
  RefactoringItem,
  ArcheologistAnalysis,
} from '@/types/codebase-archeologist';

const execFileAsync = promisify(execFile);

// ── File collection ─────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'Intermediate', 'Binaries', 'Saved', 'DerivedDataCache', 'ThirdParty',
  '.git', 'node_modules', '.vs', '.vscode',
]);

async function collectSourceFiles(
  dir: string,
  exts: Set<string>,
  maxDepth = 8,
  depth = 0,
): Promise<string[]> {
  if (depth > maxDepth) return [];
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      results.push(...await collectSourceFiles(path.join(dir, e.name), exts, maxDepth, depth + 1));
    } else if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) {
      results.push(path.join(dir, e.name));
    }
    if (results.length > 2000) break; // safety cap
  }
  return results;
}

// ── Anti-pattern detectors ──────────────────────────────────────────────────

let nextId = 0;
function hit(
  category: AntiPatternCategory,
  severity: Severity,
  file: string,
  message: string,
  suggestion: string,
  line?: number,
): AntiPatternHit {
  return { id: `ap-${++nextId}`, category, severity, file, line, message, suggestion };
}

function detectMissingGeneratedBody(content: string, file: string): AntiPatternHit[] {
  const results: AntiPatternHit[] = [];
  // Find every UCLASS / USTRUCT declaration
  const classRe = /\b(UCLASS|USTRUCT)\s*\([^)]*\)\s*(?:class|struct)\s+(?:\w+_API\s+)?(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split('\n').length;
    // Look ahead for GENERATED_BODY() or GENERATED_UCLASS_BODY() within 30 lines
    const after = content.slice(m.index, m.index + 2000);
    if (!/GENERATED_(?:U(?:CLASS|STRUCT)_)?BODY\s*\(\s*\)/.test(after)) {
      results.push(hit(
        'missing-generated-body', 'critical', file,
        `${m[2]} (${m[1]}) is missing GENERATED_BODY() macro`,
        'Add GENERATED_BODY() as the first line inside the class body',
        lineNum,
      ));
    }
  }
  return results;
}

function detectHardCodedAssetPaths(content: string, file: string): AntiPatternHit[] {
  const results: AntiPatternHit[] = [];
  const re = /(?:TEXT\s*\(\s*)?["']\/Game\/[^"']+["']\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split('\n').length;
    results.push(hit(
      'hard-coded-asset-path', 'warning', file,
      `Hard-coded asset path: ${m[0].slice(0, 60)}${m[0].length > 60 ? '...' : ''}`,
      'Use FSoftObjectPath or TSoftObjectPtr<> for runtime-resolvable references',
      lineNum,
    ));
  }
  return results;
}

function detectUntrackedNewObject(content: string, file: string): AntiPatternHit[] {
  const results: AntiPatternHit[] = [];
  // Find NewObject<T>() calls, then check if assigned to a UPROPERTY member
  const re = /NewObject\s*<\s*(\w+)\s*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split('\n').length;
    // Heuristic: check if the preceding 5 lines have UPROPERTY for the target variable
    const ctx = content.slice(Math.max(0, m.index - 500), m.index);
    const lines = ctx.split('\n').slice(-5);
    const hasUproperty = lines.some(l => /UPROPERTY/.test(l));
    if (!hasUproperty) {
      results.push(hit(
        'untracked-newobject', 'warning', file,
        `NewObject<${m[1]}> may not be tracked by GC (no nearby UPROPERTY)`,
        'Ensure the result is stored in a UPROPERTY() member or added to root set',
        lineNum,
      ));
    }
  }
  return results;
}

const DEPRECATED_PATTERNS: Array<{ re: RegExp; msg: string; suggestion: string }> = [
  { re: /\bFName\s*\(\s*TEXT\s*\(\s*"[^"]*"\s*\)\s*\)/g, msg: 'FName(TEXT("...")) — use FName literals', suggestion: 'Use FName(\"Literal\") directly or NAME_None' },
  { re: /\bGetCharacterMovement\b/g, msg: 'GetCharacterMovement() is legacy', suggestion: 'Use GetCharacterMovement<UCharacterMovementComponent>() or cached pointer' },
  { re: /\bUProperty\b/g, msg: 'UProperty is deprecated in UE5', suggestion: 'Use FProperty instead' },
  { re: /\bCreateDefaultSubobject\b.*\bAttachTo\b/g, msg: 'AttachTo is deprecated', suggestion: 'Use SetupAttachment() in constructor instead' },
  { re: /\bTArray\s*<\s*FString\s*>\s*\w+\s*=\s*\{/g, msg: 'Initializer list for TArray<FString> may cause copies', suggestion: 'Consider using a static const TArray or TConstArrayView' },
];

function detectDeprecatedAPIs(content: string, file: string): AntiPatternHit[] {
  const results: AntiPatternHit[] = [];
  for (const { re, msg, suggestion } of DEPRECATED_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      results.push(hit('deprecated-api', 'info', file, msg, suggestion, lineNum));
    }
  }
  return results;
}

function detectGodClass(content: string, file: string): AntiPatternHit[] {
  const results: AntiPatternHit[] = [];
  const classRe = /(?:UCLASS|USTRUCT)\s*\([^)]*\)\s*(?:class|struct)\s+(?:\w+_API\s+)?(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(content)) !== null) {
    const startIdx = content.indexOf('{', m.index);
    if (startIdx === -1) continue;
    // Count lines until matching brace
    let depth = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    const body = content.slice(startIdx, endIdx);
    const lineCount = body.split('\n').length;
    const methodCount = (body.match(/\b\w+\s+\w+\s*\([^)]*\)\s*(?:const\s*)?(?:override\s*)?[;{]/g) || []).length;
    const lineNum = content.slice(0, m.index).split('\n').length;

    if (lineCount > 1000) {
      results.push(hit(
        'god-class', 'critical', file,
        `${m[1]} has ${lineCount} lines — god class`,
        'Split into smaller focused classes using composition',
        lineNum,
      ));
    } else if (methodCount > 20) {
      results.push(hit(
        'god-class', 'warning', file,
        `${m[1]} has ${methodCount} methods — approaching god class`,
        'Consider extracting related methods into helper/component classes',
        lineNum,
      ));
    }
  }
  return results;
}

// ── Circular include detection ──────────────────────────────────────────────

function buildIncludeGraph(
  files: Map<string, string>,
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const includeRe = /#include\s+"([^"]+)"/g;
  for (const [filePath, content] of files) {
    const includes: string[] = [];
    let m: RegExpExecArray | null;
    includeRe.lastIndex = 0;
    while ((m = includeRe.exec(content)) !== null) {
      includes.push(m[1]);
    }
    // Normalize to just filename for local includes
    graph.set(path.basename(filePath), includes.map(i => path.basename(i)));
  }
  return graph;
}

function detectCircularIncludes(
  graph: Map<string, string[]>,
  fileToFullPath: Map<string, string>,
): AntiPatternHit[] {
  const results: AntiPatternHit[] = [];
  const visited = new Set<string>();
  const seen = new Set<string>(); // cycle dedup

  for (const start of graph.keys()) {
    // Simple DFS cycle detection (depth-limited to 6)
    const stack: Array<{ node: string; chain: string[] }> = [{ node: start, chain: [start] }];
    const inStack = new Set<string>([start]);

    while (stack.length > 0) {
      const { node, chain } = stack.pop()!;
      inStack.delete(node);
      const deps = graph.get(node) || [];
      for (const dep of deps) {
        if (dep === start && chain.length > 1) {
          const key = [...chain, dep].sort().join('→');
          if (!seen.has(key)) {
            seen.add(key);
            results.push(hit(
              'circular-include', 'warning',
              fileToFullPath.get(start) || start,
              `Circular include: ${chain.join(' → ')} → ${dep}`,
              'Break the cycle by using forward declarations or splitting headers',
            ));
          }
        } else if (!inStack.has(dep) && chain.length < 6 && graph.has(dep)) {
          inStack.add(dep);
          stack.push({ node: dep, chain: [...chain, dep] });
        }
      }
    }
    visited.add(start);
  }
  return results;
}

// ── Git churn analysis ──────────────────────────────────────────────────────

async function analyzeGitChurn(
  projectPath: string,
  maxCommits = 200,
): Promise<{ churn: FileChurn[]; surgeries: ShotgunSurgery[] }> {
  const churn: FileChurn[] = [];
  const surgeries: ShotgunSurgery[] = [];

  try {
    // File churn: commits per file in Source/
    const { stdout: logOut } = await execFileAsync('git', [
      'log', `--max-count=${maxCommits}`, '--pretty=format:', '--name-only',
      '--diff-filter=AMRC', '--', 'Source/',
    ], { cwd: projectPath, maxBuffer: 5 * 1024 * 1024 });

    const fileCommits = new Map<string, number>();
    for (const line of logOut.split('\n')) {
      const f = line.trim();
      if (!f) continue;
      fileCommits.set(f, (fileCommits.get(f) || 0) + 1);
    }

    // Get last-modified dates and author counts for top-churn files
    const sorted = [...fileCommits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
    for (const [file, commits] of sorted) {
      let authors = 1;
      let lastModified = '';
      try {
        const { stdout: authorOut } = await execFileAsync('git', [
          'log', '--format=%aN', '--', file,
        ], { cwd: projectPath, maxBuffer: 1024 * 1024 });
        authors = new Set(authorOut.trim().split('\n').filter(Boolean)).size;
        const { stdout: dateOut } = await execFileAsync('git', [
          'log', '-1', '--format=%aI', '--', file,
        ], { cwd: projectPath, maxBuffer: 1024 });
        lastModified = dateOut.trim();
      } catch { /* ignore git errors for individual files */ }
      churn.push({ file, commits, authors, lastModified });
    }

    // Shotgun surgery: commits touching 10+ files
    const { stdout: surgeryOut } = await execFileAsync('git', [
      'log', `--max-count=${maxCommits}`, '--pretty=format:%H|%s|%aI', '--shortstat',
    ], { cwd: projectPath, maxBuffer: 5 * 1024 * 1024 });

    const lines = surgeryOut.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.includes('|')) continue;
      const [commit, message, date] = line.split('|');
      // Next non-empty line should have stat
      const statLine = lines[i + 1]?.trim() || '';
      const fileMatch = statLine.match(/(\d+)\s+files?\s+changed/);
      if (fileMatch) {
        const filesChanged = parseInt(fileMatch[1], 10);
        if (filesChanged >= 10) {
          surgeries.push({
            commit: commit.slice(0, 8),
            message: message.slice(0, 80),
            filesChanged,
            date,
          });
        }
      }
    }
  } catch {
    // Not a git repo or git not available — return empty
  }

  return { churn, surgeries };
}

// ── Main analysis ───────────────────────────────────────────────────────────

export async function runArcheologistAnalysis(
  projectPath: string,
): Promise<ArcheologistAnalysis> {
  const start = Date.now();
  nextId = 0;

  const sourceDir = path.join(projectPath, 'Source');
  const headerExts = new Set(['.h', '.hpp']);
  const cppExts = new Set(['.cpp', '.cc']);
  const allExts = new Set([...headerExts, ...cppExts]);

  const files = await collectSourceFiles(sourceDir, allExts);
  const headerFiles = files.filter(f => headerExts.has(path.extname(f).toLowerCase()));

  // Read all files in parallel batches of 20
  const fileContents = new Map<string, string>();
  for (let i = 0; i < files.length; i += 20) {
    const batch = files.slice(i, i + 20);
    const results = await Promise.all(
      batch.map(async f => {
        try { return { f, c: await fs.readFile(f, 'utf-8') }; }
        catch { return { f, c: '' }; }
      }),
    );
    for (const { f, c } of results) {
      if (c) fileContents.set(f, c);
    }
  }

  // Run all detectors
  const allHits: AntiPatternHit[] = [];

  for (const [filePath, content] of fileContents) {
    const rel = path.relative(projectPath, filePath).replace(/\\/g, '/');
    const isHeader = headerExts.has(path.extname(filePath).toLowerCase());

    if (isHeader) {
      allHits.push(...detectMissingGeneratedBody(content, rel));
      allHits.push(...detectGodClass(content, rel));
    }
    allHits.push(...detectHardCodedAssetPaths(content, rel));
    allHits.push(...detectUntrackedNewObject(content, rel));
    allHits.push(...detectDeprecatedAPIs(content, rel));
  }

  // Circular includes (headers only)
  const headerContents = new Map<string, string>();
  for (const f of headerFiles) {
    const c = fileContents.get(f);
    if (c) headerContents.set(f, c);
  }
  const includeGraph = buildIncludeGraph(headerContents);
  const fileToFullPath = new Map<string, string>();
  for (const f of headerFiles) {
    fileToFullPath.set(path.basename(f), path.relative(projectPath, f).replace(/\\/g, '/'));
  }
  allHits.push(...detectCircularIncludes(includeGraph, fileToFullPath));

  // Git churn
  const { churn, surgeries } = await analyzeGitChurn(projectPath);

  // Build refactoring backlog: score = antiPatterns-in-file * churn
  const fileHitCount = new Map<string, { count: number; topCat: AntiPatternCategory; topSev: Severity }>();
  for (const h of allHits) {
    const prev = fileHitCount.get(h.file);
    if (!prev) {
      fileHitCount.set(h.file, { count: 1, topCat: h.category, topSev: h.severity });
    } else {
      prev.count++;
      if (severityWeight(h.severity) > severityWeight(prev.topSev)) {
        prev.topSev = h.severity;
        prev.topCat = h.category;
      }
    }
  }
  const churnMap = new Map(churn.map(c => [c.file, c.commits]));

  const backlog: RefactoringItem[] = [];
  for (const [file, { count, topCat, topSev }] of fileHitCount) {
    const fileChurn = churnMap.get(file) || 1;
    backlog.push({
      file,
      score: count * fileChurn,
      churn: fileChurn,
      antiPatterns: count,
      topCategory: topCat,
      severity: topSev,
    });
  }
  backlog.sort((a, b) => b.score - a.score);

  // Aggregate by category
  const byCategory = {} as Record<AntiPatternCategory, number>;
  const categories: AntiPatternCategory[] = [
    'missing-generated-body', 'circular-include', 'hard-coded-asset-path',
    'untracked-newobject', 'deprecated-api', 'god-class',
  ];
  for (const c of categories) byCategory[c] = 0;
  for (const h of allHits) byCategory[h.category]++;

  const bySeverity = { critical: 0, warning: 0, info: 0 };
  for (const h of allHits) bySeverity[h.severity]++;

  return {
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - start,
    totalFiles: files.length,
    totalAntiPatterns: allHits.length,
    bySeverity,
    byCategory,
    antiPatterns: allHits,
    churn,
    shotgunSurgeries: surgeries,
    refactoringBacklog: backlog.slice(0, 50),
  };
}

function severityWeight(s: Severity): number {
  switch (s) {
    case 'critical': return 3;
    case 'warning': return 2;
    case 'info': return 1;
  }
}
