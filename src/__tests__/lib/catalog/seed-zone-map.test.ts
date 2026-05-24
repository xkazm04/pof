import { describe, it, expect } from 'vitest';
import { zoneToEntry, seedZoneEntries } from '@/lib/catalog/seed-zone-map';
import { ZONES } from '@/components/modules/core-engine/sub_world/_shared/data';

describe('zoneToEntry', () => {
  const z0 = ZONES[0];
  it('prefixes id, keeps displayName as name + data', () => {
    const e = zoneToEntry(z0);
    expect(e.id).toBe(`zone-${z0.id}`);
    expect(e.name).toBe(z0.displayName);
    expect(e.data).toBe(z0);
    expect(e.catalogId).toBe('zone-map');
    expect(e.lifecycle).toBe('planned');
  });
  it('derives categoryPath = [Zones, group, type] and tags = [type, status]', () => {
    const e = zoneToEntry(z0);
    expect(e.categoryPath).toEqual(['Zones', z0.group, z0.type]);
    expect(e.tags).toEqual([z0.type, z0.status]);
  });
});

describe('seedZoneEntries', () => {
  it('maps every zone with unique ids', () => {
    const entries = seedZoneEntries();
    expect(entries.length).toBe(ZONES.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
