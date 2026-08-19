/**
 * Packaging input collection — the pure core of the packaging truth engine
 * (docs/research/packaging-truth-engine-spec.md). A packaging step must reflect what its
 * SIBLING steps actually produced (the fix-campaign lesson: never invent content), so
 * this walks the sibling artifacts' data for the two kinds of real, verifiable output:
 *
 *  - file references — strings pointing at produced files on disk (generated/ paths or
 *    absolute paths with a media/data extension). Verified in place by the engine.
 *  - embedded data-URLs — the gap-loop pattern stores generated art INSIDE the artifact
 *    as `url(data:image/...;base64,...)` swatches; these are materialized into the
 *    package as real files.
 *
 * `ueAssets` declarations are collected separately: they are UE-side names whose
 * realization is the L3 gates' job, listed in the manifest for transparency only.
 * Client-safe (no fs/crypto here).
 */
import { safeAssetDir, safeAssetName } from '@/lib/visual-gen/generated-assets';

export interface SiblingArtifact {
  step: string;
  data: Record<string, unknown>;
  ueAssets: string[];
}

export interface FileInput {
  kind: 'file';
  sourceStep: string;
  path: string;
}

export interface DataUrlInput {
  kind: 'dataUrl';
  sourceStep: string;
  /** Package-relative filename the engine materializes this into. */
  name: string;
  mime: string;
  base64: string;
}

/**
 * A reference that IS a served artifact but whose disk location could not be
 * derived. Reported, never dropped: a package that silently omits a mesh looks
 * identical to one that never had it (the fix-campaign lesson).
 */
export interface UnresolvedInput {
  kind: 'unresolved';
  sourceStep: string;
  /** The reference exactly as the sibling stored it. */
  reference: string;
  reason: string;
}

export interface PackageInputs {
  files: FileInput[];
  dataUrls: DataUrlInput[];
  ueDeclarations: string[];
  /** Served artifacts packaging could not place on disk — surfaced in the manifest's `missing[]`. */
  unresolved: UnresolvedInput[];
}

/** Extensions that mark a string as a produced-file reference (not prose). */
const FILE_EXT = /\.(glb|gltf|fbx|obj|png|jpe?g|webp|gif|wav|mp3|ogg|csv|json|py|umap|uasset)$/i;
/** A file reference is either under generated/ or an absolute path. UE object paths (/Game/...) are declarations, not files. */
const looksLikeFile = (s: string): boolean => {
  if (s.length > 512 || /\s/.test(s)) return false;
  if (!FILE_EXT.test(s)) return false;
  const n = s.replace(/\\/g, '/');
  if (n.startsWith('/Game/')) return false;
  return n.includes('generated/') || /^[A-Za-z]:\//.test(n) || n.startsWith('/');
};

/** `/api/visual-gen/asset/<name>` with an optional query — the mesh serve route. */
const ASSET_URL_RE = /^\/api\/visual-gen\/asset\/([^/?#]+)(?:\?([^#]*))?$/;

/**
 * Resolve an app serve-route URL to its disk location, using the SAME allow-list the
 * route itself resolves with (`safeAssetDir` / `safeAssetName` over `ASSET_DIRS`).
 *
 * The route used to serve only `generated/triposr/`, so this was a one-line mapping.
 * Since every other provider's mesh is served as `?dir=<provider>`, an anchored
 * `([^/?#]+)$` regex stopped matching those URLs — packaging then treated them as prose
 * and DROPPED them, so a row whose selected candidate was a Tripo cloud mesh (or any
 * `generated/meshes/` pipeline mesh) shipped a package silently missing its model.
 *
 * Returns `null` when the string is not an asset URL at all (the overwhelmingly common
 * case), a `path` when it resolves, and a `reason` when it is an asset URL this app
 * could not serve — which is a finding to report, not a string to quietly skip.
 */
function resolveAssetUrl(s: string): { path?: string; reason?: string } | null {
  const m = s.replace(/\\/g, '/').match(ASSET_URL_RE);
  if (!m) return null;
  const [, rawName, query] = m;

  let name: string;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    // Artifact data is untrusted input (SQLite / MCP / headless drains).
    return { reason: `asset URL has an undecodable filename ("${rawName}")` };
  }
  if (!safeAssetName(name)) {
    return { reason: `asset URL names a file the serve route would refuse ("${name}")` };
  }

  const requestedDir = query ? new URLSearchParams(query).get('dir') : null;
  const spec = safeAssetDir(requestedDir);
  if (!spec) {
    return { reason: `asset URL names dir "${requestedDir}", which is not in the generated-asset allow-list` };
  }
  return { path: `generated/${spec.dir}/${name}` };
}

const DATA_URL = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'model/gltf-binary': 'glb',
};

const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Walk one artifact's data, feeding every string to the two collectors. */
function walkStrings(value: unknown, onString: (s: string) => void): void {
  if (typeof value === 'string') { onString(value); return; }
  if (Array.isArray(value)) { for (const v of value) walkStrings(v, onString); return; }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) walkStrings(v, onString);
  }
}

/** Collect everything packageable from the packaging step's sibling artifacts. Pure. */
export function collectPackageInputs(siblings: SiblingArtifact[]): PackageInputs {
  const files: FileInput[] = [];
  const dataUrls: DataUrlInput[] = [];
  const seenFiles = new Set<string>();
  const seenDataUrls = new Set<string>();
  const ueDeclarations: string[] = [];
  const seenDecls = new Set<string>();
  const unresolved: UnresolvedInput[] = [];
  const seenUnresolved = new Set<string>();

  for (const sib of siblings) {
    let dataUrlIndex = 0;
    walkStrings(sib.data, (s) => {
      // data-URLs first — a swatch string is not a file path.
      let m: RegExpExecArray | null;
      DATA_URL.lastIndex = 0;
      let matched = false;
      while ((m = DATA_URL.exec(s)) !== null) {
        matched = true;
        const [, mime, base64] = m;
        const dedupeKey = base64.slice(0, 64) + base64.length;
        if (seenDataUrls.has(dedupeKey)) continue;
        seenDataUrls.add(dedupeKey);
        const ext = EXT_BY_MIME[mime.toLowerCase()] ?? 'bin';
        dataUrls.push({
          kind: 'dataUrl',
          sourceStep: sib.step,
          name: `${slugify(sib.step)}-${dataUrlIndex++}.${ext}`,
          mime,
          base64,
        });
      }
      if (matched) return;

      const served = resolveAssetUrl(s);
      if (served?.reason) {
        if (seenUnresolved.has(s)) return;
        seenUnresolved.add(s);
        unresolved.push({ kind: 'unresolved', sourceStep: sib.step, reference: s, reason: served.reason });
        return;
      }

      const candidate = served?.path ?? s;
      if (looksLikeFile(candidate)) {
        const key = candidate.replace(/\\/g, '/');
        if (seenFiles.has(key)) return;
        seenFiles.add(key);
        files.push({ kind: 'file', sourceStep: sib.step, path: candidate });
      }
    });

    for (const decl of sib.ueAssets) {
      if (seenDecls.has(decl)) continue;
      seenDecls.add(decl);
      ueDeclarations.push(decl);
    }
  }

  return { files, dataUrls, ueDeclarations, unresolved };
}
