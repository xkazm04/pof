import { describe, it, expect, vi } from 'vitest';
import {
  aggregatePackaging,
  verifyPackagingAll,
  isPackagingStep,
  type PackagingVerifyDeps,
} from '@/lib/catalog/acceptance/packagingVerify';
import type { PackageManifest } from '@/lib/catalog/packaging/packageArtifacts';

const manifest = (over: Partial<PackageManifest>): PackageManifest => ({
  catalogId: 'items',
  entityId: 'rusted-blade',
  packagedAt: 't',
  files: [],
  missing: [],
  ueDeclarations: [],
  ...over,
});

const file = { name: 'a.glb', sourceStep: '3D Model', origin: 'referenced' as const, path: 'generated/a.glb', bytes: 10, sha1: 'x' };

describe('aggregatePackaging', () => {
  it('all references staged + hashed → L2 pass', () => {
    const r = aggregatePackaging(manifest({ files: [file, { ...file, name: 'b.jpg' }] }), 'UE Packaging');
    expect(r).toMatchObject({ tier: 'L2', status: 'pass' });
    expect(r.detail).toMatch(/2 real files/i);
  });

  it('missing references → deferred with the missing paths as the reason (never fail)', () => {
    const r = aggregatePackaging(
      manifest({ files: [file], missing: [{ path: 'generated/missing.wav', sourceStep: 'Audio', reason: 'referenced file not found on disk' }] }),
      'UE Packaging',
    );
    expect(r.status).toBe('deferred');
    expect(r.reason).toContain('generated/missing.wav');
  });

  it('nothing collectible → deferred "declarations only", naming the UE-side count', () => {
    const r = aggregatePackaging(manifest({ ueDeclarations: ['/Game/A', '/Game/B'] }), 'UE Packaging');
    expect(r.status).toBe('deferred');
    expect(r.reason).toMatch(/no packageable file outputs/i);
    expect(r.reason).toMatch(/2 UE asset declaration/);
  });
});

describe('isPackagingStep', () => {
  it('matches the explicit flag and the UE Packaging label fallback', () => {
    expect(isPackagingStep({ packaging: true, label: 'Bundle' })).toBe(true);
    expect(isPackagingStep({ label: 'UE Packaging' })).toBe(true);
    expect(isPackagingStep({ label: 'Economy' })).toBe(false);
  });
});

describe('verifyPackagingAll', () => {
  const mkDeps = (): PackagingVerifyDeps & { upserts: unknown[] } => {
    const upserts: unknown[] = [];
    return {
      upserts,
      listArtifacts: () => [
        { catalogId: 'items', entityId: 'rusted-blade', step: 'UE Packaging', status: 'pass' },
        { catalogId: 'items', entityId: 'rusted-blade', step: 'Economy', status: 'pass' },
      ],
      isPackaging: (catalogId, step) => step === 'UE Packaging',
      getSiblings: vi.fn(() => [{ step: '3D Model', data: { meshPath: 'generated/a.glb' }, ueAssets: [] }]),
      build: vi.fn(() => manifest({ missing: [{ path: 'generated/a.glb', sourceStep: '3D Model', reason: 'referenced file not found on disk' }] })),
      upsertStatus: (catalogId, entityId, step, res) => { upserts.push({ catalogId, entityId, step, res }); },
    };
  };

  it('rebuilds the package for packaging steps only and writes changed verdicts back', () => {
    const deps = mkDeps();
    const summary = verifyPackagingAll({}, deps, { apply: true });
    expect(summary.verified).toBe(1); // Economy skipped
    expect(summary.skipped).toBe(1);
    expect(summary.deferred).toBe(1);
    expect(summary.changed).toBe(1); // pass -> deferred
    expect(deps.upserts).toHaveLength(1);
    expect(summary.results[0]).toMatchObject({ step: 'UE Packaging', from: 'pass', to: 'deferred', changed: true });
  });

  it('dry-run reports the would-be verdicts without writing', () => {
    const deps = mkDeps();
    const summary = verifyPackagingAll({}, deps, { apply: false });
    expect(summary.changed).toBe(0);
    expect(deps.upserts).toHaveLength(0);
    expect(summary.results[0].to).toBe('deferred');
  });
});
