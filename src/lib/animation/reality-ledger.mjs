// @ts-check
/**
 * Animation Reality Ledger — reconciles four views of the animation system so the
 * "out of reality" gap is observable:
 *   1. REFERENCED — /Game/... asset paths the generated UE5 C++ loads.
 *   2. EXISTING   — .uasset files actually on disk in the project's Content/.
 *   3. VALID      — referenced+existing assets that are usable (montages that
 *                   aren't empty shells; via AssetManifest, that have sections/notifies).
 *   4. RUNTIME    — fallback/failure signals ("No playable montage", "PlayMontage failed").
 *
 * Pure core (`reconcile`) takes plain arrays so it is unit-testable without a
 * filesystem; thin fs adapters feed it from a real project. No external deps.
 *
 * @typedef {'montage'|'sequence'|'skeleton'|'skeletalMesh'|'animBlueprint'|'dataTable'|'blueprint'|'map'|'material'|'input'|'other'} AssetKind
 * @typedef {{ path: string, referencedBy: string[] }} ReferencedAsset
 * @typedef {{ path: string, sizeBytes: number }} ExistingAsset
 * @typedef {{ signal: string, source: string }} RuntimeSignal
 * @typedef {{ [gamePath: string]: { sections?: string[], notifies?: unknown[] } }} ManifestByPath
 * @typedef {{ path: string, kind: AssetKind, exists: boolean, sizeBytes: number, valid: boolean, issues: string[], referencedBy: string[] }} ReferencedRow
 * @typedef {{ path: string, kind: AssetKind, referencedBy: string[] }} MissingRow
 * @typedef {{ path: string, kind: AssetKind, sizeBytes: number, referencedBy: string[] }} EmptyShellRow
 * @typedef {{ path: string, kind: AssetKind, sizeBytes: number }} OrphanRow
 * @typedef {{ projectPath?: string, summary: LedgerSummary, missing: MissingRow[], emptyShells: EmptyShellRow[], orphans: OrphanRow[], referenced: ReferencedRow[], runtimeFallbacks: RuntimeSignal[] }} Ledger
 * @typedef {{ sourceFiles: number, contentAssets: number, referenced: number, existing: number, missing: number, emptyShells: number, orphans: number, runtimeFallbacks: number, status: 'green'|'red' }} LedgerSummary
 */

import fs from 'fs';
import path from 'path';

/** Montages at/below this size are treated as likely-empty shells (heuristic; real
 *  validity comes from AssetManifest sections/notifies when available). */
export const EMPTY_SHELL_BYTES = 6000;

/** Asset kinds whose absence/invalidity means the animation system is broken. */
export const ANIMATION_KINDS = new Set(['montage', 'sequence', 'skeleton', 'skeletalMesh', 'animBlueprint']);

/**
 * Classify a /Game/... asset path by UE naming + path conventions.
 * @param {string} gamePath
 * @returns {AssetKind}
 */
