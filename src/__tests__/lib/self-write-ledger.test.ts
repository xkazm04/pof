import { describe, it, expect, beforeEach } from 'vitest';
import {
  claimSelfWrite,
  consumeSelfWrite,
  clearSelfWrites,
  pendingClaimCount,
} from '@/lib/self-write-ledger';

const P = 'C:/tmp/project/Source/PoF/AThing.h';

describe('self-write ledger', () => {
  beforeEach(() => clearSelfWrites());

  it('matches a claim whose bytes are still ours', () => {
    claimSelfWrite(P, 'ours');
    expect(consumeSelfWrite(P, 'ours')).toBe(true);
  });

  // PC3 — the filter is content-matched, not a mute button on a path.
  it('does not match when the bytes on disk are somebody else\'s', () => {
    claimSelfWrite(P, 'ours');
    expect(consumeSelfWrite(P, 'theirs')).toBe(false);
    // and the claim survives, because our write may still be landing
    expect(pendingClaimCount()).toBe(1);
  });

  it('consumes the claim on the first match, so the next change is foreign', () => {
    claimSelfWrite(P, 'ours');
    expect(consumeSelfWrite(P, 'ours')).toBe(true);
    expect(consumeSelfWrite(P, 'ours')).toBe(false);
    expect(pendingClaimCount()).toBe(0);
  });

  it('does not match an unreadable file — we cannot show the bytes are ours', () => {
    claimSelfWrite(P, 'ours');
    expect(consumeSelfWrite(P, null)).toBe(false);
  });

  it('never matches a path nobody claimed', () => {
    expect(consumeSelfWrite(P, 'anything')).toBe(false);
  });

  it('normalizes separators and case, so one write is one claim', () => {
    claimSelfWrite('C:\\tmp\\project\\Source\\PoF\\AThing.h', 'ours');
    expect(consumeSelfWrite('C:/tmp/project/Source/pof/AThing.h', 'ours')).toBe(true);
  });
});
