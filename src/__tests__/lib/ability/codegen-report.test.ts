import { describe, it, expect } from 'vitest';
import { parseCodegenReport, codegenSummary } from '@/lib/ability/codegen-report';

const NOW = () => '2026-07-29T00:00:00.000Z';

const GOOD = {
  filesWritten: ['Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_Fireball_FireStrike.h'],
  buildOk: true,
  seedRan: true,
  dataTableRows: 3,
  missingTags: [],
};

describe('parseCodegenReport', () => {
  it('confirms a complete run and stamps it', () => {
    const r = parseCodegenReport(GOOD, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBe('confirmed');
    expect(r.data.dataTableRows).toBe(3);
    expect(r.data.reportedAt).toBe(NOW());
    expect(r.data.reason).toBeUndefined();
  });

  it('derives failure (with a reason) even when the agent claims nothing is wrong', () => {
    const r = parseCodegenReport({ ...GOOD, seedRan: false, dataTableRows: 0 }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.status).toBe('failed');
    expect(r.data.reason).toContain('seeder did not run');
    expect(r.data.reason).toContain('0 rows');
  });

  it('fails an empty file list', () => {
    const r = parseCodegenReport({ ...GOOD, filesWritten: [] }, NOW);
    expect(r.ok && r.data.status).toBe('failed');
    expect(r.ok && r.data.reason).toContain('no files were written');
  });

  it('keeps the agent-reported reason on a failure', () => {
    const r = parseCodegenReport({ ...GOOD, buildOk: false, reason: 'LNK2019 in GA_Gen_Fireball.cpp' }, NOW);
    expect(r.ok && r.data.reason).toBe('LNK2019 in GA_Gen_Fireball.cpp');
  });

  it('rejects malformed LLM payloads instead of casting them', () => {
    expect(parseCodegenReport({ ...GOOD, filesWritten: 'a.cpp' }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, filesWritten: [1, 2] }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, buildOk: 'yes' }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, seedRan: undefined }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, dataTableRows: -1 }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, dataTableRows: 'three' }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, missingTags: [{}] }).ok).toBe(false);
    expect(parseCodegenReport({ ...GOOD, reason: 5 }).ok).toBe(false);
  });

  it('treats an absent row count as unproven, not as success', () => {
    const r = parseCodegenReport({ ...GOOD, dataTableRows: null }, NOW);
    expect(r.ok && r.data.status).toBe('failed');
    expect(r.ok && r.data.reason).toContain('no DataTable row count');
  });
});

describe('codegenSummary', () => {
  it('summarizes a confirmed run', () => {
    const r = parseCodegenReport(GOOD, NOW);
    expect(r.ok && codegenSummary(r.data)).toBe('1 file written · built · DT_GeneratedAbilities seeded (3 rows)');
  });

  it('surfaces the reason for a failed run', () => {
    const r = parseCodegenReport({ ...GOOD, buildOk: false, reason: 'build broke' }, NOW);
    expect(r.ok && codegenSummary(r.data)).toBe('build broke');
  });
});