export function classifyKind(gamePath) {
  const lower = gamePath.toLowerCase();
  // path-segment signals first (a montage under /Maps/ is still a map ref, etc.)
  if (/\/maps?\//.test(lower)) return 'map';
  if (/\/materials?\//.test(lower)) return 'material';
  if (/\/input\//.test(lower)) return 'input';
  const base = gamePath.slice(gamePath.lastIndexOf('/') + 1);
  if (/^AM_/.test(base) || /montage/i.test(gamePath)) return 'montage';
  if (/^AS_/.test(base)) return 'sequence';
  if (/^ABP_/.test(base)) return 'animBlueprint';
  if (/^SKM_/.test(base)) return 'skeletalMesh';
  if (/^(SK_|SKEL_)/.test(base) || /skeleton/i.test(base)) return 'skeleton';
  if (/^DT_/.test(base)) return 'dataTable';
  if (/^(BP_|GA_|GE_)/.test(base)) return 'blueprint';
  if (/^(M_|MI_)/.test(base)) return 'material';
  if (/^IA_/.test(base)) return 'input';
  return 'other';
}

/**
 * Size-based empty-shell heuristic. Only montages are judged (sequences are large,
 * skeletons vary). Used only when no AssetManifest validity info is available.
 * @param {AssetKind} kind
 * @param {number} sizeBytes
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function isLikelyEmptyShell(kind, sizeBytes, threshold = EMPTY_SHELL_BYTES) {
  return kind === 'montage' && sizeBytes > 0 && sizeBytes < threshold;
}

/**
 * Pure reconciliation: the heart of the ledger. No filesystem access.
 * @param {{ referenced: ReferencedAsset[], existing: ExistingAsset[], runtimeSignals?: RuntimeSignal[], manifestByPath?: ManifestByPath, emptyShellBytes?: number }} input
 * @returns {Ledger}
 */
export function reconcile({ referenced, existing, runtimeSignals = [], manifestByPath = {}, emptyShellBytes = EMPTY_SHELL_BYTES }) {
  const sizeByPath = new Map(existing.map((e) => [e.path, e.sizeBytes]));
  const referencedSet = new Set(referenced.map((r) => r.path));

  /** @type {ReferencedRow[]} */
  const refRows = referenced.map((r) => {
    const kind = classifyKind(r.path);
    const exists = sizeByPath.has(r.path);
    const sizeBytes = sizeByPath.get(r.path) ?? 0;
    /** @type {string[]} */
    const issues = [];
    let valid = true;
    if (!exists) {
      valid = false;
      issues.push('missing');
    } else if (kind === 'montage') {
      const man = manifestByPath[r.path];
      const manifestSaysPopulated = !!man && ((man.sections?.length ?? 0) > 0 || (man.notifies?.length ?? 0) > 0);
      if (manifestSaysPopulated) {
        valid = true; // trust real metadata over the size heuristic
      } else if (isLikelyEmptyShell(kind, sizeBytes, emptyShellBytes)) {
        valid = false;
        issues.push('empty-shell');
      }
    }
    return { path: r.path, kind, exists, sizeBytes, valid, issues, referencedBy: [...new Set(r.referencedBy)].sort() };
  });

  const missing = refRows.filter((r) => !r.exists).map((r) => ({ path: r.path, kind: r.kind, referencedBy: r.referencedBy }));
  const emptyShells = refRows
    .filter((r) => r.exists && r.issues.includes('empty-shell'))
    .map((r) => ({ path: r.path, kind: r.kind, sizeBytes: r.sizeBytes, referencedBy: r.referencedBy }));

  // orphans: animation assets that exist on disk but no generated code references
  const orphans = existing
    .map((e) => ({ path: e.path, kind: classifyKind(e.path), sizeBytes: e.sizeBytes }))
    .filter((e) => (e.kind === 'montage' || e.kind === 'sequence') && !referencedSet.has(e.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  const missingAnimation = missing.some((m) => ANIMATION_KINDS.has(m.kind));
  const status = missingAnimation || emptyShells.length > 0 || runtimeSignals.length > 0 ? 'red' : 'green';

  return {
    summary: {
      sourceFiles: 0, // filled by buildLedger
      contentAssets: existing.length,
      referenced: refRows.length,
      existing: refRows.filter((r) => r.exists).length,
      missing: missing.length,
      emptyShells: emptyShells.length,
      orphans: orphans.length,
      runtimeFallbacks: runtimeSignals.length,
      status,
    },
    missing: missing.sort((a, b) => a.path.localeCompare(b.path)),
    emptyShells: emptyShells.sort((a, b) => a.sizeBytes - b.sizeBytes),
    orphans,
    referenced: refRows.sort((a, b) => a.path.localeCompare(b.path)),
    runtimeFallbacks: runtimeSignals,
  };
}

// ── filesystem adapters ──────────────────────────────────────────────────────

/** @param {string} dir @param {(name: string) => boolean} test @param {string[]} [acc] @returns {string[]} */
function walk(dir, test, acc = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(fp, test, acc); }
    else if (test(e.name)) acc.push(fp.replace(/\\/g, '/'));
  }
  return acc;
}

const GAME_REF_RE = /\/Game\/[A-Za-z0-9_/]+/g;

/**
 * Scan generated C++/h source for distinct /Game/... asset references.
 * @param {string} sourceDir
 * @returns {{ refs: ReferencedAsset[], fileCount: number }}
 */
export function scanSourceRefs(sourceDir) {
  const files = walk(sourceDir, (n) => n.endsWith('.cpp') || n.endsWith('.h'));
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const f of files) {
    let txt;
    try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const base = path.basename(f);
    let m;
    while ((m = GAME_REF_RE.exec(txt))) {
      if (!map.has(m[0])) map.set(m[0], new Set());
      map.get(m[0])?.add(base);
    }
  }
  const refs = [...map.entries()].map(([p, set]) => ({ path: p, referencedBy: [...set] }));
  return { refs, fileCount: files.length };
}

/**
 * Scan Content/ for .uasset files, returning /Game/... paths + sizes.
 * @param {string} contentDir
 * @returns {ExistingAsset[]}
 */
export function scanContentAssets(contentDir) {
  const files = walk(contentDir, (n) => n.endsWith('.uasset'));
  return files.map((f) => ({
    path: '/Game/' + path.relative(contentDir, f).replace(/\\/g, '/').replace(/\.uasset$/, ''),
    sizeBytes: fs.statSync(f).size,
  }));
}

const RUNTIME_RE = /No playable[^"\n]*|PlayMontage failed[^"\n]*|using [0-9.]+s timer-driven attack window/g;

/**
 * Scan .log files for animation runtime-failure signals.
 * @param {string[]} searchDirs
 * @returns {RuntimeSignal[]}
 */
export function scanRuntimeSignals(searchDirs) {
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const dir of searchDirs) {
    const logs = walk(dir, (n) => n.endsWith('.log'));
    for (const f of logs) {
      let txt;
      try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
      let m;
      while ((m = RUNTIME_RE.exec(txt))) {
        const sig = m[0].trim();
        if (!seen.has(sig)) seen.set(sig, path.basename(f));
      }
    }
  }
  return [...seen.entries()].map(([signal, source]) => ({ signal, source }));
}

/**
 * Build the full ledger from a real UE project on disk.
 * @param {{ projectPath: string, logDirs?: string[], manifestByPath?: ManifestByPath, emptyShellBytes?: number }} opts
 * @returns {Ledger}
 */
export function buildLedger({ projectPath, logDirs, manifestByPath = {}, emptyShellBytes = EMPTY_SHELL_BYTES }) {
  const { refs, fileCount } = scanSourceRefs(path.join(projectPath, 'Source'));
  const existing = scanContentAssets(path.join(projectPath, 'Content'));
  const dirs = logDirs ?? [path.join(projectPath, '.claude', 'logs')];
  const runtimeSignals = scanRuntimeSignals(dirs);
  const ledger = reconcile({ referenced: refs, existing, runtimeSignals, manifestByPath, emptyShellBytes });
  ledger.projectPath = projectPath;
  ledger.summary.sourceFiles = fileCount;
  return ledger;
}
