// @vitest-environment node
/**
 * scan-sweep --challenge (code-quality-evaluation/B): the Asset-Code Oracle joins on
 * ONE identity - the asset's relativePath, the key scan-assets has emitted its edges
 * in since 1ca51326 - so a clean project scores 100 with a connected graph, same-named
 * assets in different folders stay distinct, and every violation carries a stable id
 * `<type>:<subject>` (plus the target for a stale reference) that survives a re-scan.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { POST as scanAssetsPost } from '@/app/api/filesystem/scan-assets/route';
import type { ScannedAsset, AssetDependencyEdge, AssetType } from '@/app/api/filesystem/scan-assets/route';
import type { ScannedClass } from '@/app/api/filesystem/scan-project/route';
import { analyzeConsistency } from '@/lib/asset-code-oracle';

const HERO: ScannedClass = { name: 'AHero', prefix: 'A', headerPath: 'Source/P/Hero.h' };

function asset(relativePath: string, type: AssetType): ScannedAsset {
  const name = path.posix.basename(relativePath).replace(/\.u(asset|map)$/, '');
  return {
    name,
    relativePath,
    fullPath: `/p/Content/${relativePath}`,
    extension: '.uasset',
    type,
    sizeBytes: 1,
    modifiedAt: '2026-09-01T00:00:00.000Z',
  };
}

// ── Case 1: the fixture as the REAL scan-assets route emits it ──────────────

let projectDir = '';
let scanned: { assets: ScannedAsset[]; dependencies: AssetDependencyEdge[] };

beforeAll(async () => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-oracle-'));
  const files = [
    'Env/Rock/SM_Rock', 'Env/Rock/M_Rock', 'Env/Rock/T_Rock_D', 'Env/Rock/T_Rock_N',
    'Chars/SK_Hero', 'Chars/M_Hero', 'Chars/T_Hero_D', 'Chars/BP_Hero',
  ];
  for (const f of files) {
    const full = path.join(projectDir, 'Content', `${f}.uasset`);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'x');
  }
  const res = await scanAssetsPost(new NextRequest('http://localhost/api/filesystem/scan-assets', {
    method: 'POST',
    body: JSON.stringify({ projectPath: projectDir }),
  }));
  const json = await res.json();
  scanned = json.data;
});

afterAll(() => {
  if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('analyzeConsistency - one path identity', () => {
  it('case 1: a clean fixture as scan-assets emits it -> no stale/unreferenced, score 100, 7 connected nodes', () => {
    expect(scanned.assets).toHaveLength(8);
    expect(scanned.dependencies).toHaveLength(5);
    const r = analyzeConsistency([HERO], scanned.assets, scanned.dependencies);
    expect(r.violations.filter((v) => v.type === 'stale-reference')).toHaveLength(0);
    expect(r.violations.filter((v) => v.type === 'unreferenced-asset')).toHaveLength(0);
    expect(r.stats.consistencyScore).toBe(100);
    const connected = r.dependencyGraph.nodes.filter((n) => n.inDegree + n.outDegree > 0);
    expect(connected).toHaveLength(7);
  });

  it('case 2: two SM_Rock in Env/A and Env/B -> two nodes keyed by relativePath, labelled SM_Rock, each with its own edges', () => {
    const assets = [
      asset('Env/A/SM_Rock.uasset', 'mesh'),
      asset('Env/A/M_Stone.uasset', 'material'),
      asset('Env/B/SM_Rock.uasset', 'mesh'),
      asset('Env/B/M_Moss.uasset', 'material'),
      asset('Env/B/M_Lichen.uasset', 'material'),
    ];
    const edges: AssetDependencyEdge[] = [
      { from: 'Env/A/SM_Rock.uasset', to: 'Env/A/M_Stone.uasset', relation: 'uses-material' },
      { from: 'Env/B/SM_Rock.uasset', to: 'Env/B/M_Moss.uasset', relation: 'uses-material' },
      { from: 'Env/B/SM_Rock.uasset', to: 'Env/B/M_Lichen.uasset', relation: 'uses-material' },
    ];
    const r = analyzeConsistency([], assets, edges);
    const rocks = r.dependencyGraph.nodes.filter((n) => n.label === 'SM_Rock');
    expect(rocks.map((n) => n.id).sort()).toEqual(['Env/A/SM_Rock.uasset', 'Env/B/SM_Rock.uasset']);
    expect(rocks.find((n) => n.id === 'Env/A/SM_Rock.uasset')!.outDegree).toBe(1);
    expect(rocks.find((n) => n.id === 'Env/B/SM_Rock.uasset')!.outDegree).toBe(2);
    expect(r.violations.filter((v) => v.type === 'stale-reference')).toHaveLength(0);
  });

  it('case 3: violation ids are stable across input order and read <type>:<subject>', () => {
    const assets = [
      asset('Chars/BP_Old.uasset', 'blueprint'),
      asset('Env/X_Foo.uasset', 'mesh'),
      asset('Env/SM_Lone.uasset', 'mesh'),
      asset('Env/SM_Rock.uasset', 'mesh'),
    ];
    const edges: AssetDependencyEdge[] = [
      // two stale references from ONE asset to different missing targets
      { from: 'Env/SM_Rock.uasset', to: 'Env/M_Gone.uasset', relation: 'uses-material' },
      { from: 'Env/SM_Rock.uasset', to: 'Env/M_Lost.uasset', relation: 'uses-material' },
    ];
    const classes: ScannedClass[] = [{ name: 'AEnemy', prefix: 'A', headerPath: 'Source/P/Enemy.h' }];
    const a = analyzeConsistency(classes, assets, edges);
    const b = analyzeConsistency(classes, [...assets].reverse(), [...edges].reverse());
    const idsA = a.violations.map((v) => v.id);
    expect(new Set(idsA).size).toBe(idsA.length);
    expect([...idsA].sort()).toEqual(b.violations.map((v) => v.id).sort());
    expect(idsA).toEqual(expect.arrayContaining([
      'orphaned-asset:Chars/BP_Old.uasset',
      'missing-asset:AEnemy',
      'naming-mismatch:Env/X_Foo.uasset',
      'unreferenced-asset:Env/SM_Lone.uasset',
    ]));
    const stale = idsA.filter((id) => id.startsWith('stale-reference:'));
    expect(stale).toHaveLength(2);
    for (const id of stale) expect(id.startsWith('stale-reference:Env/SM_Rock.uasset')).toBe(true);
    for (const v of a.violations) {
      expect(v.id).toMatch(new RegExp(`^${v.type}:`));
      expect(v.id).not.toMatch(/^v-\d+$/);
    }
  });

  it('[guard] case 8: orphaned BP, missing BP, and a mesh with the texture prefix are still reported', () => {
    const assets = [
      asset('Chars/BP_Wizard.uasset', 'blueprint'),
      asset('Env/T_Boulder.uasset', 'mesh'),
    ];
    const classes: ScannedClass[] = [{ name: 'AGoblin', prefix: 'A', headerPath: 'Source/P/Goblin.h' }];
    const r = analyzeConsistency(classes, assets, []);
    const types = r.violations.map((v) => v.type);
    expect(types).toContain('orphaned-asset');
    expect(types).toContain('missing-asset');
    expect(types).toContain('naming-mismatch');
  });
});
