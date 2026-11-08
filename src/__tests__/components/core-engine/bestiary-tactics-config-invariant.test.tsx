import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TACTICS_CONFIG, TACTICS_ENEMIES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { TacticsLegend } from '@/components/modules/core-engine/sub_bestiary/encounters/EncountersSubparts';

afterEach(cleanup);

describe('tactics config agrees with the tactics map data', () => {
  it('attackers never exceed MaxSimultaneous', () => {
    const attackers = TACTICS_ENEMIES.filter(e => e.role === 'attacking').length;
    expect(attackers).toBeLessThanOrEqual(TACTICS_CONFIG.maxSimultaneous);
  });

  it('a flanker exists iff FlankingEnabled', () => {
    const flankers = TACTICS_ENEMIES.filter(e => e.role === 'flanking').length;
    expect(flankers > 0).toBe(TACTICS_CONFIG.flankingEnabled);
  });

  it('the legend chips render the config values', () => {
    const { container } = render(<TacticsLegend />);
    const text = container.textContent ?? '';
    expect(text).toContain(`${TACTICS_CONFIG.maxSimultaneous}MaxSimultaneous`);
    expect(text).toContain(`${TACTICS_CONFIG.flankingEnabled}FlankingEnabled`);
  });
});
