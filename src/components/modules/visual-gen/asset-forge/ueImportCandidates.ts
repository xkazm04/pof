/**
 * Which forge deliveries the UE import control can offer, and the name each one lands under.
 * Pure (no store, no fetch) — `UeImportPanel` reads the forge store's `jobs` and projects them
 * through here.
 *
 * Why it exists: the forge store already holds every delivery's server `meshPath`, its $0
 * finished mesh (`finish.meshPath`) and its verdict, while the import control asked the
 * operator to TYPE a server path the queue never shows. And an import left unnamed fell
 * through to the importer's shared default (`TripoSRMesh`), so every blank-named import
 * replaced the previous one.
 */
import { jobOutcome } from './forgeJobStatus';
import type { GenerationJob } from './useForgeStore';

/** The delivery's verdict, carried verbatim — a rejected or ungated mesh is offered, never as a pass. */
export type CandidateVerdict = 'accepted' | 'rejected' | 'ungated';

export interface ImportCandidate {
  jobId: string;
  /** The server path the import reads: the finished mesh when a finish completed, else the delivery. */
  glbPath: string;
  stage: 'finished' | 'raw';
  verdict: CandidateVerdict;
  prompt: string;
  /** The asset class the job was generated against — feeds the plan's size target. */
  assetClass?: string;
}

const GLB = /\.glb$/i;

/**
 * Project forge jobs onto import candidates. Only a delivered job (`completed`) whose mesh is
 * a real `.glb` on this server is offered: failed and in-flight jobs have nothing to import, a
 * format-mismatched delivery is not the container its extension claims, and a Blender-MCP job
 * never lands a mesh here. A completed finish wins over the raw delivery — it is the mesh the
 * pipeline meant to ship.
 */
export function importCandidates(jobs: readonly GenerationJob[]): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  for (const job of jobs) {
    const outcome = jobOutcome(job);
    if (outcome !== 'complete' && outcome !== 'rejected' && outcome !== 'ungated') continue;
    if (job.formatMismatch) continue;
    const finished = job.finish?.state === 'done' ? job.finish.meshPath : undefined;
    const glbPath = finished && GLB.test(finished) ? finished : job.meshPath;
    if (!glbPath || !GLB.test(glbPath)) continue;
    out.push({
      jobId: job.id,
      glbPath,
      stage: glbPath === finished ? 'finished' : 'raw',
      verdict: outcome === 'complete' ? 'accepted' : outcome,
      prompt: job.prompt,
      ...(job.assetClass ? { assetClass: job.assetClass } : {}),
    });
  }
  return out;
}

/** The characters UE asset names (and the plan route) accept. */
export const ASSET_NAME_RE = /^[A-Za-z0-9_]{1,64}$/;

const MAX_NAME = 40;
const ARTICLES = new Set(['a', 'an', 'the', 'of']);

function pascalWords(text: string): string[] {
  return text
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w && !ARTICLES.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Whole words, up to the length budget — never a word cut in half. */
function fit(words: string[], budget: number): string {
  let s = '';
  for (const w of words) {
    if (s.length + w.length > budget) break;
    s += w;
  }
  return s || (words[0] ?? '').slice(0, budget);
}

/** A tiny stable hash, so a nameless mesh still gets its OWN name, never a shared one. */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}

/**
 * An `SM_` asset name for a delivery: the prompt's subject (the text before its first comma —
 * "…, game ready" is a style tail, not a name), else the file's basename. `[A-Za-z0-9_]`, at
 * most 40 chars, and never the importer's shared `TripoSRMesh`. Pure.
 */
export function suggestedAssetName(src: { prompt: string; glbPath: string }): string {
  const budget = MAX_NAME - 'SM_'.length;
  const subject = fit(pascalWords(src.prompt.split(',')[0] ?? ''), budget);
  if (subject) return `SM_${subject}`;
  const base = src.glbPath.replace(/\\/g, '/').split('/').pop()?.replace(GLB, '') ?? '';
  const fromFile = fit(pascalWords(base), budget);
  if (fromFile && fromFile.toLowerCase() !== 'triposrmesh') return `SM_${fromFile}`;
  return `SM_Mesh_${shortHash(src.glbPath)}`;
}
