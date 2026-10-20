import { describe, it, expect, afterEach } from 'vitest';
import { proposalEnvelope, issueRefineDirection, runIssueNote } from '@/lib/one-shot/proposal-issues';
import { createProposalPhases, type PostJson } from '@/lib/one-shot/proposalPhases';
import { useOneShotJobStore, type OneShotProposal } from '@/stores/oneShotJobStore';
import type { CatalogDistribution } from '@/lib/catalog/gap-analysis';

describe('proposalEnvelope', () => {
  it('returns {name, data, rationale, issues}', () => {
    const env = proposalEnvelope(
      { name: 'Iron Hatchet', data: { type: 'Weapon', rarity: 'Common' }, rationale: 'why' },
      { catalogId: 'items', resolveLink: () => true },
    );
    expect(env).toEqual({ name: 'Iron Hatchet', data: { type: 'Weapon', rarity: 'Common' }, rationale: 'why', issues: [] });
  });

  it('a callback missing its name yields a name issue', () => {
    const env = proposalEnvelope({ data: { type: 'Weapon', rarity: 'Common' } }, { catalogId: 'items', resolveLink: () => true });
    expect(env.name).toBe('');
    expect(env.rationale).toBe('');
    expect(env.issues.map((i) => i.field)).toContain('name');
  });
});

describe('issueRefineDirection', () => {
  it('is null for none', () => {
    expect(issueRefineDirection([])).toBeNull();
    expect(issueRefineDirection(undefined)).toBeNull();
  });

  it('lists each field: message and says to keep the rest unchanged', () => {
    const d = issueRefineDirection([
      { field: 'rarity', message: 'rarity must be one of Common' },
      { field: 'type', message: "required field 'type' is missing" },
    ]);
    expect(d).toContain('rarity: rarity must be one of Common');
    expect(d).toContain("type: required field 'type' is missing");
    expect(d).toMatch(/unchanged/i);
  });
});

describe('runIssueNote', () => {
  const base: OneShotProposal = { name: 'n', data: {}, rationale: 'r' };
  it('counts issues', () => {
    expect(runIssueNote({ ...base, issues: [{ field: 'a', message: 'm' }, { field: 'b', message: 'm' }] })).toBe(' · 2 issues');
    expect(runIssueNote({ ...base, issues: [{ field: 'a', message: 'm' }] })).toBe(' · 1 issue');
  });
  it('is empty with none or a persisted proposal lacking the field', () => {
    expect(runIssueNote({ ...base, issues: [] })).toBe('');
    expect(runIssueNote(base)).toBe('');
  });
});

describe('store keeps issues', () => {
  const D = { catalogId: 'items', total: 0, byAttribute: {}, underrepresented: [], sample: [] } as unknown as CatalogDistribution;
  afterEach(() => useOneShotJobStore.getState().reset());

  it('propose stores issues; a following refine replaces them', async () => {
    const issues = [{ field: 'rarity', message: 'bad' }];
    const replies: OneShotProposal[] = [
      { name: 'a', data: {}, rationale: 'r', issues },
      { name: 'a', data: {}, rationale: 'r', issues: [] },
    ];
    const postJson = (async () => replies.shift()) as unknown as PostJson;
    const phases = createProposalPhases(postJson);
    useOneShotJobStore.setState({ phase: 'analyzed', catalogId: 'items', distribution: D });
    await phases.proposeFor(null);
    expect(useOneShotJobStore.getState().proposal?.issues).toEqual(issues);
    await phases.refine('fix it');
    expect(useOneShotJobStore.getState().proposal?.issues).toEqual([]);
  });
});
