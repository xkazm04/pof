import {
  ZONES,
  type ZoneRecord,
} from '@/components/modules/core-engine/unique-tabs/ZoneMap/data';
import type { ZoneEntry } from './types';

/** Convert one ZoneRecord into a Zone Map entry. */
export function zoneToEntry(zone: ZoneRecord): ZoneEntry {
  return {
    id: `zone-${zone.id}`,
    catalogId: 'zone-map',
    name: zone.displayName,
    categoryPath: ['Zones', zone.group, zone.type],
    tags: [zone.type, zone.status],
    lifecycle: 'planned',
    data: zone,
  };
}

/** Seed the zone-map catalog from ZONES. */
export function seedZoneEntries(): ZoneEntry[] {
  return ZONES.map(zoneToEntry);
}
