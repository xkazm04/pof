import { describe, it, expect } from 'vitest';
import { artifactUpsertSchema } from '@/lib/catalog/artifact-validation';

describe('artifactUpsertSchema', () => {
  it('accepts a valid upsert', () => {
    const r = artifactUpsertSchema.safeParse({
      catalogId: 'items', entityId: 'item-1', step: 'Attributes',
      data: { stats: { Damage: 34 } }, ueAssets: ['/Game/X'], status: 'pass', tier: 'L0',
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown status', () => {
    const r = artifactUpsertSchema.safeParse({ catalogId: 'items', entityId: 'i', step: 'X', status: 'green' });
    expect(r.success).toBe(false);
  });
  it('defaults data/ueAssets when omitted', () => {
    const r = artifactUpsertSchema.safeParse({ catalogId: 'items', entityId: 'i', step: 'X', status: 'deferred' });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.data).toEqual({}); expect(r.data.ueAssets).toEqual([]); }
  });
});
