import { describe, it, expect } from 'vitest';
import { CONFLICT_LEVEL_LABELS, lookupJargon } from '@/lib/blueprint-jargon';
import { computeSemanticDiff } from '@/lib/blueprint-semantic-diff';
import type { BlueprintAsset } from '@/types/blueprint';

// The semantic diff files a C++-only member (`remove`) as `compatible`, and a
// whole-file Write to Project DELETES it (the overwrite review exists for that).
// The `compatible` decoder still said "no manual decision needed / safe to
// apply automatically" — the same overclaim d91c776c removed from `none`.

const asset: BlueprintAsset = {
  className: 'BP_Hero', parentClass: 'AActor', variables: [], functions: [],
  eventGraph: { name: 'EventGraph', graphType: 'event', nodes: [] },
};
const handWritten = `UCLASS()
class AHero : public AActor
{
  GENERATED_BODY()
public:
  UFUNCTION(Server, Reliable)
  void ServerFire();
};`;

describe('the "compatible" conflict-level decoder', () => {
  it('a C++-only member is classified compatible (the premise)', () => {
    const diff = computeSemanticDiff(asset, handWritten, 'Game', 0);
    expect(diff.overallConflict).toBe('compatible');
    expect(diff.changes.some((c) => c.type === 'remove' && c.name === 'ServerFire')).toBe(true);
  });

  it('does not promise that applying is safe or needs no decision', () => {
    const entry = CONFLICT_LEVEL_LABELS.compatible;
    const text = `${entry.plain} ${entry.whyItMatters ?? ''}`;
    expect(text).not.toMatch(/no manual decision/i);
    expect(text).not.toMatch(/safe to apply automatically/i);
    expect(text).toMatch(/C\+\+-only/);
    expect(lookupJargon('compatible')).toBe(entry);
  });
});
