import { describe, it, expect } from 'vitest';
import { packageLedger, type LedgerSibling } from '@/lib/catalog/packaging/packageLedger';
import type { ManifestFile } from '@/lib/catalog/packaging/packageArtifacts';

const ORDER = ['Concept 2D Art', '3D Mesh', 'UE Packaging'];
const file = (sourceStep: string, name = `generated/${sourceStep}.png`): ManifestFile => ({
  name, sourceStep, origin: 'referenced', path: name, bytes: 10, sha1: 'abc',
});
const pass = (step: string): LedgerSibling => ({ step, status: 'pass', source: 'checker' });

describe('packageLedger — blockers by owing step', () => {
  it('a missing file names the sibling that owes it (kind, count, reason) and blocks the package', () => {
    const ledger = packageLedger(
      {
        files: [file('Concept 2D Art')],
        missing: [{ path: 'generated/meshes/g.glb', sourceStep: '3D Mesh', reason: 'referenced file not found on disk' }],
        ueDeclarations: [],
      },
      [pass('Concept 2D Art'), pass('3D Mesh')],
      ORDER,
    );
    expect(ledger.state).toBe('blocked');
    expect(ledger.blockers).toEqual([{ step: '3D Mesh', kind: 'missing-file', count: 1, reason: 'referenced file not found on disk' }]);
    expect(ledger.unverified).toEqual([]);
  });

  it('a staged file whose own step is TEMPLATE-held is unverified content and blocks, though the disk half passes', () => {
    const ledger = packageLedger(
      { files: [file('Concept 2D Art')], missing: [], ueDeclarations: [] },
      [{ step: 'Concept 2D Art', status: 'pending', source: 'checker', reason: 'TEMPLATE: written for the exemplar' }, pass('3D Mesh')],
      ORDER,
    );
    expect(ledger.unverified).toHaveLength(1);
    expect(ledger.unverified[0]).toMatchObject({ step: 'Concept 2D Art', status: 'pending', files: 1 });
    expect(ledger.unverified[0].reason?.startsWith('TEMPLATE:')).toBe(true);
    expect(ledger.blockers).toEqual([]);
    expect(ledger.state).toBe('blocked');
  });

  it('unrealized /Game declarations are one blocker each; unchecked ones (no UE root) never block', () => {
    const unrealized = packageLedger(
      {
        files: [file('Concept 2D Art')], missing: [],
        ueDeclarations: [{ path: '/Game/Data/DT_Affixes', realized: false }, { path: '/Game/Effects/GE_X', realized: false }],
      },
      [pass('Concept 2D Art')], ORDER, { '/Game/Effects/GE_X': '3D Mesh' },
    );
    const decl = unrealized.blockers.filter((b) => b.kind === 'unrealized-declaration');
    expect(decl).toHaveLength(2);
    expect(decl.find((b) => b.reason.includes('GE_X'))?.step).toBe('3D Mesh');
    expect(unrealized.state).toBe('blocked');

    const unchecked = packageLedger(
      {
        files: [file('Concept 2D Art')], missing: [],
        ueDeclarations: [{ path: '/Game/Data/DT_Affixes', realized: null }, { path: '/Game/Effects/GE_X', realized: null }],
      },
      [pass('Concept 2D Art')], ORDER,
    );
    expect(unchecked.declarations).toBe('unchecked (no UE root)');
    expect(unchecked.blockers.some((b) => b.kind === 'unrealized-declaration')).toBe(false);
    expect(unchecked.state).toBe('ready');
  });

  it('an empty package (no files, nothing missing) is the declarations-only deferral', () => {
    const ledger = packageLedger({ files: [], missing: [], ueDeclarations: [] }, [pass('3D Mesh')], ORDER);
    expect(ledger.state).toBe('declarations-only');
    expect(ledger.blockers).toEqual([]);
  });

  it('blockers follow pipeline order, whatever order the manifest listed them in', () => {
    const ledger = packageLedger(
      {
        files: [],
        missing: [
          { path: 'generated/meshes/g.glb', sourceStep: '3D Mesh', reason: 'referenced file not found on disk' },
          { path: 'generated/a.png', sourceStep: 'Concept 2D Art', reason: 'referenced file is empty (0 bytes)' },
          { path: 'generated/meshes/h.glb', sourceStep: '3D Mesh', reason: 'referenced file not found on disk' },
        ],
        ueDeclarations: [],
      },
      [pass('Concept 2D Art'), pass('3D Mesh')], ORDER,
    );
    expect(ledger.blockers.map((b) => [b.step, b.count])).toEqual([['Concept 2D Art', 1], ['3D Mesh', 2]]);
  });
});
