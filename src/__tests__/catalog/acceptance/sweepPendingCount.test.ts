import { describe, it, expect } from 'vitest';
import { verifyStaticAll } from '@/lib/catalog/acceptance/staticVerify';
import { verifyPackagingAll } from '@/lib/catalog/acceptance/packagingVerify';
import { drainPythonAll } from '@/lib/catalog/acceptance/pythonDrain';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';
import type { PackageManifest } from '@/lib/catalog/packaging/packageArtifacts';

// Since foldContentHold, a sweep can store `pending` (a content hold outranks a static/package
// pass), and a python module can return fewer artifacts than expected (pending). Every graded row
// must land in exactly one bucket, or the summary under-reports what it wrote.

const pass: AcceptanceResult = { label: 'x', tier: 'L2', status: 'pass', detail: 'ok' };
const held: AcceptanceResult = { label: 'x', tier: 'L0', status: 'pending', detail: 'missing', reason: 'field "a" missing: b' };
const row = { catalogId: 'c', entityId: 'e', step: 's', status: 'pass' };

describe('sweep summaries count a pending outcome', () => {
  it('verifyStaticAll: verified = passed + pending + deferred + failed', () => {
    const s = verifyStaticAll({}, {
      resolveUeRoot: () => 'C:/ue',
      listArtifacts: () => [row],
      getStaticChecks: () => [() => pass],
      upsertStatus: () => {},
      getContentVerdict: () => held,
    }, { apply: false });
    expect(s.results[0].to).toBe('pending');
    expect(s.pending).toBe(1);
    expect(s.passed + s.pending + s.deferred + s.failed).toBe(s.verified);
  });

  it('verifyPackagingAll: verified = passed + pending + deferred + failed', () => {
    const manifest: PackageManifest = { catalogId: 'c', entityId: 'e', packagedAt: 't', files: [{ name: 'a.png', sourceStep: 'x', origin: 'referenced', path: 'a.png', bytes: 1, sha1: 'h' }], missing: [], ueDeclarations: [] };
    const s = verifyPackagingAll({}, {
      listArtifacts: () => [row],
      isPackaging: () => true,
      getSiblings: () => [],
      build: () => manifest,
      upsertStatus: () => {},
      getContentVerdict: () => held,
    }, { apply: false });
    expect(s.results[0].to).toBe('pending');
    expect(s.pending).toBe(1);
    expect(s.passed + s.pending + s.deferred + s.failed).toBe(s.verified);
  });

  it('drainPythonAll: dispatched = passed + pending + stillDeferred + failed', async () => {
    const s = await drainPythonAll({}, {
      listArtifacts: () => [{ ...row, status: 'deferred', data: { python: { module: 'm', function: 'f' } } }],
      stepOrder: () => ['s'],
      run: async () => ({ ok: true, data: { created: [], skipped: [], failed: [] } }),
      grade: () => held,
      save: () => {},
    }, { apply: false });
    expect(s.pending).toBe(1);
    expect(s.passed + s.pending + s.stillDeferred + s.failed).toBe(s.dispatched);
  });
});
