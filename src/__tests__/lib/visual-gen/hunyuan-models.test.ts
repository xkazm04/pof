import { describe, it, expect } from 'vitest';
import {
  hunyuanModelFor,
  HUNYUAN_RUNNING_MODEL,
  HUNYUAN_AUDIT_STATE,
} from '@/lib/visual-gen/hunyuan-models';

describe('hunyuanModelFor', () => {
  it('states the model for every known asset class', () => {
    for (const c of ['character', 'weapon', 'prop', 'environment', 'modular-part']) {
      expect(hunyuanModelFor(c).model).toBe(HUNYUAN_RUNNING_MODEL);
    }
  });

  // The whole point of the module, mirroring `tripoModelFor`: an absent class must not
  // degrade back into an unstated default resolved inside the python script.
  it('still states a model when no asset class is supplied', () => {
    const pin = hunyuanModelFor(undefined);
    expect(pin.model).toBe(HUNYUAN_RUNNING_MODEL);
    expect(pin.rationale).toContain('script default');
  });

  it('never resolves to an empty model id', () => {
    expect(hunyuanModelFor('nonsense-class').model.trim()).not.toBe('');
  });

  // THE honesty guard, and the one place this module deliberately diverges from
  // `tripoModelFor`. Tripo's pin is `audited: true` because an arena graded it PASS.
  // No PoF arena has ever graded a Hunyuan mesh — `generated/hunyuan3d/` holds zero
  // files — so claiming `audited` here would manufacture exactly the false confidence
  // that pinning exists to remove. Stating an unaudited default is the improvement;
  // calling it audited would be a regression wearing the fix's clothes.
  it('never claims the model is audited, and says so in the rationale', () => {
    for (const c of ['character', 'weapon', undefined]) {
      const pin = hunyuanModelFor(c);
      expect(pin.audited).toBe(false);
      expect(pin.rationale.toLowerCase()).toContain('never been graded');
    }
  });

  it('records the zero-mesh observation that keeps `audited` false', () => {
    expect(HUNYUAN_AUDIT_STATE.arenaRuns).toBe(0);
    expect(HUNYUAN_AUDIT_STATE.gradedMeshes).toBe(0);
    expect(HUNYUAN_AUDIT_STATE.verdict).toBe('unaudited');
  });
});
