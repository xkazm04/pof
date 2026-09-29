import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { DIABLO1_PORT_LAWS, PORT_QUALIFICATIONS_DATA } from '@/lib/catalog/reference/portQualificationsData';

describe('pinned-port companion laws', () => {
  it('are in the diablo1 canon, unique, and within the law length cap', () => {
    const ids = new Set(DIABLO1_CANON.map((rule) => rule.id));
    expect(DIABLO1_CANON.filter((rule) => rule.id.startsWith('d1-port-'))).toHaveLength(DIABLO1_PORT_LAWS.length);
    expect(new Set(DIABLO1_PORT_LAWS.map((law) => law.id)).size).toBe(DIABLO1_PORT_LAWS.length);
    for (const law of DIABLO1_PORT_LAWS) {
      expect(ids.has(law.id)).toBe(true);
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.refs?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('only qualify laws that exist, and never the pinned-port laws themselves', () => {
    const ids = new Set(DIABLO1_CANON.map((rule) => rule.id));
    for (const law of PORT_QUALIFICATIONS_DATA) {
      for (const target of law.qualifies) {
        expect(ids.has(target), `${law.id} qualifies missing ${target}`).toBe(true);
        expect(target.startsWith('d1-port-')).toBe(false);
      }
    }
  });
});
