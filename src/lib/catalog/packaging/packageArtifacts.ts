/**
 * Packaging truth engine — turn a row's sibling artifacts into a REAL package:
 * referenced files verified (stat + sha1) in place, embedded data-URLs materialized as
 * files under `generated/packages/<catalogId>/<entityId>/`, and a `manifest.json` that
 * describes exactly what exists — with `missing[]` for every reference that doesn't
 * (never silently dropped). The manifest is what `packagingVerify` grades: acceptance
 * derives from disk truth, not from the produce payload.
 *
 * fs/crypto resolve via `process.getBuiltinModule` (the `staticVerify` lesson: works in
 * Node CJS+ESM and vitest-jsdom, stays out of the client bundle) and are injectable for
 * tests via `PackagingFsDeps`.
 */
import type { SiblingArtifact } from './collect';
import { collectPackageInputs } from './collect';

export interface ManifestFile {
  /** Package-relative name (materialized) or the original reference (referenced). */
  name: string;
  sourceStep: string;
  origin: 'referenced' | 'materialized';
  /** Where the bytes actually live on disk. */
  path: string;
  bytes: number;
  sha1: string;
}

export interface ManifestMissing {
  path: string;
  sourceStep: string;
  reason: string;
}

export interface PackageManifest {
  catalogId: string;
  entityId: string;
  packagedAt: string;
  files: ManifestFile[];
  missing: ManifestMissing[];
  /** UE-side asset names declared by siblings — realized/verified by the L3 gates, listed for transparency. */
  ueDeclarations: string[];
}

export interface PackagingFsDeps {
  exists: (path: string) => boolean;
  readFile: (path: string) => Buffer;
  writeFile: (path: string, content: Buffer | string) => void;
  mkdir: (dir: string) => void;
  /** Root for materialized packages (default `generated/packages`). */
  packagesRoot: string;
  now: () => string;
}

function builtin<T>(id: string): T {
  const proc = globalThis as unknown as { process?: { getBuiltinModule?: <M>(i: string) => M } };
  const get = proc.process?.getBuiltinModule;
  if (!get) throw new Error('packaging engine is server-only (no Node runtime detected)');
  return get<T>(id);
}

function sha1Hex(buf: Buffer): string {
  const crypto = builtin<{ createHash: (a: string) => { update: (b: Buffer) => { digest: (e: string) => string } } }>('node:crypto');
  return crypto.createHash('sha1').update(buf).digest('hex');
}

/** Build (or rebuild — idempotent) the package for one row from its sibling artifacts. */
export function buildPackage(
  catalogId: string,
  entityId: string,
  siblings: SiblingArtifact[],
  deps: PackagingFsDeps,
): PackageManifest {
  const inputs = collectPackageInputs(siblings);
  const pkgDir = `${deps.packagesRoot}/${catalogId}/${entityId}`;
  deps.mkdir(pkgDir);

  const files: ManifestFile[] = [];
  const missing: ManifestMissing[] = [];

  for (const ref of inputs.files) {
    if (!deps.exists(ref.path)) {
      missing.push({ path: ref.path, sourceStep: ref.sourceStep, reason: 'referenced file not found on disk' });
      continue;
    }
    const buf = deps.readFile(ref.path);
    if (buf.length === 0) {
      missing.push({ path: ref.path, sourceStep: ref.sourceStep, reason: 'referenced file is empty (0 bytes)' });
      continue;
    }
    files.push({ name: ref.path, sourceStep: ref.sourceStep, origin: 'referenced', path: ref.path, bytes: buf.length, sha1: sha1Hex(buf) });
  }

  for (const d of inputs.dataUrls) {
    const buf = Buffer.from(d.base64, 'base64');
    if (buf.length === 0) {
      missing.push({ path: d.name, sourceStep: d.sourceStep, reason: 'embedded data-URL decoded to 0 bytes' });
      continue;
    }
    const path = `${pkgDir}/${d.name}`;
    deps.writeFile(path, buf);
    files.push({ name: d.name, sourceStep: d.sourceStep, origin: 'materialized', path, bytes: buf.length, sha1: sha1Hex(buf) });
  }

  const manifest: PackageManifest = {
    catalogId,
    entityId,
    packagedAt: deps.now(),
    files,
    missing,
    ueDeclarations: inputs.ueDeclarations,
  };
  deps.writeFile(`${pkgDir}/manifest.json`, JSON.stringify(manifest, null, 2));
  return manifest;
}

/** Real-filesystem deps rooted at the app cwd. Server-only. */
export function defaultPackagingFsDeps(): PackagingFsDeps {
  type NodeFs = {
    existsSync: (p: string) => boolean;
    readFileSync: (p: string) => Buffer;
    writeFileSync: (p: string, c: Buffer | string) => void;
    mkdirSync: (p: string, o: { recursive: boolean }) => void;
  };
  type NodePath = { join: (...parts: string[]) => string; isAbsolute: (p: string) => boolean };
  const fs = builtin<NodeFs>('node:fs');
  const path = builtin<NodePath>('node:path');
  const cwd = (globalThis as unknown as { process: { cwd: () => string } }).process.cwd();
  const abs = (p: string) => (path.isAbsolute(p) ? p : path.join(cwd, p));
  return {
    exists: (p) => fs.existsSync(abs(p)),
    readFile: (p) => fs.readFileSync(abs(p)),
    writeFile: (p, c) => fs.writeFileSync(abs(p), c),
    mkdir: (p) => fs.mkdirSync(abs(p), { recursive: true }),
    packagesRoot: 'generated/packages',
    now: () => new Date().toISOString(),
  };
}
